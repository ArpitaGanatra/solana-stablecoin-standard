import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import ora from "ora";
import {
  getConnection,
  getProvider,
  loadKeypair,
  getCoreProgram,
  getNetwork,
} from "../utils/connection";
import { loadConfig } from "../utils/config";
import {
  success,
  error,
  info,
  printTx,
  formatAmount,
  printTable,
} from "../utils/format";
import {
  buildAddMinterIx,
  buildRemoveMinterIx,
  buildUpdateMinterIx,
  findConfigPda,
  findMinterPda,
  type MinterInfo,
} from "@stbr/sss-token";

export function registerMintersCommand(program: Command): void {
  const minters = program.command("minters").description("Manage minters");

  minters
    .command("add")
    .description("Add a new minter")
    .argument("<address>", "Minter wallet address")
    .option("--quota <amount>", "Mint quota (human-readable)", "0")
    .option("--unlimited", "Grant unlimited minting", false)
    .option("--keypair <path>", "Path to authority keypair")
    .option("--network <url>", "RPC URL")
    .action(async (address: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const authority = loadKeypair(opts.keypair);
        const provider = getProvider(connection, authority);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);
        const minterPubkey = new PublicKey(address);
        const quota = opts.unlimited
          ? new BN(0)
          : new BN(opts.quota).mul(new BN(10).pow(new BN(config.decimals)));

        const spinner = ora(`Adding minter ${address}...`).start();

        const txSig = await buildAddMinterIx(
          coreProgram as any,
          authority.publicKey,
          mintPubkey,
          minterPubkey,
          quota,
          opts.unlimited
        ).rpc();

        spinner.stop();
        success(`Minter added: ${address}`);
        if (opts.unlimited) {
          info("Quota: Unlimited");
        } else {
          info(`Quota: ${opts.quota}`);
        }
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  minters
    .command("remove")
    .description("Remove a minter")
    .argument("<address>", "Minter wallet address")
    .option("--keypair <path>", "Path to authority keypair")
    .option("--network <url>", "RPC URL")
    .action(async (address: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const authority = loadKeypair(opts.keypair);
        const provider = getProvider(connection, authority);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);
        const minterPubkey = new PublicKey(address);

        const spinner = ora(`Removing minter ${address}...`).start();

        const txSig = await buildRemoveMinterIx(
          coreProgram as any,
          authority.publicKey,
          mintPubkey,
          minterPubkey
        ).rpc();

        spinner.stop();
        success(`Minter removed: ${address}`);
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  minters
    .command("info")
    .description("Show minter info")
    .argument("<address>", "Minter wallet address")
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (address: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const keypair = loadKeypair(opts.keypair);
        const provider = getProvider(connection, keypair);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);
        const minterPubkey = new PublicKey(address);

        const [configPda] = findConfigPda(mintPubkey, coreProgram.programId);
        const [minterPda] = findMinterPda(
          configPda,
          minterPubkey,
          coreProgram.programId
        );

        const mi = (await (coreProgram as any).account.minterInfo.fetch(
          minterPda
        )) as MinterInfo;

        console.log("");
        console.log(`  Minter: ${address}`);
        console.log(`  ${"─".repeat(40)}`);
        console.log(`  Active:    ${mi.active ? "Yes" : "No"}`);
        console.log(`  Unlimited: ${mi.unlimited ? "Yes" : "No"}`);
        console.log(`  Quota:     ${mi.quota.toString()}`);
        console.log(`  Minted:    ${mi.minted.toString()}`);
        console.log("");
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  minters
    .command("update")
    .description("Update a minter's quota or status")
    .argument("<address>", "Minter wallet address")
    .option("--quota <amount>", "New mint quota (human-readable)")
    .option("--unlimited", "Grant unlimited minting")
    .option("--no-unlimited", "Revoke unlimited minting")
    .option("--active", "Activate minter")
    .option("--no-active", "Deactivate minter")
    .option("--keypair <path>", "Path to authority keypair")
    .option("--network <url>", "RPC URL")
    .action(async (address: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const authority = loadKeypair(opts.keypair);
        const provider = getProvider(connection, authority);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);
        const minterPubkey = new PublicKey(address);

        // Fetch current minter state to use as defaults
        const [configPda] = findConfigPda(mintPubkey, coreProgram.programId);
        const [minterPda] = findMinterPda(
          configPda,
          minterPubkey,
          coreProgram.programId
        );
        const current = (await (coreProgram as any).account.minterInfo.fetch(
          minterPda
        )) as MinterInfo;

        const quota =
          opts.quota !== undefined
            ? new BN(opts.quota).mul(new BN(10).pow(new BN(config.decimals)))
            : current.quota;
        const active = opts.active !== undefined ? opts.active : current.active;
        const unlimited =
          opts.unlimited !== undefined ? opts.unlimited : current.unlimited;

        const spinner = ora(`Updating minter ${address}...`).start();

        const txSig = await buildUpdateMinterIx(
          coreProgram as any,
          authority.publicKey,
          mintPubkey,
          minterPubkey,
          quota,
          active,
          unlimited
        ).rpc();

        spinner.stop();
        success(`Minter updated: ${address}`);
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
