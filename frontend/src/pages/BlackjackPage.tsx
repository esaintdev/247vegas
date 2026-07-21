import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useWalletStore } from "@/store/walletStore";
import PlayingCard from "@/components/games/PlayingCard";

interface CardData {
  suit: string;
  rank: string;
  face_up: boolean;
  display: string;
}

interface GameState {
  round_id: string;
  game_type: string;
  player_cards: CardData[];
  dealer_cards: CardData[];
  player_score: number;
  dealer_score: number;
  bet_amount: number;
  is_finished: boolean;
  outcome: string | null;
  won: boolean | null;
  payout_amount: number | null;
  player_busted: boolean;
  dealer_busted: boolean;
  player_blackjack: boolean;
  can_split: boolean;
  can_double: boolean;
  insurance_offered: boolean;
  message: string | null;
}

const QUICK_BETS = [10, 25, 50, 100];

export default function BlackjackPage() {
  const navigate = useNavigate();
  const { wallet, fetchWallet } = useWalletStore();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [betAmount, setBetAmount] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [gameHistory, setGameHistory] = useState<
    { outcome: string; amount: number }[]
  >([]);

  const currentBet = gameState?.bet_amount ?? betAmount;

  const startGame = useCallback(async () => {
    setIsLoading(true);
    setShowResult(false);
    setLastMessage(null);
    try {
      const { data } = await apiClient.post<GameState>("/blackjack/bet", {
        bet_amount: betAmount,
      });
      setGameState(data);
      if (data.is_finished) {
        setShowResult(true);
        setLastMessage(data.message);
        setGameHistory((prev) => [
          { outcome: data.outcome || "unknown", amount: data.bet_amount },
          ...prev.slice(0, 9),
        ]);
      }
      fetchWallet();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setLastMessage(axiosErr.response?.data?.detail || "Failed to start game");
    } finally {
      setIsLoading(false);
    }
  }, [betAmount, fetchWallet]);

  const gameAction = useCallback(
    async (action: "hit" | "stand" | "double") => {
      if (!gameState?.round_id) return;
      setIsLoading(true);
      setLastMessage(null);
      try {
        const { data } = await apiClient.post<GameState>(
          `/blackjack/${gameState.round_id}/${action}`,
          {},
        );
        setGameState(data);
        if (data.is_finished) {
          setShowResult(true);
          setLastMessage(data.message);
          setGameHistory((prev) => [
            { outcome: data.outcome || "unknown", amount: data.bet_amount },
            ...prev.slice(0, 9),
          ]);
        }
        fetchWallet();
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setLastMessage(
          axiosErr.response?.data?.detail || `Failed to ${action}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [gameState?.round_id, fetchWallet],
  );

  const newGame = () => {
    setGameState(null);
    setShowResult(false);
    setLastMessage(null);
  };

  const canAct = gameState && !gameState.is_finished && !isLoading;
  const hasBet = gameState !== null;

  return (
    <div className="min-h-screen bg-[#0D1117] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-lg text-emerald-400">🃏</div>
            <div>
              <h1 className="text-xl font-bold text-white">Blackjack</h1>
              <p className="text-sm text-gray-500">Beat the dealer's hand without going over 21</p>
            </div>
          </div>
          <button onClick={() => navigate("/games")}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-400 transition-all hover:bg-white/[0.08] hover:text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Back to Games
          </button>
        </motion.div>

        {/* Game Table */}
        <motion.div
          className="relative overflow-hidden rounded-2xl border border-white/[0.06]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="relative min-h-[420px] bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-900 p-4 sm:p-8">
            <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.5) 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            />

            {/* Dealer */}
            <div className="relative mb-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Dealer</span>
                {gameState && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    gameState.dealer_busted ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/70"
                  }`}>
                    {gameState.dealer_busted ? "BUST" : gameState.dealer_score || "?"}
                  </span>
                )}
              </div>
              <div className="flex min-h-[100px] flex-wrap items-center gap-3">
                {gameState ? (
                  gameState.dealer_cards.map((card, i) => (
                    <PlayingCard key={i} card={card} index={i} />
                  ))
                ) : (
                  <div className="flex items-center gap-3 opacity-30">
                    {[0, 1].map((i) => (
                      <div key={i} className="flex h-24 w-16 items-center justify-center rounded-xl border-2 border-dashed border-white/20 text-white/20 text-xl">?</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-8 border-t border-white/10" />

            {/* Player */}
            <div className="relative mb-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Your Hand</span>
                {gameState && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    gameState.player_busted ? "bg-red-500/20 text-red-300" :
                    gameState.player_blackjack && gameState.is_finished ? "bg-amber-500/20 text-amber-400" :
                    "bg-white/10 text-white/70"
                  }`}>
                    {gameState.player_busted ? "BUST" : gameState.player_score || ""}
                  </span>
                )}
              </div>
              <div className="flex min-h-[100px] flex-wrap items-center gap-3">
                {gameState ? (
                  gameState.player_cards.map((card, i) => (
                    <PlayingCard key={i} card={card} index={i} />
                  ))
                ) : (
                  <div className="flex items-center gap-3 opacity-30">
                    <span className="text-2xl">🃏</span>
                    <p className="text-sm text-white/40">Place a bet to start playing</p>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <AnimatePresence>
              {lastMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mb-4 rounded-xl px-4 py-3 text-center text-sm font-medium ${
                    showResult ? "bg-black/40 text-white" : "bg-blue-500/10 text-blue-400"
                  }`}
                >
                  {lastMessage}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bet Controls */}
            {!hasBet && (
              <div className="space-y-4">
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/50">Select Bet</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_BETS.map((amount) => (
                      <motion.button
                        key={amount}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setBetAmount(amount)}
                        className={`relative flex h-14 w-14 items-center justify-center rounded-full font-mono text-sm font-bold transition-all ${
                          betAmount === amount
                            ? "bg-gradient-to-br from-amber-400 to-amber-500 text-black shadow-lg shadow-amber-500/30"
                            : "bg-gradient-to-br from-gray-700 to-gray-800 text-gray-300 hover:from-gray-600 hover:to-gray-700"
                        }`}
                      >
                        ${amount}
                        <div className={`pointer-events-none absolute inset-1 rounded-full border-2 ${
                          betAmount === amount ? "border-yellow-300/30" : "border-white/10"
                        }`} />
                      </motion.button>
                    ))}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startGame}
                  disabled={isLoading || !wallet || parseFloat(wallet.available_balance) < betAmount}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-4 text-lg font-bold text-black shadow-lg shadow-amber-500/20 transition-all hover:from-amber-300 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      Dealing...
                    </span>
                  ) : !wallet ? "Loading..." : parseFloat(wallet.available_balance) < betAmount ? "Insufficient Balance" : `Deal $${betAmount}`}
                </motion.button>
              </div>
            )}

            {/* Game Actions */}
            {hasBet && (
              <div className="flex flex-col gap-4">
                {!gameState?.is_finished && (
                  <div className="flex flex-wrap justify-center gap-3">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => gameAction("hit")} disabled={!canAct}
                      className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3 font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50">
                      Hit
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => gameAction("stand")} disabled={!canAct}
                      className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-8 py-3 font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:from-red-400 hover:to-red-500 disabled:opacity-50">
                      Stand
                    </motion.button>
                    {gameState?.can_double && (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => gameAction("double")} disabled={!canAct}
                        className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 py-3 font-bold text-black shadow-lg shadow-amber-500/30 transition-all hover:from-yellow-300 hover:to-amber-400 disabled:opacity-50">
                        Double (${currentBet * 2})
                      </motion.button>
                    )}
                  </div>
                )}
                {gameState?.is_finished && (
                  <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={newGame}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 font-bold text-black shadow-lg shadow-amber-500/20 transition-all hover:from-amber-300 hover:to-amber-400">
                    Play Again
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Bottom row */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* History */}
          {gameHistory.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-xl border border-white/[0.06] bg-[#161B22] px-5 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Recent Hands</h3>
              <div className="flex flex-wrap gap-2">
                {gameHistory.map((h, i) => (
                  <span key={i} className={`rounded-full px-3 py-1 text-xs font-medium ${
                    h.outcome === "blackjack" ? "bg-amber-500/10 text-amber-400" :
                    h.outcome === "win" ? "bg-emerald-500/10 text-emerald-400" :
                    h.outcome === "push" ? "bg-blue-500/10 text-blue-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {h.outcome} (${h.amount})
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Rules */}
          {!hasBet && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="rounded-xl border border-white/[0.06] bg-[#161B22] px-5 py-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Rules</h4>
              <ul className="space-y-1.5 text-sm text-gray-400">
                <li>• Blackjack pays <span className="font-medium text-amber-400">3:2</span></li>
                <li>• Dealer stands on <span className="font-medium text-white">17</span></li>
                <li>• Split and double down available</li>
                <li>• Insurance offered when dealer shows Ace</li>
              </ul>
            </motion.div>
          )}
        </div>

        {/* Balance */}
        {wallet && (
          <div className="mt-4 text-center text-xs text-gray-600">
            Balance: <span className="font-medium text-gray-400">${parseFloat(wallet.available_balance).toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
