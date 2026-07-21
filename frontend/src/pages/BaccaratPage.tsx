import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useWalletStore } from "@/store/walletStore";
import WinModal from "@/components/games/WinModal";

interface BaccaratResult {
  round_id: string; outcome: string;
  player_cards: string[]; banker_cards: string[];
  player_score: number; banker_score: number;
  player_third: string | null; banker_third: string | null;
  natural: boolean; bet_type: string; payout: string;
  won: boolean; message: string | null;
}

// ── Bead Plate Component ──────────────────────────────────────────
// Traditional Baccarat scoreboard: Big Road layout
// 6 rows per column, left → right, top → bottom
// Red ● = Player, Blue ● = Banker, Green ● = Tie

function BeadPlate({ history }: { history: { outcome: string; score: string; natural?: boolean }[] }) {
  if (history.length === 0) return null;

  // Build columns (oldest results first)
  const reversed = [...history].reverse();
  const columns: { outcome: string; score: string }[][] = [];
  let currentCol: { outcome: string; score: string }[] = [];

  for (const item of reversed) {
    currentCol.push(item);
    if (currentCol.length === 6) {
      columns.push(currentCol);
      currentCol = [];
    }
  }
  if (currentCol.length > 0) {
    columns.push(currentCol);
  }

  const maxColumns = Math.min(columns.length, 14); // cap display width

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/70 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Big Road
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Player
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" /> Banker
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" /> Tie
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="inline-flex gap-px" style={{ minHeight: 6 * 28 + 2 }}>
          {Array.from({ length: maxColumns }).map((_, colIdx) => {
            const col = columns[colIdx];
            return (
              <div key={colIdx} className="flex flex-col gap-px">
                {Array.from({ length: 6 }).map((_, rowIdx) => {
                  const item = col[rowIdx];
                  if (!item) {
                    return (
                      <div
                        key={rowIdx}
                        className="h-6 w-6 rounded-sm bg-gray-800/30"
                      />
                    );
                  }
                  const outcome = item.outcome;
                  const isPlayer = outcome === "player";
                  const isBanker = outcome === "banker";

                  return (
                    <motion.div
                      key={rowIdx}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        delay: (maxColumns - 1 - colIdx) * 0.03 + rowIdx * 0.05,
                      }}
                      className={`relative flex h-6 w-6 items-center justify-center rounded-sm text-[9px] font-bold ${
                        isPlayer
                          ? "bg-red-600 text-white"
                          : isBanker
                            ? "bg-blue-600 text-white"
                            : "bg-green-700 text-white"
                      }`}
                      title={`${outcome} (${item.score})${item.natural ? ' NATURAL' : ''}`}
                    >
                      {isPlayer ? "P" : isBanker ? "B" : "T"}
                      {item.natural && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="inline-block h-2 w-2 rounded-full border border-white/60 bg-transparent" />
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats bar */}
      {history.length > 0 && (
        <div className="mt-3 flex items-center gap-3 border-t border-gray-800 pt-2 text-[10px] text-gray-500">
          <span>
            Total: <strong className="text-white">{history.length}</strong>
          </span>
          <span>
            P:{" "}
            <strong className="text-red-400">
              {history.filter((h) => h.outcome === "player").length}
            </strong>
          </span>
          <span>
            B:{" "}
            <strong className="text-blue-400">
              {history.filter((h) => h.outcome === "banker").length}
            </strong>
          </span>
          <span>
            T:{" "}
            <strong className="text-green-400">
              {history.filter((h) => h.outcome === "tie").length}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export default function BaccaratPage() {
  const navigate = useNavigate();
  const { wallet, fetchWallet } = useWalletStore();
  const [betType, setBetType] = useState<"player" | "banker" | "tie">("player");
  const [betAmount, setBetAmount] = useState(10);
  const [result, setResult] = useState<BaccaratResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ outcome: string; score: string; natural?: boolean }[]>([]);
  const [winModalOpen, setWinModalOpen] = useState(false);

  const handleBet = useCallback(async () => {
    if (loading) return;
    setLoading(true); setResult(null); setWinModalOpen(false);
    try {
      const { data } = await apiClient.post<BaccaratResult>("/baccarat/bet", {
        bet_amount: betAmount, bet_type: betType,
      });
      setResult(data);
      if (data.won) setWinModalOpen(true);
      setHistory(prev => [{ outcome: data.outcome, score: `${data.player_score}-${data.banker_score}`, natural: data.natural }, ...prev.slice(0, 84)]);
      fetchWallet();
    } catch { /* ignore */ }
    setLoading(false);
  }, [betAmount, betType, loading, fetchWallet]);

  const suitColor = (card: string) => {
    const s = card.slice(-1);
    return s === "♥" || s === "♦" ? "text-red-500" : "text-gray-900";
  };

  const renderCards = (cards: string[]) => (
    <div className="flex gap-2">
      {cards.map((c, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: -20, rotateZ: -5 }}
          animate={{ opacity: 1, y: 0, rotateZ: 0 }}
          transition={{ delay: i * 0.1, type: "spring", stiffness: 300 }}
          className="flex h-20 w-14 flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white font-mono text-sm font-bold shadow-xl">
          <div className={suitColor(c)}>
            <div>{c.slice(0, -1)}</div>
            <div className="text-base">{c.slice(-1)}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">💎 Baccarat</h1>
          <p className="text-sm text-gray-400">Player vs Banker — closest to 9 wins</p>
        </div>
        <button onClick={() => navigate("/games")} className="btn-ghost text-sm">← Back</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          {/* Table */}
          <div className="relative overflow-hidden rounded-2xl border border-casino-dark-border bg-gradient-to-b from-casino-green-felt via-casino-green-light to-casino-green-felt p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-0 opacity-5"
              style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.3) 1px, transparent 0)", backgroundSize: "20px 20px" }} />

            {/* Banker */}
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Banker</span>
                {result && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/80">{result.banker_score}</span>}
              </div>
              <div className="min-h-[80px]">{result ? renderCards(result.banker_cards) : <div className="flex gap-2 opacity-30"><div className="flex h-20 w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/30 text-white/30">?</div><div className="flex h-20 w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/30 text-white/30">?</div></div>}</div>
            </div>

            <div className="mb-8 border-t border-white/10" />

            {/* Player */}
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Player</span>
                {result && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/80">{result.player_score}</span>}
              </div>
              <div className="min-h-[80px]">{result ? renderCards(result.player_cards) : <div className="flex gap-2 opacity-30"><div className="flex h-20 w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/30 text-white/30">🃏</div><p className="ml-2 text-sm text-white/40">Place a bet to start</p></div>}</div>
            </div>

            {/* Message */}
            <AnimatePresence>{result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl p-3 text-center text-sm font-medium ${result.won ? "bg-casino-gold/20 text-casino-gold" : "bg-black/30 text-white/70"}`}>
                {result.message}
              </motion.div>
            )}</AnimatePresence>
          </div>

          {/* Bet buttons */}
          <div className="mt-4 flex gap-2">
            {(["player", "banker", "tie"] as const).map(type => (
              <motion.button key={type} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => { setBetType(type); setResult(null); }}
                className={`flex-1 rounded-xl py-3 text-center font-bold transition-all ${betType === type
                  ? type === "player" ? "bg-blue-600 text-white ring-2 ring-blue-400" : type === "banker" ? "bg-red-600 text-white ring-2 ring-red-400" : "bg-green-600 text-white ring-2 ring-green-400"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                {type === "player" ? "👤 Player" : type === "banker" ? "🏦 Banker" : "🤝 Tie (8:1)"}
              </motion.button>
            ))}
          </div>

          {/* ⬇️ Scoreboard — below the table, full width */}
          <div className="mt-6">
            <BeadPlate history={history} />
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Bet Amount</h3>
            <div className="grid grid-cols-2 gap-2">
              {[5, 10, 25, 50, 100, 250].map(v => (
                <button key={v} onClick={() => setBetAmount(v)}
                  className={`rounded-lg border px-3 py-2 font-mono text-sm font-bold transition-all ${betAmount === v ? "border-casino-gold bg-casino-gold/10 text-casino-gold" : "border-casino-dark-border text-gray-400 hover:border-gray-600"}`}>
                  ${v}
                </button>
              ))}
            </div>
          </div>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleBet} disabled={loading || !wallet || parseFloat(wallet.available_balance) < betAmount}
            className="btn-primary w-full py-4 text-lg">
            {loading ? "Dealing..." : `Deal $${betAmount}`}
          </motion.button>

          {/* Quick Stats in side panel */}
          {history.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Streaks</h3>
              <div className="space-y-1 text-xs text-gray-400">
                {(() => {
                  // Find current streak
                  const lastOutcomes = history.map(h => h.outcome);
                  let streak = 1;
                  for (let i = 0; i < lastOutcomes.length - 1; i++) {
                    if (lastOutcomes[i] === lastOutcomes[i + 1]) streak++;
                    else break;
                  }
                  const streakType = lastOutcomes[0];
                  return (
                    <p>
                      Current:{" "}
                      <strong className={
                        streakType === "player" ? "text-red-400" :
                        streakType === "banker" ? "text-blue-400" : "text-green-400"
                      }>
                        {streak}x {streakType}
                      </strong>
                    </p>
                  );
                })()}
                <p>Last: {history[0]?.outcome} ({history[0]?.score})</p>
              </div>
            </div>
          )}

          {wallet && (
            <div className="text-center text-xs text-gray-600">
              Balance: <span className="font-medium text-gray-400">${parseFloat(wallet.available_balance).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      <WinModal open={winModalOpen} amount={result?.payout || "0"} message={result?.message || undefined} onClose={() => setWinModalOpen(false)} />
    </div>
  );
}
