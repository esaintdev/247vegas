import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { Link } from "react-router-dom";

export default function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        className="mx-auto max-w-4xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your account settings</p>
        </div>

        {/* Profile Card */}
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-6 pb-6 pt-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-3xl font-bold text-white shadow-lg">
                  {user?.username?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${
                  user?.is_verified ? "bg-emerald-500" : "bg-gray-300"
                }`}>
                  {user?.is_verified && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </div>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-xl font-bold text-gray-900">
                  {user?.display_name || user?.username}
                </h2>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                    user?.is_verified
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}>
                    <span className={`inline-flex h-1.5 w-1.5 rounded-full ${
                      user?.is_verified ? "bg-emerald-500" : "bg-red-500"
                    }`} />
                    {user?.is_verified ? "Verified" : "Unverified"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Member
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Account Details */}
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-700 uppercase">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Account Details
            </h3>
            <dl className="space-y-2">
              {[
                { label: "Username", value: user?.username },
                { label: "Email", value: user?.email },
                { label: "Display Name", value: user?.display_name },
                { label: "Joined", value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
                  <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase">{row.label}</dt>
                  <dd className="text-sm font-medium text-gray-900">{row.value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Identity Verification */}
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-700 uppercase">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
              Identity Verification
            </h3>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">KYC Status</span>
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                  user?.is_verified
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  <span className={`inline-flex h-1.5 w-1.5 rounded-full ${
                    user?.is_verified ? "bg-emerald-500" : "bg-amber-500"
                  }`} />
                  {user?.is_verified ? "Verified" : "Not Verified"}
                </span>
              </div>
            </div>
            {!user?.is_verified && (
              <Link
                to="/kyc"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4C00C2] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#3d009e]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Complete KYC Verification
              </Link>
            )}
          </div>

          {/* Responsible Gaming */}
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm md:col-span-2">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-700 uppercase">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Responsible Gaming
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              We're committed to providing a safe and responsible gaming environment. Use the tools below to manage your play.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <button className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Set Deposit Limit
              </button>
              <button className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Set Time Limit
              </button>
              <button className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 shadow-sm transition-all hover:bg-red-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                Self-Exclusion
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
