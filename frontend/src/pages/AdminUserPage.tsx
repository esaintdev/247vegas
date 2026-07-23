import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "@/api/client";
import { useAuthStore } from "@/store/authStore";

interface Transaction {
  id: string; type: string; status: string; amount: string;
  description: string | null; created_at: string;
}

interface GameRound {
  id: string; game_type: string; status: string;
  bet_amount: string; payout_amount: string | null;
  is_completed: boolean; created_at: string;
}

interface UserDetail {
  id: string; email: string; username: string; display_name: string;
  is_active: boolean; is_verified: boolean; is_admin: boolean;
  created_at: string; updated_at: string;
  last_login_at: string | null; last_login_ip: string | null;
  wallet_balance: string; wallet_locked: string; wallet_bonus: string;
  wallet_currency: string; wallet_is_active: boolean;
  total_deposits: string; total_withdrawals: string;
  total_bets: string; total_wins: string; net_pl: string;
  total_games_played: number;
  recent_transactions: Transaction[];
  recent_game_rounds: GameRound[];
}

export default function AdminUserPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const isSelf = currentUser?.id === userId;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"transactions" | "games">("transactions");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjType, setAdjType] = useState<"credit" | "debit">("credit");
  const [adjSaving, setAdjSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiClient.get<UserDetail>(`/admin/users/${userId}/detail`)
      .then((res) => setUser(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleAdjust = async () => {
    if (!adjAmount || !adjReason) return;
    setAdjSaving(true);
    setMsg(null);
    try {
      await apiClient.post(`/admin/wallet/${userId}/adjust`, {
        amount: adjAmount, type: adjType, reason: adjReason,
      });
      setMsg({ type: "success", text: `$${adjAmount} ${adjType}ed — ${adjReason}` });
      setAdjAmount("");
      setAdjReason("");
      const res = await apiClient.get<UserDetail>(`/admin/users/${userId}/detail`);
      setUser(res.data);
    } catch {
      setMsg({ type: "error", text: "Failed to adjust wallet" });
    }
    setAdjSaving(false);
  };

  const handleFreeze = async () => {
    if (!user) return;
    try {
      await apiClient.post(`/admin/wallet/${userId}/freeze`, { is_frozen: user.wallet_is_active });
      const res = await apiClient.get<UserDetail>(`/admin/users/${userId}/detail`);
      setUser(res.data);
      setMsg({ type: "success", text: user.wallet_is_active ? "Wallet frozen" : "Wallet unfrozen" });
    } catch {
      setMsg({ type: "error", text: "Failed to toggle wallet freeze" });
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    setMsg(null);
    try {
      const { data } = await apiClient.post(`/admin/users/${userId}/toggle-active`);
      const res = await apiClient.get<UserDetail>(`/admin/users/${userId}/detail`);
      setUser(res.data);
      setMsg({ type: "success", text: data.is_active ? "User reactivated" : "User suspended" });
    } catch {
      setMsg({ type: "error", text: "Failed to toggle user status" });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#4C00C2]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <p className="text-gray-500 font-bold">User not found</p>
        <button onClick={() => navigate("/admin")} className="rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0">
          Back to Admin
        </button>
      </div>
    );
  }

  const formatUSD = (val: string) => `$${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <button onClick={() => navigate("/admin")} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-b-[3px] border-[#3d009e]/30 bg-[#4C00C2] text-sm font-black text-white shadow-sm">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-gray-900">{user.username}</h1>
          <p className="text-xs text-gray-500 font-medium">{user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
            user.is_active ? "border-b-[3px] border-emerald-200 bg-emerald-50 text-emerald-600" : "border-b-[3px] border-red-200 bg-red-50 text-red-600"
          }`}>{user.is_active ? "Active" : "Suspended"}</span>
          {user.is_verified && <span className="inline-flex items-center rounded-full border-b-[3px] border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600">KYC</span>}
          {user.is_admin && <span className="inline-flex items-center rounded-full border-b-[3px] border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">Admin</span>}
        </div>
      </header>

      <div className="p-6 max-w-[1400px] mx-auto">
        {msg && (
          <div className={`mb-4 rounded-2xl border-b-[4px] px-4 py-3 text-sm font-medium ${
            msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}>{msg.text}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Left: Wallet + Stats ─────────────── */}
          <div className="space-y-5 lg:col-span-1">
            {/* Wallet Card */}
            <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              <h2 className="mb-4 text-xs font-bold tracking-wide text-gray-600 uppercase">Wallet</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-gray-500">Balance</p>
                  <p className="font-display text-3xl font-black tracking-tight text-emerald-600">{formatUSD(user.wallet_balance)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border-b-[3px] border-amber-200 bg-amber-50/50 p-3">
                    <p className="text-xs font-bold text-gray-500">Locked</p>
                    <p className="font-mono font-bold text-amber-600">{formatUSD(user.wallet_locked)}</p>
                  </div>
                  <div className="rounded-2xl border-b-[3px] border-blue-200 bg-blue-50/50 p-3">
                    <p className="text-xs font-bold text-gray-500">Bonus</p>
                    <p className="font-mono font-bold text-blue-600">{formatUSD(user.wallet_bonus)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="text-xs font-bold text-gray-500">{user.wallet_currency} • {user.wallet_is_active ? "Active" : "Frozen"}</span>
                  <button onClick={handleFreeze}
                    className={`rounded-full border-b-[3px] px-4 py-1.5 text-xs font-bold transition-all duration-75 active:translate-y-[3px] active:border-b-0 ${
                      user.wallet_is_active
                        ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                        : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    }`}>{user.wallet_is_active ? "Freeze" : "Unfreeze"}</button>
                </div>
              </div>
            </div>

            {/* Adjust Wallet */}
            <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              <h2 className="mb-4 text-xs font-bold tracking-wide text-gray-600 uppercase">Adjust Balance</h2>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={() => setAdjType("credit")}
                    className={`flex-1 rounded-full py-2.5 text-xs font-bold transition-all duration-75 active:translate-y-[2px] ${
                      adjType === "credit" ? "border-b-[3px] border-emerald-200 bg-emerald-50 text-emerald-600" : "border-b-[3px] border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}>Credit +</button>
                  <button onClick={() => setAdjType("debit")}
                    className={`flex-1 rounded-full py-2.5 text-xs font-bold transition-all duration-75 active:translate-y-[2px] ${
                      adjType === "debit" ? "border-b-[3px] border-red-200 bg-red-50 text-red-600" : "border-b-[3px] border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}>Debit −</button>
                </div>
                <input type="number" step="0.01" min="0.01" placeholder="Amount" value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
                <input type="text" placeholder="Reason (e.g. Bonus, Correction)" value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
                <button onClick={handleAdjust} disabled={adjSaving || !adjAmount || !adjReason}
                  className="w-full rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-4 py-3 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0 disabled:opacity-50">
                  {adjSaving ? "Processing..." : adjType === "credit" ? "Credit Wallet" : "Debit Wallet"}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              <h2 className="mb-4 text-xs font-bold tracking-wide text-gray-600 uppercase">Lifetime Stats</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="font-bold text-gray-500">Games Played</span><span className="font-bold text-gray-900">{user.total_games_played}</span></div>
                <div className="flex justify-between"><span className="font-bold text-gray-500">Total Deposits</span><span className="font-mono font-bold text-emerald-600">{formatUSD(user.total_deposits)}</span></div>
                <div className="flex justify-between"><span className="font-bold text-gray-500">Total Withdrawals</span><span className="font-mono font-bold text-red-600">{formatUSD(user.total_withdrawals)}</span></div>
                <div className="flex justify-between"><span className="font-bold text-gray-500">Total Bets</span><span className="font-mono font-bold text-gray-600">{formatUSD(user.total_bets)}</span></div>
                <div className="flex justify-between"><span className="font-bold text-gray-500">Total Wins</span><span className="font-mono font-bold text-emerald-600">{formatUSD(user.total_wins)}</span></div>
                <div className="flex justify-between border-t border-gray-100 pt-3">
                  <span className="font-bold text-gray-500">Net P&amp;L</span>
                  <span className={`font-mono font-black ${parseFloat(user.net_pl) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {parseFloat(user.net_pl) >= 0 ? "+" : ""}{formatUSD(user.net_pl)}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Info */}
            <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-wide text-gray-600 uppercase">Account</h2>
                {isSelf ? (
                  <span className="rounded-full border-b-[3px] border-gray-200 bg-gray-100 px-4 py-1.5 text-xs font-bold text-gray-400 cursor-not-allowed" title="You cannot suspend your own account">
                    Cannot self-suspend
                  </span>
                ) : (
                  <button onClick={handleToggleActive}
                    className={`rounded-full border-b-[3px] px-4 py-1.5 text-xs font-bold transition-all duration-75 active:translate-y-[3px] active:border-b-0 ${
                      user.is_active
                        ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                        : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    }`}>{user.is_active ? "Suspend" : "Reactivate"}</button>
                )}
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="font-bold text-gray-500">Joined</span><span className="font-bold text-gray-900">{new Date(user.created_at).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="font-bold text-gray-500">Last Updated</span><span className="font-bold text-gray-900">{new Date(user.updated_at).toLocaleDateString()}</span></div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="mb-2 text-xs font-bold tracking-wide text-gray-600 uppercase">Login History</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-500">Last Login</span>
                      <span className="font-bold text-gray-900">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleString()
                          : "Never"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-500">Last IP</span>
                      <span className="font-mono text-xs font-bold text-gray-900">
                        {user.last_login_ip || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Activity ──────────────────── */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="mb-4 flex gap-2 rounded-full border-b-[4px] border-gray-200 bg-white p-1.5 shadow-sm">
              <button onClick={() => setActiveTab("transactions")}
                className={`flex-1 rounded-full px-4 py-2.5 text-xs font-bold transition-all duration-75 active:translate-y-[2px] ${
                  activeTab === "transactions" ? "border-b-[3px] border-[#3d009e] bg-[#4C00C2] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>Transactions ({user.recent_transactions.length})</button>
              <button onClick={() => setActiveTab("games")}
                className={`flex-1 rounded-full px-4 py-2.5 text-xs font-bold transition-all duration-75 active:translate-y-[2px] ${
                  activeTab === "games" ? "border-b-[3px] border-[#3d009e] bg-[#4C00C2] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>Game History ({user.recent_game_rounds.length})</button>
            </div>

            {/* Transactions */}
            {activeTab === "transactions" && (
              <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
                {user.recent_transactions.length === 0 ? (
                  <div className="py-12 text-center text-sm font-bold text-gray-400">No transactions yet</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#4C00C2]/5 text-xs uppercase tracking-wider text-[#4C00C2]">
                        <th className="px-5 py-3.5 text-left font-bold">Date</th>
                        <th className="px-5 py-3.5 text-left font-bold">Type</th>
                        <th className="px-5 py-3.5 text-left font-bold">Status</th>
                        <th className="px-5 py-3.5 text-right font-bold">Amount</th>
                        <th className="px-5 py-3.5 text-left font-bold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.recent_transactions.map((tx) => (
                        <tr key={tx.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                          <td className="px-5 py-3.5 text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`inline-flex h-2 w-2 rounded-full ${
                                tx.type === "deposit" || tx.type === "win" || tx.type === "adjustment" || tx.type === "bonus" ? "bg-emerald-500" : "bg-red-500"
                              }`} />
                              <span className="text-xs font-bold capitalize text-gray-700">{tx.type}</span>
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs font-bold capitalize ${
                              tx.status === "completed" ? "text-emerald-600" :
                              tx.status === "pending" ? "text-amber-600" :
                              tx.status === "hold" ? "text-blue-600" :
                              tx.status === "failed" || tx.status === "cancelled" ? "text-red-600" : "text-gray-600"
                            }`}>{tx.status}</span>
                          </td>
                          <td className={`px-5 py-3.5 text-right font-mono text-xs font-bold ${
                            tx.type === "deposit" || tx.type === "win" || tx.type === "bonus" ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {(tx.type === "deposit" || tx.type === "win" || tx.type === "bonus" ? "+" : "-")}
                            ${parseFloat(tx.amount).toFixed(2)}
                          </td>
                          <td className="max-w-[200px] truncate px-5 py-3.5 text-xs text-gray-500">{tx.description || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Game History */}
            {activeTab === "games" && (
              <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
                {user.recent_game_rounds.length === 0 ? (
                  <div className="py-12 text-center text-sm font-bold text-gray-400">No games played yet</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#4C00C2]/5 text-xs uppercase tracking-wider text-[#4C00C2]">
                        <th className="px-5 py-3.5 text-left font-bold">Date</th>
                        <th className="px-5 py-3.5 text-left font-bold">Game</th>
                        <th className="px-5 py-3.5 text-left font-bold">Status</th>
                        <th className="px-5 py-3.5 text-right font-bold">Bet</th>
                        <th className="px-5 py-3.5 text-right font-bold">Payout</th>
                        <th className="px-5 py-3.5 text-right font-bold">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.recent_game_rounds.map((g) => {
                        const bet = parseFloat(g.bet_amount);
                        const payout = g.payout_amount ? parseFloat(g.payout_amount) : 0;
                        const won = payout > 0;
                        return (
                          <tr key={g.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                            <td className="px-5 py-3.5 text-xs text-gray-500">{new Date(g.created_at).toLocaleDateString()}</td>
                            <td className="px-5 py-3.5 text-xs font-bold capitalize text-gray-900">{g.game_type}</td>
                            <td className="px-5 py-3.5">
                              <span className={`text-xs font-bold capitalize ${
                                g.status === "completed" ? "text-emerald-600" :
                                g.status === "cancelled" ? "text-red-600" : "text-amber-600"
                              }`}>{g.status}</span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono text-xs font-bold text-gray-600">${bet.toFixed(2)}</td>
                            <td className="px-5 py-3.5 text-right font-mono text-xs font-bold text-gray-600">{payout > 0 ? `$${payout.toFixed(2)}` : "—"}</td>
                            <td className="px-5 py-3.5 text-right">
                              {g.is_completed && (
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                                  won ? "border-b-[2px] border-emerald-200 bg-emerald-50 text-emerald-600" : "border-b-[2px] border-red-200 bg-red-50 text-red-600"
                                }`}>
                                  {won ? "Won" : "Lost"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
