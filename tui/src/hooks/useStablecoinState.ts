import { useState, useEffect, useCallback, useRef } from "react";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import {
  StablecoinConfig,
  MinterInfo,
  findConfigPda,
  findMinterPda,
} from "@stbr/sss-token";

export interface TokenHolder {
  address: string;
  owner: string;
  balance: BN;
}

export interface StablecoinState {
  config: StablecoinConfig | null;
  supply: BN | null;
  holders: TokenHolder[];
  minters: MinterInfo[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL = 5000;

export function useStablecoinState(
  program: Program,
  connection: Connection,
  mintAddress: string,
  decimals: number
): StablecoinState {
  const [config, setConfig] = useState<StablecoinConfig | null>(null);
  const [supply, setSupply] = useState<BN | null>(null);
  const [holders, setHolders] = useState<TokenHolder[]>([]);
  const [minters, setMinters] = useState<MinterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isMounted = useRef(true);

  const mint = new PublicKey(mintAddress);
  const [configPda] = findConfigPda(mint, program.programId);

  const fetchAll = useCallback(async () => {
    try {
      // Fetch config
      const cfg = (await (program.account as any).stablecoinConfig.fetch(
        configPda
      )) as StablecoinConfig;
      if (!isMounted.current) return;
      setConfig(cfg);

      // Fetch supply
      const mintInfo = await getMint(
        connection,
        mint,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      if (!isMounted.current) return;
      setSupply(new BN(mintInfo.supply.toString()));

      // Fetch token accounts (holders)
      const tokenAccounts = await connection
        .getTokenAccountsByOwner(
          mint,
          { programId: TOKEN_2022_PROGRAM_ID },
          "confirmed"
        )
        .catch(() => null);

      // Use getParsedProgramAccounts for Token-2022 token accounts
      const parsedAccounts = await connection
        .getParsedTokenAccountsByOwner(
          // We need to get all token accounts for this mint instead
          // Use getTokenLargestAccounts as a simpler approach
          mint,
          { programId: TOKEN_2022_PROGRAM_ID }
        )
        .catch(() => null);

      // Actually, let's use getTokenLargestAccounts for holders
      const largestAccounts = await connection
        .getTokenLargestAccounts(mint, "confirmed")
        .catch(() => null);

      if (!isMounted.current) return;

      if (largestAccounts?.value) {
        const holderList: TokenHolder[] = largestAccounts.value
          .filter((a) => a.uiAmount && a.uiAmount > 0)
          .map((a) => ({
            address: a.address.toString(),
            owner: a.address.toString(), // will resolve below
            balance: new BN(a.amount),
          }));
        setHolders(holderList);
      }

      // Fetch minters using getProgramAccounts
      const minterAccounts = await (program.account as any).minterInfo
        .all([{ memcmp: { offset: 8, bytes: configPda.toBase58() } }])
        .catch(() => []);

      if (!isMounted.current) return;
      setMinters(minterAccounts.map((a) => a.account as unknown as MinterInfo));

      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err.message || "Failed to fetch state");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [program, connection, mintAddress]);

  useEffect(() => {
    isMounted.current = true;
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchAll]);

  return {
    config,
    supply,
    holders,
    minters,
    loading,
    error,
    lastUpdated,
    refresh: fetchAll,
  };
}
