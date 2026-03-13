import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SssCore } from "../target/types/sss_core";
import { SssTransferHook } from "../target/types/sss_transfer_hook";
import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const CONFIG_SEED = Buffer.from("stablecoin_config");
const MINTER_SEED = Buffer.from("minter_info");
const BLACKLIST_SEED = Buffer.from("blacklist_seed");

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

function findBlacklistPda(
  config: PublicKey,
  address: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BLACKLIST_SEED, config.toBuffer(), address.toBuffer()],
    programId
  );
}

async function airdrop(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  sol: number = 10
) {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

async function createAta(
  connection: anchor.web3.Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const ix = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    owner,
    mint,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const tx = new anchor.web3.Transaction().add(ix);
  await anchor.web3.sendAndConfirmTransaction(connection, tx, [payer]);
  return ata;
}

// Build remaining accounts needed for transfer_checked on mints with transfer hooks.
// These are forwarded through the CPI: sss_core -> Token-2022 -> transfer_hook
function getTransferHookRemainingAccounts(
  mint: PublicKey,
  config: PublicKey,
  sourceOwner: PublicKey,
  destOwner: PublicKey,
  hookProgramId: PublicKey,
  coreProgramId: PublicKey
): anchor.web3.AccountMeta[] {
  const [extraMetaList] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.toBuffer()],
    hookProgramId
  );
  const [sourceBlacklist] = findBlacklistPda(config, sourceOwner, coreProgramId);
  const [destBlacklist] = findBlacklistPda(config, destOwner, coreProgramId);

  return [
    // Extra account meta list (Token-2022 reads this to resolve extra accounts)
    { pubkey: extraMetaList, isSigner: false, isWritable: false },
    // Resolved extra metas (in order defined in InitializeExtraAccountMetaList):
    { pubkey: coreProgramId, isSigner: false, isWritable: false },    // sss-core program
    { pubkey: config, isSigner: false, isWritable: false },            // config PDA
    { pubkey: sourceBlacklist, isSigner: false, isWritable: false },   // source blacklist
    { pubkey: destBlacklist, isSigner: false, isWritable: false },     // dest blacklist
    // Hook program (must be last — Token-2022 invokes this)
    { pubkey: hookProgramId, isSigner: false, isWritable: false },
  ];
}

