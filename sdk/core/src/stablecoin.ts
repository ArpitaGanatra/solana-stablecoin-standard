import { Program, BN } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  AccountMeta,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMint,
} from "@solana/spl-token";
import type { SssCore } from "./idl";
import {
  StablecoinConfig,
  MinterInfo,
  BlacklistEntry,
  PresetConfig,
  UpdateRolesParams,
} from "./types";
import { findConfigPda, findMinterPda, findBlacklistPda } from "./utils/pda";
import { buildInitializeIx } from "./instructions/initialize";
import { buildMintTokensIx } from "./instructions/mintTokens";
import { buildBurnTokensIx } from "./instructions/burnTokens";
import { buildFreezeAccountIx } from "./instructions/freezeAccount";
import { buildThawAccountIx } from "./instructions/thawAccount";
import { buildPauseIx } from "./instructions/pause";
import { buildUnpauseIx } from "./instructions/unpause";
import { buildAddMinterIx } from "./instructions/addMinter";
import { buildRemoveMinterIx } from "./instructions/removeMinter";
import { buildUpdateMinterIx } from "./instructions/updateMinter";
import { buildUpdateRolesIx } from "./instructions/updateRoles";
import { buildTransferAuthorityIx } from "./instructions/transferAuthority";
import { buildAcceptAuthorityIx } from "./instructions/acceptAuthority";
import { buildCancelAuthorityTransferIx } from "./instructions/cancelAuthorityTransfer";
import { buildBlacklistAddressIx } from "./instructions/blacklistAddress";
import { buildRemoveFromBlacklistIx } from "./instructions/removeFromBlacklist";
import { buildSeizeIx } from "./instructions/seize";

export interface CreateParams {
  program: Program<SssCore>;
  connection: Connection;
  preset?: PresetConfig;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  authority: Keypair;
  enableMetadata?: boolean;
  enablePermanentDelegate?: boolean;
  enableTransferHook?: boolean;
  defaultAccountFrozen?: boolean;
  transferHookProgramId?: PublicKey;
}

export interface LoadParams {
  program: Program<SssCore>;
  connection: Connection;
  mint: PublicKey;
}

export class SolanaStablecoin {
  readonly program: Program<SssCore>;
  readonly connection: Connection;
  readonly mintAddress: PublicKey;
  readonly configPda: PublicKey;
  readonly configBump: number;

  private constructor(
    program: Program<SssCore>,
    connection: Connection,
    mint: PublicKey,
    configPda: PublicKey,
    configBump: number
  ) {
    this.program = program;
    this.connection = connection;
    this.mintAddress = mint;
    this.configPda = configPda;
    this.configBump = configBump;
  }

  /**
   * Initialize a new stablecoin — creates the mint and config PDA on-chain.
   *
   * @example
   * const stable = await SolanaStablecoin.create({
   *   program, connection,
   *   preset: Presets.SSS_2,
   *   name: "My Stablecoin",
   *   symbol: "MYUSD",
   *   uri: "https://...",
   *   decimals: 6,
   *   authority: adminKeypair,
   * });
   */
  static async create(
    params: CreateParams
  ): Promise<{ stablecoin: SolanaStablecoin; mintKeypair: Keypair; txSig: string }> {
    const { program, connection, authority, preset } = params;
    const mintKeypair = Keypair.generate();
    const [configPda, configBump] = findConfigPda(
      mintKeypair.publicKey,
      program.programId
    );

    const txSig = await buildInitializeIx(
      program,
      { authority: authority.publicKey, mint: mintKeypair },
      {
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        decimals: params.decimals,
        enableMetadata: params.enableMetadata,
        enablePermanentDelegate: params.enablePermanentDelegate,
        enableTransferHook: params.enableTransferHook,
        defaultAccountFrozen: params.defaultAccountFrozen,
        transferHookProgramId: params.transferHookProgramId,
      },
      preset
    ).rpc();

    const stablecoin = new SolanaStablecoin(
      program,
      connection,
      mintKeypair.publicKey,
      configPda,
      configBump
    );

    return { stablecoin, mintKeypair, txSig };
  }

  /**
   * Load an existing stablecoin by its mint address.
   *
   * @example
   * const stable = await SolanaStablecoin.load({ program, connection, mint });
   */
  static async load(params: LoadParams): Promise<SolanaStablecoin> {
    const { program, connection, mint } = params;
    const [configPda, configBump] = findConfigPda(mint, program.programId);

    // Verify config exists
    await program.account.stablecoinConfig.fetch(configPda);

    return new SolanaStablecoin(program, connection, mint, configPda, configBump);
  }

  // ── Queries ──

  async getConfig(): Promise<StablecoinConfig> {
    return (await this.program.account.stablecoinConfig.fetch(
      this.configPda
    )) as unknown as StablecoinConfig;
  }

