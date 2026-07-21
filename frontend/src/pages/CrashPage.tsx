import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useWalletStore } from "@/store/walletStore";

interface CrashResult {
  round_id: string; outcome: string; crash_multiplier: number;
  cash_out_at: number | null; final_multiplier: number;
  elapsed_seconds: number; bet_amount: string; payout: string;
  won: boolean; message: string | null;
}

export default function CrashPage() {
  const navigate = useNavigate();
  const { wallet, fetchWallet } = useWalletStore();
  const [bet, setBet] = useState(5);
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [result, setResult] = useState<CrashResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [multiplier, setMultiplier] = useState(1.00);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<{ mult: number; won: boolean }[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const simulateCrash = useCallback((crashAt: number, cashOut: number | null, didWin: boolean) => {
    setRunning(true);
    setMultiplier(1.00);
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000;
      const current = 1.00 + (elapsed ** 1.4) * 0.15;
      setMultiplier(current);

      if (didWin && cashOut && current >= cashOut) {
        setMultiplier(cashOut);
        cancelAnimationFrame(animRef.current);
        return;
      }

      if (current >= crashAt) {
        setMultiplier(crashAt);
        setRunning(false);
        return;
      }

      if (elapsed < 10) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setRunning(false);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, []);

  const handleBet = useCallback(async () => {
    if (loading || running) return;
    setLoading(true); setResult(null);

    try {
      const { data } = await apiClient.post<CrashResult>("/crash/bet", {
        bet_amount: bet, cash_out_at: autoCashout,
      });
      // Store result immediately (hidden behind crash animation)
      setResult(data);
      setHistory(prev => [{ mult: data.crash_multiplier, won: data.won }, ...prev.slice(0, 19)]);

      simulateCrash(data.crash_multiplier, data.cash_out_at, data.won);
      setTimeout(() => {
        setRunning(false);
        fetchWallet();
        setLoading(false);
      }, Math.min(data.crash_multiplier * 800, 8000) + 500);
    } catch {
      setLoading(false);
    }
  }, [bet, autoCashout, loading, running, fetchWallet, simulateCrash]);

  const pct = Math.min((multiplier - 1) / 9, 1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">🚀 Crash</h1>
          <p className="text-sm text-gray-400">Cash out before it crashes!</p>
        </div>
        <button onClick={() => navigate("/games")} className="btn-ghost text-sm">← Back</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Game display */}
        <div className="relative overflow-hidden rounded-2xl border border-casino-dark-border bg-gradient-to-b from-gray-900 to-black p-8">
          <motion.div
            className="flex min-h-[300px] flex-col items-center justify-center"
            animate={{ scale: running ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: running ? Infinity : 0, duration: 0.5 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={running ? "running" : "idle"}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className="font-display text-7xl font-bold sm:text-8xl"
                  style={{ color: multiplier < 2 ? "#22C55E" : multiplier < 5 ? "#EAB308" : "#EF4444" }}>
                  {running ? `${multiplier.toFixed(2)}x` : result ? `${result.crash_multiplier.toFixed(2)}x` : "1.00x"}
                </div>
                <div className="mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-gray-800 mx-auto">
                  <motion.div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                    style={{ width: `${pct * 100}%` }} />
                </div>
                <p className="mt-4 text-sm text-gray-500">
                  {running ? "📈 Rising..." : result?.won ? result.message : result ? result.message : "Place a bet to start"}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Bet</h3>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 5, 10, 25, 50].map(v => (
                <button key={v} onClick={() => setBet(v)}
                  className={`rounded-lg border px-3 py-2 font-mono text-sm font-bold transition-all ${bet === v ? "border-casino-gold bg-casino-gold/10 text-casino-gold" : "border-casino-dark-border text-gray-400 hover:border-gray-600"}`}>
                  ${v}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Auto Cash-out</h3>
            <div className="grid grid-cols-2 gap-2">
              {[1.5, 2, 3, 5, 10, 20].map(v => (
                <button key={v} onClick={() => setAutoCashout(v)}
                  className={`rounded-lg border px-3 py-2 font-mono text-sm font-bold transition-all ${autoCashout === v ? "border-casino-gold bg-casino-gold/10 text-casino-gold" : "border-casino-dark-border text-gray-400 hover:border-gray-600"}`}>
                  {v}x
                </button>
              ))}
            </div>
          </div>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleBet}
            disabled={loading || running || !wallet || parseFloat(wallet.available_balance) < bet}
            className="btn-primary w-full py-4 text-lg">
            {loading || running ? "🚀 Flying..." : `Bet $${bet}`}
          </motion.button>

          {history.length > 0 && (
            <div className="card">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">History</h3>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${h.won ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {h.mult.toFixed(2)}x
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
