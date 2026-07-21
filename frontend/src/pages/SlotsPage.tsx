import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useWalletStore } from "@/store/walletStore";
import WinModal from "@/components/games/WinModal";

// ── Types ───────────────────────────────────────────────────────────

interface SpinResult {
  round_id: string;
  grid: string[][];
  symbols: string[][];
  paylines: {
    symbol: string;
    count: number;
    win_amount: string;
    positions: number[][];
    payline_index: number[][];
  }[];
  scatter_count: number;
  scatter_win: string;
  total_win: string;
  bet_amount: string;
  lines: number;
  won: boolean;
  message: string | null;
}

// ── Symbol Display ──────────────────────────────────────────────────

const SYMBOL_EMOJIS: Record<string, string> = {
  cherry: "🍒", lemon: "🍋", orange: "🍊", plum: "🫐",
  grapes: "🍇", watermelon: "🍉", seven: "7️⃣",
  bar: "💠", bell: "🔔", wild: "⭐", scatter: "💎",
};

const SYMBOL_COLORS: Record<string, string> = {
  cherry: "text-red-400", lemon: "text-yellow-400", orange: "text-orange-400",
  plum: "text-purple-400", grapes: "text-violet-400", watermelon: "text-green-400",
  seven: "text-red-500", bar: "text-blue-400", bell: "text-yellow-300",
  wild: "text-amber-300", scatter: "text-cyan-300",
};

const SYMBOL_BG: Record<string, string> = {
  cherry: "bg-red-500/10", lemon: "bg-yellow-500/10", orange: "bg-orange-500/10",
  plum: "bg-purple-500/10", grapes: "bg-violet-500/10", watermelon: "bg-green-500/10",
  seven: "bg-red-500/15", bar: "bg-blue-500/10", bell: "bg-yellow-500/15",
  wild: "bg-amber-500/20 ring-2 ring-amber-400/30", scatter: "bg-cyan-500/10",
};

// Placeholder grid shown before the first spin (grey, empty cells)
const PLACEHOLDER_GRID: string[][] = Array.from({ length: 3 }, () =>
  Array.from({ length: 5 }, () => ""),
);

// ── Main Page ───────────────────────────────────────────────────────

