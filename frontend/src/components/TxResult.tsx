"use client";

interface TxResultProps {
  signature: string | null;
  error: string | null;
  onClear: () => void;
}

export default function TxResult({ signature, error, onClear }: TxResultProps) {
  if (!signature && !error) return null;

  const cluster = process.env.NEXT_PUBLIC_CLUSTER || "devnet";
  const explorerUrl = signature
    ? `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`
    : "";

  return (
    <div
      className={`mt-4 p-3 rounded-lg text-sm ${
        error
          ? "bg-danger/10 border border-danger/30 text-danger"
          : "bg-success/10 border border-success/30 text-success"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          {error ? (
            <p>{error}</p>
          ) : (
            <p>
              Transaction successful!{" "}
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View on Explorer
              </a>
            </p>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-muted hover:text-foreground ml-3"
        >
          x
        </button>
      </div>
    </div>
  );
}
