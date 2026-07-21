import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useWalletStore } from "@/store/walletStore";
import PlayingCard from "@/components/games/PlayingCard";
import WinModal from "@/components/games/WinModal";

interface CardData {
  suit: string;
  rank: string;
  face_up: boolean;
  display: string;
}

interface GameState {
  round_id: string;
  game_type: string;
  player_cards: CardData[] | CardData[][];
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
  insurance_active: boolean;
  has_split: boolean;
  hand_count: number;
  active_hand: number;
  message: string | null;
}

const QUICK_BETS = [10, 25, 50, 100];

// ── Helper: normalize player_cards ──────────────────────────────────

function getPlayerHands(state: GameState): CardData[][] {
  const cards = state.player_cards;
  if (!cards) return [];
  if (Array.isArray(cards) && cards.length > 0 && !("suit" in cards[0])) {
    // Already a list of hands
    return cards as CardData[][];
  }
  // Single hand (flat list)
  return [cards as CardData[]];
}

// ── Main Component ──────────────────────────────────────────────────

export default function BlackjackPage() {
  const navigate = useNavigate();
  const { wallet, fetchWallet } = useWalletStore();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [betAmount, setBetAmount] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [winModalOpen, setWinModalOpen] = useState(false);
  const [gameHistory, setGameHistory] = useState<
    { outcome: string; amount: number; payout: number; playerScore: number; dealerScore: number }[]
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
        if (data.won) setWinModalOpen(true);
        setShowResult(true);
        setLastMessage(data.message);
        setGameHistory((prev) => [
          { outcome: data.outcome || "unknown", amount: Number(data.bet_amount), payout: Number(data.payout_amount || 0), playerScore: data.player_score, dealerScore: data.dealer_score },
          ...prev.slice(0, 49),
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
    async (action: "hit" | "stand" | "double" | "split" | "insurance") => {
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
          if (data.won) setWinModalOpen(true);
          setShowResult(true);
          setLastMessage(data.message);
          setGameHistory((prev) => [
            { outcome: data.outcome || "unknown", amount: Number(data.bet_amount), payout: Number(data.payout_amount || 0), playerScore: data.player_score, dealerScore: data.dealer_score },
            ...prev.slice(0, 49),
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
    setWinModalOpen(false);
  };

  const canAct = gameState && !gameState.is_finished && !isLoading;
  const hasBet = gameState !== null;
  const hands = gameState ? getPlayerHands(gameState) : [];

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

            {/* Insurance Indicator */}
            {gameState?.insurance_offered && !gameState.insurance_active && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 text-center"
              >
                <p className="text-sm font-medium text-amber-400 mb-2">
                  🛡️ Dealer showing Ace — Insurance offered (${(currentBet / 2).toFixed(2)})
                </p>
                <div className="flex justify-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => gameAction("insurance")} disabled={isLoading}
                    className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-black transition-all hover:bg-amber-400 disabled:opacity-50"
                  >
                    Take Insurance
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setGameState(prev => prev ? { ...prev, insurance_offered: false } : prev)}
                    disabled={isLoading}
                    className="rounded-lg bg-gray-700 px-5 py-2 text-sm font-medium text-gray-300 transition-all hover:bg-gray-600 disabled:opacity-50"
                  >
                    Decline
                  </motion.button>
                </div>
              </motion.div>
            )}

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

            {/* Player Hands */}
            {hands.map((handCards, handIdx) => (
              <div key={handIdx} className="relative mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    {gameState?.has_split ? `Hand ${handIdx + 1}` : "Your Hand"}
                    {gameState?.has_split && handIdx === gameState?.active_hand && !gameState?.is_finished && (
                      <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">● Active</span>
                    )}
                  </span>
                  {/* Score badge */}
                  {(() => {
                    const score = handCards.reduce((sum, c) => {
                      if (!c.face_up || c.rank === "?") return sum;
                      if (["J", "Q", "K"].includes(c.rank)) return sum + 10;
                      if (c.rank === "A") return sum + 11;
                      return sum + parseInt(c.rank);
                    }, 0);
                    return (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        score > 21 ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/70"
                      }`}>
                        {score > 21 ? "BUST" : score || ""}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex min-h-[80px] flex-wrap items-center gap-2">
                  {handCards.map((card, i) => (
                    <PlayingCard key={i} card={card} index={i} />
                  ))}
                </div>
              </div>
            ))}

            {/* Empty state */}
            {!gameState && (
              <div className="mb-6 flex items-center gap-3 opacity-30">
                <span className="text-2xl">🃏</span>
                <p className="text-sm text-white/40">Place a bet to start playing</p>
              </div>
            )}

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
                  {/* Custom wager input */}
                  <div className="mt-3">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
                      <input
                        type="number"
                        min={1}
                        value={betAmount}
                        onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-8 pr-3 text-sm font-mono font-bold text-white outline-none transition-all focus:border-casino-gold focus:ring-1 focus:ring-casino-gold/40"
                        placeholder="Custom amount"
                      />
                    </div>
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
                      className={`rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3 font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 ${
                        gameState?.has_split ? "border-2 border-emerald-400/30" : ""
                      }`}>
                      Hit {gameState?.has_split && `(Hand ${(gameState?.active_hand ?? 0) + 1})`}
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => gameAction("stand")} disabled={!canAct}
                      className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-8 py-3 font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:from-red-400 hover:to-red-500 disabled:opacity-50">
                      Stand {gameState?.has_split ? `(Hand ${(gameState?.active_hand ?? 0) + 1})` : ""}
                    </motion.button>
                    {gameState?.can_double && !gameState?.has_split && (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => gameAction("double")} disabled={!canAct}
                        className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 py-3 font-bold text-black shadow-lg shadow-amber-500/30 transition-all hover:from-yellow-300 hover:to-amber-400 disabled:opacity-50">
                        Double (${currentBet * 2})
                      </motion.button>
                    )}
                    {gameState?.can_split && (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => gameAction("split")} disabled={!canAct}
                        className="rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 px-8 py-3 font-bold text-white shadow-lg shadow-purple-900/30 transition-all hover:from-purple-400 hover:to-purple-500 disabled:opacity-50">
                        ✂️ Split
                      </motion.button>
                    )}
                  </div>
                )}

                {/* Show hand summary when multiple hands */}
                {gameState?.has_split && !gameState.is_finished && (
                  <div className="text-center text-xs text-white/40">
                    {hands.map((_, i) => (
                      <span key={i} className={`mx-1 ${
                        i === gameState.active_hand ? "font-bold text-emerald-400" : "text-white/30"
                      }`}>
                        Hand {i + 1}{i < hands.length - 1 ? " · " : ""}
                      </span>
                    ))}
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
          {/* Scoreboard */}
          {gameHistory.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/[0.06] bg-[#161B22] px-5 py-4">
              {/* Stats bar */}
              <div className="mb-4 flex items-center gap-4 text-xs">
                <span className="text-gray-500">Hands: <strong className="text-white">{gameHistory.length}</strong></span>
                <span className="text-gray-500">Wins: <strong className="text-emerald-400">{gameHistory.filter(h => h.outcome === "win" || h.outcome === "blackjack" || h.outcome === "insurance_win").length}</strong></span>
                <span className="text-gray-500">Losses: <strong className="text-red-400">{gameHistory.filter(h => h.outcome === "lose" || h.outcome === "bust").length}</strong></span>
                <span className="text-gray-500">Pushes: <strong className="text-blue-400">{gameHistory.filter(h => h.outcome === "push").length}</strong></span>
                <span className="text-gray-500">P&L: <strong className={(() => {
                  const pnl = gameHistory.reduce((s, h) => s + h.payout - h.amount, 0);
                  return pnl >= 0 ? "text-emerald-400" : "text-red-400";
                })()}>${gameHistory.reduce((s, h) => s + h.payout - h.amount, 0).toFixed(2)}</strong></span>
              </div>
              {/* Table */}
              <div className="max-h-[260px] overflow-y-auto space-y-1">
                {gameHistory.map((h, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                      h.outcome === "blackjack" ? "bg-amber-500/8" :
                      h.outcome === "win" ? "bg-emerald-500/8" :
                      h.outcome === "push" ? "bg-blue-500/8" :
                      h.outcome === "insurance_win" ? "bg-yellow-500/8" :
                      "bg-red-500/5"
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${
                        h.outcome === "blackjack" ? "bg-amber-500/15 text-amber-400" :
                        h.outcome === "win" ? "bg-emerald-500/15 text-emerald-400" :
                        h.outcome === "push" ? "bg-blue-500/15 text-blue-400" :
                        h.outcome === "insurance_win" ? "bg-yellow-500/15 text-yellow-400" :
                        "bg-red-500/15 text-red-400"
                      }`}>{h.outcome}</span>
                      <span className="text-gray-500">Bet: <strong className="text-gray-300">${h.amount}</strong></span>
                      <span className="text-gray-500">Payout: <strong className="text-white">${h.payout.toFixed(2)}</strong></span>
                    </div>
                    <span className="text-gray-500">You {h.playerScore} · Dealer {h.dealerScore}</span>
                  </motion.div>
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
                <li>• <span className="font-medium text-purple-400">Split</span> pairs into two hands</li>
                <li>• <span className="font-medium text-amber-400">Insurance</span> offered when dealer shows Ace</li>
                <li>• Double down available on first two cards</li>
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

      <WinModal open={winModalOpen} amount={gameState?.payout_amount ?? 0} message={gameState?.message || undefined} onClose={() => setWinModalOpen(false)} />
    </div>
  );
}
