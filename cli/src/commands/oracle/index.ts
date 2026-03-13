import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { BN, Program } from "@coral-xyz/anchor";
import ora from "ora";
import {
  getConnection,
  getNetwork,
  loadKeypair,
  getProvider,
} from "../../utils/connection";
import { loadConfig } from "../../utils/config";
import {
  error,
  info,
  success,
  printTx,
  formatAmount,
  parseAmount,
  shortenAddress,
} from "../../utils/format";

const SSS_ORACLE_PROGRAM_ID = new PublicKey(
  process.env.SSS_ORACLE_PROGRAM_ID ||
    "GnEKCqWBDCTzLHrCTiRT6Mi1a37PHSsAoFBowLKPT2PH"
);

async function getOracleProgram(provider: any): Promise<Program> {
  const idl = await Program.fetchIdl(SSS_ORACLE_PROGRAM_ID, provider);
  if (!idl) {
    throw new Error(
      "Could not fetch IDL for sss-oracle. Make sure the program is deployed."
    );
  }
  return new Program(idl, provider);
}

function findOracleConfigPda(
  stablecoinMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_config"), stablecoinMint.toBuffer()],
    programId
  );
}

function findVaultAuthorityPda(
  oracleConfig: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), oracleConfig.toBuffer()],
    programId
  );
}

