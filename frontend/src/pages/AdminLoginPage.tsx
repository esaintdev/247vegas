import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import apiClient from "@/api/client";
import { useAuthStore } from "@/store/authStore";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("admin@casino.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data } = await apiClient.post("/auth/login", { email, password });
      const { data: userData } = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });

      if (!userData.is_admin) {
        setError("This account does not have admin access.");
        return;
      }

      setAuth(userData, data.access_token, data.refresh_token);
      navigate("/admin", { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || "Login failed");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="rounded-[24px] border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] border-b-[4px] border-[#3d009e] bg-[#4C00C2] text-2xl text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="inline-block rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-5 py-1.5 text-xs font-bold text-white shadow-sm uppercase tracking-wider">
              Admin Portal
            </div>
            <p className="mt-3 text-sm text-gray-500">Sign in to manage the platform</p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border-b-[4px] border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-gray-300 bg-white px-5 py-3.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                placeholder="admin@247vegas.com"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-full border border-gray-300 bg-white px-5 py-3.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                placeholder="Enter admin password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-9 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-75 hover:bg-[#3d009e] active:translate-y-[4px] active:border-b-0 disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/login")}
              className="text-xs font-medium text-gray-500 transition-colors hover:text-[#4C00C2]"
            >
              ← Back to player login
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Admin access only. Unauthorized access is prohibited.
        </p>
      </motion.div>
    </div>
  );
}
