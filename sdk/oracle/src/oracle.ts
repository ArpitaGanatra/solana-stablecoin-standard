import { Program, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { OracleConfig } from "./types";
import { findOracleConfigPda, findVaultAuthorityPda } from "./utils/pda";
import { findConfigPda, findMinterPda } from "@stbr/sss-token";

export const SSS_ORACLE_PROGRAM_ID = new PublicKey(
  "GnEKCqWBDCTzLHrCTiRT6Mi1a37PHSsAoFBowLKPT2PH"
);

export interface InitializeOracleParams {
  stablecoinMint: PublicKey;
  collateralMint: PublicKey;
  oracleFeed: PublicKey;
  sssCoreProgram: PublicKey;
  maxStaleSlots: number;
  minSamples: number;
  spreadBps: number;
  stablecoinDecimals: number;
  collateralDecimals: number;
  authority: PublicKey;
}

export interface MintWithOracleParams {
  user: PublicKey;
  stablecoinAmount: BN;
  maxCollateral: BN;
}

export interface RedeemWithOracleParams {
  user: PublicKey;
  stablecoinAmount: BN;
  minCollateral: BN;
}

export class SolanaStablecoinOracle {
  readonly program: Program;
  readonly connection: Connection;
  readonly stablecoinMint: PublicKey;
  readonly oracleConfigPda: PublicKey;
  readonly oracleConfigBump: number;

  private constructor(
    program: Program,
    connection: Connection,
    stablecoinMint: PublicKey,
    oracleConfigPda: PublicKey,
    oracleConfigBump: number
  ) {
    this.program = program;
    this.connection = connection;
    this.stablecoinMint = stablecoinMint;
    this.oracleConfigPda = oracleConfigPda;
    this.oracleConfigBump = oracleConfigBump;
  }

  static async load(params: {
    program: Program;
    connection: Connection;
    stablecoinMint: PublicKey;
  }): Promise<SolanaStablecoinOracle> {
    const [configPda, bump] = findOracleConfigPda(
      params.stablecoinMint,
      params.program.programId
    );

    return new SolanaStablecoinOracle(
      params.program,
      params.connection,
      params.stablecoinMint,
      configPda,
      bump
    );
  }

  async getConfig(): Promise<OracleConfig> {
    return (await (this.program.account as any).oracleConfig.fetch(
      this.oracleConfigPda
    )) as OracleConfig;
  }

  async initializeOracle(params: InitializeOracleParams): Promise<string> {
    const [oracleConfig] = findOracleConfigPda(
      params.stablecoinMint,
      this.program.programId
    );
    const [vaultAuthority] = findVaultAuthorityPda(
      oracleConfig,
      this.program.programId
    );
    const collateralVault = getAssociatedTokenAddressSync(
      params.collateralMint,
      vaultAuthority,
      true, // allowOwnerOffCurve (PDA)
      TOKEN_PROGRAM_ID
    );

    return await (this.program.methods as any)
      .initializeOracle({
        maxStaleSlots: new BN(params.maxStaleSlots),
        minSamples: params.minSamples,
        spreadBps: params.spreadBps,
        stablecoinDecimals: params.stablecoinDecimals,
        collateralDecimals: params.collateralDecimals,
      })
      .accounts({
        authority: params.authority,
        stablecoinMint: params.stablecoinMint,
        collateralMint: params.collateralMint,
        oracleFeed: params.oracleFeed,
        oracleConfig,
        vaultAuthority,
        collateralVault,
        sssCoreProgram: params.sssCoreProgram,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async mintWithOracle(params: MintWithOracleParams): Promise<string> {
    const config = await this.getConfig();
    const [vaultAuthority] = findVaultAuthorityPda(
      this.oracleConfigPda,
      this.program.programId
    );
    const [sssCoreConfig] = findConfigPda(
      this.stablecoinMint,
      config.sssCoreProgram
    );
    const [minterInfo] = findMinterPda(
      sssCoreConfig,
      vaultAuthority,
      config.sssCoreProgram
    );

    const userCollateralAccount = getAssociatedTokenAddressSync(
      config.collateralMint,
      params.user,
      false,
      TOKEN_PROGRAM_ID
    );
    const userStablecoinAccount = getAssociatedTokenAddressSync(
      this.stablecoinMint,
      params.user,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    return await (this.program.methods as any)
      .mintWithOracle(params.stablecoinAmount, params.maxCollateral)
      .accounts({
        user: params.user,
        oracleConfig: this.oracleConfigPda,
        oracleFeed: config.oracleFeed,
        vaultAuthority,
        collateralVault: config.vault,
        userCollateralAccount,
        stablecoinMint: this.stablecoinMint,
        userStablecoinAccount,
        sssCoreConfig,
        minterInfo,
        sssCoreProgram: config.sssCoreProgram,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();
  }

  async redeemWithOracle(params: RedeemWithOracleParams): Promise<string> {
    const config = await this.getConfig();
    const [vaultAuthority] = findVaultAuthorityPda(
      this.oracleConfigPda,
      this.program.programId
    );

    const userCollateralAccount = getAssociatedTokenAddressSync(
      config.collateralMint,
      params.user,
      false,
      TOKEN_PROGRAM_ID
    );
    const userStablecoinAccount = getAssociatedTokenAddressSync(
      this.stablecoinMint,
      params.user,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    return await (this.program.methods as any)
      .redeemWithOracle(params.stablecoinAmount, params.minCollateral)
      .accounts({
        user: params.user,
        oracleConfig: this.oracleConfigPda,
        oracleFeed: config.oracleFeed,
        vaultAuthority,
        collateralVault: config.vault,
        userCollateralAccount,
        stablecoinMint: this.stablecoinMint,
        userStablecoinAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();
  }

  async updateFeed(authority: PublicKey, newFeed: PublicKey): Promise<string> {
    return await (this.program.methods as any)
      .updateOracleFeed()
      .accounts({
        authority,
        oracleConfig: this.oracleConfigPda,
        newOracleFeed: newFeed,
      })
      .rpc();
  }

  async updateParams(
    authority: PublicKey,
    params: {
      maxStaleSlots?: number;
      minSamples?: number;
      spreadBps?: number;
      isActive?: boolean;
    }
  ): Promise<string> {
    return await (this.program.methods as any)
      .updateOracleParams({
        maxStaleSlots: params.maxStaleSlots
          ? new BN(params.maxStaleSlots)
          : null,
        minSamples: params.minSamples ?? null,
        spreadBps: params.spreadBps ?? null,
        isActive: params.isActive ?? null,
      })
      .accounts({
        authority,
        oracleConfig: this.oracleConfigPda,
      })
      .rpc();
  }

  async withdrawFees(
    authority: PublicKey,
    amount: BN,
    destination: PublicKey
  ): Promise<string> {
    const [vaultAuthority] = findVaultAuthorityPda(
      this.oracleConfigPda,
      this.program.programId
    );
    const config = await this.getConfig();

    return await (this.program.methods as any)
      .withdrawFees(amount)
      .accounts({
        authority,
        oracleConfig: this.oracleConfigPda,
        vaultAuthority,
        collateralVault: config.vault,
        destination,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }
}
