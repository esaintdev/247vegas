import { useState, useEffect } from "react";
import apiClient from "@/api/client";

interface Bonus {
  id: string; name: string; description: string | null;
  bonus_type: string; status: string;
  match_percent: string | null; max_bonus_amount: string | null;
  flat_amount: string | null; free_spins_count: number | null;
  wagering_multiplier: string | null; max_bet_with_bonus: string | null;
  starts_at: string | null; expires_at: string | null;
  min_deposit_amount: string | null; eligible_games: string | null;
  is_repeatable: boolean; max_claims_per_user: number | null;
  created_at: string; total_claims: number;
}

type BonusForm = {
  name: string; description: string; bonus_type: string;
  match_percent: string; max_bonus_amount: string;
  flat_amount: string; free_spins_count: string;
  wagering_multiplier: string; max_bet_with_bonus: string;
  starts_at: string; expires_at: string;
  min_deposit_amount: string; eligible_games: string;
  is_repeatable: boolean; max_claims_per_user: string;
};

const emptyForm: BonusForm = {
  name: "", description: "", bonus_type: "deposit_match",
  match_percent: "", max_bonus_amount: "",
  flat_amount: "", free_spins_count: "",
  wagering_multiplier: "1.00", max_bet_with_bonus: "",
  starts_at: "", expires_at: "",
  min_deposit_amount: "", eligible_games: "",
  is_repeatable: false, max_claims_per_user: "",
};

