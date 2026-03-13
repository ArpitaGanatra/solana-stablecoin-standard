"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useStablecoin } from "@/contexts/StablecoinProvider";
import Card from "@/components/Card";
import TxResult from "@/components/TxResult";

const SSS_CORE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SSS_CORE_PROGRAM_ID ||
    "4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb"
);

const ROLES = ["pauser", "burner", "freezer", "blacklister", "seizer"] as const;

export default function RolesPage() {
  const { config, mintAddress, loadConfig } = useStablecoin();
  const wallet = useWallet();
  const { connection } = useConnection();

  const [selectedRole, setSelectedRole] = useState<string>("pauser");
  const [newAddress, setNewAddress] = useState("");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Authority transfer
  const [newAuthority, setNewAuthority] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted">Load a stablecoin from the header first</p>
      </div>
    );
  }

  const getProgram = async () => {
    if (!wallet.publicKey || !wallet.signTransaction)
      throw new Error("Wallet not connected");
    const provider = new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
    const idl = await Program.fetchIdl(SSS_CORE_PROGRAM_ID, provider);
    if (!idl) throw new Error("Could not fetch program IDL");
    return new Program(idl, provider);
  };

  const handleUpdateRole = async () => {
    setLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);
      const addr = new PublicKey(newAddress);

      const params: Record<string, PublicKey | null> = {
        pauser: null,
        burner: null,
        freezer: null,
        blacklister: null,
        seizer: null,
      };
      params[selectedRole] = addr;

      const sig = await program.methods
        .updateRoles(params)
        .accountsPartial({
          authority: wallet.publicKey!,
          mint,
        })
        .rpc();

      setTxSig(sig);
      loadConfig();
    } catch (err: any) {
      setTxError(err.message || "Update role failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTransferAuthority = async () => {
    setAuthLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);
      const newAuth = new PublicKey(newAuthority);

      const sig = await program.methods
        .transferAuthority(newAuth)
        .accountsPartial({
          authority: wallet.publicKey!,
          mint,
        })
        .rpc();

      setTxSig(sig);
      loadConfig();
    } catch (err: any) {
      setTxError(err.message || "Transfer authority failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAcceptAuthority = async () => {
    setAuthLoading(true);
    setTxSig(null);
    setTxError(null);
    try {
      const program = await getProgram();
      const mint = new PublicKey(mintAddress);

      const sig = await program.methods
        .acceptAuthority()
        .accountsPartial({
          newAuthority: wallet.publicKey!,
          mint,
        })
        .rpc();

      setTxSig(sig);
      loadConfig();
    } catch (err: any) {
      setTxError(err.message || "Accept authority failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const currentRoleValue = (role: string) => {
    const map: Record<string, PublicKey> = {
      pauser: config.pauser,
      burner: config.burner,
      freezer: config.freezer,
      blacklister: config.blacklister,
      seizer: config.seizer,
    };
    return map[role]?.toBase58() ?? "N/A";
  };

  return (
    <div className="space-y-6">
      <Card title="Current Roles">
        <div className="space-y-2">
          {ROLES.map((role) => {
            const isCompliance = role === "blacklister" || role === "seizer";
            if (isCompliance && !config.enableTransferHook) return null;
            const val = currentRoleValue(role);
            return (
              <div
                key={role}
                className="flex items-center justify-between py-2 border-b border-card-border last:border-0"
              >
                <span className="text-sm text-muted capitalize">{role}</span>
                <span className="text-xs font-mono text-foreground">
                  {val.slice(0, 4)}...{val.slice(-4)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Update Role">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              >
                {ROLES.map((r) => {
                  const isCompliance = r === "blacklister" || r === "seizer";
                  if (isCompliance && !config.enableTransferHook) return null;
                  return (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">
                New Address
              </label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="New role holder address..."
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleUpdateRole}
              disabled={loading || !newAddress}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Processing..." : "Update Role"}
            </button>
          </div>
        </Card>

        <Card title="Transfer Authority">
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Two-step process: initiate transfer, then the new authority must
              accept.
            </p>
            {config.pendingAuthority && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm">
                <p className="text-warning">
                  Pending transfer to:{" "}
                  <span className="font-mono">
                    {config.pendingAuthority.toBase58().slice(0, 8)}...
                  </span>
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm text-muted mb-1">
                New Authority
              </label>
              <input
                type="text"
                value={newAuthority}
                onChange={(e) => setNewAuthority(e.target.value)}
                placeholder="New authority address..."
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleTransferAuthority}
                disabled={authLoading || !newAuthority}
                className="bg-warning hover:bg-warning/80 disabled:opacity-50 text-black py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {authLoading ? "..." : "Initiate Transfer"}
              </button>
              <button
                onClick={handleAcceptAuthority}
                disabled={authLoading}
                className="bg-success hover:bg-success/80 disabled:opacity-50 text-black py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {authLoading ? "..." : "Accept Authority"}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <TxResult
        signature={txSig}
        error={txError}
        onClear={() => {
          setTxSig(null);
          setTxError(null);
        }}
      />
    </div>
  );
}
