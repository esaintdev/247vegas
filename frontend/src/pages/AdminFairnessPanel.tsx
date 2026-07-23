import { useState } from "react";
import apiClient from "@/api/client";

interface SeedInfo {
  round_id: string;
  game_type: string;
  server_seed: string | null;
  server_seed_hash: string | null;
  client_seed: string | null;
  nonce: number;
  is_completed: boolean;
  has_seeds: boolean;
}

interface Verification {
  round_id: string;
  game_type: string;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  is_verified: boolean;
  message: string;
}

interface VerifyResponse {
  has_seeds: boolean;
  seed_info: SeedInfo;
  verification: Verification | null;
  message: string;
}

export function FairnessPanel() {
  const [roundId, setRoundId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyRound = async () => {
    if (!roundId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await apiClient.post<VerifyResponse>("/admin/fairness/verify-round", {
        round_id: roundId,
      });
      setResult(data);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to verify round";
      setError(detail);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <h3 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Provably Fair Verification</h3>
        <p className="mb-4 text-sm text-gray-500">
          Enter a game round ID to verify its provable fairness. The system checks that the
          revealed server seed matches the SHA-256 hash that was committed before the round started.
        </p>
        <div className="flex gap-3">
          <input
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            placeholder="Enter game round ID..."
            onKeyDown={(e) => e.key === "Enter" && verifyRound()}
            className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
          />
          <button
            onClick={verifyRound}
            disabled={loading || !roundId}
            className="rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "🔍 Verify"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border-b-[4px] border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          {/* Status banner */}
          {result.has_seeds && result.verification ? (
            <div className={`mb-6 rounded-2xl border-b-[4px] px-5 py-4 ${
              result.verification.is_verified
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{result.verification.is_verified ? "✅" : "❌"}</span>
                <div>
                  <p className={`font-bold text-sm ${result.verification.is_verified ? "text-emerald-700" : "text-red-700"}`}>
                    {result.verification.is_verified ? "Verified — Seeds Match" : "Verification FAILED"}
                  </p>
                  <p className={`text-xs ${result.verification.is_verified ? "text-emerald-600" : "text-red-600"}`}>
                    {result.verification.message}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className={`mb-6 rounded-2xl border-b-[4px] px-5 py-4 ${
              !result.has_seeds ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{!result.has_seeds ? "ℹ️" : "⏳"}</span>
                <div>
                  <p className="font-bold text-sm text-amber-700">{result.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Seed details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Round ID</p>
              <p className="font-mono text-xs font-bold text-gray-900 break-all">{result.seed_info.round_id}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Game</p>
              <p className="text-sm font-bold capitalize text-gray-900">{result.seed_info.game_type}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Nonce</p>
              <p className="font-mono text-sm font-bold text-gray-900">{result.seed_info.nonce}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Status</p>
              <p className={`text-sm font-bold ${result.seed_info.is_completed ? "text-emerald-600" : "text-amber-600"}`}>
                {result.seed_info.is_completed ? "Completed" : "In Progress"}
              </p>
            </div>
          </div>

          {(result.has_seeds || result.seed_info.server_seed_hash) && (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Committed Hash (SHA-256)</p>
                <p className="font-mono text-xs text-gray-700 break-all">{result.seed_info.server_seed_hash}</p>
                <p className="mt-1 text-[10px] text-gray-400">Hash committed before the round started</p>
              </div>
              {result.seed_info.server_seed && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Server Seed (Revealed)</p>
                  <p className="font-mono text-xs text-gray-700 break-all">{result.seed_info.server_seed}</p>
                  <p className="mt-1 text-[10px] text-gray-400">Revealed after the round completed</p>
                </div>
              )}
              {result.seed_info.client_seed && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Client Seed</p>
                  <p className="font-mono text-xs text-gray-700 break-all">{result.seed_info.client_seed}</p>
                </div>
              )}
            </div>
          )}

          {/* How it works */}
          <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">How Provably Fair Works</p>
            <ol className="ml-4 list-decimal space-y-1 text-xs text-gray-600">
              <li>Before each round, a random <strong>server seed</strong> is generated and its SHA-256 hash is committed to the database</li>
              <li>Players can optionally provide their own <strong>client seed</strong></li>
              <li>The <strong>nonce</strong> auto-increments each round</li>
              <li>After the round, the <strong>server seed</strong> is revealed</li>
              <li>Anyone can verify: <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-[10px]">sha256(server_seed + client_seed + nonce) == committed_hash</code></li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
