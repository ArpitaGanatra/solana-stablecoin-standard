/**
 * Devnet Example Operations
 *
 * Initializes an SSS-1 stablecoin on devnet and runs example operations:
 *   init → add minter → mint → freeze → thaw → burn
 *
 * Records all transaction signatures for bounty submission proof.
 *
 * Usage: npx ts-node scripts/devnet-example-ops.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  Connection,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey("4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb");

interface TxRecord {
  operation: string;
  signature: string;
}

async function main() {
  // Setup provider
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const keypairPath = path.join(process.env.HOME ?? "~", ".config/solana/id.json");
  const rawKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(rawKey));
  const wallet = new anchor.Wallet(authority);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  // Load IDL
  const idl = await Program.fetchIdl(PROGRAM_ID, provider);
  if (!idl) throw new Error("IDL not found on-chain");
  const program = new Program(idl, provider);

  const txs: TxRecord[] = [];
  const mintKeypair = Keypair.generate();

  console.log("══════════════════════════════════════════");
  console.log("  SSS Devnet Example Operations");
  console.log("══════════════════════════════════════════");
  console.log(`Authority: ${authority.publicKey.toBase58()}`);
  console.log(`Mint:      ${mintKeypair.publicKey.toBase58()}`);
  console.log("");

  // ── 1. Initialize SSS-1 Stablecoin ──
  console.log("1. Initializing SSS-1 stablecoin...");
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stablecoin_config"), mintKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const initSig = await program.methods
    .initialize({
      name: "SSS Demo USD",
      symbol: "sUSD",
      uri: "https://sss.superteam.fun/metadata.json",
      decimals: 6,
      enableMetadata: true,
      additionalMetadata: [],
      enablePermanentDelegate: false,
      enableTransferHook: false,
      defaultAccountFrozen: false,
      transferHookProgramId: null,
    })
    .accounts({
      authority: authority.publicKey,
      config: configPda,
      mint: mintKeypair.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([authority, mintKeypair])
    .rpc();

  txs.push({ operation: "initialize (SSS-1)", signature: initSig });
  console.log(`   tx: ${initSig}`);

  // ── 2. Add Minter ──
  console.log("2. Adding minter...");
  const [minterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("minter_info"), configPda.toBuffer(), authority.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const addMinterSig = await program.methods
    .addMinter(authority.publicKey, new BN(1_000_000_000), false) // minter, quota: 1000 tokens, not unlimited
    .accounts({
      authority: authority.publicKey,
      config: configPda,
      minterInfo: minterPda,
      minter: authority.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  txs.push({ operation: "add_minter", signature: addMinterSig });
  console.log(`   tx: ${addMinterSig}`);

  // ── 3. Mint tokens ──
  console.log("3. Minting 100 sUSD...");
  const recipientAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    authority.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Create ATA first
  const createAtaIx = createAssociatedTokenAccountInstruction(
    authority.publicKey,
    recipientAta,
    authority.publicKey,
    mintKeypair.publicKey,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const { Transaction } = await import("@solana/web3.js");
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const ataTx = new Transaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    feePayer: authority.publicKey,
  }).add(createAtaIx);
  ataTx.sign(authority);
  const ataCreateSig = await connection.sendRawTransaction(ataTx.serialize());
  await connection.confirmTransaction({ signature: ataCreateSig, ...latestBlockhash }, "confirmed");

  const mintSig = await program.methods
    .mintTokens(new BN(100_000_000)) // 100 tokens (6 decimals)
    .accounts({
      minter: authority.publicKey,
      config: configPda,
      minterInfo: minterPda,
      mint: mintKeypair.publicKey,
      tokenAccount: recipientAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([authority])
    .rpc();

  txs.push({ operation: "mint_tokens (100 sUSD)", signature: mintSig });
  console.log(`   tx: ${mintSig}`);

  // ── 4. Freeze account ──
  console.log("4. Freezing account...");
  const freezeSig = await program.methods
    .freezeAccount()
    .accounts({
      freezer: authority.publicKey,
      config: configPda,
      mint: mintKeypair.publicKey,
      tokenAccount: recipientAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([authority])
    .rpc();

  txs.push({ operation: "freeze_account", signature: freezeSig });
  console.log(`   tx: ${freezeSig}`);

  // ── 5. Thaw account ──
  console.log("5. Thawing account...");
  const thawSig = await program.methods
    .thawAccount()
    .accounts({
      freezer: authority.publicKey,
      config: configPda,
      mint: mintKeypair.publicKey,
      tokenAccount: recipientAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([authority])
    .rpc();

  txs.push({ operation: "thaw_account", signature: thawSig });
  console.log(`   tx: ${thawSig}`);

  // ── 6. Burn tokens ──
  console.log("6. Burning 10 sUSD...");
  const burnSig = await program.methods
    .burnTokens(new BN(10_000_000)) // 10 tokens
    .accounts({
      burner: authority.publicKey,
      config: configPda,
      mint: mintKeypair.publicKey,
      tokenAccount: recipientAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([authority])
    .rpc();

  txs.push({ operation: "burn_tokens (10 sUSD)", signature: burnSig });
  console.log(`   tx: ${burnSig}`);

  // ── 7. Pause ──
  console.log("7. Pausing program...");
  const pauseSig = await program.methods
    .pause()
    .accounts({
      pauser: authority.publicKey,
      config: configPda,
    })
    .signers([authority])
    .rpc();

  txs.push({ operation: "pause", signature: pauseSig });
  console.log(`   tx: ${pauseSig}`);

  // ── 8. Unpause ──
  console.log("8. Unpausing program...");
  const unpauseSig = await program.methods
    .unpause()
    .accounts({
      pauser: authority.publicKey,
      config: configPda,
    })
    .signers([authority])
    .rpc();

  txs.push({ operation: "unpause", signature: unpauseSig });
  console.log(`   tx: ${unpauseSig}`);

  // ── Save results ──
  const deploymentFile = path.join(__dirname, "devnet-deployment.json");
  const existing = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  existing.mint = mintKeypair.publicKey.toBase58();
  existing.configPda = configPda.toBase58();
  existing.exampleTransactions = txs;
  fs.writeFileSync(deploymentFile, JSON.stringify(existing, null, 2));

  console.log("");
  console.log("══════════════════════════════════════════");
  console.log("  All operations complete!");
  console.log("");
  console.log(`  Mint:       ${mintKeypair.publicKey.toBase58()}`);
  console.log(`  Config PDA: ${configPda.toBase58()}`);
  console.log(`  Transactions: ${txs.length}`);
  console.log("");
  console.log("  Results saved to scripts/devnet-deployment.json");
  console.log("══════════════════════════════════════════");

  // Update .env with real values
  const envPath = path.join(__dirname, "..", "backend", ".env");
  const envContent = `# Solana RPC (devnet)
RPC_URL=https://api.devnet.solana.com

# Program (deployed on devnet)
PROGRAM_ID=${PROGRAM_ID.toBase58()}
MINT=${mintKeypair.publicKey.toBase58()}

# Authority keypair
KEYPAIR_PATH=~/.config/solana/id.json

# Server
PORT=3000
HOST=0.0.0.0

# Logging
LOG_LEVEL=info

# Event listener
POLL_INTERVAL_MS=5000
`;
  fs.writeFileSync(envPath, envContent);
  console.log("  backend/.env updated with deployed values");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
