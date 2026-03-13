import { PublicKey, AccountMeta } from "@solana/web3.js";
import { findBlacklistPda, findExtraAccountMetaListPda } from "./pda";

/**
 * Build the remaining accounts needed for transfer_checked on mints with transfer hooks.
 * These are forwarded through the CPI chain: sss_core -> Token-2022 -> transfer_hook.
 *
 * Required for seize operations and any transfer_checked calls on SSS-2 mints.
 */
export function getTransferHookRemainingAccounts(
  mint: PublicKey,
  config: PublicKey,
  sourceOwner: PublicKey,
  destOwner: PublicKey,
  hookProgramId: PublicKey,
  coreProgramId: PublicKey
): AccountMeta[] {
  const [extraMetaList] = findExtraAccountMetaListPda(mint, hookProgramId);
  const [sourceBlacklist] = findBlacklistPda(
    config,
    sourceOwner,
    coreProgramId
  );
  const [destBlacklist] = findBlacklistPda(config, destOwner, coreProgramId);

  return [
    // Extra account meta list (Token-2022 reads this to resolve extra accounts)
    { pubkey: extraMetaList, isSigner: false, isWritable: false },
    // Resolved extra metas (in order defined in InitializeExtraAccountMetaList):
    { pubkey: coreProgramId, isSigner: false, isWritable: false }, // sss-core program
    { pubkey: config, isSigner: false, isWritable: false }, // config PDA
    { pubkey: sourceBlacklist, isSigner: false, isWritable: false }, // source blacklist
    { pubkey: destBlacklist, isSigner: false, isWritable: false }, // dest blacklist
    // Hook program (must be last — Token-2022 invokes this)
    { pubkey: hookProgramId, isSigner: false, isWritable: false },
  ];
}
