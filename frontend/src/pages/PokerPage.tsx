import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useWalletStore } from "@/store/walletStore";

interface PokerResult {
  round_id: string; stage: string; community: string[];
  player_hand: string[]; ai_hand: string[] | null;
  player_rank: string | null; ai_rank: string | null;
  player_score: number | null; ai_score: number | null;
  outcome: string | null; pot: string | null;
  is_finished: boolean; message: string | null;
}

const suitColor = (card: string) => {
  const s = card.slice(-1);
  return s === "♥" || s === "♦" ? "text-red-500" : "text-gray-900 dark:text-gray-900";
};

function Card({ card, hidden }: { card: string; hidden?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: -15, rotateZ: -5 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`flex h-20 w-14 flex-col items-center justify-center rounded-xl border-2 font-mono text-sm font-bold shadow-xl ${hidden ? "border-gray-600 bg-gradient-to-br from-blue-900 to-blue-950" : "border-gray-200 bg-white"}`}>
      {hidden ? (
        <div className="grid grid-cols-2 gap-0.5 opacity-50">{[...Array(4)].map((_, i) => <div key={i} className="h-2 w-2 rounded-sm bg-blue-400/30" />)}</div>
      ) : (
        <div className={suitColor(card)}>
          <div className="leading-none">{card.slice(0, -1)}</div>
          <div className="text-base leading-none">{card.slice(-1)}</div>
        </div>
      )}
    </motion.div>
  );
}

const rankColors: Record<string, string> = {
  "Royal Flush": "text-purple-400 bg-purple-500/10",
  "Straight Flush": "text-purple-400 bg-purple-500/10",
  "Four of a Kind": "text-red-400 bg-red-500/10",
  "Full House": "text-orange-400 bg-orange-500/10",
  "Flush": "text-cyan-400 bg-cyan-500/10",
  "Straight": "text-green-400 bg-green-500/10",
  "Three of a Kind": "text-yellow-400 bg-yellow-500/10",
  "Two Pair": "text-blue-400 bg-blue-500/10",
  "Pair": "text-gray-300 bg-gray-500/10",
  "High Card": "text-gray-500 bg-gray-500/5",
};