export default function SlotsPage() {
  const navigate = useNavigate();
  const { wallet, fetchWallet } = useWalletStore();

  const [betAmount, setBetAmount] = useState(1);
  const [lines, setLines] = useState(10);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [history, setHistory] = useState<{ win: number; bet: number }[]>([]);
  const [winModalOpen, setWinModalOpen] = useState(false);
  const spinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellCenters, setCellCenters] = useState<Record<string, { x: number; y: number }>>({});
  const [currentPaylineIdx, setCurrentPaylineIdx] = useState(-1);

  const totalBet = betAmount;

  const spinReels = useCallback(async () => {
    if (isLoading || spinning) return;

    setIsLoading(true);
    setSpinning(true);
    setResult(null);
    setWinModalOpen(false);

    try {
      const { data } = await apiClient.post<SpinResult>("/slots/spin", {
        bet_amount: betAmount,
        lines: lines,
      });

      // Store the real result immediately (grid, win, etc.)
      setResult(data);
      if (data.won) setWinModalOpen(true);

      // Stop spinning animation after the reels have visually settled
      spinTimeout.current = setTimeout(() => {
        setSpinning(false);
        if (data.won) {
          setHistory((prev) => [
            { win: parseFloat(data.total_win), bet: parseFloat(data.bet_amount) },
            ...prev.slice(0, 9),
          ]);
        }
        fetchWallet();
        setIsLoading(false);
      }, 1500);
    } catch {
      setSpinning(false);
      setIsLoading(false);
    }
  }, [betAmount, lines, isLoading, spinning, fetchWallet]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (spinTimeout.current) {
        clearTimeout(spinTimeout.current);
      }
    };
  }, []);

  // Measure cell positions when result arrives and spinning stops
  useEffect(() => {
    if (!result || spinning || !gridRef.current) {
      setCurrentPaylineIdx(-1);
      return;
    }

    const container = gridRef.current;
    const containerRect = container.getBoundingClientRect();
    const centers: Record<string, { x: number; y: number }> = {};

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = container.querySelector(`[data-row="${r}"][data-col="${c}"]`);
        if (cell) {
          const rect = (cell as HTMLElement).getBoundingClientRect();
          centers[`${r}-${c}`] = {
            x: rect.left + rect.width / 2 - containerRect.left,
            y: rect.top + rect.height / 2 - containerRect.top,
          };
        }
      }
    }
    setCellCenters(centers);
    setCurrentPaylineIdx(0);
  }, [result, spinning]);

  // Cycle through winning paylines one at a time
  useEffect(() => {
    if (currentPaylineIdx < 0 || !result?.paylines?.length) return;

    const id = setTimeout(() => {
      setCurrentPaylineIdx((prev) => {
        if (prev < 0 || !result?.paylines?.length) return -1;
        return (prev + 1) % result.paylines.length;
      });
    }, 2000);

    return () => clearTimeout(id);
  }, [currentPaylineIdx, result?.paylines?.length]);

  const lineCost = (betAmount / lines).toFixed(2);

  // Always show 15 cells — real data from the backend, or grey placeholders before first spin
  const displayGrid = result?.grid || PLACEHOLDER_GRID;

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            🎰 Slot Machines
          </h1>
          <p className="text-sm text-gray-400">
            5 reels · 3 rows · 10 paylines · Big wins!
          </p>
        </div>
        <button onClick={() => navigate("/games")} className="btn-ghost text-sm">
          ← Back to Games
        </button>
      </div>

      {/* Game area */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Reels */}
        <div>
          <motion.div
            className="relative overflow-hidden rounded-2xl border-2 border-casino-gold/30 bg-gradient-to-b from-gray-900 to-black p-4 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {/* Machine top */}

            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="h-3 w-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
              <span className="ml-2 font-display text-sm font-bold tracking-widest text-casino-gold">
                LUCKY SLOTS
              </span>
            </div>

            {/* Reel grid */}
            <div ref={gridRef} className="relative rounded-xl border border-gray-700 bg-gray-900/50 p-3">
              {/* Payline indicators */}
              <div className="absolute -left-1 top-0 flex h-full flex-col justify-evenly">
                {[0, 1, 2].map((r) => (
                  <div
                    key={r}
                    className="h-2 w-2 rounded-full bg-casino-gold/40"
                  />
                ))}
              </div>

              <div className="grid grid-cols-5 gap-2">
                {displayGrid.map((row, ri) =>
                  row.map((sym, ci) => {
                    const isPlaceholder = !sym;
                    const emoji = isPlaceholder ? "" : (SYMBOL_EMOJIS[sym] || sym);
                    const color = isPlaceholder ? "text-gray-700" : (SYMBOL_COLORS[sym] || "text-white");
                    const bg = isPlaceholder
                      ? "bg-gray-800/20 border border-dashed border-gray-700/40"
                      : (SYMBOL_BG[sym] || "bg-gray-800");
                    const isWin = result?.won && result.paylines.some(
                      (pl) => pl.positions?.some(([r, c]) => r === ri && c === ci)
                    );

                    return (
                      <motion.div
                        key={`${ri}-${ci}`}
                        data-row={ri}
                        data-col={ci}
                        className={`flex aspect-square items-center justify-center rounded-xl text-2xl sm:text-3xl md:text-4xl ${bg} ${color} ${
                          isWin ? "ring-2 ring-casino-gold shadow-lg shadow-casino-gold/30" : ""
                        }`}
                        initial={
                          spinning
                            ? { y: -60, opacity: 0, rotateX: 90 }
                            : { y: 0, opacity: 1, rotateX: 0 }
                        }
                        animate={
                          spinning
                            ? {
                                y: [null, 0],
                                opacity: 1,
                                rotateX: 0,
                                transition: {
                                  delay: ci * 0.15 + ri * 0.05,
                                  duration: 0.4,
                                  ease: "easeOut",
                                },
                              }
                            : { y: 0, opacity: 1, rotateX: 0 }
                        }
                      >
                        <AnimatePresence mode="wait">
                          {spinning ? (
                            <motion.span
                              key="spin"
                              animate={{ rotateY: 360 }}
                              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            >
                              🎰
                            </motion.span>
                          ) : (
                            <motion.span
                              key={emoji || "empty"}
                              initial={{ scale: 0, rotateZ: -180 }}
                              animate={{ scale: 1, rotateZ: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 200,
                                delay: ci * 0.1,
                              }}
                            >
                              {emoji}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  }),
                )}
              </div>

              {/* Winning payline path overlay */}
              {result && !spinning && currentPaylineIdx >= 0 && result.paylines.length > 0 && result.paylines[currentPaylineIdx]?.payline_index && (
                <svg
                  className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                  style={{ overflow: "visible" }}
                >
                  {(() => {
                    const pl = result.paylines[currentPaylineIdx];
                    const fullPath: number[][] = pl.payline_index;
                    const winningPositions: number[][] = pl.positions;

                    // Compute pixel coordinates from cell centers
                    const points = fullPath
                      .map(([r, c]) => cellCenters[`${r}-${c}`])
                      .filter(Boolean);
                    const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");

                    // Only the winning segment's cells get dots
                    const winPoints = winningPositions
                      .map(([r, c]) => cellCenters[`${r}-${c}`])
                      .filter(Boolean);

                    if (points.length < 2) return null;

                    return (
                      <g>
                        {/* Glow trail */}
                        <polyline
                          points={pointsStr}
                          fill="none"
                          stroke="rgba(251, 191, 36, 0.25)"
                          strokeWidth={10}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="animate-pulse"
                        />
                        {/* Main line */}
                        <polyline
                          points={pointsStr}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="2000"
                          strokeDashoffset={0}
                          style={{
                            animation: `payline-draw 0.6s ease-out forwards`,
                          }}
                        />
                        {/* Dots at winning positions */}
                        {winPoints.map((pt, i) => (
                          <g key={i}>
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={8}
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              style={{
                                animation: `payline-dot 0.3s ease-out ${0.6 + i * 0.1}s forwards`,
                                opacity: 0,
                              }}
                            />
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={4}
                              fill="#fbbf24"
                              style={{
                                animation: `payline-dot 0.3s ease-out ${0.6 + i * 0.1}s forwards`,
                                opacity: 0,
                              }}
                            />
                          </g>
                        ))}
                        {/* Payline label */}
                        <text
                          x={points[points.length - 1].x}
                          y={points[points.length - 1].y - 16}
                          textAnchor="middle"
                          fill="#fbbf24"
                          fontSize={11}
                          fontWeight={700}
                          style={{
                            animation: `payline-label 0.3s ease-out 0.8s forwards`,
                            opacity: 0,
                          }}
                        >
                          {`Payline ${currentPaylineIdx + 1}`}
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              )}
            </div>

            {/* Win display */}
            <AnimatePresence>
              {result && !spinning && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 rounded-xl p-4 text-center ${
                    result.won
                      ? "bg-gradient-to-r from-casino-gold/20 via-amber-500/20 to-casino-gold/20"
                      : "bg-gray-800/50"
                  }`}
                >
                  {result.won ? (
                    <div>
                      <p className="text-sm text-casino-gold/80">YOU WIN!</p>
                      <p className="font-display text-4xl font-bold text-casino-gold animate-pulse-glow">
                        ${parseFloat(result.total_win).toFixed(2)}
                      </p>
                      {result.paylines.length > 0 && (
                        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                          {result.paylines.map((pl, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-casino-gold/10 px-2 py-0.5 text-xs text-casino-gold"
                            >
                              {pl.count}x {SYMBOL_EMOJIS[pl.symbol] || pl.symbol} (+${parseFloat(pl.win_amount).toFixed(2)})
                            </span>
                          ))}
                        </div>
                      )}
                      {parseFloat(result.scatter_win) > 0 && (
                        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                          <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
                            💎 Scatter {result.scatter_count}× (+${parseFloat(result.scatter_win).toFixed(2)})
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{result.message}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spin button on machine */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={spinReels}
              disabled={isLoading || spinning || !wallet || parseFloat(wallet.available_balance) < totalBet}
              className="btn-primary mx-auto mt-4 block w-full max-w-xs py-4 text-lg"
            >
              {spinning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Spinning...
                </span>
              ) : (
                `🎰 SPIN $${betAmount.toFixed(2)}`
              )}
            </motion.button>
          </motion.div>
        </div>

        {/* Controls panel */}
        <div className="space-y-4">
          {/* Bet amount */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              Bet Amount
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[0.25, 0.50, 1, 2, 5, 10].map((val) => (
                <button
                  key={val}
                  onClick={() => setBetAmount(val)}
                  className={`rounded-lg border px-3 py-2 font-mono text-sm font-bold transition-all ${
                    betAmount === val
                      ? "border-casino-gold bg-casino-gold/10 text-casino-gold"
                      : "border-casino-dark-border text-gray-400 hover:border-gray-600"
                  }`}
                >
                  ${val.toFixed(2)}
                </button>
              ))}
            </div>
            {/* Custom wager input */}
            <div className="mt-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">$</span>
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(0.25, parseFloat(e.target.value) || 0.25))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-8 pr-3 text-sm font-mono font-bold text-white outline-none transition-all focus:border-casino-gold focus:ring-1 focus:ring-casino-gold/40"
                  placeholder="Custom amount"
                />
              </div>
            </div>
          </div>

          {/* Paylines */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              Paylines ({lines})
            </h3>
            <input
              type="range"
              min={1}
              max={10}
              value={lines}
              onChange={(e) => setLines(parseInt(e.target.value))}
              className="w-full accent-casino-gold"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>1 line</span>
              <span>10 lines</span>
            </div>
            <div className="mt-3 rounded-lg bg-gray-800/50 p-2 text-center">
              <p className="text-xs text-gray-400">Per line: ${lineCost}</p>
              <p className="font-mono text-sm font-bold text-casino-gold">
                Total: ${totalBet.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Paytable */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              Paytable (3x / 4x / 5x)
            </h3>
            <div className="space-y-1 text-xs">
              {[["🍒", "cherry", "2x / 5x / 20x"],
                ["🍋", "lemon", "2x / 5x / 20x"],
                ["🍊", "orange", "3x / 8x / 30x"],
                ["🫐", "plum", "3x / 8x / 30x"],
                ["🍇", "grapes", "5x / 15x / 50x"],
                ["🍉", "watermelon", "5x / 15x / 50x"],
                ["7️⃣", "seven", "10x / 30x / 100x"],
                ["💠", "bar", "15x / 40x / 150x"],
                ["🔔", "bell", "20x / 50x / 200x"],
                ["⭐", "wild", "25x / 75x / 300x"],
              ].map(([emoji, name, payout]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded px-2 py-1 hover:bg-gray-800/50"
                >
                  <span className="flex items-center gap-1.5">
                    <span>{emoji}</span>
                    <span className="capitalize text-gray-400">{name}</span>
                  </span>
                  <span className="font-mono text-gray-500">{payout}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent wins */}
          {history.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                Recent Wins
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400"
                  >
                    +${h.win.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Balance */}
      {wallet && (
        <div className="mt-4 text-center text-xs text-gray-600">
          Balance:{" "}
          <span className="font-medium text-gray-400">
            ${parseFloat(wallet.available_balance).toFixed(2)}
          </span>
        </div>
      )}

      <WinModal open={winModalOpen} amount={result?.total_win || "0"} onClose={() => setWinModalOpen(false)} />
    </div>
  );
}
