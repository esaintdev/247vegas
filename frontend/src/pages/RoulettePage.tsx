import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useWalletStore } from "@/store/walletStore";

// ── Types ───────────────────────────────────────────────────────────

interface BetResult {
  type: string;
  amount: string;
  numbers: number[];
  won: boolean;
  payout_multiplier: number;
  payout: string;
}

interface SpinResult {
  round_id: string;
  winning_number: number;
  winning_color: string;
  results: BetResult[];
  total_bet: string;
  total_payout: string;
  net_result: string;
  won: boolean;
  spin_history: number[];
  message: string | null;
}

interface PlacedBet {
  id: string;
  type: string;
  amount: number;
  numbers: number[];
  label: string;
}

// ── Roulette Layout Data ────────────────────────────────────────────

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21,
  23, 25, 27, 30, 32, 34, 36,
]);

function numberColor(n: number): string {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

// Table layout: rows of 3 (each row is a column on the betting table)
const TABLE_NUMBERS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

const DOZEN_NAMES = ["1st 12", "2nd 12", "3rd 12"];

// Column definitions for "2:1" column bets
const COLUMNS = [
  { name: "2:1", numbers: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34] },
  { name: "2:1", numbers: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35] },
  { name: "2:1", numbers: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36] },
];

// ── Chip Selector ───────────────────────────────────────────────────

const CHIP_VALUES = [5, 10, 25, 50, 100];
const CHIP_COLORS = ["#DC2626", "#2563EB", "#16A34A", "#D97706", "#7C3AED"];

// ── Outside Bet Buttons ─────────────────────────────────────────────

const OUTSIDE_BETS = [
  { type: "red", label: "RED", payout: "1:1", numbers: [] },
  { type: "black", label: "BLACK", payout: "1:1", numbers: [] },
  { type: "odd", label: "ODD", payout: "1:1", numbers: [] },
  { type: "even", label: "EVEN", payout: "1:1", numbers: [] },
  { type: "low", label: "1-18", payout: "1:1", numbers: [] },
  { type: "high", label: "19-36", payout: "1:1", numbers: [] },
];

// ── Shared Wheel Drawing Function ──────────────────────────────────

function drawWheel(
  ctx: CanvasRenderingContext2D,
  size: number,
  angle: number,
  centerNumber: number | null,
) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 8;

  ctx.clearRect(0, 0, size, size);

  const numbers = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
    11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
    22, 18, 29, 7, 28, 12, 35, 3, 26,
  ];
  const n = numbers.length;
  const segmentAngle = (2 * Math.PI) / n;
  const innerR = radius * 0.38;
  const outerR = radius;

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1a2e";
  ctx.fill();
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 2;
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const startAngleS = -Math.PI / 2 + i * segmentAngle + angle;
    const endAngleS = startAngleS + segmentAngle;

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngleS, endAngleS);
    ctx.arc(cx, cy, innerR, endAngleS, startAngleS, true);
    ctx.closePath();

    const num = numbers[i];
    const color = numberColor(num);
    ctx.fillStyle =
      color === "red" ? "#DC2626" : color === "black" ? "#1a1a2e" : "#16A34A";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const midAngle = startAngleS + segmentAngle / 2;
    const textR = innerR + (outerR - innerR) * 0.55;
    const tx = cx + Math.cos(midAngle) * textR;
    const ty = cy + Math.sin(midAngle) * textR;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(num), 0, 0);
    ctx.restore();
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 4, 0, Math.PI * 2);
  ctx.fillStyle = "#0D1117";
  ctx.fill();
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center text
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(centerNumber !== null ? String(centerNumber) : "0", cx, cy);
}

// ── Wheel Canvas Component ──────────────────────────────────────────

