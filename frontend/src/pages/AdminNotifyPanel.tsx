import { useState } from "react";
import apiClient from "@/api/client";

export function AdminNotifyPanel() {
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifType, setNotifType] = useState("system");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const sendNotification = async () => {
    if (!title || !message) return;
    setSending(true);
    setMsg(null);
    try {
      const { data } = await apiClient.post("/admin/notifications/send", {
        user_id: isBroadcast ? "ALL" : userId,
        title,
        message,
        type: notifType,
      });
      setMsg({ type: "success", text: data.message || `Sent to ${data.sent_count} user(s)` });
      setTitle("");
      setMessage("");
      setUserId("");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to send notification";
      setMsg({ type: "error", text: detail });
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`mb-4 rounded-2xl border-b-[4px] px-4 py-3 text-sm font-medium ${
          msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
        }`}>{msg.text}</div>
      )}

      <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <h3 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Send Notification</h3>
        
        <div className="space-y-4">
          {/* Target */}
          <div>
            <label className="mb-2 flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={isBroadcast} onChange={(e) => setIsBroadcast(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#4C00C2] focus:ring-[#4C00C2]/30" />
              <span className="text-sm font-bold text-gray-600">Broadcast to all users</span>
            </label>
            {!isBroadcast && (
              <input value={userId} onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter User ID..."
                className="mt-2 w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
            )}
          </div>

          {/* Type */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">Type</label>
            <div className="flex gap-2">
              {[
                { value: "system", label: "🔔 System" },
                { value: "promo", label: "🎁 Promo" },
                { value: "warning", label: "⚠️ Warning" },
                { value: "announcement", label: "📢 Announcement" },
              ].map((t) => (
                <button key={t.value} onClick={() => setNotifType(t.value)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-all duration-75 active:translate-y-[2px] ${
                    notifType === t.value ? "border-b-[3px] border-[#3d009e] bg-[#4C00C2] text-white" : "border-b-[3px] border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                  }`}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title..."
              className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
          </div>

          {/* Message */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">Message *</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              placeholder="Notification message..."
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20" />
          </div>

          <button onClick={sendNotification} disabled={sending || !title || !message || (!isBroadcast && !userId)}
            className="rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0 disabled:opacity-50">
            {sending ? "Sending..." : isBroadcast ? "🚀 Broadcast to All Users" : "📨 Send Notification"}
          </button>
        </div>
      </div>
    </div>
  );
}
