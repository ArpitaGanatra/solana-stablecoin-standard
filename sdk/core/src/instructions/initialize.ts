import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import type { SssCore } from "../idl";
import { InitializeParams, PresetConfig } from "../types";
import { findConfigPda } from "../utils/pda";

export interface InitializeAccounts {
  authority: PublicKey;
  mint: Keypair;
}

export function buildInitializeIx(
  program: Program<SssCore>,
  accounts: InitializeAccounts,
  params: InitializeParams,
  preset?: PresetConfig
) {
  const [config] = findConfigPda(accounts.mint.publicKey, program.programId);

  const ixParams = {
    decimals: params.decimals,
    enableMetadata: preset?.enableMetadata ?? params.enableMetadata ?? true,
    name: params.name,
    symbol: params.symbol,
    uri: params.uri,
    additionalMetadata: [],
    enablePermanentDelegate:
      preset?.enablePermanentDelegate ??
      params.enablePermanentDelegate ??
      false,
    enableTransferHook:
      preset?.enableTransferHook ?? params.enableTransferHook ?? false,
    defaultAccountFrozen:
      preset?.defaultAccountFrozen ?? params.defaultAccountFrozen ?? false,
    transferHookProgramId: params.transferHookProgramId ?? null,
  };

  return program.methods
    .initialize(ixParams)
    .accountsPartial({
      authority: accounts.authority,
      mint: accounts.mint.publicKey,
      config,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([accounts.mint]);
}
