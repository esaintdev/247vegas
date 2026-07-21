import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useNotificationStore } from "@/store/notificationStore";

const TYPE_ICONS: Record<string, string> = {
  deposit: "💰",
  withdrawal: "💸",
  kyc: "🪪",
  game_win: "🎉",
  system: "🔔",
};

export default function NotificationsPage() {
  const {
    notifications,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    fetchUnreadCount,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Notifications</h1>
            <p className="mt-1 text-gray-400">
              Stay updated on deposits, withdrawals, wins, and more
            </p>
          </div>
          <button
            onClick={markAllAsRead}
            className="btn-ghost text-sm"
          >
            Mark all read
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-casino-gold border-t-transparent" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && notifications.length === 0 && (
          <motion.div
            className="mt-12 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="text-6xl">🔔</span>
            <h2 className="mt-4 font-display text-xl font-bold">All Clear</h2>
            <p className="mt-2 text-gray-400">
              No notifications yet. You'll see updates here when you make deposits,
              win games, or complete KYC verification.
            </p>
            <Link to="/games" className="btn-primary mt-6 inline-block">
              Start Playing
            </Link>
          </motion.div>
        )}

        {/* Notification List */}
        {!isLoading && notifications.length > 0 && (
          <div className="mt-6 space-y-2">
            {notifications.map((n, index) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`card flex items-start gap-4 transition-all ${
                  !n.is_read ? "border-l-2 border-l-casino-gold" : ""
                }`}
              >
                <span className="mt-1 text-xl">
                  {TYPE_ICONS[n.type] || "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className={`font-medium ${!n.is_read ? "text-white" : "text-gray-300"}`}>
                        {n.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">{n.message}</p>
                    </div>
                    {!n.is_read && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="shrink-0 rounded px-2 py-1 text-[10px] font-medium text-casino-gold transition-colors hover:bg-casino-gold/10"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-[11px] text-gray-600">
                      {new Date(n.created_at).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {n.link && (
                      <Link
                        to={n.link}
                        className="text-[11px] font-medium text-casino-gold transition-colors hover:text-yellow-400"
                      >
                        View details →
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
