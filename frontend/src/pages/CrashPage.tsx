import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useWalletStore } from "@/store/walletStore";
import WinModal from "@/components/games/WinModal";

// ── Types ───────────────────────────────────────────────────────────

interface CrashResult {
  round_id: string;
  outcome: string;
  crash_multiplier: number;
  cash_out_at: number | null;
  final_multiplier: number;
  elapsed_seconds: number;
  bet_amount: string;
  payout: string;
  won: boolean;
  message: string | null;
}

type GameState = "idle" | "betting" | "running" | "cashing_out" | "celebrating" | "crashing" | "done";

// ── Multiplier Curve ─────────────────────────────────────────────────
// Formula: m(t) = 1.0 + (t ** 1.4) * 0.15

function multAtTime(t: number): number {
  return 1.0 + Math.pow(t, 1.4) * 0.15;
}

function timeForMult(m: number): number {
  return Math.pow((m - 1) / 0.15, 1 / 1.4);
}

// ── Canvas Drawing ───────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#020617");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  graphLeft: number, graphRight: number, graphTop: number, graphBottom: number,
  maxMult: number,
) {
  const gridMults = [1, 2, 5, 10, 20, 50];
  ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
  ctx.lineWidth = 1;
  ctx.font = "11px monospace";
  ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
  ctx.textAlign = "right";

  for (const m of gridMults) {
    if (m > maxMult) break;
    const y = graphBottom - ((m - 1) / (maxMult - 1)) * (graphBottom - graphTop);
    ctx.beginPath();
    ctx.moveTo(graphLeft, y);
    ctx.lineTo(graphRight, y);
    ctx.stroke();
    ctx.fillText(`${m}x`, graphLeft - 6, y + 4);
  }
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  graphLeft: number, graphRight: number, graphTop: number, graphBottom: number,
  currentTime: number, maxTime: number, maxMult: number,
  glowColor: string,
) {
  const steps = Math.ceil(currentTime / 0.02);
  if (steps < 1) return;

  // Glow layer
  ctx.save();
  ctx.shadowColor = glowColor || "#f59e0b";
  ctx.shadowBlur = 20;
  ctx.strokeStyle = glowColor || "#f59e0b";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * currentTime;
    const m = multAtTime(t);
    const x = graphLeft + (t / maxTime) * (graphRight - graphLeft);
    const y = graphBottom - ((m - 1) / (maxMult - 1)) * (graphBottom - graphTop);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Main line (thinner, brighter)
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * currentTime;
    const m = multAtTime(t);
    const x = graphLeft + (t / maxTime) * (graphRight - graphLeft);
    const y = graphBottom - ((m - 1) / (maxMult - 1)) * (graphBottom - graphTop);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function getCurveEndpoint(
  graphLeft: number, graphRight: number,
  graphTop: number, graphBottom: number,
  currentTime: number, maxTime: number, maxMult: number,
): { x: number; y: number; angle: number } {
  const m = multAtTime(currentTime);
  const x = graphLeft + (currentTime / maxTime) * (graphRight - graphLeft);
  const y = graphBottom - ((m - 1) / (maxMult - 1)) * (graphBottom - graphTop);

  // Angle from tangent of the curve
  const dt = 0.05;
  const t1 = currentTime - dt;
  const t2 = currentTime + dt;
  const m1 = multAtTime(Math.max(t1, 0));
  const m2 = multAtTime(t2);
  const x1 = graphLeft + (Math.max(t1, 0) / maxTime) * (graphRight - graphLeft);
  const x2 = graphLeft + (t2 / maxTime) * (graphRight - graphLeft);
  const y1 = graphBottom - ((m1 - 1) / (maxMult - 1)) * (graphBottom - graphTop);
  const y2 = graphBottom - ((m2 - 1) / (maxMult - 1)) * (graphBottom - graphTop);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  return { x, y, angle };
}

function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // Flame (flicker)
  const flicker = Math.random() * 0.3 + 0.7;
  ctx.beginPath();
  ctx.moveTo(-6, 16);
  ctx.lineTo(-2, 28 * flicker);
  ctx.lineTo(2, 28 * flicker);
  ctx.lineTo(6, 16);
  ctx.fillStyle = "#f97316";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, 16);
  ctx.lineTo(0, 24 * flicker);
  ctx.lineTo(4, 16);
  ctx.fillStyle = "#fbbf24";
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(-10, 4);
  ctx.lineTo(10, 4);
  ctx.closePath();
  const bodyGrad = ctx.createLinearGradient(-10, 0, 10, 0);
  bodyGrad.addColorStop(0, "#f59e0b");
  bodyGrad.addColorStop(0.5, "#fbbf24");
  bodyGrad.addColorStop(1, "#f59e0b");
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Wings
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  ctx.lineTo(-18, 8);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fillStyle = "#d97706";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, 2);
  ctx.lineTo(18, 8);
  ctx.lineTo(10, 8);
  ctx.closePath();
  ctx.fillStyle = "#d97706";
  ctx.fill();

  // Window
  ctx.beginPath();
  ctx.arc(0, -6, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1a2e";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Window shine
  ctx.beginPath();
  ctx.arc(-1.5, -8, 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fill();

  ctx.restore();
}

function drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  const numParticles = 40;
  const colors = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#ff6b6b", "#dc2626"];

  for (let i = 0; i < numParticles; i++) {
    const angle = (i / numParticles) * Math.PI * 2 + (progress * 0.5);
    const distance = Math.pow(progress, 0.7) * 120;
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    const size = (1 - progress) * 8 + 1;

    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = Math.max(1 - progress * 1.2, 0);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Central flash
  if (progress < 0.3) {
    const flashSize = (1 - progress / 0.3) * 50;
    ctx.beginPath();
    ctx.arc(x, y, flashSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 200, 50, ${(1 - progress / 0.3) * 0.6})`;
    ctx.fill();
  }
}

function drawCashoutCelebration(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  const numParticles = 25;
  const colors = ["#22c55e", "#16a34a", "#4ade80", "#86efac", "#34d399"];

  for (let i = 0; i < numParticles; i++) {
    const angle = (i / numParticles) * Math.PI * 2 - Math.PI / 2;
    const distance = Math.pow(progress, 0.6) * 90;
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    const size = (1 - progress) * 6 + 2;

    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = Math.max(1 - progress * 1.5, 0);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Rocket trail (stars)
  if (progress < 0.5) {
    const trailProgress = progress / 0.5;
    for (let i = 0; i < 10; i++) {
      const tAngle = (i / 10) * Math.PI * 2;
      const dist = trailProgress * 40;
      const sx = x + Math.cos(tAngle) * dist;
      const sy = y - 10 - dist;
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 100, ${1 - trailProgress})`;
      ctx.fill();
    }
  }
}

