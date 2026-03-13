"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface TxResultProps {
  signature: string | null;
  error: string | null;
  onClear: () => void;
}

export default function TxResult({ signature, error, onClear }: TxResultProps) {
  const cluster = process.env.NEXT_PUBLIC_CLUSTER || "devnet";
  const prevSig = useRef<string | null>(null);
  const prevError = useRef<string | null>(null);

  useEffect(() => {
    if (signature && signature !== prevSig.current) {
      prevSig.current = signature;
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
      toast.success("Transaction confirmed", {
        description: (
          <span className="font-mono text-xs">
            {signature.slice(0, 8)}...{signature.slice(-8)}
          </span>
        ),
        action: {
          label: "Explorer",
          onClick: () => window.open(explorerUrl, "_blank"),
        },
        duration: 8000,
        style: {
          background: "#111111",
          border: "1px solid rgba(74, 222, 128, 0.2)",
          boxShadow: "0 0 20px rgba(74, 222, 128, 0.08)",
        },
      });
      onClear();
    }
  }, [signature, cluster, onClear]);

  useEffect(() => {
    if (error && error !== prevError.current) {
      prevError.current = error;
      toast.error("Transaction failed", {
        description: error.length > 120 ? error.slice(0, 120) + "..." : error,
        duration: 8000,
      });
      onClear();
    }
  }, [error, onClear]);

  return null;
}
