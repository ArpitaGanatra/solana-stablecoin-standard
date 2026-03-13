"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";

interface StablecoinConfig {
  authority: PublicKey;
  mint: PublicKey;
  pauser: PublicKey;
  burner: PublicKey;
  freezer: PublicKey;
  blacklister: PublicKey;
  seizer: PublicKey;
  pendingAuthority: PublicKey | null;
  decimals: number;
  isPaused: boolean;
  hasMetadata: boolean;
  totalMinters: number;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
}

interface StablecoinContextType {
  mintAddress: string;
  setMintAddress: (addr: string) => void;
  config: StablecoinConfig | null;
  loading: boolean;
  error: string | null;
  totalSupply: number | null;
  loadConfig: () => Promise<void>;
  getProvider: () => AnchorProvider | null;
}

const StablecoinContext = createContext<StablecoinContextType | null>(null);

export function useStablecoin() {
  const ctx = useContext(StablecoinContext);
  if (!ctx)
    throw new Error("useStablecoin must be used within StablecoinProvider");
  return ctx;
}

// PDA derivation matching the on-chain program
const CONFIG_SEED = "stablecoin_config";
const SSS_CORE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SSS_CORE_PROGRAM_ID ||
    "4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb"
);

function findConfigPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED), mint.toBuffer()],
    SSS_CORE_PROGRAM_ID
  );
  return pda;
}

export default function StablecoinProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [mintAddress, setMintAddress] = useState("");
  const [config, setConfig] = useState<StablecoinConfig | null>(null);
  const [totalSupply, setTotalSupply] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProvider = useCallback((): AnchorProvider | null => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    return new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const loadConfig = useCallback(async () => {
    if (!mintAddress) return;

    setLoading(true);
    setError(null);
    try {
      const mint = new PublicKey(mintAddress);
      const configPda = findConfigPda(mint);

      const accountInfo = await connection.getAccountInfo(configPda);
      if (!accountInfo) {
        throw new Error("Config account not found. Is this a valid SSS mint?");
      }

      // Decode using Anchor's borsh layout
      // Skip 8-byte discriminator
      const data = accountInfo.data.slice(8);
      let offset = 0;

      const readPubkey = () => {
        const pk = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        return pk;
      };

      const readBool = () => {
        const val = data[offset] === 1;
        offset += 1;
        return val;
      };

      const readU8 = () => {
        const val = data[offset];
        offset += 1;
        return val;
      };

      const readU32 = () => {
        const val = data.readUInt32LE(offset);
        offset += 4;
        return val;
      };

      const readOptionPubkey = () => {
        const hasValue = data[offset] === 1;
        offset += 1;
        if (hasValue) {
          return readPubkey();
        }
        offset += 32;
        return null;
      };

      const authority = readPubkey();
      const mintPk = readPubkey();
      const pauser = readPubkey();
      const burner = readPubkey();
      const freezer = readPubkey();
      const blacklister = readPubkey();
      const seizer = readPubkey();
      const pendingAuthority = readOptionPubkey();
      const decimals = readU8();
      const isPaused = readBool();
      const hasMetadata = readBool();
      const totalMinters = readU32();
      const enablePermanentDelegate = readBool();
      const enableTransferHook = readBool();
      const defaultAccountFrozen = readBool();

      setConfig({
        authority,
        mint: mintPk,
        pauser,
        burner,
        freezer,
        blacklister,
        seizer,
        pendingAuthority,
        decimals,
        isPaused,
        hasMetadata,
        totalMinters,
        enablePermanentDelegate,
        enableTransferHook,
        defaultAccountFrozen,
      });

      // Fetch supply
      const supplyInfo = await connection.getTokenSupply(mint);
      setTotalSupply(Number(supplyInfo.value.uiAmount));
    } catch (err: any) {
      setError(err.message || "Failed to load config");
      setConfig(null);
      setTotalSupply(null);
    } finally {
      setLoading(false);
    }
  }, [mintAddress, connection]);

  return (
    <StablecoinContext.Provider
      value={{
        mintAddress,
        setMintAddress,
        config,
        loading,
        error,
        totalSupply,
        loadConfig,
        getProvider,
      }}
    >
      {children}
    </StablecoinContext.Provider>
  );
}
