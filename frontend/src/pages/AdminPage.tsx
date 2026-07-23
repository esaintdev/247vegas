import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import apiClient from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";
import { BonusesPanel } from "./AdminBonusesPanel";
import { AdminNotifyPanel } from "./AdminNotifyPanel";
import { FairnessPanel } from "./AdminFairnessPanel";
import { PlatformSettingsPanel, GameControlPanel } from "./AdminSettingsPanel";
import { downloadCsv, toCsv } from "@/utils/csv";

type Tab = "overview" | "users" | "transactions" | "games" | "kyc" | "analytics" | "settings" | "bonuses" | "gamecontrol" | "platform" | "audit" | "roles" | "notify" | "fairness";

interface Stats {
  total_users: number; active_users: number;
  total_deposits: string; total_withdrawals: string;
  total_bets: string; total_wins: string;
  platform_revenue: string; games_played: number;
  pending_withdrawals: number; pending_withdrawal_amount: string;
}

interface UserRow {
  id: string; email: string; username: string; display_name: string;
  is_active: boolean; is_verified: boolean;
  wallet_balance: string; wallet_locked: string;
  transaction_count: number; game_count: number;
  created_at: string;
}

interface TxRow {
  id: string; user_email: string; user_username: string;
  type: string; status: string; amount: string;
  description: string | null; created_at: string;
}

interface GameStatRow {
  game_type: string; total_rounds: number;
  total_bet: string; total_payout: string; rtp: string;
}

interface KycRow {
  id: string; user_id: string; user_email: string; user_username: string;
  status: string; document_type: string | null; full_name: string | null;
  nationality: string | null; submitted_at: string | null;
}

interface ActiveUsersResponse {
  last_hour: number; last_24h: number; last_7d: number; last_30d: number;
}

interface RevenuePoint {
  date: string; deposits: string; withdrawals: string;
  bets: string; wins: string; revenue: string; games_played: number;
}

interface GamePopRow {
  game_type: string; total_rounds: number; unique_players: number;
  total_bet: string; total_payout: string; rtp: string;
}

interface UserGrowthPoint {
  date: string; registrations: number; total_users: number;
}

interface GameConfigRow {
  game_type: string;
  min_bet: string;
  max_bet: string;
  default_bet: string;
  rtp_adjustment: string;
  is_active: boolean;
}

interface AuditLogEntry {
  id: string;
  admin_id: string;
  admin_username: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  timestamp: string;
}

