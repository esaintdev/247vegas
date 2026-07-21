import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useAuthStore } from "@/store/authStore";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register";
}

export default function AuthModal({ open, onClose, defaultMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    setMode(defaultMode);
    setError("");
  }, [defaultMode, open]);

  const reset = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const { data } = await apiClient.post("/auth/login", { email, password });
      const { data: userData } = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      setAuth(userData, data.access_token, data.refresh_token);
      reset();
      onClose();
      navigate("/dashboard");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = err?.message;
      if (detail) {
        setError(typeof detail === "string" ? detail : JSON.stringify(detail));
      } else if (message) {
        setError(`Network error: ${message}`);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await apiClient.post("/auth/register", {
        email,
        username,
        password,
      });
      const { data: userData } = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      setAuth(userData, data.access_token, data.refresh_token);
      reset();
      onClose();
      navigate("/dashboard");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = err?.message;
      if (detail) {
        setError(typeof detail === "string" ? detail : JSON.stringify(detail));
      } else if (message) {
        setError(`Network error: ${message}`);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl sm:p-10"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all hover:bg-gray-200"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#4C00C2] text-2xl text-white">
                {mode === "login" ? "♠" : "🃏"}
              </div>
              <h1 className="font-display text-3xl font-bold text-gray-900">
                {mode === "login" ? (
                  <>Welcome <span className="text-[#4C00C2]">Back</span></>
                ) : (
                  <>Create <span className="text-[#4C00C2]">Account</span></>
                )}
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {mode === "login"
                  ? "Sign in to your account to continue"
                  : "Join the action and start playing"}
              </p>
            </div>

            {error && (
              <motion.div
                className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                  placeholder="you@example.com"
                  required
                />
              </div>

              {mode === "register" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                    placeholder="Choose a username"
                    minLength={3}
                    required
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                  placeholder={mode === "login" ? "Enter your password" : "Create a strong password"}
                  minLength={8}
                  required
                />
              </div>

              {mode === "register" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                    placeholder="Repeat your password"
                    minLength={8}
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-9 py-4 text-base font-bold text-white transition-all duration-75 hover:bg-[#3d009e] active:translate-y-[4px] active:border-b-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading
                  ? mode === "login" ? "Signing in..." : "Creating account..."
                  : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              {mode === "login" ? (
                <>Don't have an account?{" "}
                  <button onClick={switchMode} className="font-medium text-[#4C00C2] hover:text-[#3d009e]">
                    Sign up
                  </button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button onClick={switchMode} className="font-medium text-[#4C00C2] hover:text-[#3d009e]">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