// ── History dots chart ──────────────────────────────────────────────

function drawHistoryDots(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  history: { mult: number; won: boolean }[],
) {
  const dotSize = 4;
  const gap = 8;
  const startX = w - 10;
  const maxDots = Math.min(history.length, Math.floor((w - 20) / (dotSize * 2 + gap)));

  for (let i = 0; i < maxDots; i++) {
    const hItem = history[i];
    const x = startX - (dotSize * 2 + gap) * (i + 1);
    const y = h - 15;
    ctx.beginPath();
    ctx.arc(x, y, dotSize, 0, Math.PI * 2);
    ctx.fillStyle = hItem.won ? "rgba(34, 197, 94, 0.6)" : "rgba(239, 68, 68, 0.4)";
    ctx.fill();
  }
}

// ── Graph Component ─────────────────────────────────────────────────

function CrashGraph({
  gameState,
  currentMult,
  crashAt,
  cashoutMult,
  explosionProgress,
  celebrationProgress,
  history,
}: {
  gameState: GameState;
  currentMult: number;
  crashAt: number;
  cashoutMult: number | null;
  explosionProgress: number;
  celebrationProgress: number;
  history: { mult: number; won: boolean }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const padLeft = 50;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 30;
    const graphLeft = padLeft;
    const graphRight = w - padRight;
    const graphTop = padTop;
    const graphBottom = h - padBottom;

    const maxMult = Math.max(crashAt * 1.3, 5);
    const maxTime = timeForMult(maxMult);

    drawBackground(ctx, w, h);
    drawGridLines(ctx, graphLeft, graphRight, graphTop, graphBottom, maxMult);

    // Determine what time/curve to draw
    let drawTime = 0;
    if (gameState === "running") {
      drawTime = timeForMult(currentMult);
    } else if (gameState === "celebrating" || gameState === "done") {
      // Draw curve up to cashout point (or crash point if done without win)
      const finalMult = (cashoutMult && cashoutMult > 1) ? cashoutMult : crashAt;
      drawTime = timeForMult(finalMult);
    } else if (gameState === "crashing") {
      drawTime = timeForMult(crashAt);
    }

    if (drawTime > 0) {
      const isWin = gameState === "celebrating";
      drawCurve(ctx, graphLeft, graphRight, graphTop, graphBottom,
        drawTime, maxTime, maxMult, isWin ? "#22c55e" : "#f59e0b");
    }

    // Rocket at end of curve
    if (gameState === "running" || gameState === "cashing_out") {
      const endpoint = getCurveEndpoint(graphLeft, graphRight, graphTop, graphBottom,
        drawTime, maxTime, maxMult);
      drawRocket(ctx, endpoint.x, endpoint.y, endpoint.angle, 1.0);
    }

    // Explosion
    if (gameState === "crashing") {
      const crashEndpoint = getCurveEndpoint(graphLeft, graphRight, graphTop, graphBottom,
        drawTime, maxTime, maxMult);
      drawExplosion(ctx, crashEndpoint.x, crashEndpoint.y, explosionProgress);
    }

    // Cashout celebration
    if (gameState === "celebrating") {
      const cashEndpoint = getCurveEndpoint(graphLeft, graphRight, graphTop, graphBottom,
        drawTime, maxTime, maxMult);
      drawCashoutCelebration(ctx, cashEndpoint.x, cashEndpoint.y, celebrationProgress);
    }

    // Current multiplier text on graph
    if (gameState === "running" || gameState === "cashing_out") {
      const mult = gameState === "cashing_out" ? (cashoutMult || currentMult) : currentMult;
      const endpoint = getCurveEndpoint(graphLeft, graphRight, graphTop, graphBottom,
        drawTime, maxTime, maxMult);
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      const textColor = mult < 2 ? "#22c55e" : mult < 5 ? "#eab308" : "#ef4444";
      ctx.fillStyle = textColor;
      ctx.shadowColor = textColor;
      ctx.shadowBlur = 15;
      ctx.fillText(`${mult.toFixed(2)}x`, endpoint.x, endpoint.y - 30);
      ctx.shadowBlur = 0;
    }

    // History dots at bottom of canvas
    drawHistoryDots(ctx, w, h, history);
  }, [gameState, currentMult, crashAt, cashoutMult, explosionProgress, celebrationProgress, history]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full rounded-xl"
      style={{ minHeight: 340 }}
    />
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export default function CrashPage() {
  const navigate = useNavigate();
  const { wallet, fetchWallet } = useWalletStore();

  const [bet, setBet] = useState(5);
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [result, setResult] = useState<CrashResult | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [crashAt, setCrashAt] = useState(2.0);
  const [currentMult, setCurrentMult] = useState(1.0);
  const [cashoutMult, setCashoutMult] = useState<number | null>(null);
  const [explosionProgress, setExplosionProgress] = useState(0);
  const [celebrationProgress, setCelebrationProgress] = useState(0);
  const [history, setHistory] = useState<{ mult: number; won: boolean }[]>([]);
  const [winModalOpen, setWinModalOpen] = useState(false);

  const animRef = useRef(0);
  const explosionRef = useRef(0);
  const celebrationRef = useRef(0);
  const startTimeRef = useRef(0);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      cancelAnimationFrame(explosionRef.current);
      cancelAnimationFrame(celebrationRef.current);
    };
  }, []);

  // ── Place bet ──────────────────────────────────────────────────────

  const placeBet = useCallback(async () => {
    if (gameState !== "idle" && gameState !== "done") return;

    setGameState("betting");
    setResult(null);
    setCashoutMult(null);
    setExplosionProgress(0);
    setCelebrationProgress(0);
    setWinModalOpen(false);

    try {
      const { data } = await apiClient.post<CrashResult>("/crash/bet", {
        bet_amount: bet,
      });

      setRoundId(data.round_id);
      setCrashAt(data.crash_multiplier);
      setCurrentMult(1.0);
      startTimeRef.current = performance.now();
      setGameState("running");
    } catch {
      setGameState("idle");
    }
  }, [bet, gameState]);

  // ── Running animation ─────────────────────────────────────────────

  useEffect(() => {
    if (gameState !== "running") return;

    const startTime = startTimeRef.current;

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000;
      const mult = multAtTime(elapsed);
      setCurrentMult(mult);

      // Check if crashed
      if (mult >= crashAt) {
        // Auto-crash
        setCurrentMult(crashAt);
        setGameState("crashing");
        return;
      }

      // Cap at 15 seconds max animation
      if (elapsed > 15) {
        setGameState("crashing");
        return;
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, crashAt]);

  // ── Cash-out handler ──────────────────────────────────────────────

  const handleCashout = useCallback(async () => {
    if (gameState !== "running" || !roundId) return;

    const cashoutValue = currentMult;
    setCashoutMult(cashoutValue);
    setGameState("cashing_out");
    cancelAnimationFrame(animRef.current);

    try {
      const { data } = await apiClient.post<CrashResult>(
        `/crash/${roundId}/cashout`,
        { multiplier: cashoutValue },
      );

      setResult(data);
      setHistory((prev) => [
        { mult: data.crash_multiplier, won: data.won },
        ...prev.slice(0, 19),
      ]);

      if (data.won) {
        setCashoutMult(data.cash_out_at);
        setGameState("celebrating");
        setWinModalOpen(true);
      } else {
        // Cashed out too late — crashed
        setCurrentMult(data.crash_multiplier);
        setGameState("crashing");
      }
    } catch {
      // Failed cashout — treat as crash
      setGameState("crashing");
    }
  }, [gameState, roundId, currentMult]);

  // ── Explosion animation ───────────────────────────────────────────

  useEffect(() => {
    if (gameState !== "crashing") return;

    // Notify backend of crash
    if (roundId && !result) {
      apiClient.post(`/crash/${roundId}/crash`).then(({ data }) => {
        setResult(data);
        setHistory((prev) => [
          { mult: data.crash_multiplier, won: false },
          ...prev.slice(0, 19),
        ]);
      }).catch(() => {});
    }

    setExplosionProgress(0);
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000;
      const progress = Math.min(elapsed / 1.0, 1);
      setExplosionProgress(progress);

      if (progress < 1) {
        explosionRef.current = requestAnimationFrame(animate);
      } else {
        setGameState("done");
        fetchWallet();
      }
    };

    explosionRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(explosionRef.current);
  }, [gameState, roundId, result, fetchWallet]);

  // ── Celebration animation ─────────────────────────────────────────

  useEffect(() => {
    if (gameState !== "celebrating") return;

    setCelebrationProgress(0);
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000;
      const progress = Math.min(elapsed / 0.8, 1);
      setCelebrationProgress(progress);

      if (progress < 1) {
        celebrationRef.current = requestAnimationFrame(animate);
      } else {
        setGameState("done");
        fetchWallet();
      }
    };

    celebrationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(celebrationRef.current);
  }, [gameState, fetchWallet]);

  // ── Auto cash-out ─────────────────────────────────────────────────

  useEffect(() => {
    if (gameState !== "running") return;
    if (currentMult >= autoCashout) {
      handleCashout();
    }
  }, [gameState, currentMult, autoCashout, handleCashout]);

  // ── Render helpers ────────────────────────────────────────────────

  const multColor = currentMult < 2 ? "text-green-400"
    : currentMult < 5 ? "text-yellow-400"
    : "text-red-400";

  const canBet = (gameState === "idle" || gameState === "done")
    && wallet && parseFloat(wallet.available_balance) >= bet;

  const canCashout = gameState === "running";

  const showResult = result && (gameState === "done" || gameState === "celebrating");

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            🚀 Crash
          </h1>
          <p className="text-sm text-gray-400">
            Cash out before it crashes!
          </p>
        </div>
        <button onClick={() => navigate("/games")} className="btn-ghost text-sm">
          ← Back to Games
        </button>
      </div>

      {/* Game area */}
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        {/* Graph */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900/30 p-3" style={{ minHeight: 420 }}>
          <div className="h-[380px]">
            <CrashGraph
              gameState={gameState}
              currentMult={currentMult}
              crashAt={crashAt}
              cashoutMult={cashoutMult}
              explosionProgress={explosionProgress}
              celebrationProgress={celebrationProgress}
              history={history.slice(0, 20)}
            />
          </div>

          {/* Overlay multiplier (big, shown during running) */}
          <AnimatePresence>
            {(gameState === "running" || gameState === "cashing_out") && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute left-4 top-4"
              >
                <span className={`font-mono text-3xl font-bold ${multColor}`}>
                  {currentMult.toFixed(2)}x
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* History bar at bottom */}
          <div className="mt-3 flex flex-wrap gap-1">
            {history.slice(0, 20).map((h, i) => (
              <span
                key={i}
                className={`inline-block h-1.5 w-5 rounded-full ${
                  h.won ? "bg-green-500/50" : "bg-red-500/40"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Bet amount */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              Bet Amount
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 5, 10, 25, 50].map((v) => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  disabled={gameState === "running" || gameState === "betting"}
                  className={`rounded-lg border px-3 py-2 font-mono text-sm font-bold transition-all ${
                    bet === v
                      ? "border-casino-gold bg-casino-gold/10 text-casino-gold"
                      : "border-gray-700 text-gray-400 hover:border-gray-600 disabled:opacity-40"
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Auto cash-out */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              Auto Cash-out
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[1.5, 2, 3, 5, 10, 20].map((v) => (
                <button
                  key={v}
                  onClick={() => setAutoCashout(v)}
                  disabled={gameState === "running" || gameState === "betting"}
                  className={`rounded-lg border px-3 py-2 font-mono text-sm font-bold transition-all ${
                    autoCashout === v
                      ? "border-green-500 bg-green-500/10 text-green-400"
                      : "border-gray-700 text-gray-400 hover:border-gray-600 disabled:opacity-40"
                  }`}
                >
                  {v}x
                </button>
              ))}
            </div>
          </div>

          {/* CASH OUT button */}
          <AnimatePresence mode="wait">
            {canCashout ? (
              <motion.button
                key="cashout"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleCashout}
                className="relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-green-500 to-green-600 px-6 py-5 font-bold text-white shadow-lg shadow-green-500/30 transition-all hover:from-green-400 hover:to-green-500 active:scale-[0.98]"
              >
                {/* Pulse ring */}
                <motion.div
                  className="absolute inset-0 rounded-xl bg-white/20"
                  animate={{ opacity: [0, 0.3, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
                <motion.div
                  className="absolute inset-0 rounded-xl bg-white/10"
                  animate={{ opacity: [0, 0.2, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                />
                <span className="relative flex items-center justify-center gap-2 text-xl">
                  💰 CASH OUT
                  <span className="font-mono text-lg">
                    {currentMult.toFixed(2)}x
                  </span>
                </span>
                <span className="relative mt-1 block text-xs text-green-200">
                  Win ${(bet * currentMult).toFixed(2)}
                </span>
              </motion.button>
            ) : (
              <motion.button
                key="bet"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={
                  gameState === "idle" || gameState === "done"
                    ? { scale: 1, opacity: 1 }
                    : {}
                }
                exit={{ scale: 0.9, opacity: 0 }}
                whileHover={canBet ? { scale: 1.02 } : {}}
                whileTap={canBet ? { scale: 0.98 } : {}}
                onClick={placeBet}
                disabled={!canBet}
                className={`w-full rounded-xl px-6 py-5 text-lg font-bold transition-all ${
                  gameState === "betting"
                    ? "bg-gray-700 text-gray-400"
                    : "bg-gradient-to-b from-casino-gold to-amber-600 text-black shadow-lg shadow-casino-gold/30"
                }`}
              >
                {gameState === "betting" ? "🚀 Starting..." :
                 gameState === "cashing_out" ? "💸 Cashing Out..." :
                 gameState === "crashing" ? "💥 CRASHED!" :
                 showResult && result?.won ? `✅ Won $${parseFloat(result.payout).toFixed(2)}` :
                 showResult ? `💥 Lost at ${result?.crash_multiplier.toFixed(2)}x` :
                 `🎰 Bet $${bet}`}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Result message */}
          <AnimatePresence>
            {showResult && result?.message && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl p-3 text-center text-sm font-medium ${
                  result.won
                    ? "bg-green-500/10 text-green-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {result.message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* History */}
          {history.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                History
              </h3>
              <div className="flex max-h-[120px] flex-wrap gap-1.5 overflow-y-auto">
                {history.slice(0, 30).map((h, i) => (
                  <span
                    key={i}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      h.won
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {h.mult.toFixed(2)}x
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Balance */}
          {wallet && (
            <div className="text-center text-xs text-gray-600">
              Balance:{" "}
              <span className="font-medium text-gray-400">
                ${parseFloat(wallet.available_balance).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      <WinModal
        open={winModalOpen}
        amount={result?.payout || "0"}
        message={result?.message || undefined}
        onClose={() => setWinModalOpen(false)}
      />
    </div>
  );
}