export default function PokerPage() {
  const navigate = useNavigate();
  const { wallet, fetchWallet } = useWalletStore();
  const [result, setResult] = useState<PokerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAiCards, setShowAiCards] = useState(false);
  const [history, setHistory] = useState<{ outcome: string; rank: string }[]>([]);

  const deal = useCallback(async () => {
    setLoading(true); setResult(null); setShowAiCards(false);
    try {
      const { data } = await apiClient.post<PokerResult>("/poker/bet", { action: "deal" });
      setResult(data); fetchWallet();
    } catch { /* ignore */ }
    setLoading(false);
  }, [fetchWallet]);

  const showdown = useCallback(async () => {
    if (!result?.round_id) return;
    setLoading(true); setShowAiCards(true);
    try {
      const { data } = await apiClient.post<PokerResult>(`/poker/bet`, { action: "showdown" });
      setResult(data);
      if (data.is_finished) {
        setHistory(prev => [{ outcome: data.outcome || "?", rank: data.player_rank || "?" }, ...prev.slice(0, 9)]);
      }
      fetchWallet();
    } catch { /* ignore */ }
    setLoading(false);
  }, [result?.round_id, fetchWallet]);

  const fold = useCallback(async () => {
    if (!result?.round_id) return;
    setLoading(true); setShowAiCards(true);
    try {
      const { data } = await apiClient.post<PokerResult>(`/poker/bet`, { action: "fold" });
      setResult(data);
      if (data.is_finished) {
        setHistory(prev => [{ outcome: "fold", rank: "—" }, ...prev.slice(0, 9)]);
      }
      fetchWallet();
    } catch { /* ignore */ }
    setLoading(false);
  }, [result?.round_id, fetchWallet]);

  const rankClass = (rank: string | null) => {
    if (!rank) return "text-gray-500";
    return rankColors[rank] || "text-gray-300 bg-gray-500/10";
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">♠️ Texas Hold'em</h1>
          <p className="text-sm text-gray-400">Single-player versus AI dealer</p>
        </div>
        <button onClick={() => navigate("/games")} className="btn-ghost text-sm">← Back</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="relative overflow-hidden rounded-2xl border border-casino-dark-border bg-gradient-to-b from-casino-green-felt via-casino-green-light to-casino-green-felt p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 opacity-5"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.3) 1px, transparent 0)", backgroundSize: "20px 20px" }} />

          {/* AI */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">AI Dealer</span>
              {result?.ai_rank && showAiCards && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${rankClass(result.ai_rank)}`}>{result.ai_rank}</span>
              )}
            </div>
            <div className="flex min-h-[80px] flex-wrap gap-2">
              {result ? (result.ai_hand || []).map((c, i) => <Card key={i} card={c} hidden={!showAiCards} />)
                : <div className="flex gap-2 opacity-30"><div className="flex h-20 w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/30 text-white/30">?</div><div className="flex h-20 w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/30 text-white/30">?</div></div>}
            </div>
          </div>

          {/* Community */}
          <div className="mb-6">
            <div className="mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Community Cards</span>
            </div>
            <div className="flex min-h-[80px] flex-wrap gap-2">
              {result ? (
                result.community.length > 0 ? result.community.map((c, i) => <Card key={i} card={c} />)
                  : <p className="text-sm text-white/40">Flop coming...</p>
              ) : (
                [...Array(5)].map((_, i) => <div key={i} className="flex h-20 w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/20 text-transparent">?</div>)
              )}
            </div>
          </div>

          <div className="mb-6 border-t border-white/10" />

          {/* Player */}
          <div className="mb-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">You</span>
              {result?.player_rank && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${rankClass(result.player_rank)}`}>{result.player_rank}</span>
              )}
            </div>
            <div className="flex min-h-[80px] flex-wrap gap-2">
              {result ? (result.player_hand || []).map((c, i) => <Card key={i} card={c} />)
                : <div className="flex gap-2 opacity-30"><div className="flex h-20 w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/30 text-white/30">🃏</div><p className="ml-2 text-sm text-white/40">Deal to start</p></div>}
            </div>
          </div>

          {/* Message */}
          <AnimatePresence>{result?.is_finished && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl p-3 text-center text-sm font-medium ${result.outcome === "win" ? "bg-casino-gold/20 text-casino-gold" : "bg-black/30 text-white/70"}`}>
              {result.message}
            </motion.div>
          )}</AnimatePresence>

          {/* Actions */}
          {result && !result.is_finished && (
            <div className="mt-4 flex justify-center gap-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={showdown} disabled={loading}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 font-bold text-white shadow-lg hover:from-emerald-500 hover:to-green-500 disabled:opacity-50">
                Showdown
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={fold} disabled={loading}
                className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-8 py-3 font-bold text-white shadow-lg hover:from-red-500 hover:to-rose-500 disabled:opacity-50">
                Fold
              </motion.button>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Actions</h3>
            <div className="space-y-2">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={deal} disabled={loading || (!!result && !result.is_finished)}
                className="btn-primary w-full py-3">
                {loading ? "Dealing..." : "🃏 Deal Hand ($10)"}
              </motion.button>
              {result?.is_finished && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={deal} className="btn-secondary w-full py-3">
                  Play Again
                </motion.button>
              )}
            </div>
          </div>

          {history.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">History</h3>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${h.outcome === "win" ? "bg-green-500/20 text-green-400" : h.outcome === "tie" ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400"}`}>
                    {h.outcome}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 text-xs text-gray-400">
            <h4 className="mb-2 font-bold text-gray-300">📖 How to Play</h4>
            <ul className="space-y-1">
              <li>• Click <strong className="text-white">Deal</strong> to start ($10 ante)</li>
              <li>• After the flop, choose <strong className="text-white">Showdown</strong> or <strong className="text-white">Fold</strong></li>
              <li>• Showdown deals turn + river, best hand wins</li>
              <li>• Hands ranked: Royal Flush &gt; Straight Flush &gt; ... &gt; High Card</li>
            </ul>
          </div>

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
