import { useState, useEffect } from "react";
import apiClient from "@/api/client";

interface Settings {
  maintenance_mode: boolean; maintenance_message: string | null;
  announcement_enabled: boolean; announcement_text: string | null; announcement_type: string;
  min_withdrawal: string; max_withdrawal: string; daily_withdrawal_limit: string;
  deposit_fee_percent: string; withdrawal_fee_percent: string; withdrawal_fee_fixed: string;
  supported_currencies: string; default_currency: string;
}

interface LiveSession {
  id: string; user_id: string; username: string;
  game_type: string; status: string; bet_amount: string;
  created_at: string; elapsed_seconds: number;
}

// ── Settings Panel ────────────────────────────────────────────

export function PlatformSettingsPanel() {
  const [, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState<Settings | null>(null);

  useEffect(() => {
    apiClient.get<Settings>("/admin/settings")
      .then((res) => { setSettings(res.data); setForm(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true); setMsg(null);
    try {
      const { data } = await apiClient.put<Settings>("/admin/settings", form);
      setSettings(data); setForm(data);
      setMsg({ type: "success", text: "Settings saved" });
    } catch { setMsg({ type: "error", text: "Failed to save settings" }); }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-24"><div className="h-7 w-7 animate-spin rounded-full border-2 border-[#4C00C2] border-t-transparent" /></div>;
  if (!form) return <div className="py-12 text-center text-sm font-bold text-gray-400">Failed to load settings</div>;

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`mb-4 rounded-2xl border-b-[4px] px-4 py-3 text-sm font-medium ${
          msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
        }`}>{msg.text}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Maintenance */}
        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Maintenance Mode</h3>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={form.maintenance_mode}
                onChange={(e) => setForm({ ...form, maintenance_mode: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-[#4C00C2] focus:ring-[#4C00C2]/30" />
              <span className="text-sm font-bold text-gray-600">Enable maintenance mode</span>
            </label>
            {form.maintenance_mode && (
              <textarea value={form.maintenance_message || ""} onChange={(e) => setForm({ ...form, maintenance_message: e.target.value })} rows={2}
                placeholder="Maintenance message shown to users..."
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            )}
          </div>
        </div>

        {/* Announcement */}
        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Site Announcement</h3>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={form.announcement_enabled}
                onChange={(e) => setForm({ ...form, announcement_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-[#4C00C2] focus:ring-[#4C00C2]/30" />
              <span className="text-sm font-bold text-gray-600">Show announcement banner</span>
            </label>
            {form.announcement_enabled && (
              <>
                <div className="flex gap-2">
                  {["info", "warning", "success", "danger"].map((t) => (
                    <button key={t} onClick={() => setForm({ ...form, announcement_type: t })}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-all duration-75 active:translate-y-[2px] ${
                        form.announcement_type === t ? "border-b-[3px] border-[#3d009e] bg-[#4C00C2] text-white" : "border-b-[3px] border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                      }`}>{t}</button>
                  ))}
                </div>
                <textarea value={form.announcement_text || ""} onChange={(e) => setForm({ ...form, announcement_text: e.target.value })} rows={2}
                  placeholder="Announcement text..."
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
              </>
            )}
          </div>
        </div>

        {/* Withdrawal Limits */}
        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Withdrawal Limits</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "min_withdrawal", label: "Min ($)" },
              { key: "max_withdrawal", label: "Max ($)" },
              { key: "daily_withdrawal_limit", label: "Daily Limit ($)" },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-bold text-gray-600">{f.label}</label>
                <input type="number" step="0.01" min="0" value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
              </div>
            ))}
          </div>
        </div>

        {/* Fees */}
        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Platform Fees</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "deposit_fee_percent", label: "Deposit Fee %" },
              { key: "withdrawal_fee_percent", label: "Withdrawal Fee %" },
              { key: "withdrawal_fee_fixed", label: "Fixed Fee ($)" },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-bold text-gray-600">{f.label}</label>
                <input type="number" step="0.01" min="0" value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
              </div>
            ))}
          </div>
        </div>

        {/* Currency */}
        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Currency Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Default Currency</label>
              <input value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value.toUpperCase() })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Supported Currencies (comma-separated)</label>
              <input value={form.supported_currencies} onChange={(e) => setForm({ ...form, supported_currencies: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0 disabled:opacity-50">
        {saving ? "Saving..." : "Save All Settings"}
      </button>
    </div>
  );
}

// ── Game Control Panel ─────────────────────────────────────────

export function GameControlPanel() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [killRoundId, setKillRoundId] = useState("");
  const [killing, setKilling] = useState(false);

  const fetchSessions = () => {
    apiClient.get<LiveSession[]>("/admin/live-sessions")
      .then((res) => setSessions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSessions(); }, []);

  const killRound = async (roundId?: string) => {
    const id = roundId || killRoundId;
    if (!id) return;
    setKilling(true); setMsg(null);
    try {
      const { data } = await apiClient.post("/admin/kill-round", { round_id: id });
      setMsg({ type: "success", text: data.message || "Round killed" });
      setKillRoundId("");
      fetchSessions();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to kill round";
      setMsg({ type: "error", text: detail });
    }
    setKilling(false);
  };

  if (loading) return <div className="flex items-center justify-center py-24"><div className="h-7 w-7 animate-spin rounded-full border-2 border-[#4C00C2] border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`mb-4 rounded-2xl border-b-[4px] px-4 py-3 text-sm font-medium ${
          msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
        }`}>{msg.text}</div>
      )}

      {/* Kill Round */}
      <div className="rounded-[24px] border border-red-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold tracking-wide text-red-600 uppercase">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          Kill Stuck Game Round
        </h3>
        <div className="flex gap-3">
          <input value={killRoundId} onChange={(e) => setKillRoundId(e.target.value)}
            placeholder="Enter round ID to force-cancel..."
            className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-red-400/50 focus:ring-2 focus:ring-red-400/20" />
          <button onClick={() => killRound()} disabled={killing || !killRoundId}
            className="rounded-full border-b-[4px] border-red-300 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-600 shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0 disabled:opacity-50">
            {killing ? "Killing..." : "Kill Round"}
          </button>
        </div>
      </div>

      {/* Live Sessions */}
      <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-bold tracking-wide text-gray-700 uppercase">
            Live Game Sessions ({sessions.length})
          </h3>
          <button onClick={fetchSessions}
            className="rounded-full border-b-[3px] border-gray-200 bg-gray-50 px-4 py-1.5 text-xs font-bold text-gray-500 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-gray-100">Refresh</button>
        </div>
        {sessions.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-gray-400">No active game sessions</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#4C00C2]/5 text-xs uppercase tracking-wider text-[#4C00C2]">
                <th className="px-5 py-3.5 text-left font-bold">Player</th>
                <th className="px-5 py-3.5 text-left font-bold">Game</th>
                <th className="px-5 py-3.5 text-left font-bold">Status</th>
                <th className="px-5 py-3.5 text-right font-bold">Bet</th>
                <th className="px-5 py-3.5 text-right font-bold">Duration</th>
                <th className="px-5 py-3.5 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                  <td className="px-5 py-3.5 text-left font-bold text-gray-900">{s.username}</td>
                  <td className="px-5 py-3.5 text-left capitalize text-gray-500">{s.game_type}</td>
                  <td className="px-5 py-3.5 text-left">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      s.status === "playing" ? "border-b-[2px] border-emerald-200 bg-emerald-50 text-emerald-600" : "border-b-[2px] border-amber-200 bg-amber-50 text-amber-600"
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-gray-600">${parseFloat(s.bet_amount).toFixed(2)}</td>
                  <td className="px-5 py-3.5 text-right text-gray-500">{s.elapsed_seconds}s</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => killRound(s.id)}
                      className="rounded-full border-b-[3px] border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-red-100">Kill</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