export function registerOracleCommand(program: Command): void {
  const oracle = program
    .command("oracle")
    .description("Oracle integration module for non-USD stablecoin pegs");

  // ── oracle init ──
  oracle
    .command("init")
    .description("Initialize oracle config for a stablecoin mint")
    .requiredOption("--feed <pubkey>", "Switchboard pull feed address")
    .requiredOption(
      "--collateral-mint <pubkey>",
      "Collateral token mint (e.g. USDC)"
    )
    .option("--spread <bps>", "Spread in basis points", "30")
    .option("--max-stale-slots <n>", "Max staleness in slots", "150")
    .option("--min-samples <n>", "Min oracle samples", "1")
    .option("--collateral-decimals <n>", "Collateral token decimals", "6")
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const keypair = loadKeypair(opts.keypair);
        const provider = getProvider(connection, keypair);
        const oracleProgram = await getOracleProgram(provider);

        const stablecoinMint = new PublicKey(config.mint);
        const collateralMint = new PublicKey(opts.collateralMint);
        const oracleFeed = new PublicKey(opts.feed);

        const [oracleConfig] = findOracleConfigPda(
          stablecoinMint,
          oracleProgram.programId
        );
        const [vaultAuthority] = findVaultAuthorityPda(
          oracleConfig,
          oracleProgram.programId
        );

        const {
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
          getAssociatedTokenAddressSync,
        } = await import("@solana/spl-token");

        const collateralVault = getAssociatedTokenAddressSync(
          collateralMint,
          vaultAuthority,
          true,
          TOKEN_PROGRAM_ID
        );

        const spinner = ora("Initializing oracle config...").start();

        const sssCoreProgram = new PublicKey(
          "4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb"
        );

        const sig = await (oracleProgram.methods as any)
          .initializeOracle({
            maxStaleSlots: new BN(parseInt(opts.maxStaleSlots)),
            minSamples: parseInt(opts.minSamples),
            spreadBps: parseInt(opts.spread),
            stablecoinDecimals: config.decimals,
            collateralDecimals: parseInt(opts.collateralDecimals),
          })
          .accounts({
            authority: keypair.publicKey,
            stablecoinMint,
            collateralMint,
            oracleFeed,
            oracleConfig,
            vaultAuthority,
            collateralVault,
            sssCoreProgram,
            systemProgram: PublicKey.default,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([keypair])
          .rpc();

        spinner.stop();
        success("Oracle initialized!");
        printTx(sig, network);
        info(`Oracle config: ${oracleConfig.toBase58()}`);
        info(`Vault authority: ${vaultAuthority.toBase58()}`);
        info(`Collateral vault: ${collateralVault.toBase58()}`);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  // ── oracle status ──
  oracle
    .command("status")
    .description("Show oracle config and current status")
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const keypair = loadKeypair(opts.keypair);
        const provider = getProvider(connection, keypair);
        const oracleProgram = await getOracleProgram(provider);

        const stablecoinMint = new PublicKey(config.mint);
        const [oracleConfig] = findOracleConfigPda(
          stablecoinMint,
          oracleProgram.programId
        );

        const spinner = ora("Fetching oracle config...").start();
        const oracleData = await (
          oracleProgram.account as any
        ).oracleConfig.fetch(oracleConfig);
        spinner.stop();

        console.log("\n  Oracle Configuration");
        console.log(`  ${"─".repeat(50)}`);
        console.log(
          `  Authority:          ${shortenAddress(oracleData.authority)}`
        );
        console.log(
          `  Stablecoin Mint:    ${shortenAddress(oracleData.stablecoinMint)}`
        );
        console.log(
          `  Collateral Mint:    ${shortenAddress(oracleData.collateralMint)}`
        );
        console.log(
          `  Oracle Feed:        ${shortenAddress(oracleData.oracleFeed)}`
        );
        console.log(
          `  Vault:              ${shortenAddress(oracleData.vault)}`
        );
        console.log(
          `  Active:             ${oracleData.isActive ? "Yes" : "No"}`
        );
        console.log(
          `  Spread:             ${oracleData.spreadBps} bps (${(
            oracleData.spreadBps / 100
          ).toFixed(2)}%)`
        );
        console.log(
          `  Max Stale Slots:    ${oracleData.maxStaleSlots.toString()}`
        );
        console.log(`  Min Samples:        ${oracleData.minSamples}`);
        console.log(`  Stablecoin Dec:     ${oracleData.stablecoinDecimals}`);
        console.log(`  Collateral Dec:     ${oracleData.collateralDecimals}`);

        // Fetch vault balance
        const { TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
        try {
          const vaultBalance = await connection.getTokenAccountBalance(
            oracleData.vault
          );
          console.log(
            `  Vault Balance:      ${vaultBalance.value.uiAmountString}`
          );
        } catch {
          console.log(`  Vault Balance:      (unable to fetch)`);
        }

        console.log();
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  // ── oracle mint ──
  oracle
    .command("mint")
    .description("Mint stablecoins at oracle price (deposit collateral)")
    .argument("<amount>", "Amount of stablecoins to mint")
    .option(
      "--max-collateral <amount>",
      "Max collateral to pay (slippage protection)"
    )
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (amount, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const keypair = loadKeypair(opts.keypair);
        const provider = getProvider(connection, keypair);
        const oracleProgram = await getOracleProgram(provider);

        const stablecoinMint = new PublicKey(config.mint);
        const [oracleConfigPda] = findOracleConfigPda(
          stablecoinMint,
          oracleProgram.programId
        );

        const oracleData = await (
          oracleProgram.account as any
        ).oracleConfig.fetch(oracleConfigPda);

        const {
          TOKEN_PROGRAM_ID,
          TOKEN_2022_PROGRAM_ID,
          getAssociatedTokenAddressSync,
        } = await import("@solana/spl-token");
        const { findConfigPda, findMinterPda } = await import(
          "@stbr/sss-token"
        );

        const [vaultAuthority] = findVaultAuthorityPda(
          oracleConfigPda,
          oracleProgram.programId
        );
        const [sssCoreConfig] = findConfigPda(
          stablecoinMint,
          oracleData.sssCoreProgram
        );
        const [minterInfo] = findMinterPda(
          sssCoreConfig,
          vaultAuthority,
          oracleData.sssCoreProgram
        );

        const stablecoinAmount = parseAmount(amount, config.decimals);
        const maxCollateral = opts.maxCollateral
          ? parseAmount(opts.maxCollateral, oracleData.collateralDecimals)
          : stablecoinAmount.mul(new BN(2)); // default 2x slippage

        const userCollateral = getAssociatedTokenAddressSync(
          oracleData.collateralMint,
          keypair.publicKey,
          false,
          TOKEN_PROGRAM_ID
        );
        const userStablecoin = getAssociatedTokenAddressSync(
          stablecoinMint,
          keypair.publicKey,
          false,
          TOKEN_2022_PROGRAM_ID
        );

        const spinner = ora("Minting stablecoins at oracle price...").start();

        const sig = await (oracleProgram.methods as any)
          .mintWithOracle(stablecoinAmount, maxCollateral)
          .accounts({
            user: keypair.publicKey,
            oracleConfig: oracleConfigPda,
            oracleFeed: oracleData.oracleFeed,
            vaultAuthority,
            collateralVault: oracleData.vault,
            userCollateralAccount: userCollateral,
            stablecoinMint,
            userStablecoinAccount: userStablecoin,
            sssCoreConfig,
            minterInfo,
            sssCoreProgram: oracleData.sssCoreProgram,
            tokenProgram: TOKEN_PROGRAM_ID,
            token2022Program: TOKEN_2022_PROGRAM_ID,
          })
          .signers([keypair])
          .rpc();

        spinner.stop();
        success(`Minted ${amount} stablecoins at oracle price!`);
        printTx(sig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  // ── oracle redeem ──
  oracle
    .command("redeem")
    .description("Redeem stablecoins at oracle price (receive collateral)")
    .argument("<amount>", "Amount of stablecoins to redeem")
    .option(
      "--min-collateral <amount>",
      "Min collateral to receive (slippage protection)"
    )
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (amount, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const keypair = loadKeypair(opts.keypair);
        const provider = getProvider(connection, keypair);
        const oracleProgram = await getOracleProgram(provider);

        const stablecoinMint = new PublicKey(config.mint);
        const [oracleConfigPda] = findOracleConfigPda(
          stablecoinMint,
          oracleProgram.programId
        );

        const oracleData = await (
          oracleProgram.account as any
        ).oracleConfig.fetch(oracleConfigPda);

        const {
          TOKEN_PROGRAM_ID,
          TOKEN_2022_PROGRAM_ID,
          getAssociatedTokenAddressSync,
        } = await import("@solana/spl-token");

        const [vaultAuthority] = findVaultAuthorityPda(
          oracleConfigPda,
          oracleProgram.programId
        );

        const stablecoinAmount = parseAmount(amount, config.decimals);
        const minCollateral = opts.minCollateral
          ? parseAmount(opts.minCollateral, oracleData.collateralDecimals)
          : new BN(0);

        const userCollateral = getAssociatedTokenAddressSync(
          oracleData.collateralMint,
          keypair.publicKey,
          false,
          TOKEN_PROGRAM_ID
        );
        const userStablecoin = getAssociatedTokenAddressSync(
          stablecoinMint,
          keypair.publicKey,
          false,
          TOKEN_2022_PROGRAM_ID
        );

        const spinner = ora("Redeeming stablecoins at oracle price...").start();

        const sig = await (oracleProgram.methods as any)
          .redeemWithOracle(stablecoinAmount, minCollateral)
          .accounts({
            user: keypair.publicKey,
            oracleConfig: oracleConfigPda,
            oracleFeed: oracleData.oracleFeed,
            vaultAuthority,
            collateralVault: oracleData.vault,
            userCollateralAccount: userCollateral,
            stablecoinMint,
            userStablecoinAccount: userStablecoin,
            tokenProgram: TOKEN_PROGRAM_ID,
            token2022Program: TOKEN_2022_PROGRAM_ID,
          })
          .signers([keypair])
          .rpc();

        spinner.stop();
        success(`Redeemed ${amount} stablecoins!`);
        printTx(sig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  // ── oracle update-feed ──
  oracle
    .command("update-feed")
    .description("Update the Switchboard feed address")
    .argument("<feed>", "New Switchboard feed pubkey")
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (feed, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const keypair = loadKeypair(opts.keypair);
        const provider = getProvider(connection, keypair);
        const oracleProgram = await getOracleProgram(provider);

        const stablecoinMint = new PublicKey(config.mint);
        const [oracleConfigPda] = findOracleConfigPda(
          stablecoinMint,
          oracleProgram.programId
        );

        const sig = await (oracleProgram.methods as any)
          .updateOracleFeed()
          .accounts({
            authority: keypair.publicKey,
            oracleConfig: oracleConfigPda,
            newOracleFeed: new PublicKey(feed),
          })
          .signers([keypair])
          .rpc();

        success("Oracle feed updated!");
        printTx(sig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  // ── oracle update-params ──
  oracle
    .command("update-params")
    .description("Update oracle parameters")
    .option("--spread <bps>", "New spread in basis points")
    .option("--max-stale-slots <n>", "New max staleness")
    .option("--min-samples <n>", "New min samples")
    .option("--active <bool>", "Enable/disable oracle")
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const keypair = loadKeypair(opts.keypair);
        const provider = getProvider(connection, keypair);
        const oracleProgram = await getOracleProgram(provider);

        const stablecoinMint = new PublicKey(config.mint);
        const [oracleConfigPda] = findOracleConfigPda(
          stablecoinMint,
          oracleProgram.programId
        );

        const sig = await (oracleProgram.methods as any)
          .updateOracleParams({
            maxStaleSlots: opts.maxStaleSlots
              ? new BN(parseInt(opts.maxStaleSlots))
              : null,
            minSamples: opts.minSamples ? parseInt(opts.minSamples) : null,
            spreadBps: opts.spread ? parseInt(opts.spread) : null,
            isActive: opts.active !== undefined ? opts.active === "true" : null,
          })
          .accounts({
            authority: keypair.publicKey,
            oracleConfig: oracleConfigPda,
          })
          .signers([keypair])
          .rpc();

        success("Oracle params updated!");
        printTx(sig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });

  // ── oracle withdraw-fees ──
  oracle
    .command("withdraw-fees")
    .description("Withdraw accumulated spread fees from the vault")
    .argument("<amount>", "Amount to withdraw")
    .option("--to <pubkey>", "Destination token account")
    .option("--keypair <path>", "Path to keypair")
    .option("--network <url>", "RPC URL")
    .action(async (amount, opts) => {
      try {
        const config = loadConfig();
        const network = opts.network || config.network || getNetwork();
        const connection = getConnection(network);
        const keypair = loadKeypair(opts.keypair);
        const provider = getProvider(connection, keypair);
        const oracleProgram = await getOracleProgram(provider);

        const stablecoinMint = new PublicKey(config.mint);
        const [oracleConfigPda] = findOracleConfigPda(
          stablecoinMint,
          oracleProgram.programId
        );
        const [vaultAuthority] = findVaultAuthorityPda(
          oracleConfigPda,
          oracleProgram.programId
        );

        const oracleData = await (
          oracleProgram.account as any
        ).oracleConfig.fetch(oracleConfigPda);

        const { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } =
          await import("@solana/spl-token");

        const destination = opts.to
          ? new PublicKey(opts.to)
          : getAssociatedTokenAddressSync(
              oracleData.collateralMint,
              keypair.publicKey,
              false,
              TOKEN_PROGRAM_ID
            );

        const withdrawAmount = parseAmount(
          amount,
          oracleData.collateralDecimals
        );

        const sig = await (oracleProgram.methods as any)
          .withdrawFees(withdrawAmount)
          .accounts({
            authority: keypair.publicKey,
            oracleConfig: oracleConfigPda,
            vaultAuthority,
            collateralVault: oracleData.vault,
            destination,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([keypair])
          .rpc();

        success(`Withdrew ${amount} collateral fees!`);
        printTx(sig, network);
      } catch (err: any) {
        error(err.message || err);
        process.exit(1);
      }
    });
}