describe("sss-core", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.sssCore as Program<SssCore>;
  const hookProgram = anchor.workspace
    .sssTransferHook as Program<SssTransferHook>;
  const connection = provider.connection;
  const authority = provider.wallet as anchor.Wallet;

  // Shared state for SSS-1 tests
  let sss1Mint: Keypair;
  let sss1Config: PublicKey;
  let sss1Ata: PublicKey;

  // Shared state for SSS-2 tests
  let sss2Mint: Keypair;
  let sss2Config: PublicKey;
  let treasuryAta: PublicKey;

  // Extra keypairs
  const minterKp = Keypair.generate();
  const pauserKp = Keypair.generate();
  const burnerKp = Keypair.generate();
  const freezerKp = Keypair.generate();
  const blacklisterKp = Keypair.generate();
  const seizerKp = Keypair.generate();
  const newAuthorityKp = Keypair.generate();
  const recipientKp = Keypair.generate();
  const unauthorizedKp = Keypair.generate();

  before(async () => {
    // Airdrop to all keypairs that will sign transactions
    await Promise.all([
      airdrop(connection, minterKp.publicKey),
      airdrop(connection, pauserKp.publicKey),
      airdrop(connection, burnerKp.publicKey),
      airdrop(connection, freezerKp.publicKey),
      airdrop(connection, blacklisterKp.publicKey),
      airdrop(connection, seizerKp.publicKey),
      airdrop(connection, newAuthorityKp.publicKey),
      airdrop(connection, recipientKp.publicKey),
      airdrop(connection, unauthorizedKp.publicKey),
    ]);
  });

  // =========================================================================
  // SSS-1: Minimal Stablecoin
  // =========================================================================
  describe("SSS-1: Minimal Stablecoin", () => {
    describe("initialize", () => {
      it("initializes an SSS-1 stablecoin with metadata", async () => {
        sss1Mint = Keypair.generate();
        [sss1Config] = findConfigPda(sss1Mint.publicKey, program.programId);

        await program.methods
          .initialize({
            decimals: 6,
            enableMetadata: true,
            name: "Test USD",
            symbol: "TUSD",
            uri: "https://example.com/metadata.json",
            additionalMetadata: [],
            enablePermanentDelegate: false,
            enableTransferHook: false,
            defaultAccountFrozen: false,
            transferHookProgramId: null,
          })
          .accounts({
            authority: authority.publicKey,
            mint: sss1Mint.publicKey,
            config: sss1Config,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([sss1Mint])
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(sss1Config);
        expect(config.authority.toBase58()).to.equal(
          authority.publicKey.toBase58()
        );
        expect(config.mint.toBase58()).to.equal(sss1Mint.publicKey.toBase58());
        expect(config.decimals).to.equal(6);
        expect(config.isPaused).to.be.false;
        expect(config.hasMetadata).to.be.true;
        expect(config.enablePermanentDelegate).to.be.false;
        expect(config.enableTransferHook).to.be.false;
        expect(config.defaultAccountFrozen).to.be.false;
        expect(config.totalMinters).to.equal(0);
        // All roles default to authority
        expect(config.pauser.toBase58()).to.equal(
          authority.publicKey.toBase58()
        );
        expect(config.burner.toBase58()).to.equal(
          authority.publicKey.toBase58()
        );
        expect(config.freezer.toBase58()).to.equal(
          authority.publicKey.toBase58()
        );
      });

      it("fails with name too long", async () => {
        const badMint = Keypair.generate();
        const [badConfig] = findConfigPda(badMint.publicKey, program.programId);

        try {
          await program.methods
            .initialize({
              decimals: 6,
              enableMetadata: true,
              name: "A".repeat(33),
              symbol: "TUSD",
              uri: "https://example.com/metadata.json",
              additionalMetadata: [],
              enablePermanentDelegate: false,
              enableTransferHook: false,
              defaultAccountFrozen: false,
              transferHookProgramId: null,
            })
            .accounts({
              authority: authority.publicKey,
              mint: badMint.publicKey,
              config: badConfig,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([badMint])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("NameTooLong");
        }
      });

      it("fails with symbol too long", async () => {
        const badMint = Keypair.generate();
        const [badConfig] = findConfigPda(badMint.publicKey, program.programId);

        try {
          await program.methods
            .initialize({
              decimals: 6,
              enableMetadata: true,
              name: "Test",
              symbol: "A".repeat(11),
              uri: "https://example.com/metadata.json",
              additionalMetadata: [],
              enablePermanentDelegate: false,
              enableTransferHook: false,
              defaultAccountFrozen: false,
              transferHookProgramId: null,
            })
            .accounts({
              authority: authority.publicKey,
              mint: badMint.publicKey,
              config: badConfig,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([badMint])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("SymbolTooLong");
        }
      });

      it("fails when metadata enabled but no URI", async () => {
        const badMint = Keypair.generate();
        const [badConfig] = findConfigPda(badMint.publicKey, program.programId);

        try {
          await program.methods
            .initialize({
              decimals: 6,
              enableMetadata: true,
              name: "Test",
              symbol: "TST",
              uri: "",
              additionalMetadata: [],
              enablePermanentDelegate: false,
              enableTransferHook: false,
              defaultAccountFrozen: false,
              transferHookProgramId: null,
            })
            .accounts({
              authority: authority.publicKey,
              mint: badMint.publicKey,
              config: badConfig,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([badMint])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("UriRequired");
        }
      });

      it("initializes without metadata (SSS-1 minimal)", async () => {
        const noMetaMint = Keypair.generate();
        const [noMetaConfig] = findConfigPda(
          noMetaMint.publicKey,
          program.programId
        );

        await program.methods
          .initialize({
            decimals: 9,
            enableMetadata: false,
            name: "",
            symbol: "",
            uri: "",
            additionalMetadata: [],
            enablePermanentDelegate: false,
            enableTransferHook: false,
            defaultAccountFrozen: false,
            transferHookProgramId: null,
          })
          .accounts({
            authority: authority.publicKey,
            mint: noMetaMint.publicKey,
            config: noMetaConfig,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([noMetaMint])
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(
          noMetaConfig
        );
        expect(config.hasMetadata).to.be.false;
        expect(config.decimals).to.equal(9);
      });
    });

    describe("add_minter", () => {
      it("adds a minter with quota", async () => {
        const [minterPda] = findMinterPda(
          sss1Config,
          minterKp.publicKey,
          program.programId
        );

        await program.methods
          .addMinter(minterKp.publicKey, new anchor.BN(1_000_000), false)
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
            minterInfo: minterPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        const minterInfo = await program.account.minterInfo.fetch(minterPda);
        expect(minterInfo.minter.toBase58()).to.equal(
          minterKp.publicKey.toBase58()
        );
        expect(minterInfo.quota.toNumber()).to.equal(1_000_000);
        expect(minterInfo.minted.toNumber()).to.equal(0);
        expect(minterInfo.active).to.be.true;
        expect(minterInfo.unlimited).to.be.false;

        const config = await program.account.stablecoinConfig.fetch(sss1Config);
        expect(config.totalMinters).to.equal(1);
      });

      it("fails when non-authority tries to add minter", async () => {
        const [minterPda] = findMinterPda(
          sss1Config,
          unauthorizedKp.publicKey,
          program.programId
        );

        try {
          await program.methods
            .addMinter(unauthorizedKp.publicKey, new anchor.BN(1000), false)
            .accounts({
              authority: unauthorizedKp.publicKey,
              config: sss1Config,
              minterInfo: minterPda,
              systemProgram: SystemProgram.programId,
            })
            .signers([unauthorizedKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("InvalidAuthority");
        }
      });

      it("fails with non-zero quota when unlimited is true", async () => {
        const tempMinter = Keypair.generate();
        const [minterPda] = findMinterPda(
          sss1Config,
          tempMinter.publicKey,
          program.programId
        );

        try {
          await program.methods
            .addMinter(tempMinter.publicKey, new anchor.BN(1000), true)
            .accounts({
              authority: authority.publicKey,
              config: sss1Config,
              minterInfo: minterPda,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("InvalidQuotaForUnlimited");
        }
      });
    });

    describe("mint_tokens", () => {
      before(async () => {
        sss1Ata = await createAta(
          connection,
          (authority as any).payer,
          sss1Mint.publicKey,
          recipientKp.publicKey
        );
      });

      it("mints tokens within quota", async () => {
        const [minterPda] = findMinterPda(
          sss1Config,
          minterKp.publicKey,
          program.programId
        );

        await program.methods
          .mintTokens(new anchor.BN(500_000))
          .accounts({
            minter: minterKp.publicKey,
            config: sss1Config,
            minterInfo: minterPda,
            mint: sss1Mint.publicKey,
            tokenAccount: sss1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([minterKp])
          .rpc();

        const minterInfo = await program.account.minterInfo.fetch(minterPda);
        expect(minterInfo.minted.toNumber()).to.equal(500_000);
      });

      it("fails when minting exceeds quota", async () => {
        const [minterPda] = findMinterPda(
          sss1Config,
          minterKp.publicKey,
          program.programId
        );

        try {
          await program.methods
            .mintTokens(new anchor.BN(600_000)) // 500k already minted + 600k > 1M quota
            .accounts({
              minter: minterKp.publicKey,
              config: sss1Config,
              minterInfo: minterPda,
              mint: sss1Mint.publicKey,
              tokenAccount: sss1Ata,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([minterKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("MinterQuotaExceeded");
        }
      });

      it("fails with zero amount", async () => {
        const [minterPda] = findMinterPda(
          sss1Config,
          minterKp.publicKey,
          program.programId
        );

        try {
          await program.methods
            .mintTokens(new anchor.BN(0))
            .accounts({
              minter: minterKp.publicKey,
              config: sss1Config,
              minterInfo: minterPda,
              mint: sss1Mint.publicKey,
              tokenAccount: sss1Ata,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([minterKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("InvalidAmount");
        }
      });
    });

    describe("update_minter", () => {
      it("updates minter quota and active status", async () => {
        const [minterPda] = findMinterPda(
          sss1Config,
          minterKp.publicKey,
          program.programId
        );

        await program.methods
          .updateMinter(
            minterKp.publicKey,
            new anchor.BN(2_000_000),
            true,
            false
          )
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
            minterInfo: minterPda,
          })
          .rpc();

        const minterInfo = await program.account.minterInfo.fetch(minterPda);
        expect(minterInfo.quota.toNumber()).to.equal(2_000_000);
        expect(minterInfo.active).to.be.true;
      });

      it("deactivates a minter and blocks minting", async () => {
        const [minterPda] = findMinterPda(
          sss1Config,
          minterKp.publicKey,
          program.programId
        );

        await program.methods
          .updateMinter(
            minterKp.publicKey,
            new anchor.BN(2_000_000),
            false,
            false
          )
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
            minterInfo: minterPda,
          })
          .rpc();

        try {
          await program.methods
            .mintTokens(new anchor.BN(100))
            .accounts({
              minter: minterKp.publicKey,
              config: sss1Config,
              minterInfo: minterPda,
              mint: sss1Mint.publicKey,
              tokenAccount: sss1Ata,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([minterKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("MinterNotActive");
        }

        // Re-activate for later tests
        await program.methods
          .updateMinter(
            minterKp.publicKey,
            new anchor.BN(2_000_000),
            true,
            false
          )
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
            minterInfo: minterPda,
          })
          .rpc();
      });
    });

    describe("burn_tokens", () => {
      let burnerAta: PublicKey;

      before(async () => {
        burnerAta = await createAta(
          connection,
          (authority as any).payer,
          sss1Mint.publicKey,
          authority.publicKey
        );

        // Add authority as unlimited minter for setup
        const [tempMinterPda] = findMinterPda(
          sss1Config,
          authority.publicKey,
          program.programId
        );

        await program.methods
          .addMinter(authority.publicKey, new anchor.BN(0), true)
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
            minterInfo: tempMinterPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        await program.methods
          .mintTokens(new anchor.BN(1_000_000))
          .accounts({
            minter: authority.publicKey,
            config: sss1Config,
            minterInfo: tempMinterPda,
            mint: sss1Mint.publicKey,
            tokenAccount: burnerAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
      });

      it("burns tokens (SSS-1: burner burns own tokens)", async () => {
        await program.methods
          .burnTokens(new anchor.BN(100_000))
          .accounts({
            burner: authority.publicKey,
            config: sss1Config,
            mint: sss1Mint.publicKey,
            tokenAccount: burnerAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
      });

      it("fails with zero amount", async () => {
        try {
          await program.methods
            .burnTokens(new anchor.BN(0))
            .accounts({
              burner: authority.publicKey,
              config: sss1Config,
              mint: sss1Mint.publicKey,
              tokenAccount: burnerAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("InvalidAmount");
        }
      });

      it("fails when non-burner tries to burn", async () => {
        try {
          await program.methods
            .burnTokens(new anchor.BN(1000))
            .accounts({
              burner: unauthorizedKp.publicKey,
              config: sss1Config,
              mint: sss1Mint.publicKey,
              tokenAccount: burnerAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([unauthorizedKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Unauthorized");
        }
      });
    });

    describe("freeze_account / thaw_account", () => {
      it("freezes a token account", async () => {
        await program.methods
          .freezeAccount()
          .accounts({
            freezer: authority.publicKey,
            config: sss1Config,
            mint: sss1Mint.publicKey,
            tokenAccount: sss1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
      });

      it("fails when non-freezer tries to freeze", async () => {
        // Create another ATA to try freezing
        try {
          await program.methods
            .freezeAccount()
            .accounts({
              freezer: unauthorizedKp.publicKey,
              config: sss1Config,
              mint: sss1Mint.publicKey,
              tokenAccount: sss1Ata,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([unauthorizedKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Unauthorized");
        }
      });

      it("thaws a frozen token account", async () => {
        await program.methods
          .thawAccount()
          .accounts({
            freezer: authority.publicKey,
            config: sss1Config,
            mint: sss1Mint.publicKey,
            tokenAccount: sss1Ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
      });
    });

    describe("pause / unpause", () => {
      it("pauses the stablecoin", async () => {
        await program.methods
          .pause()
          .accounts({
            pauser: authority.publicKey,
            config: sss1Config,
          })
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(sss1Config);
        expect(config.isPaused).to.be.true;
      });

      it("fails to pause when already paused", async () => {
        try {
          await program.methods
            .pause()
            .accounts({
              pauser: authority.publicKey,
              config: sss1Config,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Paused");
        }
      });

      it("blocks minting while paused", async () => {
        const [minterPda] = findMinterPda(
          sss1Config,
          minterKp.publicKey,
          program.programId
        );

        try {
          await program.methods
            .mintTokens(new anchor.BN(100))
            .accounts({
              minter: minterKp.publicKey,
              config: sss1Config,
              minterInfo: minterPda,
              mint: sss1Mint.publicKey,
              tokenAccount: sss1Ata,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([minterKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Paused");
        }
      });

      it("blocks freezing while paused", async () => {
        try {
          await program.methods
            .freezeAccount()
            .accounts({
              freezer: authority.publicKey,
              config: sss1Config,
              mint: sss1Mint.publicKey,
              tokenAccount: sss1Ata,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Paused");
        }
      });

      it("blocks burning while paused", async () => {
        const burnerAta = getAssociatedTokenAddressSync(
          sss1Mint.publicKey,
          authority.publicKey,
          true,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        try {
          await program.methods
            .burnTokens(new anchor.BN(100))
            .accounts({
              burner: authority.publicKey,
              config: sss1Config,
              mint: sss1Mint.publicKey,
              tokenAccount: burnerAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Paused");
        }
      });

      it("fails when non-pauser tries to unpause", async () => {
        try {
          await program.methods
            .unpause()
            .accounts({
              pauser: unauthorizedKp.publicKey,
              config: sss1Config,
            })
            .signers([unauthorizedKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Unauthorized");
        }
      });

      it("unpauses the stablecoin", async () => {
        await program.methods
          .unpause()
          .accounts({
            pauser: authority.publicKey,
            config: sss1Config,
          })
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(sss1Config);
        expect(config.isPaused).to.be.false;
      });

      it("fails to unpause when not paused", async () => {
        try {
          await program.methods
            .unpause()
            .accounts({
              pauser: authority.publicKey,
              config: sss1Config,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("NotPaused");
        }
      });
    });

    describe("update_roles", () => {
      it("updates pauser role", async () => {
        await program.methods
          .updateRoles({
            newPauser: pauserKp.publicKey,
            newBurner: null,
            newFreezer: null,
            newBlacklister: null,
            newSeizer: null,
          })
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
          })
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(sss1Config);
        expect(config.pauser.toBase58()).to.equal(
          pauserKp.publicKey.toBase58()
        );
      });

      it("updated pauser can pause", async () => {
        await program.methods
          .pause()
          .accounts({
            pauser: pauserKp.publicKey,
            config: sss1Config,
          })
          .signers([pauserKp])
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(sss1Config);
        expect(config.isPaused).to.be.true;

        // Unpause for later tests
        await program.methods
          .unpause()
          .accounts({
            pauser: pauserKp.publicKey,
            config: sss1Config,
          })
          .signers([pauserKp])
          .rpc();
      });

      it("old pauser can no longer pause", async () => {
        try {
          await program.methods
            .pause()
            .accounts({
              pauser: authority.publicKey,
              config: sss1Config,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Unauthorized");
        }
      });

      it("updates multiple roles at once", async () => {
        await program.methods
          .updateRoles({
            newPauser: pauserKp.publicKey,
            newBurner: burnerKp.publicKey,
            newFreezer: freezerKp.publicKey,
            newBlacklister: blacklisterKp.publicKey,
            newSeizer: seizerKp.publicKey,
          })
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
          })
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(sss1Config);
        expect(config.burner.toBase58()).to.equal(
          burnerKp.publicKey.toBase58()
        );
        expect(config.freezer.toBase58()).to.equal(
          freezerKp.publicKey.toBase58()
        );
        expect(config.blacklister.toBase58()).to.equal(
          blacklisterKp.publicKey.toBase58()
        );
        expect(config.seizer.toBase58()).to.equal(
          seizerKp.publicKey.toBase58()
        );
      });

      it("rejects zero address for roles", async () => {
        try {
          await program.methods
            .updateRoles({
              newPauser: PublicKey.default,
              newBurner: null,
              newFreezer: null,
              newBlacklister: null,
              newSeizer: null,
            })
            .accounts({
              authority: authority.publicKey,
              config: sss1Config,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("ZeroAddress");
        }
      });

      it("fails when non-authority updates roles", async () => {
        try {
          await program.methods
            .updateRoles({
              newPauser: unauthorizedKp.publicKey,
              newBurner: null,
              newFreezer: null,
              newBlacklister: null,
              newSeizer: null,
            })
            .accounts({
              authority: unauthorizedKp.publicKey,
              config: sss1Config,
            })
            .signers([unauthorizedKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("InvalidAuthority");
        }
      });
    });

    describe("transfer_authority (2-step)", () => {
      it("proposes authority transfer", async () => {
        await program.methods
          .transferAuthority(newAuthorityKp.publicKey)
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
          })
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(sss1Config);
        expect(config.pendingAuthority.toBase58()).to.equal(
          newAuthorityKp.publicKey.toBase58()
        );
      });

      it("fails when proposing self as new authority", async () => {
        const freshMint = Keypair.generate();
        const [freshConfig] = findConfigPda(
          freshMint.publicKey,
          program.programId
        );

        await program.methods
          .initialize({
            decimals: 6,
            enableMetadata: false,
            name: "",
            symbol: "",
            uri: "",
            additionalMetadata: [],
            enablePermanentDelegate: false,
            enableTransferHook: false,
            defaultAccountFrozen: false,
            transferHookProgramId: null,
          })
          .accounts({
            authority: authority.publicKey,
            mint: freshMint.publicKey,
            config: freshConfig,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([freshMint])
          .rpc();

        try {
          await program.methods
            .transferAuthority(authority.publicKey)
            .accounts({
              authority: authority.publicKey,
              config: freshConfig,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("InvalidAuthority");
        }
      });

      it("cancels authority transfer", async () => {
        await program.methods
          .cancelAuthorityTransfer()
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
          })
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(sss1Config);
        expect(config.pendingAuthority).to.be.null;
      });

      it("fails to cancel when no pending authority", async () => {
        try {
          await program.methods
            .cancelAuthorityTransfer()
            .accounts({
              authority: authority.publicKey,
              config: sss1Config,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("NoPendingAuthority");
        }
      });

      it("accepts authority transfer", async () => {
        // Propose
        await program.methods
          .transferAuthority(newAuthorityKp.publicKey)
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
          })
          .rpc();

        // Accept
        await program.methods
          .acceptAuthority()
          .accounts({
            newAuthority: newAuthorityKp.publicKey,
            config: sss1Config,
          })
          .signers([newAuthorityKp])
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(sss1Config);
        expect(config.authority.toBase58()).to.equal(
          newAuthorityKp.publicKey.toBase58()
        );
        expect(config.pendingAuthority).to.be.null;
      });

      it("unauthorized cannot accept authority", async () => {
        // Transfer authority back: propose from newAuthority
        await program.methods
          .transferAuthority(authority.publicKey)
          .accounts({
            authority: newAuthorityKp.publicKey,
            config: sss1Config,
          })
          .signers([newAuthorityKp])
          .rpc();

        try {
          await program.methods
            .acceptAuthority()
            .accounts({
              newAuthority: unauthorizedKp.publicKey,
              config: sss1Config,
            })
            .signers([unauthorizedKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Unauthorized");
        }

        // Accept it properly to restore authority
        await program.methods
          .acceptAuthority()
          .accounts({
            newAuthority: authority.publicKey,
            config: sss1Config,
          })
          .rpc();
      });
    });

    describe("remove_minter", () => {
      it("removes a minter and decrements count", async () => {
        const tempMinter = Keypair.generate();
        const [tempMinterPda] = findMinterPda(
          sss1Config,
          tempMinter.publicKey,
          program.programId
        );

        await program.methods
          .addMinter(tempMinter.publicKey, new anchor.BN(1000), false)
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
            minterInfo: tempMinterPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        const configBefore = await program.account.stablecoinConfig.fetch(
          sss1Config
        );
        const mintersBefore = configBefore.totalMinters;

        await program.methods
          .removeMinter(tempMinter.publicKey)
          .accounts({
            authority: authority.publicKey,
            config: sss1Config,
            minterInfo: tempMinterPda,
          })
          .rpc();

        const configAfter = await program.account.stablecoinConfig.fetch(
          sss1Config
        );
        expect(configAfter.totalMinters).to.equal(mintersBefore - 1);

        // Verify account is closed
        const minterAccount = await connection.getAccountInfo(tempMinterPda);
        expect(minterAccount).to.be.null;
      });
    });
  });

  // =========================================================================
  // SSS-2: Compliant Stablecoin
  // =========================================================================
  describe("SSS-2: Compliant Stablecoin", () => {
    describe("initialize with compliance features", () => {
      it("initializes SSS-2 with permanent delegate + transfer hook", async () => {
        sss2Mint = Keypair.generate();
        [sss2Config] = findConfigPda(sss2Mint.publicKey, program.programId);

        await program.methods
          .initialize({
            decimals: 6,
            enableMetadata: true,
            name: "Compliant USD",
            symbol: "CUSD",
            uri: "https://example.com/cusd.json",
            additionalMetadata: [{ key: "issuer", value: "TestCorp" }],
            enablePermanentDelegate: true,
            enableTransferHook: true,
            defaultAccountFrozen: false,
            transferHookProgramId: hookProgram.programId,
          })
          .accounts({
            authority: authority.publicKey,
            mint: sss2Mint.publicKey,
            config: sss2Config,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([sss2Mint])
          .rpc();

        const config = await program.account.stablecoinConfig.fetch(sss2Config);
        expect(config.enablePermanentDelegate).to.be.true;
        expect(config.enableTransferHook).to.be.true;
        expect(config.decimals).to.equal(6);
        expect(config.hasMetadata).to.be.true;
      });

      it("fails when transfer hook enabled without program ID", async () => {
        const badMint = Keypair.generate();
        const [badConfig] = findConfigPda(badMint.publicKey, program.programId);

        try {
          await program.methods
            .initialize({
              decimals: 6,
              enableMetadata: false,
              name: "",
              symbol: "",
              uri: "",
              additionalMetadata: [],
              enablePermanentDelegate: false,
              enableTransferHook: true,
              defaultAccountFrozen: false,
              transferHookProgramId: null,
            })
            .accounts({
              authority: authority.publicKey,
              mint: badMint.publicKey,
              config: badConfig,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([badMint])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("TransferHookProgramRequired");
        }
      });
    });

    describe("blacklist (SSS-2)", () => {
      const blacklistTarget = Keypair.generate();

      before(async () => {
        // Set roles for SSS-2
        await program.methods
          .updateRoles({
            newPauser: null,
            newBurner: authority.publicKey,
            newFreezer: null,
            newBlacklister: blacklisterKp.publicKey,
            newSeizer: seizerKp.publicKey,
          })
          .accounts({
            authority: authority.publicKey,
            config: sss2Config,
          })
          .rpc();
      });

      it("adds address to blacklist", async () => {
        const [blacklistPda] = findBlacklistPda(
          sss2Config,
          blacklistTarget.publicKey,
          program.programId
        );

        await program.methods
          .blacklistAddress(blacklistTarget.publicKey)
          .accounts({
            blacklister: blacklisterKp.publicKey,
            config: sss2Config,
            blacklistEntry: blacklistPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([blacklisterKp])
          .rpc();

        const entry = await program.account.blacklistEntry.fetch(blacklistPda);
        expect(entry.address.toBase58()).to.equal(
          blacklistTarget.publicKey.toBase58()
        );
        expect(entry.config.toBase58()).to.equal(sss2Config.toBase58());
      });

      it("fails when non-blacklister tries to blacklist", async () => {
        const target2 = Keypair.generate();
        const [blacklistPda] = findBlacklistPda(
          sss2Config,
          target2.publicKey,
          program.programId
        );

        try {
          await program.methods
            .blacklistAddress(target2.publicKey)
            .accounts({
              blacklister: unauthorizedKp.publicKey,
              config: sss2Config,
              blacklistEntry: blacklistPda,
              systemProgram: SystemProgram.programId,
            })
            .signers([unauthorizedKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Unauthorized");
        }
      });

      it("removes address from blacklist", async () => {
        const [blacklistPda] = findBlacklistPda(
          sss2Config,
          blacklistTarget.publicKey,
          program.programId
        );

        await program.methods
          .removeFromBlacklist(blacklistTarget.publicKey)
          .accounts({
            blacklister: blacklisterKp.publicKey,
            config: sss2Config,
            blacklistEntry: blacklistPda,
          })
          .signers([blacklisterKp])
          .rpc();

        const account = await connection.getAccountInfo(blacklistPda);
        expect(account).to.be.null;
      });
    });

    describe("blacklist fails gracefully on SSS-1", () => {
      it("rejects blacklist_address when compliance not enabled", async () => {
        const target = Keypair.generate();
        const [blacklistPda] = findBlacklistPda(
          sss1Config,
          target.publicKey,
          program.programId
        );

        // Note: sss1Config blacklister was updated to blacklisterKp
        try {
          await program.methods
            .blacklistAddress(target.publicKey)
            .accounts({
              blacklister: blacklisterKp.publicKey,
              config: sss1Config,
              blacklistEntry: blacklistPda,
              systemProgram: SystemProgram.programId,
            })
            .signers([blacklisterKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("ComplianceNotEnabled");
        }
      });
    });

    describe("seize (SSS-2)", () => {
      let seizeFromAta: PublicKey;

      before(async () => {
        // Create ATAs for seize tests
        seizeFromAta = await createAta(
          connection,
          (authority as any).payer,
          sss2Mint.publicKey,
          recipientKp.publicKey
        );
        treasuryAta = await createAta(
          connection,
          (authority as any).payer,
          sss2Mint.publicKey,
          authority.publicKey
        );

        // Add minter and mint tokens
        const [minterPda] = findMinterPda(
          sss2Config,
          authority.publicKey,
          program.programId
        );

        await program.methods
          .addMinter(authority.publicKey, new anchor.BN(0), true)
          .accounts({
            authority: authority.publicKey,
            config: sss2Config,
            minterInfo: minterPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        // Initialize transfer hook extra account meta list
        const [extraMetaList] = PublicKey.findProgramAddressSync(
          [Buffer.from("extra-account-metas"), sss2Mint.publicKey.toBuffer()],
          hookProgram.programId
        );

        await hookProgram.methods
          .initializeExtraAccountMetaList()
          .accounts({
            payer: authority.publicKey,
            extraAccountMetaList: extraMetaList,
            mint: sss2Mint.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        await program.methods
          .mintTokens(new anchor.BN(1_000_000))
          .accounts({
            minter: authority.publicKey,
            config: sss2Config,
            minterInfo: minterPda,
            mint: sss2Mint.publicKey,
            tokenAccount: seizeFromAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
      });

      it("seizes tokens via permanent delegate", async () => {
        const remainingAccounts = getTransferHookRemainingAccounts(
          sss2Mint.publicKey,
          sss2Config,
          recipientKp.publicKey,   // source token account owner
          authority.publicKey,      // treasury token account owner
          hookProgram.programId,
          program.programId
        );

        await program.methods
          .seize(new anchor.BN(500_000))
          .accounts({
            seizer: seizerKp.publicKey,
            config: sss2Config,
            mint: sss2Mint.publicKey,
            from: seizeFromAta,
            treasury: treasuryAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .remainingAccounts(remainingAccounts)
          .signers([seizerKp])
          .rpc();
      });

      it("fails with zero amount", async () => {
        try {
          await program.methods
            .seize(new anchor.BN(0))
            .accounts({
              seizer: seizerKp.publicKey,
              config: sss2Config,
              mint: sss2Mint.publicKey,
              from: seizeFromAta,
              treasury: treasuryAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([seizerKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("InvalidAmount");
        }
      });

      it("fails when non-seizer tries to seize", async () => {
        try {
          await program.methods
            .seize(new anchor.BN(1000))
            .accounts({
              seizer: unauthorizedKp.publicKey,
              config: sss2Config,
              mint: sss2Mint.publicKey,
              from: seizeFromAta,
              treasury: treasuryAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([unauthorizedKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Unauthorized");
        }
      });
    });

    describe("seize fails gracefully on SSS-1", () => {
      it("rejects seize when permanent delegate not enabled", async () => {
        try {
          await program.methods
            .seize(new anchor.BN(1000))
            .accounts({
              seizer: seizerKp.publicKey,
              config: sss1Config,
              mint: sss1Mint.publicKey,
              from: sss1Ata,
              treasury: sss1Ata,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([seizerKp])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("ComplianceNotEnabled");
        }
      });
    });

    describe("SSS-2 burn via permanent delegate", () => {
      it("burns tokens from any account using permanent delegate", async () => {
        // treasuryAta has 500k tokens from the seize test
        await program.methods
          .burnTokens(new anchor.BN(100_000))
          .accounts({
            burner: authority.publicKey,
            config: sss2Config,
            mint: sss2Mint.publicKey,
            tokenAccount: treasuryAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
      });
    });
  });

  // =========================================================================
  // Integration: SSS-1 full lifecycle
  // =========================================================================
  describe("Integration: SSS-1 mint -> freeze -> thaw", () => {
    it("full lifecycle works end-to-end", async () => {
      const [minterPda] = findMinterPda(
        sss1Config,
        minterKp.publicKey,
        program.programId
      );

      // Mint
      await program.methods
        .mintTokens(new anchor.BN(100_000))
        .accounts({
          minter: minterKp.publicKey,
          config: sss1Config,
          minterInfo: minterPda,
          mint: sss1Mint.publicKey,
          tokenAccount: sss1Ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minterKp])
        .rpc();

      // Freeze (using updated freezer role)
      await program.methods
        .freezeAccount()
        .accounts({
          freezer: freezerKp.publicKey,
          config: sss1Config,
          mint: sss1Mint.publicKey,
          tokenAccount: sss1Ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezerKp])
        .rpc();

      // Thaw
      await program.methods
        .thawAccount()
        .accounts({
          freezer: freezerKp.publicKey,
          config: sss1Config,
          mint: sss1Mint.publicKey,
          tokenAccount: sss1Ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezerKp])
        .rpc();
    });
  });

  // =========================================================================
  // Integration: SSS-2 mint -> blacklist -> seize -> remove blacklist
  // =========================================================================
  describe("Integration: SSS-2 mint -> blacklist -> seize", () => {
    let integTarget: Keypair;
    let integTargetAta: PublicKey;

    before(async () => {
      integTarget = Keypair.generate();
      await airdrop(connection, integTarget.publicKey);

      integTargetAta = await createAta(
        connection,
        (authority as any).payer,
        sss2Mint.publicKey,
        integTarget.publicKey
      );
    });

    it("full compliance lifecycle", async () => {
      const [minterPda] = findMinterPda(
        sss2Config,
        authority.publicKey,
        program.programId
      );

      // 1. Mint tokens to target
      await program.methods
        .mintTokens(new anchor.BN(1_000_000))
        .accounts({
          minter: authority.publicKey,
          config: sss2Config,
          minterInfo: minterPda,
          mint: sss2Mint.publicKey,
          tokenAccount: integTargetAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      // 2. Blacklist the target
      const [blacklistPda] = findBlacklistPda(
        sss2Config,
        integTarget.publicKey,
        program.programId
      );

      await program.methods
        .blacklistAddress(integTarget.publicKey)
        .accounts({
          blacklister: blacklisterKp.publicKey,
          config: sss2Config,
          blacklistEntry: blacklistPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklisterKp])
        .rpc();

      // Verify blacklist entry exists
      const entry = await program.account.blacklistEntry.fetch(blacklistPda);
      expect(entry.address.toBase58()).to.equal(
        integTarget.publicKey.toBase58()
      );

      // 3. Seize tokens from blacklisted account
      const seizeRemainingAccounts = getTransferHookRemainingAccounts(
        sss2Mint.publicKey,
        sss2Config,
        integTarget.publicKey,    // source owner
        authority.publicKey,       // treasury owner
        hookProgram.programId,
        program.programId
      );

      await program.methods
        .seize(new anchor.BN(1_000_000))
        .accounts({
          seizer: seizerKp.publicKey,
          config: sss2Config,
          mint: sss2Mint.publicKey,
          from: integTargetAta,
          treasury: treasuryAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .remainingAccounts(seizeRemainingAccounts)
        .signers([seizerKp])
        .rpc();

      // 4. Remove from blacklist
      await program.methods
        .removeFromBlacklist(integTarget.publicKey)
        .accounts({
          blacklister: blacklisterKp.publicKey,
          config: sss2Config,
          blacklistEntry: blacklistPda,
        })
        .signers([blacklisterKp])
        .rpc();

      // Verify blacklist entry is closed
      const account = await connection.getAccountInfo(blacklistPda);
      expect(account).to.be.null;
    });
  });
});
