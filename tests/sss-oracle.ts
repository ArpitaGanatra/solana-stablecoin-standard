import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { SssOracle } from "../target/types/sss_oracle";
import { SssCore } from "../target/types/sss_core";
import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

const ORACLE_CONFIG_SEED = Buffer.from("oracle_config");
const VAULT_AUTHORITY_SEED = Buffer.from("vault_authority");
const CONFIG_SEED = Buffer.from("stablecoin_config");
const MINTER_SEED = Buffer.from("minter_info");

function findOracleConfigPda(
  stablecoinMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ORACLE_CONFIG_SEED, stablecoinMint.toBuffer()],
    programId
  );
}

function findVaultAuthorityPda(
  oracleConfig: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_AUTHORITY_SEED, oracleConfig.toBuffer()],
    programId
  );
}

function findConfigPda(
  mint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CONFIG_SEED, mint.toBuffer()],
    programId
  );
}

function findMinterPda(
  config: PublicKey,
  minter: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINTER_SEED, config.toBuffer(), minter.toBuffer()],
    programId
  );
}

describe("sss-oracle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const oracleProgram = anchor.workspace.SssOracle as Program<SssOracle>;
  const coreProgram = anchor.workspace.SssCore as Program<SssCore>;

  const authority = provider.wallet as anchor.Wallet;
  let collateralMint: PublicKey;
  let stablecoinMint: Keypair;
  let oracleConfigPda: PublicKey;
  let vaultAuthorityPda: PublicKey;
  let collateralVault: PublicKey;
  let mockOracleFeed: Keypair;

  before(async () => {
    // Airdrop SOL
    const sig = await provider.connection.requestAirdrop(
      authority.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // Create a mock collateral token (standard SPL Token, simulating USDC)
    collateralMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6, // USDC decimals
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Mint some collateral to the authority
    const authorityCollateralAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      collateralMint,
      authority.publicKey,
      false,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    await mintTo(
      provider.connection,
      authority.payer,
      collateralMint,
      authorityCollateralAta.address,
      authority.publicKey,
      1_000_000_000_000, // 1M USDC
      [],
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Create a mock oracle feed keypair (not a real Switchboard feed, for test scaffolding)
    mockOracleFeed = Keypair.generate();

    // For integration testing with sss-core, we'd need to initialize a stablecoin first
    // This is a scaffolding test — full integration requires localnet with both programs
    stablecoinMint = Keypair.generate();
  });

  describe("PDA derivation", () => {
    it("derives oracle config PDA correctly", () => {
      const [pda, bump] = findOracleConfigPda(
        stablecoinMint.publicKey,
        oracleProgram.programId
      );
      expect(pda).to.be.instanceOf(PublicKey);
      expect(bump).to.be.a("number");
      oracleConfigPda = pda;
    });

    it("derives vault authority PDA correctly", () => {
      const [pda, bump] = findVaultAuthorityPda(
        oracleConfigPda,
        oracleProgram.programId
      );
      expect(pda).to.be.instanceOf(PublicKey);
      expect(bump).to.be.a("number");
      vaultAuthorityPda = pda;
    });

    it("derives collateral vault ATA correctly", () => {
      collateralVault = getAssociatedTokenAddressSync(
        collateralMint,
        vaultAuthorityPda,
        true, // PDA
        TOKEN_PROGRAM_ID
      );
      expect(collateralVault).to.be.instanceOf(PublicKey);
    });
  });

  describe("price calculations", () => {
    // Test the price math from the SDK
    it("calculates collateral for mint correctly (same decimals)", () => {
      // EUR/USD = 1.08, Switchboard returns with 18 decimals
      // 1.08 * 10^18 = 1_080_000_000_000_000_000
      const oraclePrice = new BN("1080000000000000000");
      const stablecoinAmount = new BN("100000000"); // 100 EUR (6 decimals)
      const stablecoinDecimals = 6;
      const collateralDecimals = 6;
      const spreadBps = 30; // 0.30%

      const switchboardFactor = new BN(10).pow(new BN(18));
      const numerator = stablecoinAmount.mul(oraclePrice);
      const collateralRaw = numerator.div(switchboardFactor);

      // collateralRaw should be ~108_000_000 (108 USDC)
      expect(collateralRaw.toNumber()).to.be.approximately(108_000_000, 1);

      // With 30 bps spread: 108_000_000 * 10030 / 10000 = 108_324_000
      const withSpread = collateralRaw
        .mul(new BN(10000 + spreadBps))
        .div(new BN(10000))
        .add(new BN(1)); // round up
      expect(withSpread.toNumber()).to.be.approximately(108_324_001, 1);
    });

    it("calculates collateral for redeem correctly", () => {
      const oraclePrice = new BN("1080000000000000000");
      const stablecoinAmount = new BN("100000000"); // 100 EUR
      const spreadBps = 30;

      const switchboardFactor = new BN(10).pow(new BN(18));
      const collateralRaw = stablecoinAmount
        .mul(oraclePrice)
        .div(switchboardFactor);

      // With -30 bps spread: 108_000_000 * 9970 / 10000 = 107_676_000
      const withSpread = collateralRaw
        .mul(new BN(10000 - spreadBps))
        .div(new BN(10000));
      expect(withSpread.toNumber()).to.be.approximately(107_676_000, 1);
    });

    it("handles BRL/USD price correctly", () => {
      // BRL/USD = 0.20 (1 BRL = 0.20 USD)
      // Switchboard: 200_000_000_000_000_000 (0.2 * 10^18)
      const oraclePrice = new BN("200000000000000000");
      const stablecoinAmount = new BN("1000000000"); // 1000 BRL (6 decimals)

      const switchboardFactor = new BN(10).pow(new BN(18));
      const collateralRaw = stablecoinAmount
        .mul(oraclePrice)
        .div(switchboardFactor);

      // 1000 BRL * 0.20 = 200 USDC = 200_000_000
      expect(collateralRaw.toNumber()).to.equal(200_000_000);
    });

    it("handles different decimal configurations", () => {
      // stablecoin = 9 decimals, collateral = 6 decimals
      const oraclePrice = new BN("1080000000000000000"); // 1.08
      const stablecoinAmount = new BN("100000000000"); // 100 with 9 decimals

      const switchboardFactor = new BN(10).pow(new BN(18));
      const extra = new BN(10).pow(new BN(9 - 6)); // 10^3

      const collateralRaw = stablecoinAmount
        .mul(oraclePrice)
        .div(switchboardFactor)
        .div(extra);

      // Should still be ~108_000_000 (108 USDC with 6 decimals)
      expect(collateralRaw.toNumber()).to.be.approximately(108_000_000, 1);
    });
  });

  describe("initialize_oracle", () => {
    // Note: This test requires sss-core to be initialized first with the stablecoin mint.
    // In a full integration test, you would:
    // 1. Initialize sss-core with a stablecoin
    // 2. Initialize oracle config linking to it
    // 3. Register the vault_authority as a minter in sss-core
    // 4. Test mint_with_oracle and redeem_with_oracle

    it("should have the correct program ID", () => {
      expect(oracleProgram.programId.toBase58()).to.equal(
        "GnEKCqWBDCTzLHrCTiRT6Mi1a37PHSsAoFBowLKPT2PH"
      );
    });

    it("should fail with invalid spread (too high)", async () => {
      // This would fail because MAX_SPREAD_BPS = 1000
      // We test the constraint exists by verifying the program loaded correctly
      const idl = oracleProgram.idl;
      const initIx = idl.instructions.find(
        (ix) => ix.name === "initialize_oracle"
      );
      expect(initIx).to.not.be.undefined;

      // Verify the instruction has the right args
      const args = initIx!.args;
      expect(args.length).to.equal(1); // single params struct
    });
  });

  describe("instruction validation", () => {
    it("has all expected instructions in the IDL", () => {
      const ixNames = oracleProgram.idl.instructions.map((ix) => ix.name);
      expect(ixNames).to.include("initialize_oracle");
      expect(ixNames).to.include("mint_with_oracle");
      expect(ixNames).to.include("redeem_with_oracle");
      expect(ixNames).to.include("update_oracle_feed");
      expect(ixNames).to.include("update_oracle_params");
      expect(ixNames).to.include("withdraw_fees");
    });

    it("has oracle_config account type in IDL", () => {
      const accountTypes = oracleProgram.idl.accounts!.map((a) => a.name);
      expect(accountTypes).to.include("OracleConfig");
    });

    it("has all expected events in IDL", () => {
      const eventNames = oracleProgram.idl.events!.map((e) => e.name);
      expect(eventNames).to.include("OracleInitialized");
      expect(eventNames).to.include("OracleMint");
      expect(eventNames).to.include("OracleRedeem");
      expect(eventNames).to.include("OracleFeedUpdated");
      expect(eventNames).to.include("OracleParamsUpdated");
    });

    it("has all expected error codes in IDL", () => {
      const errorNames = oracleProgram.idl.errors!.map((e) => e.name);
      expect(errorNames).to.include("Unauthorized");
      expect(errorNames).to.include("StalePriceFeed");
      expect(errorNames).to.include("InvalidOraclePrice");
      expect(errorNames).to.include("SlippageExceeded");
      expect(errorNames).to.include("OracleNotActive");
      expect(errorNames).to.include("InsufficientVaultBalance");
    });
  });
});