export function BonusesPanel() {
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BonusForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [issueData, setIssueData] = useState<{ bonusId: string; userId: string; amount: string } | null>(null);

  const fetchBonuses = () => {
    apiClient.get<Bonus[]>("/admin/bonuses")
      .then((res) => setBonuses(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBonuses(); }, []);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };

  const editBonus = (b: Bonus) => {
    setForm({
      name: b.name, description: b.description || "",
      bonus_type: b.bonus_type,
      match_percent: b.match_percent || "",
      max_bonus_amount: b.max_bonus_amount || "",
      flat_amount: b.flat_amount || "",
      free_spins_count: b.free_spins_count?.toString() || "",
      wagering_multiplier: b.wagering_multiplier || "1.00",
      max_bet_with_bonus: b.max_bet_with_bonus || "",
      starts_at: b.starts_at ? b.starts_at.slice(0, 16) : "",
      expires_at: b.expires_at ? b.expires_at.slice(0, 16) : "",
      min_deposit_amount: b.min_deposit_amount || "",
      eligible_games: b.eligible_games || "",
      is_repeatable: b.is_repeatable,
      max_claims_per_user: b.max_claims_per_user?.toString() || "",
    });
    setEditingId(b.id);
    setShowForm(true);
  };

  const saveBonus = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        bonus_type: form.bonus_type,
        wagering_multiplier: form.wagering_multiplier || "1.00",
        is_repeatable: form.is_repeatable,
      };
      if (form.description !== "") payload.description = form.description;
      if (form.match_percent !== "") payload.match_percent = form.match_percent;
      if (form.max_bonus_amount !== "") payload.max_bonus_amount = form.max_bonus_amount;
      if (form.flat_amount !== "") payload.flat_amount = form.flat_amount;
      if (form.free_spins_count !== "") payload.free_spins_count = parseInt(form.free_spins_count);
      if (form.max_bet_with_bonus !== "") payload.max_bet_with_bonus = form.max_bet_with_bonus;
      if (form.min_deposit_amount !== "") payload.min_deposit_amount = form.min_deposit_amount;
      if (form.eligible_games !== "") payload.eligible_games = form.eligible_games;
      if (form.max_claims_per_user !== "") payload.max_claims_per_user = parseInt(form.max_claims_per_user);
      if (form.starts_at !== "") payload.starts_at = form.starts_at;
      if (form.expires_at !== "") payload.expires_at = form.expires_at;

      if (editingId) {
        await apiClient.put(`/admin/bonuses/${editingId}`, payload);
        setMsg({ type: "success", text: `"${form.name}" updated` });
      } else {
        await apiClient.post("/admin/bonuses", payload);
        setMsg({ type: "success", text: `"${form.name}" created` });
      }
      resetForm();
      fetchBonuses();
    } catch { setMsg({ type: "error", text: "Failed to save bonus" }); }
    setSaving(false);
  };

  const toggleStatus = async (b: Bonus) => {
    if (b.status === "expired") { setMsg({ type: "error", text: "Expired bonuses cannot be activated. Create a new bonus instead." }); return; }
    const newStatus = b.status === "active" ? "disabled" : "active";
    try {
      await apiClient.put(`/admin/bonuses/${b.id}`, { status: newStatus });
      fetchBonuses();
      setMsg({ type: "success", text: `"${b.name}" is now ${newStatus}` });
    } catch { setMsg({ type: "error", text: "Failed to update status" }); }
  };

  const issueBonus = async () => {
    if (!issueData) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = { bonus_id: issueData.bonusId, user_id: issueData.userId };
      if (issueData.amount) payload.amount = issueData.amount;
      const { data } = await apiClient.post("/admin/bonuses/issue", payload);
      setMsg({ type: "success", text: `$${data.awarded_amount} bonus issued to ${data.user_id.slice(0, 8)}` });
      setIssueData(null);
      fetchBonuses();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to issue bonus";
      setMsg({ type: "error", text: detail });
    }
    setSaving(false);
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "border-b-[2px] border-emerald-200 bg-emerald-50 text-emerald-600",
      draft: "border-b-[2px] border-gray-200 bg-gray-50 text-gray-500",
      expired: "border-b-[2px] border-red-200 bg-red-50 text-red-600",
      disabled: "border-b-[2px] border-amber-200 bg-amber-50 text-amber-600",
    };
    return colors[status] || colors.draft;
  };

  const typeLabel = (t: string) => ({
    deposit_match: "Deposit Match",
    free_spins: "Free Spins",
    no_deposit: "No Deposit",
    cashback: "Cashback",
    manual: "Manual",
  }[t] || t);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-7 w-7 animate-spin rounded-full border-2 border-[#4C00C2] border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`mb-4 rounded-2xl border-b-[4px] px-4 py-3 text-sm font-medium ${
          msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
        }`}>{msg.text}</div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-wide text-gray-700 uppercase">{editingId ? "Edit Bonus" : "New Bonus"}</h3>
            <button onClick={resetForm} className="rounded-full border-b-[3px] border-gray-200 px-4 py-1.5 text-xs font-bold text-gray-500 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-gray-100">Cancel</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-bold text-gray-600">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-bold text-gray-600">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Type</label>
              <select value={form.bonus_type} onChange={(e) => setForm({ ...form, bonus_type: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20">
                <option value="deposit_match">Deposit Match</option>
                <option value="free_spins">Free Spins</option>
                <option value="no_deposit">No Deposit</option>
                <option value="cashback">Cashback</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Match %</label>
              <input type="number" step="0.01" value={form.match_percent} onChange={(e) => setForm({ ...form, match_percent: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Max Bonus $</label>
              <input type="number" step="0.01" value={form.max_bonus_amount} onChange={(e) => setForm({ ...form, max_bonus_amount: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Flat Amount $</label>
              <input type="number" step="0.01" value={form.flat_amount} onChange={(e) => setForm({ ...form, flat_amount: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Free Spins</label>
              <input type="number" value={form.free_spins_count} onChange={(e) => setForm({ ...form, free_spins_count: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Wagering Multiplier</label>
              <input type="number" step="0.01" min="0" value={form.wagering_multiplier} onChange={(e) => setForm({ ...form, wagering_multiplier: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Max Bet w/ Bonus $</label>
              <input type="number" step="0.01" value={form.max_bet_with_bonus} onChange={(e) => setForm({ ...form, max_bet_with_bonus: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Min Deposit $</label>
              <input type="number" step="0.01" value={form.min_deposit_amount} onChange={(e) => setForm({ ...form, min_deposit_amount: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Max Claims/User</label>
              <input type="number" value={form.max_claims_per_user} onChange={(e) => setForm({ ...form, max_claims_per_user: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Eligible Games (JSON)</label>
              <input value={form.eligible_games} onChange={(e) => setForm({ ...form, eligible_games: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Starts At</label>
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-600">Expires At</label>
              <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600">
                <input type="checkbox" checked={form.is_repeatable} onChange={(e) => setForm({ ...form, is_repeatable: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-[#4C00C2] focus:ring-[#4C00C2]/30" />
                Repeatable
              </label>
            </div>
          </div>
          <button onClick={saveBonus} disabled={saving || !form.name}
            className="mt-4 rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0 disabled:opacity-50">
            {saving ? "Saving..." : editingId ? "Update Bonus" : "Create Bonus"}
          </button>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex gap-3">
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0">
          + New Bonus
        </button>
      </div>

      {/* Bonuses list */}
      {bonuses.length === 0 ? (
        <div className="py-12 text-center text-sm font-bold text-gray-400">No bonuses created yet</div>
      ) : (
        <div className="grid gap-4">
          {bonuses.map((b) => (
            <div key={b.id} className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-base font-bold text-gray-900">{b.name}</h3>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadge(b.status)}`}>{b.status}</span>
                    <span className="inline-flex items-center rounded-full border-b-[2px] border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-bold text-gray-600">{typeLabel(b.bonus_type)}</span>
                  </div>
                  {b.description && <p className="mt-1 text-sm text-gray-500">{b.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                    {b.match_percent && <span>Match: <span className="font-bold text-gray-700">{b.match_percent}%</span></span>}
                    {b.max_bonus_amount && <span>Max: <span className="font-bold text-gray-700">${parseFloat(b.max_bonus_amount).toFixed(2)}</span></span>}
                    {b.flat_amount && <span>Amount: <span className="font-bold text-gray-700">${parseFloat(b.flat_amount).toFixed(2)}</span></span>}
                    {b.free_spins_count && <span>Spins: <span className="font-bold text-gray-700">{b.free_spins_count}x</span></span>}
                    <span>Wager: <span className="font-bold text-gray-700">{b.wagering_multiplier}x</span></span>
                    {b.expires_at && <span>Expires: <span className="font-bold text-gray-700">{new Date(b.expires_at).toLocaleDateString()}</span></span>}
                    <span>Claims: <span className="font-bold text-gray-700">{b.total_claims}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => editBonus(b)}
                    className="rounded-full border-b-[3px] border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-gray-100">Edit</button>
                  <button onClick={() => toggleStatus(b)}
                    className={`rounded-full border-b-[3px] px-3 py-1.5 text-xs font-bold transition-all duration-75 active:translate-y-[3px] active:border-b-0 ${
                      b.status === "active" ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    }`}>{b.status === "active" ? "Disable" : "Activate"}</button>
                  <button onClick={() => setIssueData({ bonusId: b.id, userId: "", amount: "" })}
                    className="rounded-full border-b-[3px] border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 transition-all duration-75 active:translate-y-[3px] active:border-b-0 hover:bg-blue-100">Issue</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Issue modal */}
      {issueData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setIssueData(null)}>
          <div className="w-full max-w-md rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Issue Bonus</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-600">User ID *</label>
                <input value={issueData.userId} onChange={(e) => setIssueData({ ...issueData, userId: e.target.value })}
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-600">Amount Override (optional)</label>
                <input type="number" step="0.01" value={issueData.amount} onChange={(e) => setIssueData({ ...issueData, amount: e.target.value })}
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={issueBonus} disabled={saving || !issueData.userId}
                  className="flex-1 rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0 disabled:opacity-50">
                  {saving ? "Issuing..." : "Issue Bonus"}
                </button>
                <button onClick={() => setIssueData(null)}
                  className="rounded-full border-b-[3px] border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-500 transition-all duration-75 active:translate-y-[3px] active:border-b-0">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
