import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useWalletStore } from "@/store/walletStore";

interface BaccaratResult {
  round_id: string; outcome: string;
  player_cards: string[]; banker_cards: string[];
  player_score: number; banker_score: number;
  player_third: string | null; banker_third: string | null;
  natural: boolean; bet_type: string; payout: string;
  won: boolean; message: string | null;
}

export default function BaccaratPage() {
  const navigate = useNavigate();
  const { wallet, fetchWallet } = useWalletStore();
  const [betType, setBetType] = useState<"player" | "banker" | "tie">("player");
  const [betAmount, setBetAmount] = useState(10);
  const [result, setResult] = useState<BaccaratResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ outcome: string; score: string }[]>([]);

  const handleBet = useCallback(async () => {
    if (loading) return;
    setLoading(true); setResult(null);
    try {
      const { data } = await apiClient.post<BaccaratResult>("/baccarat/bet", {
        bet_amount: betAmount, bet_type: betType,
      });
      setResult(data);
      setHistory(prev => [{ outcome: data.outcome, score: `${data.player_score}-${data.banker_score}` }, ...prev.slice(0, 9)]);
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
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <div className="card">
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

          {history.length > 0 && (
            <div className="card">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Recent</h3>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${h.outcome === "player" ? "bg-blue-500/20 text-blue-400" : h.outcome === "banker" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                    {h.outcome} ({h.score})
                  </span>
                ))}
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
    </div>
  );
}