const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> },
  { id: "analytics", label: "Analytics", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg> },
  { id: "users", label: "Users", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: "transactions", label: "Transactions", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { id: "games", label: "Games", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4"/><path d="M8 10v4"/><circle cx="16" cy="12" r="1"/><circle cx="19" cy="9" r="1"/></svg> },
  { id: "kyc", label: "KYC", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg> },
  { id: "settings", label: "Settings", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  { id: "bonuses", label: "Bonuses", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
  { id: "gamecontrol", label: "Game Control", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
  { id: "platform", label: "Platform", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> },
  { id: "audit", label: "Audit Log", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
  { id: "roles", label: "Admin Roles", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> },
  { id: "notify", label: "Notify", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
  { id: "fairness", label: "Fairness", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg> },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [gameStats, setGameStats] = useState<GameStatRow[]>([]);
  const [kycList, setKycList] = useState<KycRow[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUsersResponse | null>(null);
  const [revenueTrends, setRevenueTrends] = useState<RevenuePoint[]>([]);
  const [gamePop, setGamePop] = useState<GamePopRow[]>([]);
  const [userGrowth, setUserGrowth] = useState<UserGrowthPoint[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (user && !user.is_admin) {
    navigate("/dashboard");
    return null;
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, txsRes, gamesRes, kycRes] = await Promise.all([
        apiClient.get<Stats>("/admin/stats"),
        apiClient.get<UserRow[]>("/admin/users"),
        apiClient.get<TxRow[]>("/admin/transactions"),
        apiClient.get<GameStatRow[]>("/admin/games"),
        apiClient.get<KycRow[]>("/kyc/admin/pending"),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setTxs(txsRes.data);
      setGameStats(gamesRes.data);
      setKycList(kycRes.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadAnalytics = useCallback(() => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    Promise.all([
      apiClient.get<ActiveUsersResponse>("/analytics/active-users"),
      apiClient.get<RevenuePoint[]>("/analytics/revenue-trends?days=14"),
      apiClient.get<GamePopRow[]>("/analytics/game-popularity?days=30"),
      apiClient.get<UserGrowthPoint[]>("/analytics/user-growth?days=14"),
    ]).then(([au, rt, gp, ug]) => {
      setActiveUsers(au.data);
      setRevenueTrends(rt.data);
      setGamePop(gp.data);
      setUserGrowth(ug.data);
    }).catch((err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error)?.message
        || "Failed to load analytics data";
      setAnalyticsError(msg);
    }).finally(() => setAnalyticsLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== "analytics") return;
    loadAnalytics();
  }, [tab, loadAnalytics]);

  const toggleActive = async (userId: string) => {
    await apiClient.post(`/admin/users/${userId}/toggle-active`);
    fetchData();
  };

  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [txMessage, setTxMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const approveTx = async (txId: string) => {
    setProcessingIds((prev) => new Set(prev).add(txId));
    setTxMessage(null);
    try {
      const { data } = await apiClient.post(`/admin/transactions/${txId}/approve`);
      setTxMessage({ type: "success", text: data.message || "Approved" });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Approval failed";
      setTxMessage({ type: "error", text: detail });
    }
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(txId);
      return next;
    });
    fetchData();
  };

  const cancelTx = async (txId: string) => {
    if (!confirm("Cancel this withdrawal and refund the wallet?")) return;
    setProcessingIds((prev) => new Set(prev).add(txId));
    setTxMessage(null);
    try {
      const { data } = await apiClient.post(`/admin/transactions/${txId}/cancel`);
      setTxMessage({ type: "success", text: data.message || "Cancelled" });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Cancel failed";
      setTxMessage({ type: "error", text: detail });
    }
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(txId);
      return next;
    });
    fetchData();
  };

  const bulkApprove = async () => {
    const ids = Array.from(selectedTxIds);
    if (ids.length === 0) return;
    if (!confirm(`Approve ${ids.length} withdrawal(s)?`)) return;
    try {
      await apiClient.post("/admin/transactions/bulk-approve", { tx_ids: ids });
    } catch { /* Silent fail */ }
    setSelectedTxIds(new Set());
    fetchData();
  };

  const toggleSelectTx = (txId: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  const searchUsers = async () => {
    try {
      const { data } = await apiClient.get<UserRow[]>("/admin/users", {
        params: { search, limit: 50 },
      });
      setUsers(data);
    } catch { /* ignore */ }
  };

  const formatCurrency = (val: string) =>
    `$${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportCsv = (data: any[], columns: { key: string; label: string }[], filename: string) => {
    downloadCsv(toCsv(data, columns), filename);
  };

  // ── Admin Roles Panel ─────────────────────────────
  interface AdminUser {
    id: string; username: string; email: string;
    admin_role: string | null; is_active: boolean; created_at: string;
  }

  function AdminRolesPanel() {
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoadingState] = useState(true);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const fetchAdmins = () => {
      apiClient.get<AdminUser[]>("/admin/admins")
        .then((res) => setAdmins(res.data))
        .catch(() => {})
        .finally(() => setLoadingState(false));
    };

    useEffect(() => { fetchAdmins(); }, []);

    const updateRole = async (userId: string, role: string | null) => {
      setMsg(null);
      try {
        await apiClient.put(`/admin/users/${userId}/role`, { admin_role: role });
        setMsg({ type: "success", text: "Role updated" });
        fetchAdmins();
      } catch (err: any) {
        const detail = err?.response?.data?.detail || "Failed to update role";
        setMsg({ type: "error", text: detail });
      }
    };

    if (loading) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#4C00C2] border-t-transparent" />
        </div>
      );
    }

    const roleColors: Record<string, string> = {
      super_admin: "bg-red-100 text-red-700",
      manager: "bg-amber-100 text-amber-700",
      support: "bg-blue-100 text-blue-700",
      finance: "bg-emerald-100 text-emerald-700",
    };

    return (
      <div>
        {msg && (
          <div className={`mb-4 rounded-2xl border-b-[4px] px-4 py-3 text-sm font-medium ${
            msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}>{msg.text}</div>
        )}
        <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#4C00C2]/5 text-xs uppercase tracking-wider text-[#4C00C2]">
                <th className="px-5 py-3.5 text-left font-bold">Admin</th>
                <th className="px-5 py-3.5 text-left font-bold">Email</th>
                <th className="px-5 py-3.5 text-left font-bold">Role</th>
                <th className="px-5 py-3.5 text-center font-bold">Status</th>
                <th className="px-5 py-3.5 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">No admin users</td></tr>
              ) : (
                admins.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                    <td className="px-5 py-3.5 text-left font-medium text-gray-900">{a.username}</td>
                    <td className="px-5 py-3.5 text-left text-gray-500">{a.email}</td>
                    <td className="px-5 py-3.5 text-left">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${roleColors[a.admin_role || ""] || "bg-gray-100 text-gray-600"}`}>
                        {a.admin_role ? a.admin_role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex h-2 w-2 rounded-full ${a.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <select
                        value={a.admin_role || ""}
                        onChange={(e) => updateRole(a.id, e.target.value || null)}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                      >
                        <option value="">Demote to Player</option>
                        <option value="super_admin">Super Admin</option>
                        <option value="manager">Manager</option>
                        <option value="support">Support</option>
                        <option value="finance">Finance</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Audit Log Panel ────────────────────────────────
  function AuditLogPanel() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoadingState] = useState(true);

    useEffect(() => {
      apiClient.get<AuditLogEntry[]>("/admin/audit-log", { params: { limit: 100 } })
        .then((res) => setLogs(res.data))
        .catch(() => {})
        .finally(() => setLoadingState(false));
    }, []);

    if (loading) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#4C00C2] border-t-transparent" />
        </div>
      );
    }

    const actionLabels: Record<string, string> = {
      user_toggle_active: "Toggle User Status",
      wallet_adjust: "Wallet Adjust",
      wallet_freeze: "Wallet Freeze",
      approve_withdrawal: "Approve Withdrawal",
      cancel_withdrawal: "Cancel Withdrawal",
      bulk_approve_withdrawals: "Bulk Approve",
      update_game_settings: "Update Game Config",
      update_platform_settings: "Update Platform Settings",
      kill_round: "Kill Game Round",
      create_bonus: "Create Bonus",
      update_bonus: "Update Bonus",
      issue_bonus: "Issue Bonus",
      approve_kyc: "Approve KYC",
      reject_kyc: "Reject KYC",
    };

    const actionColors: Record<string, string> = {
      user_toggle_active: "bg-amber-100 text-amber-700",
      wallet_adjust: "bg-blue-100 text-blue-700",
      wallet_freeze: "bg-red-100 text-red-700",
      approve_withdrawal: "bg-emerald-100 text-emerald-700",
      cancel_withdrawal: "bg-red-100 text-red-700",
      bulk_approve_withdrawals: "bg-emerald-100 text-emerald-700",
      update_game_settings: "bg-violet-100 text-violet-700",
      update_platform_settings: "bg-violet-100 text-violet-700",
      kill_round: "bg-red-100 text-red-700",
      create_bonus: "bg-amber-100 text-amber-700",
      update_bonus: "bg-amber-100 text-amber-700",
      issue_bonus: "bg-emerald-100 text-emerald-700",
      approve_kyc: "bg-emerald-100 text-emerald-700",
      reject_kyc: "bg-red-100 text-red-700",
    };

    return (
      <div>
        <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#4C00C2]/5 text-xs uppercase tracking-wider text-[#4C00C2]">
                <th className="px-5 py-3.5 text-left font-bold">Admin</th>
                <th className="px-5 py-3.5 text-left font-bold">Action</th>
                <th className="px-5 py-3.5 text-left font-bold">Target</th>
                <th className="px-5 py-3.5 text-left font-bold">Details</th>
                <th className="px-5 py-3.5 text-right font-bold">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-gray-400">No audit log entries</td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                    <td className="px-5 py-3.5 text-left">
                      <span className="font-medium text-gray-900">{l.admin_username}</span>
                    </td>
                    <td className="px-5 py-3.5 text-left">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${actionColors[l.action] || "bg-gray-100 text-gray-600"}`}>
                        {actionLabels[l.action] || l.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-left text-gray-500">
                      {l.target_type && (
                        <span className="capitalize">{l.target_type.replace(/_/g, " ")}</span>
                      )}
                      {l.target_id && (
                        <span className="ml-1 font-mono text-xs text-gray-400">#{l.target_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="max-w-[250px] truncate px-5 py-3.5 text-left text-gray-500">
                      {l.details || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-gray-500">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Settings Panel ────────────────────────────────
  function SettingsPanel() {
    const [settings, setSettings] = useState<GameConfigRow[]>([]);
    const [loading, setLoadingState] = useState(true);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
      apiClient.get<GameConfigRow[]>("/admin/game-settings")
        .then((res) => setSettings(res.data))
        .catch(() => {})
        .finally(() => setLoadingState(false));
    }, []);

    if (loading) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#4C00C2] border-t-transparent" />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {msg && (
          <div className={`mb-4 rounded-2xl border-b-[4px] px-4 py-3 text-sm font-medium ${
            msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}>{msg.text}</div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {settings.map((cfg) => (
            <GameConfigCard key={cfg.game_type} config={cfg} onMessage={setMsg} />
          ))}
        </div>
      </div>
    );
  }

  function GameConfigCard({ config, onMessage }: { config: GameConfigRow; onMessage: (msg: { type: "success" | "error"; text: string } | null) => void }) {
    const [minBet, setMinBet] = useState(config.min_bet);
    const [maxBet, setMaxBet] = useState(config.max_bet);
    const [defBet, setDefBet] = useState(config.default_bet);
    const [rtpAdj, setRtpAdj] = useState(config.rtp_adjustment);
    const [active, setActive] = useState(config.is_active);
    const [saving, setSaving] = useState(false);

    const save = async () => {
      setSaving(true);
      onMessage(null);
      try {
        await apiClient.put(`/admin/game-settings/${config.game_type}`, {
          min_bet: minBet, max_bet: maxBet, default_bet: defBet,
          rtp_adjustment: rtpAdj, is_active: active,
        });
        onMessage({ type: "success", text: `${config.game_type} settings saved` });
      } catch {
        onMessage({ type: "error", text: `Failed to save ${config.game_type} settings` });
      }
      setSaving(false);
    };

    return (
      <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all hover:shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold capitalize text-gray-900">{config.game_type}</h3>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" checked={active}
              onChange={() => setActive(!active)}
              className="peer sr-only" />
            <div className="h-6 w-10 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-[#4C00C2] peer-checked:after:translate-x-full" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">Min Bet ($)</label>
            <input type="number" step="0.01" min="0" value={minBet}
              onChange={(e) => setMinBet(e.target.value)}
              className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">Max Bet ($)</label>
            <input type="number" step="0.01" min="0" value={maxBet}
              onChange={(e) => setMaxBet(e.target.value)}
              className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">Default Bet ($)</label>
            <input type="number" step="0.01" min="0" value={defBet}
              onChange={(e) => setDefBet(e.target.value)}
              className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">RTP Adj (%)</label>
            <input type="number" step="0.01" value={rtpAdj}
              onChange={(e) => setRtpAdj(e.target.value)}
              className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
          </div>
        </div>
        <button onClick={save} disabled={saving}
          className="mt-4 w-full rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0 disabled:opacity-50">
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#4C00C2] transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Brand */}
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-b-[4px] border-white/20 bg-white/20 text-sm font-black text-white shadow-sm">
              A
            </div>
            <div>
              <span className="font-display text-lg font-black tracking-tight text-white">Admin</span>
              <p className="text-[10px] leading-tight tracking-wider text-white/60 uppercase font-bold">Control Panel</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {navItems
            .filter((item) => item.id !== "roles" || (user as any)?.admin_role === "super_admin" || !(user as any)?.admin_role)
            .map((item) => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setSidebarOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-full px-5 py-3 text-sm font-bold transition-all duration-75 active:translate-y-[1px] ${
                tab === item.id
                  ? "bg-white text-[#4C00C2] shadow-md"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className={tab === item.id ? "text-[#4C00C2]" : "text-white/60"}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 px-3 py-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex w-full items-center gap-3 rounded-full px-5 py-3 text-sm font-bold text-white/70 transition-all duration-75 hover:bg-white/10 hover:text-white active:translate-y-[1px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Back to Dashboard
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-20 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-8 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 lg:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-b-[3px] border-[#3d009e]/30 bg-[#4C00C2]/10 text-[#4C00C2]">
              {navItems.find((n) => n.id === tab)?.icon}
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-gray-900 capitalize">{tab}</h1>
              <p className="text-xs text-gray-500 font-medium">Platform management & oversight</p>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8">
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#4C00C2]" />
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {/* ── Overview ─────────────────────────── */}
                {tab === "overview" && stats && (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { key: "total_users" as const, label: "Total Users", border: "border-b-blue-400", text: "text-blue-600" },
                        { key: "active_users" as const, label: "Active Users", border: "border-b-emerald-400", text: "text-emerald-600" },
                        { key: "games_played" as const, label: "Games Played", border: "border-b-violet-400", text: "text-violet-600" },
                        { key: "pending_withdrawals" as const, label: "Pending Withdrawals", border: "border-b-amber-400", text: "text-amber-600" },
                      ].map((s) => (
                        <div key={s.key} className="rounded-[24px] border-b-[4px] border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-75 active:translate-y-[4px] hover:shadow-md" style={{ borderBottomColor: s.border.includes("blue") ? "#60A5FA" : s.border.includes("emerald") ? "#34D399" : s.border.includes("violet") ? "#A78BFA" : "#FBBF24" }}>
                          <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">{s.label}</p>
                          <p className={`mt-2 font-display text-3xl font-black tracking-tight ${s.text}`}>
                            {typeof stats[s.key] === "number"
                              ? (stats[s.key] as number).toLocaleString()
                              : stats[s.key]}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        { key: "total_deposits" as const, label: "Total Deposits", border: "border-b-emerald-400", text: "text-emerald-600" },
                        { key: "total_withdrawals" as const, label: "Total Withdrawals", border: "border-b-red-400", text: "text-red-600" },
                        { key: "platform_revenue" as const, label: "Platform Revenue", border: "border-b-amber-400", text: "text-amber-600" },
                      ].map((s) => {
                        const val = stats[s.key] as string;
                        const isNegative = s.key === "platform_revenue" && val.startsWith("-");
                        return (
                          <div key={s.key} className="rounded-[24px] border-b-[4px] border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-75 active:translate-y-[4px] hover:shadow-md" style={{ borderBottomColor: s.border.includes("emerald") ? "#34D399" : s.border.includes("red") ? "#F87171" : "#FBBF24" }}>
                            <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">{s.label}</p>
                            <p className={`mt-2 font-display text-3xl font-black tracking-tight ${isNegative ? "text-red-600" : s.text}`}>
                              {formatCurrency(val)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* ── Analytics ───────────────────────── */}
                {tab === "analytics" && (
                  <>
                    {analyticsLoading ? (
                      <div className="flex items-center justify-center py-24">
                        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#4C00C2]" />
                      </div>
                    ) : (
                      <>
                        {/* Error banner */}
                        {analyticsError && (
                          <div className="rounded-2xl border-b-[4px] border-red-200 bg-red-50 px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">⚠️</span>
                              <div>
                                <p className="text-sm font-bold text-red-700">Failed to load analytics</p>
                                <p className="text-xs text-red-600">{analyticsError}</p>
                              </div>
                            </div>                              <button
                              onClick={loadAnalytics}
                              className="mt-3 rounded-full border-b-[3px] border-red-200 bg-white px-4 py-1.5 text-xs font-bold text-red-600 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-red-50"
                            >
                              Retry
                            </button>
                          </div>
                        )}

                        {/* Active Users — always render, show zeroes when no data */}
                        <div>
                          <h2 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Active Users</h2>
                          <div className="grid gap-4 sm:grid-cols-4">
                            {[
                              { label: "Last Hour", key: "last_hour" as const, border: "border-b-red-400", text: "text-red-600" },
                              { label: "Last 24h", key: "last_24h" as const, border: "border-b-amber-400", text: "text-amber-600" },
                              { label: "Last 7 Days", key: "last_7d" as const, border: "border-b-emerald-400", text: "text-emerald-600" },
                              { label: "Last 30 Days", key: "last_30d" as const, border: "border-b-blue-400", text: "text-blue-600" },
                            ].map((s) => {
                              const value = activeUsers?.[s.key] ?? 0;
                              return (
                                <div key={s.label} className="rounded-[24px] border-b-[4px] border-gray-200 bg-white p-5 shadow-sm" style={{ borderBottomColor: s.border.includes("red") ? "#F87171" : s.border.includes("amber") ? "#FBBF24" : s.border.includes("emerald") ? "#34D399" : "#60A5FA" }}>
                                  <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">{s.label}</p>
                                  <p className={`mt-2 font-display text-2xl font-black tracking-tight ${s.text}`}>{value}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <h2 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Revenue Trend (14 Days)</h2>
                          <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
                            {revenueTrends.length === 0 ? (
                              <div className="py-8 text-center">
                                <p className="text-sm font-bold text-gray-400">No revenue data available yet</p>
                                <p className="mt-1 text-xs text-gray-400">Data will appear once players start playing games</p>
                              </div>
                            ) : (
                              <div className="flex items-end gap-1" style={{ height: 120 }}>
                                {revenueTrends.map((p, i) => {
                                  const rev = parseFloat(p.revenue);
                                  const maxRev = Math.max(...revenueTrends.map((r) => Math.abs(parseFloat(r.revenue))), 1);
                                  const heightPct = Math.max((Math.abs(rev) / maxRev) * 100, 2);
                                  return (
                                    <div key={p.date} className="flex flex-1 flex-col items-center">
                                      <div
                                        className={`w-full rounded-t transition-all hover:opacity-100 ${rev >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                                        style={{ height: `${heightPct}%`, opacity: 0.5 }}
                                        title={`${p.date}: $${rev.toFixed(2)}`}
                                      />
                                      {i % 3 === 0 && <span className="mt-1.5 text-[10px] text-gray-500">{p.date.slice(5)}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h2 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Game Popularity (30 Days)</h2>
                          <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
                            {gamePop.length === 0 ? (
                              <div className="py-8 text-center">
                                <p className="text-sm font-bold text-gray-400">No game data available yet</p>
                                <p className="mt-1 text-xs text-gray-400">Game popularity stats will appear once players start playing</p>
                              </div>
                            ) : (
                              <>
                                <div className="space-y-3">
                                {gamePop.map((g) => {
                                  const maxRounds = Math.max(...gamePop.map((r) => r.total_rounds), 1);
                                  const pct = Math.max((g.total_rounds / maxRounds) * 100, g.total_rounds > 0 ? 5 : 0);
                                  return (
                                    <div key={g.game_type} className="space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold capitalize text-gray-900">{g.game_type}</span>
                                        <span className="font-mono text-gray-500">{g.total_rounds} rounds • {g.unique_players} players</span>
                                      </div>
                                      <div className="relative h-6 w-full overflow-hidden rounded-full bg-gray-100">
                                        <div
                                          className="h-full rounded-full bg-gradient-to-r from-[#4C00C2] to-[#7C3AED] transition-all duration-500"
                                          style={{ width: `${pct}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center px-3">
                                          <span className="text-[10px] font-bold text-white drop-shadow-sm">{formatCurrency(g.total_bet)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Table */}
                              <div className="mt-4 overflow-hidden rounded-[16px] border border-gray-100">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-[#4C00C2]/5 text-xs uppercase tracking-wider text-[#4C00C2]">
                                      <th className="px-4 py-3 text-left font-bold">Game</th>
                                      <th className="px-4 py-3 text-right font-bold">Rounds</th>
                                      <th className="px-4 py-3 text-right font-bold">Players</th>
                                      <th className="px-4 py-3 text-right font-bold">Total Bet</th>
                                      <th className="px-4 py-3 text-right font-bold">RTP</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {gamePop.map((g) => (
                                      <tr key={g.game_type} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                                        <td className="px-4 py-3 text-left font-bold capitalize text-gray-900">{g.game_type}</td>
                                        <td className="px-4 py-3 text-right text-gray-600">{g.total_rounds}</td>
                                        <td className="px-4 py-3 text-right text-gray-600">{g.unique_players}</td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-800 font-bold">{formatCurrency(g.total_bet)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-800 font-bold">{g.rtp}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                            )}
                          </div>
                        </div>

                        <div>
                          <h2 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">User Registrations (14 Days)</h2>
                          <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
                            {userGrowth.length === 0 ? (
                              <div className="py-8 text-center">
                                <p className="text-sm font-bold text-gray-400">No registration data yet</p>
                                <p className="mt-1 text-xs text-gray-400">User registration trends will appear once users start signing up</p>
                              </div>
                            ) : (
                              <div className="flex items-end gap-1" style={{ height: 80 }}>
                                {userGrowth.map((p, i) => {
                                  const maxReg = Math.max(...userGrowth.map((r) => r.registrations), 1);
                                  const heightPct = Math.max((p.registrations / maxReg) * 100, 2);
                                  return (
                                    <div key={p.date} className="flex flex-1 flex-col items-center">
                                      <div className="w-full rounded-t bg-[#4C00C2] transition-all hover:opacity-100" style={{ height: `${heightPct}%`, opacity: 0.4 }}
                                        title={`${p.date}: ${p.registrations} registrations`} />
                                      {i % 3 === 0 && <span className="mt-1.5 text-[10px] text-gray-500">{p.date.slice(5)}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ── Users ───────────────────────────── */}
                {tab === "users" && (
                  <div>
                    <div className="mb-5 flex gap-3">
                      <div className="relative flex-1">
                        <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search by email or username..."
                          className="w-full rounded-full border border-gray-200 bg-white py-3 pl-10 pr-5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                          onKeyDown={(e) => e.key === "Enter" && searchUsers()} />
                      </div>
                      <button onClick={searchUsers}
                        className="rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0">Search</button>
                      <button onClick={() => exportCsv(users, [
                        { key: "username", label: "Username" }, { key: "email", label: "Email" },
                        { key: "wallet_balance", label: "Balance" }, { key: "wallet_locked", label: "Locked" },
                        { key: "is_active", label: "Active" }, { key: "game_count", label: "Games" },
                        { key: "transaction_count", label: "Transactions" }, { key: "created_at", label: "Joined" },
                      ], `users-${new Date().toISOString().slice(0, 10)}.csv`)}
                        className="rounded-full border-b-[3px] border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        CSV
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#4C00C2]/5 text-xs uppercase tracking-wider text-[#4C00C2]">
                            <th className="px-5 py-3.5 text-left font-bold">User</th>
                            <th className="px-5 py-3.5 text-left font-bold">Email</th>
                            <th className="px-5 py-3.5 text-right font-bold">Balance</th>
                            <th className="px-5 py-3.5 text-right font-bold">Locked</th>
                            <th className="px-5 py-3.5 text-right font-bold">Games</th>
                            <th className="px-5 py-3.5 text-center font-bold">Status</th>
                            <th className="px-5 py-3.5 text-right font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.id}
                              onClick={() => navigate(`/admin/users/${u.id}`)}
                              className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50">
                              <td className="px-5 py-3.5 text-left font-bold text-gray-900">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-b-[3px] border-[#3d009e]/30 bg-[#4C00C2] text-xs font-bold text-white">
                                    {u.username.charAt(0).toUpperCase()}
                                  </div>
                                  {u.username}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-left text-gray-500">{u.email}</td>
                              <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600">${parseFloat(u.wallet_balance).toFixed(2)}</td>
                              <td className="px-5 py-3.5 text-right font-mono text-amber-600">${parseFloat(u.wallet_locked).toFixed(2)}</td>
                              <td className="px-5 py-3.5 text-right text-gray-600">{u.game_count}</td>
                              <td className="px-5 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className={`inline-flex h-2 w-2 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                                  <span className={`text-xs font-bold ${u.is_active ? "text-emerald-600" : "text-red-600"}`}>{u.is_active ? "Active" : "Suspended"}</span>
                                  {u.is_verified && (
                                    <>
                                      <span className="mx-0.5 h-1 w-px bg-gray-200" />
                                      <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
                                      <span className="text-xs font-bold text-amber-600">KYC</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <button onClick={(e) => { e.stopPropagation(); toggleActive(u.id); }}
                                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-75 active:translate-y-[2px] ${
                                    u.is_active
                                      ? "border-b-[3px] border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                      : "border-b-[3px] border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                  }`}>{u.is_active ? "Suspend" : "Reactivate"}</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Transactions ────────────────────── */}
                {tab === "transactions" && (
                  <div>
                    {txMessage && (
                      <div className={`mb-4 rounded-2xl border-b-[4px] px-4 py-3 text-sm font-medium ${
                        txMessage.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                      }`}>{txMessage.text}</div>
                    )}
                    {selectedTxIds.size > 0 && (
                      <div className="mb-4 flex items-center gap-3 rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
                        <span className="text-sm font-bold text-gray-700">{selectedTxIds.size} selected</span>
                        <button onClick={bulkApprove}
                          className="rounded-full border-b-[3px] border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-600 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-emerald-100">Bulk Approve</button>
                        <button onClick={() => setSelectedTxIds(new Set())}
                          className="text-xs font-bold text-gray-500 transition-colors hover:text-gray-700">Clear</button>
                      </div>
                    )}
                    <div className="mb-4 flex justify-end">
                      <button onClick={() => exportCsv(txs, [
                        { key: "user_username", label: "User" }, { key: "user_email", label: "Email" },
                        { key: "type", label: "Type" }, { key: "status", label: "Status" },
                        { key: "amount", label: "Amount" }, { key: "description", label: "Description" },
                        { key: "created_at", label: "Date" },
                      ], `transactions-${new Date().toISOString().slice(0, 10)}.csv`)}
                        className="rounded-full border-b-[3px] border-gray-200 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export CSV
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#4C00C2]/5 text-xs uppercase tracking-wider text-[#4C00C2]">
                            <th className="w-8 px-5 py-3.5 text-left font-bold"></th>
                            <th className="px-5 py-3.5 text-left font-bold">User</th>
                            <th className="px-5 py-3.5 text-left font-bold">Type</th>
                            <th className="px-5 py-3.5 text-left font-bold">Status</th>
                            <th className="px-5 py-3.5 text-right font-bold">Amount</th>
                            <th className="px-5 py-3.5 text-left font-bold">Description</th>
                            <th className="px-5 py-3.5 text-right font-bold">Date</th>
                            <th className="px-5 py-3.5 text-right font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {txs.map((tx) => (
                            <tr key={tx.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                              <td className="px-5 py-3.5 text-left">
                                {tx.type === "withdrawal" && tx.status === "pending" && (
                                  <input type="checkbox" checked={selectedTxIds.has(tx.id)}
                                    onChange={() => toggleSelectTx(tx.id)}
                                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[#4C00C2] focus:ring-[#4C00C2]/30" />
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-left">
                                <div className="font-bold text-gray-900">{tx.user_username}</div>
                                <div className="text-xs text-gray-500">{tx.user_email}</div>
                              </td>
                              <td className="px-5 py-3.5 text-left">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex h-2 w-2 rounded-full ${tx.type === "deposit" ? "bg-emerald-500" : "bg-red-500"}`} />
                                  <span className="text-xs font-bold capitalize text-gray-700">{tx.type}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-left">
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-flex h-2 w-2 rounded-full ${
                                    tx.status === "completed" ? "bg-emerald-500" :
                                    tx.status === "pending" ? "bg-amber-500" :
                                    tx.status === "hold" ? "bg-blue-500" :
                                    tx.status === "failed" ? "bg-red-500" : "bg-gray-500"
                                  }`} />
                                  <span className={`text-xs font-bold capitalize ${
                                    tx.status === "completed" ? "text-emerald-600" :
                                    tx.status === "pending" ? "text-amber-600" :
                                    tx.status === "hold" ? "text-blue-600" :
                                    tx.status === "failed" ? "text-red-600" : "text-gray-600"
                                  }`}>{tx.status}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono text-sm font-black">
                                <span className={tx.type === "withdrawal" ? "text-red-600" : "text-emerald-600"}>
                                  {tx.type === "withdrawal" ? "−" : "+"}${parseFloat(tx.amount).toFixed(2)}
                                </span>
                              </td>
                              <td className="max-w-[200px] truncate px-5 py-3.5 text-left text-gray-500">{tx.description || "—"}</td>
                              <td className="px-5 py-3.5 text-right text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</td>
                              <td className="px-5 py-3.5 text-right">
                                {tx.type === "withdrawal" && tx.status === "pending" && (
                                  <div className="flex justify-end gap-1.5">
                                    <button onClick={() => approveTx(tx.id)} disabled={processingIds.has(tx.id)}
                                      className="rounded-full border-b-[3px] border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-emerald-100 disabled:opacity-50">
                                      {processingIds.has(tx.id) ? "…" : "Approve"}</button>
                                    <button onClick={() => cancelTx(tx.id)} disabled={processingIds.has(tx.id)}
                                      className="rounded-full border-b-[3px] border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-red-100 disabled:opacity-50">
                                      Cancel</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── KYC ────────────────────────────── */}
                {tab === "kyc" && (
                  <div>
                    <div className="mb-5">
                      <span className="inline-flex items-center rounded-full border-b-[3px] border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-600">
                        {kycList.length} pending verification{kycList.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#4C00C2]/5 text-xs uppercase tracking-wider text-[#4C00C2]">
                            <th className="px-5 py-3.5 text-left font-bold">User</th>
                            <th className="px-5 py-3.5 text-left font-bold">Email</th>
                            <th className="px-5 py-3.5 text-left font-bold">Full Name</th>
                            <th className="px-5 py-3.5 text-center font-bold">Document</th>
                            <th className="px-5 py-3.5 text-center font-bold">Nationality</th>
                            <th className="px-5 py-3.5 text-right font-bold">Submitted</th>
                            <th className="px-5 py-3.5 text-right font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kycList.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-sm text-gray-400">No pending verifications</td>
                            </tr>
                          ) : (
                            kycList.map((k) => (
                              <tr key={k.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                                <td className="px-5 py-3.5 text-left font-bold text-gray-900">{k.user_username}</td>
                                <td className="px-5 py-3.5 text-left text-gray-500">{k.user_email}</td>
                                <td className="px-5 py-3.5 text-left text-gray-700">{k.full_name || "—"}</td>
                                <td className="px-5 py-3.5 text-center capitalize text-gray-600">{k.document_type?.replace("_", " ") || "—"}</td>
                                <td className="px-5 py-3.5 text-center text-gray-600">{k.nationality || "—"}</td>
                                <td className="px-5 py-3.5 text-right text-xs text-gray-500">
                                  {k.submitted_at ? new Date(k.submitted_at).toLocaleDateString() : "—"}
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <button onClick={async () => { await apiClient.post(`/kyc/admin/${k.id}/approve`); fetchData(); }}
                                      className="rounded-full border-b-[3px] border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-emerald-100">Approve</button>
                                    <button onClick={async () => { const reason = prompt("Rejection reason:"); if (reason) { await apiClient.post(`/kyc/admin/${k.id}/reject?reason=${encodeURIComponent(reason)}`); fetchData(); } }}
                                      className="rounded-full border-b-[3px] border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-red-100">Reject</button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Games ───────────────────────────── */}
                {tab === "games" && (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {gameStats.map((g) => {
                      const rtp = parseFloat(g.rtp);
                      return (
                        <div key={g.game_type} className="rounded-[24px] border-b-[4px] border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all hover:shadow-md" style={{ borderBottomColor: rtp > 100 ? "#F87171" : rtp > 95 ? "#34D399" : "#FBBF24" }}>
                          <h3 className="font-display text-xl font-black capitalize text-gray-900">{g.game_type}</h3>
                          <div className="mt-4 space-y-2.5 text-sm">
                            <div className="flex justify-between">
                              <span className="font-bold text-gray-500">Rounds</span>
                              <span className="font-bold text-gray-900">{g.total_rounds}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-bold text-gray-500">Total Bet</span>
                              <span className="font-mono font-bold text-emerald-600">{formatCurrency(g.total_bet)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-bold text-gray-500">Total Paid</span>
                              <span className="font-mono font-bold text-red-600">{formatCurrency(g.total_payout)}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-100 pt-2.5">
                              <span className="font-bold text-gray-500">RTP</span>
                              <span className={`font-mono font-black ${
                                rtp > 100 ? "text-red-600" : rtp > 95 ? "text-emerald-600" : "text-amber-600"
                              }`}>{g.rtp}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Settings ──────────────────────────── */}
                {tab === "settings" && <SettingsPanel />}

                {/* ── Bonuses ───────────────────────────── */}
                {tab === "bonuses" && <BonusesPanel />}

                {/* ── Game Control ───────────────────────── */}
                {tab === "gamecontrol" && <GameControlPanel />}

                {/* ── Platform Settings ───────────────────── */}
                {tab === "platform" && <PlatformSettingsPanel />}

                {/* ── Audit Log ───────────────────────── */}
                {tab === "audit" && <AuditLogPanel />}

                {/* ── Admin Roles ──────────────────────── */}
                {tab === "roles" && <AdminRolesPanel />}
                {tab === "notify" && <AdminNotifyPanel />}
                {tab === "fairness" && <FairnessPanel />}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