function RouletteWheel({
  spinning,
  winningNumber,
}: {
  spinning: boolean;
  winningNumber: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);

  // Draw wheel on a separate canvas for the static elements
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 220;
    canvas.width = size * 2;
    canvas.height = size * 2;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(2, 2);

    drawWheel(ctx, size, angleRef.current, winningNumber);
  }, [winningNumber]);

  // Spin animation
  useEffect(() => {
    if (!spinning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    const startAngle = angleRef.current;
    const totalRotation = Math.PI * 8;
    const duration = 2000;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      angleRef.current = startAngle + totalRotation * eased;

      // Redraw
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const size = 220;
        const cx = size / 2;
        const cy = size / 2;
        const radius = size / 2 - 8;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const numbers = [
          0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
          11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
          22, 18, 29, 7, 28, 12, 35, 3, 26,
        ];

        // Outer ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = "#1a1a2e";
        ctx.fill();
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 2;
        ctx.stroke();

        const n = numbers.length;
        const segmentAngle = (2 * Math.PI) / n;
        const innerR = radius * 0.38;
        const outerR = radius;

        for (let i = 0; i < n; i++) {
          const startAngleS = -Math.PI / 2 + i * segmentAngle + angleRef.current;
          const endAngleS = startAngleS + segmentAngle;

          ctx.beginPath();
          ctx.arc(cx, cy, outerR, startAngleS, endAngleS);
          ctx.arc(cx, cy, innerR, endAngleS, startAngleS, true);
          ctx.closePath();

          const num = numbers[i];
          const color = numberColor(num);
          ctx.fillStyle =
            color === "red" ? "#DC2626" : color === "black" ? "#1a1a2e" : "#16A34A";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 0.5;
          ctx.stroke();

          const midAngle = startAngleS + segmentAngle / 2;
          const textR = innerR + (outerR - innerR) * 0.55;
          const tx = cx + Math.cos(midAngle) * textR;
          const ty = cy + Math.sin(midAngle) * textR;

          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(midAngle + Math.PI / 2);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 9px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(num), 0, 0);
          ctx.restore();
        }

        // Center circle
        ctx.beginPath();
        ctx.arc(cx, cy, innerR - 4, 0, Math.PI * 2);
        ctx.fillStyle = "#0D1117";
        ctx.fill();
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 14px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", cx, cy);
      }

      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      } else {
        // Snap to final position
        angleRef.current = startAngle + totalRotation;
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [spinning]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Pointer triangle */}
      <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2">
        <div
          className="h-0 w-0"
          style={{
            borderTop: "12px solid transparent",
            borderBottom: "12px solid transparent",
            borderRight: "16px solid #FFD700",
          }}
        />
      </div>
      <canvas ref={canvasRef} className="drop-shadow-2xl" />
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export default function RoulettePage() {
  const navigate = useNavigate();
  const { wallet, fetchWallet } = useWalletStore();

  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinHistory, setSpinHistory] = useState<number[]>([]);
  const [selectedChip, setSelectedChip] = useState(1);

  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);

  // Add a bet
  const placeBet = useCallback(
    (type: string, numbers: number[], label: string) => {
      if (isLoading || spinning) return;

      // Check if we already have this exact bet — increase amount instead
      const existing = bets.find(
        (b) => b.type === type && JSON.stringify(b.numbers) === JSON.stringify(numbers),
      );
      if (existing) {
        setBets((prev) =>
          prev.map((b) =>
            b.id === existing.id
              ? { ...b, amount: b.amount + CHIP_VALUES[selectedChip] }
              : b,
          ),
        );
        return;
      }

      setBets((prev) => [
        ...prev,
        {
          id: `${type}-${numbers.join("-")}-${Date.now()}`,
          type,
          amount: CHIP_VALUES[selectedChip],
          numbers,
          label,
        },
      ]);
    },
    [isLoading, spinning, bets, selectedChip],
  );

  const removeBet = (id: string) => {
    setBets((prev) => prev.filter((b) => b.id !== id));
  };

  const clearBets = () => setBets([]);

  // Spin
  const handleSpin = useCallback(async () => {
    if (bets.length === 0 || isLoading || spinning) return;
    setIsLoading(true);
    setSpinning(true);
    setResult(null);

    try {
      const { data } = await apiClient.post<SpinResult>("/roulette/spin", {
        bets: bets.map((b) => ({
          type: b.type,
          amount: b.amount,
          numbers: b.numbers,
        })),
      });
      // Store result immediately (hidden behind wheel animation)
      setResult(data);
      setSpinHistory((prev) => [data.winning_number, ...prev.slice(0, 19)]);
      setBets([]);

      // Stop wheel animation after 2500ms
      setTimeout(() => {
        setSpinning(false);
        fetchWallet();
        setIsLoading(false);
      }, 2500);
    } catch {
      setSpinning(false);
      setIsLoading(false);
    }
  }, [bets, isLoading, spinning, fetchWallet]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            🎡 Roulette
          </h1>
          <p className="text-sm text-gray-400">
            European roulette — single zero, 37 numbers
          </p>
        </div>
        <button onClick={() => navigate("/games")} className="btn-ghost text-sm">
          ← Back to Games
        </button>
      </div>

      {/* Main game area */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Left: Wheel + Table */}
        <div>
          {/* Wheel */}
          <div className="mb-4 flex flex-col items-center">
            <RouletteWheel spinning={spinning} winningNumber={result?.winning_number ?? null} />

            {/* Spin result message */}
            <AnimatePresence>
              {result && !spinning && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 text-center"
                >
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
                      result.won
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{
                        backgroundColor:
                          result.winning_color === "red"
                            ? "#DC2626"
                            : result.winning_color === "black"
                              ? "#000"
                              : "#16A34A",
                      }}
                    />
                    {result.message}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Betting Table */}
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              {/* Zero */}
              <div className="mb-1 flex">
                <button
                  onClick={() => placeBet("straight", [0], "0")}
                  className="flex h-16 w-16 items-center justify-center rounded-lg bg-green-600 text-lg font-bold text-white transition-all hover:bg-green-500 active:scale-95"
                >
                  0
                </button>

                {/* Number grid */}
                <div className="ml-1 flex-1">
                  {TABLE_NUMBERS.map((row, ri) => (
                    <div key={ri} className="mb-1 flex gap-1">
                      {row.map((num) => {
                        const color = numberColor(num);
                        const hasBet = bets.some(
                          (b) => b.type === "straight" && b.numbers[0] === num,
                        );
                        return (
                          <button
                            key={num}
                            onClick={() => placeBet("straight", [num], String(num))}
                            className={`relative flex h-12 w-10 items-center justify-center rounded text-xs font-bold transition-all active:scale-95 ${
                              color === "red"
                                ? "bg-red-600 hover:bg-red-500"
                                : color === "black"
                                  ? "bg-gray-900 hover:bg-gray-800"
                                  : ""
                            } text-white`}
                          >
                            {num}
                            {hasBet && (
                              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-casino-gold text-[8px] font-bold text-black">
                                {bets.filter(
                                  (b) =>
                                    b.type === "straight" &&
                                    b.numbers[0] === num,
                                ).reduce((s, b) => s + b.amount, 0) >
                                0
                                  ? "$"
                                  : ""}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Column bets (2:1) */}
              <div className="mb-1 flex gap-1">
                {COLUMNS.map((col, i) => (
                  <button
                    key={i}
                    onClick={() => placeBet("column", col.numbers, `Col ${i + 1}`)}
                    className="flex h-8 flex-1 items-center justify-center rounded bg-gray-700/50 text-xs font-bold text-amber-400 transition-all hover:bg-gray-600 active:scale-95"
                  >
                    {col.name}
                  </button>
                ))}
              </div>

              {/* Dozen bets */}
              <div className="mb-1 flex gap-1">
                {DOZEN_NAMES.map((name, i) => {
                  const nums = Array.from(
                    { length: 12 },
                    (_, j) => i * 12 + j + 1,
                  );
                  return (
                    <button
                      key={name}
                      onClick={() => placeBet("dozen", nums, name)}
                      className="flex h-10 flex-1 items-center justify-center rounded bg-gray-800 text-xs font-medium text-gray-300 transition-all hover:bg-gray-700 active:scale-95"
                    >
                      {name}
                    </button>
                  );
                })}
              </div>

              {/* Outside bets */}
              <div className="mb-1 flex gap-1">
                {OUTSIDE_BETS.map((bet) => {
                  const bgColor =
                    bet.type === "red"
                      ? "bg-red-600/80"
                      : bet.type === "black"
                        ? "bg-gray-900"
                        : "bg-gray-800";
                  const txtColor =
                    bet.type === "red" ? "text-red-200" : "text-gray-300";
                  return (
                    <button
                      key={bet.type}
                      onClick={() => placeBet(bet.type, [], bet.label)}
                      className={`flex h-10 flex-1 items-center justify-center rounded text-xs font-bold transition-all active:scale-95 ${bgColor} ${txtColor} hover:opacity-80`}
                    >
                      {bet.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel: Controls */}
        <div className="space-y-4">
          {/* Chip selector */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              Chip Value
            </h3>
            <div className="flex flex-wrap gap-2">
              {CHIP_VALUES.map((val, i) => (
                <button
                  key={val}
                  onClick={() => setSelectedChip(i)}
                  className={`relative flex h-12 w-12 items-center justify-center rounded-full font-mono text-sm font-bold transition-all ${
                    selectedChip === i
                      ? "ring-2 ring-white scale-110"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: CHIP_COLORS[i] }}
                >
                  ${val}
                </button>
              ))}
            </div>
          </div>

          {/* Placed bets */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Your Bets ({bets.length})
              </h3>
              {bets.length > 0 && (
                <button
                  onClick={clearBets}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear all
                </button>
              )}
            </div>

            {bets.length === 0 ? (
              <p className="text-xs text-gray-500">
                Click on the table to place chips
              </p>
            ) : (
              <div className="max-h-[200px] space-y-1 overflow-y-auto">
                {bets.map((bet) => (
                  <div
                    key={bet.id}
                    className="flex items-center justify-between rounded bg-gray-800/50 px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            CHIP_COLORS[
                              CHIP_VALUES.indexOf(
                                CHIP_VALUES.reduce((prev, curr) =>
                                  Math.abs(curr - bet.amount) <
                                  Math.abs(prev - bet.amount)
                                    ? curr
                                    : prev,
                                ),
                              )
                            ],
                        }}
                      />
                      <span className="text-xs text-gray-300">
                        {bet.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-casino-gold">
                        ${bet.amount}
                      </span>
                      <button
                        onClick={() => removeBet(bet.id)}
                        className="text-[10px] text-gray-600 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            {bets.length > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-gray-700 pt-2">
                <span className="text-xs text-gray-400">Total bet</span>
                <span className="font-mono text-sm font-bold text-white">
                  ${totalBet.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Spin button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSpin}
            disabled={
              bets.length === 0 ||
              isLoading ||
              spinning ||
              !wallet ||
              parseFloat(wallet.available_balance) < totalBet
            }
            className="btn-primary w-full py-4 text-lg"
          >
            {spinning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                Spinning...
              </span>
            ) : isLoading ? (
              "Spinning..."
            ) : bets.length === 0 ? (
              "Place a Bet"
            ) : !wallet || parseFloat(wallet.available_balance) < totalBet ? (
              "Insufficient Balance"
            ) : (
              `Spin ($${totalBet.toFixed(2)})`
            )}
          </motion.button>

          {/* Bet Results */}
          <AnimatePresence>
            {result && !spinning && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6"
              >
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                  Bet Results
                </h3>
                <div className="space-y-1">
                  {result.results.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded px-2 py-1.5 ${
                        r.won ? "bg-green-500/10" : "bg-red-500/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300">{r.type}</span>
                        <span className="text-[10px] text-gray-500">
                          {r.payout_multiplier}:1
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs text-gray-400">
                          ${parseFloat(r.amount).toFixed(2)} →{" "}
                        </span>
                        <span
                          className={`font-mono text-xs font-bold ${
                            r.won ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {r.won
                            ? `+$${parseFloat(r.payout).toFixed(2)}`
                            : "-$" + parseFloat(r.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-gray-700 pt-2">
                  <span className="text-xs text-gray-400">Net result</span>
                  <span
                    className={`font-mono text-sm font-bold ${
                      result.won ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {result.won ? "+" : "-"}$
                    {parseFloat(
                      result.won ? result.net_result : result.total_bet,
                    ).toFixed(2)}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Spin history */}
      {spinHistory.length > 0 && (
        <div className="mt-6">
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              Spin History
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {spinHistory.map((n, i) => (
                <span
                  key={i}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                    n === 0
                      ? "bg-green-600 text-white"
                      : RED_NUMBERS.has(n)
                        ? "bg-red-600 text-white"
                        : "bg-gray-900 text-gray-300"
                  }`}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Balance */}
      {wallet && (
        <div className="mt-4 text-center text-xs text-gray-600">
          Balance:{" "}
          <span className="font-medium text-gray-400">
            ${parseFloat(wallet.available_balance).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