  async getTotalSupply(): Promise<BN> {
    const mintInfo = await getMint(
      this.connection,
      this.mintAddress,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    return new BN(mintInfo.supply.toString());
  }

  async getMinterInfo(minterAddress: PublicKey): Promise<MinterInfo> {
    const [minterPda] = findMinterPda(
      this.configPda,
      minterAddress,
      this.program.programId
    );
    return (await this.program.account.minterInfo.fetch(
      minterPda
    )) as unknown as MinterInfo;
  }

  async getBlacklistEntry(address: PublicKey): Promise<BlacklistEntry | null> {
    const [blacklistPda] = findBlacklistPda(
      this.configPda,
      address,
      this.program.programId
    );
    try {
      return (await this.program.account.blacklistEntry.fetch(
        blacklistPda
      )) as unknown as BlacklistEntry;
    } catch {
      return null;
    }
  }

  async isBlacklisted(address: PublicKey): Promise<boolean> {
    return (await this.getBlacklistEntry(address)) !== null;
  }

  getAta(owner: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(
      this.mintAddress,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  }

  // ── Token Operations ──

  async mint(params: {
    recipient: PublicKey;
    amount: BN;
    minter: PublicKey;
  }): Promise<string> {
    const tokenAccount = this.getAta(params.recipient);
    return buildMintTokensIx(
      this.program,
      { minter: params.minter, mint: this.mintAddress, tokenAccount },
      params.amount
    ).rpc();
  }

  async burn(params: {
    amount: BN;
    burner: PublicKey;
    tokenAccount: PublicKey;
  }): Promise<string> {
    return buildBurnTokensIx(
      this.program,
      { burner: params.burner, mint: this.mintAddress, tokenAccount: params.tokenAccount },
      params.amount
    ).rpc();
  }

  async freeze(tokenAccount: PublicKey, freezer: PublicKey): Promise<string> {
    return buildFreezeAccountIx(this.program, {
      freezer,
      mint: this.mintAddress,
      tokenAccount,
    }).rpc();
  }

  async thaw(tokenAccount: PublicKey, freezer: PublicKey): Promise<string> {
    return buildThawAccountIx(this.program, {
      freezer,
      mint: this.mintAddress,
      tokenAccount,
    }).rpc();
  }

  // ── Pause / Unpause ──

  async pause(pauser: PublicKey): Promise<string> {
    return buildPauseIx(this.program, pauser, this.mintAddress).rpc();
  }

  async unpause(pauser: PublicKey): Promise<string> {
    return buildUnpauseIx(this.program, pauser, this.mintAddress).rpc();
  }

  // ── Minter Management ──

  async addMinter(
    authority: PublicKey,
    minterAddress: PublicKey,
    quota: BN,
    unlimited: boolean = false
  ): Promise<string> {
    return buildAddMinterIx(
      this.program,
      authority,
      this.mintAddress,
      minterAddress,
      quota,
      unlimited
    ).rpc();
  }

  async removeMinter(
    authority: PublicKey,
    minterAddress: PublicKey
  ): Promise<string> {
    return buildRemoveMinterIx(
      this.program,
      authority,
      this.mintAddress,
      minterAddress
    ).rpc();
  }

  async updateMinter(
    authority: PublicKey,
    minterAddress: PublicKey,
    quota: BN,
    active: boolean,
    unlimited: boolean
  ): Promise<string> {
    return buildUpdateMinterIx(
      this.program,
      authority,
      this.mintAddress,
      minterAddress,
      quota,
      active,
      unlimited
    ).rpc();
  }

  // ── Role Management ──

  async updateRoles(
    authority: PublicKey,
    params: UpdateRolesParams
  ): Promise<string> {
    return buildUpdateRolesIx(
      this.program,
      authority,
      this.mintAddress,
      params
    ).rpc();
  }

  // ── Authority Transfer ──

  async transferAuthority(
    authority: PublicKey,
    newAuthority: PublicKey
  ): Promise<string> {
    return buildTransferAuthorityIx(
      this.program,
      authority,
      this.mintAddress,
      newAuthority
    ).rpc();
  }

  async acceptAuthority(newAuthority: PublicKey): Promise<string> {
    return buildAcceptAuthorityIx(
      this.program,
      newAuthority,
      this.mintAddress
    ).rpc();
  }

  async cancelAuthorityTransfer(authority: PublicKey): Promise<string> {
    return buildCancelAuthorityTransferIx(
      this.program,
      authority,
      this.mintAddress
    ).rpc();
  }

  // ── SSS-2 Compliance ──

  compliance = {
    blacklistAdd: async (
      address: PublicKey,
      blacklister: PublicKey
    ): Promise<string> => {
      return buildBlacklistAddressIx(
        this.program,
        blacklister,
        this.mintAddress,
        address
      ).rpc();
    },

    blacklistRemove: async (
      address: PublicKey,
      blacklister: PublicKey
    ): Promise<string> => {
      return buildRemoveFromBlacklistIx(
        this.program,
        blacklister,
        this.mintAddress,
        address
      ).rpc();
    },

    seize: async (
      from: PublicKey,
      treasury: PublicKey,
      amount: BN,
      seizer: PublicKey,
      remainingAccounts: AccountMeta[] = []
    ): Promise<string> => {
      return buildSeizeIx(
        this.program,
        seizer,
        this.mintAddress,
        from,
        treasury,
        amount,
        remainingAccounts
      ).rpc();
    },

    isBlacklisted: (address: PublicKey): Promise<boolean> => {
      return this.isBlacklisted(address);
    },
  };
}
