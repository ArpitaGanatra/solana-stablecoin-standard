import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import {
  getConnection,
  getProvider,
  loadKeypair,
  getCoreProgram,
  getNetwork,
} from "../utils/connection";
import { loadConfig } from "../utils/config";
import { success, error, info, printTx } from "../utils/format";
import {
  buildUpdateRolesIx,
  buildTransferAuthorityIx,
  buildAcceptAuthorityIx,
  buildCancelAuthorityTransferIx,
  type UpdateRolesParams,
} from "@stbr/sss-token";

export function registerRolesCommand(program: Command): void {
  program
    .command("update-roles")
    .description("Update role assignments")
    .option("--pauser <address>", "Set pauser address")
    .option("--burner <address>", "Set burner address")
    .option("--freezer <address>", "Set freezer address")
    .option("--blacklister <address>", "Set blacklister address (SSS-2)")
    .option("--seizer <address>", "Set seizer address (SSS-2)")
    .option("--keypair <path>", "Path to authority keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const authority = loadKeypair(opts.keypair);
        const provider = getProvider(connection, authority);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);

        const params: UpdateRolesParams = {};
        if (opts.pauser) params.pauser = new PublicKey(opts.pauser);
        if (opts.burner) params.burner = new PublicKey(opts.burner);
        if (opts.freezer) params.freezer = new PublicKey(opts.freezer);
        if (opts.blacklister)
          params.blacklister = new PublicKey(opts.blacklister);
        if (opts.seizer) params.seizer = new PublicKey(opts.seizer);

        if (Object.keys(params).length === 0) {
          error("Specify at least one role to update.");
          process.exit(1);
        }

        const spinner = ora("Updating roles...").start();

        const txSig = await buildUpdateRolesIx(
          coreProgram as any,
          authority.publicKey,
          mintPubkey,
          params
        ).rpc();

        spinner.stop();
        success("Roles updated");
        for (const [role, addr] of Object.entries(params)) {
          info(`${role}: ${(addr as PublicKey).toBase58()}`);
        }
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  // Transfer authority
  program
    .command("transfer-authority")
    .description("Initiate authority transfer to a new address")
    .argument("<new-authority>", "New authority address")
    .option("--keypair <path>", "Path to current authority keypair")
    .option("--network <url>", "RPC URL")
    .action(async (newAuth: string, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const authority = loadKeypair(opts.keypair);
        const provider = getProvider(connection, authority);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);
        const newAuthPubkey = new PublicKey(newAuth);

        const spinner = ora("Initiating authority transfer...").start();

        const txSig = await buildTransferAuthorityIx(
          coreProgram as any,
          authority.publicKey,
          mintPubkey,
          newAuthPubkey
        ).rpc();

        spinner.stop();
        success(`Authority transfer initiated to ${newAuth}`);
        info("The new authority must call 'accept-authority' to complete.");
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  program
    .command("accept-authority")
    .description("Accept a pending authority transfer")
    .option("--keypair <path>", "Path to new authority keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const newAuthority = loadKeypair(opts.keypair);
        const provider = getProvider(connection, newAuthority);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);

        const spinner = ora("Accepting authority...").start();

        const txSig = await buildAcceptAuthorityIx(
          coreProgram as any,
          newAuthority.publicKey,
          mintPubkey
        ).rpc();

        spinner.stop();
        success("Authority transfer accepted");
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  program
    .command("cancel-authority-transfer")
    .description("Cancel a pending authority transfer")
    .option("--keypair <path>", "Path to authority keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const authority = loadKeypair(opts.keypair);
        const provider = getProvider(connection, authority);
        const coreProgram = await getCoreProgram(provider);

        const mintPubkey = new PublicKey(config.mint);

        const spinner = ora("Cancelling authority transfer...").start();

        const txSig = await buildCancelAuthorityTransferIx(
          coreProgram as any,
          authority.publicKey,
          mintPubkey
        ).rpc();

        spinner.stop();
        success("Authority transfer cancelled");
        printTx(txSig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
