import { useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { useWalletStore } from "@/store/walletStore";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { wallet, transactions, fetchWallet, fetchTransactions } =
    useWalletStore();

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
  }, [fetchWallet, fetchTransactions]);

  const available = parseFloat(wallet?.available_balance || "0");
  const bonus = parseFloat(wallet?.bonus_balance || "0");
  const locked = parseFloat(wallet?.locked_amount || "0");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        className="mx-auto max-w-7xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.display_name || user?.username}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Here's your gaming summary</p>
        </div>

        {/* Balance Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Available Balance</p>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight text-amber-600">
              ${available.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Bonus Balance</p>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight text-emerald-600">
              ${bonus.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Locked in Bets</p>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight text-red-600">
              ${locked.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-semibold tracking-wide text-gray-700 uppercase">Recent Activity</h2>
            {transactions.length > 5 && (
              <span className="text-xs text-gray-400">Latest 5</span>
            )}
          </div>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="mb-3 text-gray-300" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <p className="text-sm text-gray-400">No transactions yet. Start playing to see your activity here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.slice(0, 5).map((tx, i) => {
                const amt = parseFloat(tx.amount);
                const isPositive = amt > 0;
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium ${
                        tx.type === "deposit" || tx.type === "win" || tx.type === "bonus"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-red-50 text-red-600"
                      }`}>
                        {tx.type === "deposit" ? "↓" : tx.type === "withdrawal" ? "↑" : tx.type === "bet" ? "🎲" : tx.type === "win" ? "🏆" : tx.type === "bonus" ? "🎁" : "•"}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium capitalize text-gray-900">{tx.type}</span>
                          <span className={`inline-flex h-1.5 w-1.5 rounded-full ${
                            tx.status === "completed" ? "bg-emerald-400" :
                            tx.status === "pending" ? "bg-amber-400" :
                            tx.status === "failed" ? "bg-red-400" : "bg-gray-400"
                          }`} />
                          <span className={`text-xs ${
                            tx.status === "completed" ? "text-emerald-600" :
                            tx.status === "pending" ? "text-amber-600" :
                            tx.status === "failed" ? "text-red-600" : "text-gray-500"
                          }`}>{tx.status}</span>
                        </div>
                        {tx.description && (
                          <p className="text-xs text-gray-500">{tx.description}</p>
                        )}
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-semibold ${
                      isPositive ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {isPositive ? "+" : ""}${amt.toFixed(2)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
