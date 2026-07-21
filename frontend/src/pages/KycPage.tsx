import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useAuthStore } from "@/store/authStore";

type KycStatus = "unverified" | "pending" | "verified" | "rejected";

interface KycData {
  id: string;
  status: KycStatus;
  document_type?: string;
  full_name?: string;
  rejection_reason?: string;
  submitted_at?: string;
  reviewed_at?: string;
}

const DOCUMENT_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's License" },
];

export default function KycPage() {
  const { user } = useAuthStore();
  const [kyc, setKyc] = useState<KycData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form fields
  const [documentType, setDocumentType] = useState("passport");
  const [documentNumber, setDocumentNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");

  // File uploads
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const { data } = await apiClient.get("/kyc/status");
      setKyc(data);
      if (data.full_name) setFullName(data.full_name);
      if (data.document_type) setDocumentType(data.document_type);
    } catch {
      setKyc({ id: "", status: "unverified" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const { data } = await apiClient.post("/kyc/submit", {
        document_type: documentType,
        document_number: documentNumber,
        full_name: fullName,
        date_of_birth: dateOfBirth,
        nationality,
        address,
      });
      setKyc(data);
      setMessage({ type: "success", text: "Documents submitted for verification!" });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Submission failed. Try again.";
      setMessage({ type: "error", text: detail });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (field: string, file: File | null) => {
    if (!file) return;
    setUploading(field);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiClient.post(`/kyc/upload/${field}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage({ type: "success", text: `${field} uploaded successfully!` });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Upload failed.";
      setMessage({ type: "error", text: detail });
    } finally {
      setUploading(null);
    }
  };

  // ── Status Display ──

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-casino-gold border-t-transparent" />
      </div>
    );
  }

  const status = kyc?.status || "unverified";

  const statusConfig: Record<KycStatus, { color: string; bg: string; label: string; icon: string }> = {
    unverified: {
      color: "text-gray-400", bg: "bg-gray-500/10", label: "Not Started", icon: "📋",
    },
    pending: {
      color: "text-amber-400", bg: "bg-amber-500/10", label: "Under Review", icon: "⏳",
    },
    verified: {
      color: "text-green-400", bg: "bg-green-500/10", label: "Verified", icon: "✅",
    },
    rejected: {
      color: "text-red-400", bg: "bg-red-500/10", label: "Rejected", icon: "❌",
    },
  };

  const cfg = statusConfig[status];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Identity Verification</h1>
            <p className="mt-1 text-gray-400">
              Complete KYC to unlock full platform access
            </p>
          </div>
          <div className={`flex items-center gap-2 rounded-lg ${cfg.bg} px-4 py-2`}>
            <span className="text-lg">{cfg.icon}</span>
            <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>

        <AnimatePresence>
          {message && (
            <motion.div
              className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                message.type === "success"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-red-500/10 text-red-400"
              }`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rejection Reason */}
        {status === "rejected" && kyc?.rejection_reason && (
          <motion.div
            className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-medium text-red-400">Reason for rejection:</p>
            <p className="mt-1 text-sm text-gray-300">{kyc.rejection_reason}</p>
          </motion.div>
        )}

        {/* Verified Banner */}
        {status === "verified" && (
          <motion.div
            className="mt-6 rounded-lg border border-green-500/20 bg-green-500/5 p-8 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="text-5xl">🎉</span>
            <h2 className="mt-4 font-display text-2xl font-bold text-green-400">Verified!</h2>
            <p className="mt-2 text-gray-400">
              Your identity has been verified. You have full access to all platform features.
            </p>
          </motion.div>
        )}

        {/* KYC Form (only show if not verified and not pending) */}
        {status !== "verified" && status !== "pending" && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {/* Personal Information */}
            <div className="card">
              <h2 className="mb-6 font-display text-xl font-bold">Personal Information</h2>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Full Name (as on ID)
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-field w-full"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="input-field w-full"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="input-field w-full"
                    placeholder="e.g. United States"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    className="input-field w-full cursor-not-allowed opacity-60"
                    disabled
                  />
                </div>
              </div>
              <div className="mt-6">
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Residential Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input-field w-full"
                  rows={3}
                  placeholder="Street, City, State/Province, Postal Code"
                  required
                />
              </div>
            </div>

            {/* Identity Document */}
            <div className="card">
              <h2 className="mb-6 font-display text-xl font-bold">Identity Document</h2>

              <div className="mb-6">
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Document Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENT_TYPES.map((dt) => (
                    <button
                      key={dt.value}
                      type="button"
                      onClick={() => setDocumentType(dt.value)}
                      className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                        documentType === dt.value
                          ? "border-casino-gold bg-casino-gold/10 text-casino-gold"
                          : "border-casino-dark-border text-gray-400 hover:border-gray-600 hover:text-white"
                      }`}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Document Number
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="input-field w-full"
                  placeholder="e.g. AB1234567"
                  required
                />
              </div>

              {/* File Uploads */}
              <div className="grid gap-6 md:grid-cols-3">
                {[
                  { field: "front", label: "Front of ID", file: frontFile, setFile: setFrontFile },
                  { field: "back", label: "Back of ID", file: backFile, setFile: setBackFile },
                  { field: "selfie", label: "Selfie", file: selfieFile, setFile: setSelfieFile },
                ].map(({ field, label, file, setFile }) => (
                  <div key={field}>
                    <p className="mb-2 text-sm font-medium text-gray-400">{label}</p>
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-casino-dark-border bg-casino-dark-card p-4 transition-colors hover:border-casino-gold/50">
                      {file ? (
                        <div className="text-center">
                          <span className="text-2xl">📄</span>
                          <p className="mt-1 text-xs text-gray-400">{file.name}</p>
                          <button
                            type="button"
                            onClick={() => setFile(null)}
                            className="mt-1 text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-2xl">📁</span>
                          <p className="mt-1 text-xs text-gray-500">Click to upload</p>
                          <p className="text-xs text-gray-600">JPEG, PNG, or PDF</p>
                        </div>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setFile(f);
                        }}
                      />
                    </label>
                    {file && (
                      <button
                        type="button"
                        onClick={() => handleFileUpload(field, file)}
                        disabled={uploading === field}
                        className="mt-2 w-full rounded-md bg-casino-gold/10 px-3 py-1.5 text-xs font-medium text-casino-gold transition-colors hover:bg-casino-gold/20 disabled:opacity-50"
                      >
                        {uploading === field ? "Uploading..." : "Upload"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !fullName || !dateOfBirth || !nationality || !address || !documentNumber}
              className="btn-primary w-full"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Submitting...
                </span>
              ) : (
                "Submit for Verification"
              )}
            </button>

            <p className="text-center text-xs text-gray-500">
              Your documents are encrypted and securely stored. We'll review them within 24-48 hours.
            </p>
          </form>
        )}

        {/* Pending State */}
        {status === "pending" && (
          <motion.div
            className="mt-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/10">
              <span className="text-4xl">⏳</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-amber-400">Under Review</h2>
            <p className="mt-2 text-gray-400">
              Your documents are being reviewed by our compliance team.
              This usually takes 24-48 hours.
            </p>
            {kyc?.submitted_at && (
              <p className="mt-4 text-sm text-gray-500">
                Submitted: {new Date(kyc.submitted_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}
            <button
              onClick={fetchStatus}
              className="btn-secondary mt-6"
            >
              Refresh Status
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
