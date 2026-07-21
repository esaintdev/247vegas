import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/api/client";
import { useWalletStore } from "@/store/walletStore";
import { useSearchParams } from "react-router-dom";

interface Bank {
  code: string;
  name: string;
}

export default function CashierPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"deposit" | "withdraw">(
    searchParams.get("tab") === "withdraw" ? "withdraw" : "deposit"
  );
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Withdrawal fields
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const { wallet, fetchWallet, fetchTransactions, transactions } =
    useWalletStore();

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
    loadBanks();
  }, [fetchWallet, fetchTransactions]);

  // Handle redirect back from Flutterwave
  useEffect(() => {
    const tx_ref = searchParams.get("tx_ref");
    const status = searchParams.get("status");
    if (tx_ref) {
      if (status === "successful" || status === "completed") {
        setMessage({
          type: "success",
          text: "Payment successful! Your wallet will be credited shortly.",
        });
      } else if (status === "cancelled") {
        setMessage({
          type: "error",
          text: "Payment was cancelled.",
        });
      } else {
        setMessage({
          type: "info",
          text: "Payment is being processed. Check your transactions for updates.",
        });
      }
      fetchWallet();
      fetchTransactions();
      window.history.replaceState({}, "", "/cashier");
    }
  }, [searchParams, fetchWallet, fetchTransactions]);

  const loadBanks = async () => {
    try {
      const { data } = await apiClient.get("/wallet/banks?country=NG");
      setBanks(data || []);
    } catch {
      // Banks not critical — user can still see the UI
    }
  };

  const quickAmounts = [10, 25, 50, 100, 250, 500];

  const handleDeposit = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const { data } = await apiClient.post("/wallet/deposit", {
        amount: parseFloat(amount),
        currency: "USD",
      });

      if (data.payment_link) {
        window.location.href = data.payment_link;
      } else {
        setMessage({
          type: "error",
          text: "Failed to get payment link. Please try again.",
        });
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || "Deposit failed. Please try again.";
      setMessage({ type: "error", text: detail });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      await apiClient.post("/wallet/withdraw", {
        amount: parseFloat(amount),
        payment_method: "bank_transfer",
        bank_code: selectedBank,
        account_number: accountNumber,
        account_name: accountName,
      });
      setMessage({
        type: "success",
        text: "Withdrawal request submitted! Admin will process it shortly.",
      });
      setAmount("");
      setAccountNumber("");
      setAccountName("");
      fetchWallet();
      fetchTransactions();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        "Withdrawal failed. Check your balance or try again.";
      setMessage({ type: "error", text: detail });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-b-[4px] border-[#3d009e]/30 bg-[#4C00C2] text-sm font-bold text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Cashier</h1>
          </div>
          <p className="text-sm font-medium text-gray-500 ml-[52px]">
            Deposit funds or request a withdrawal
          </p>

          {/* Balance Cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">Balance</p>
              <p className="mt-1 font-display text-2xl font-black text-[#4C00C2]">
                ${parseFloat(wallet?.balance || "0").toFixed(2)}
              </p>
            </div>
            <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">Available</p>
              <p className="mt-1 font-display text-2xl font-black text-emerald-600">
                ${parseFloat(wallet?.available_balance || "0").toFixed(2)}
              </p>
            </div>
            <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">Locked</p>
              <p className="mt-1 font-display text-2xl font-black text-red-500">
                ${parseFloat(wallet?.locked_amount || "0").toFixed(2)}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-8">
            <div className="mb-6 flex gap-2 rounded-full border-b-[4px] border-gray-200 bg-white p-1.5 shadow-sm">
              <button
                onClick={() => setTab("deposit")}
                className={`flex-1 rounded-full px-4 py-2.5 text-xs font-bold transition-all duration-75 active:translate-y-[2px] ${
                  tab === "deposit"
                    ? "border-b-[3px] border-[#3d009e] bg-[#4C00C2] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Deposit
              </button>
              <button
                onClick={() => setTab("withdraw")}
                className={`flex-1 rounded-full px-4 py-2.5 text-xs font-bold transition-all duration-75 active:translate-y-[2px] ${
                  tab === "withdraw"
                    ? "border-b-[3px] border-[#3d009e] bg-[#4C00C2] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Withdraw
              </button>
            </div>

            <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              {/* Status Message */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    className={`mb-4 rounded-2xl border-b-[4px] px-4 py-3 text-sm font-medium ${
                      message.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : message.type === "error"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-blue-200 bg-blue-50 text-blue-700"
                    }`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              {tab === "deposit" ? (
                /* ── DEPOSIT FORM ── */
                <div>
                  {/* Powered by Flutterwave */}
                  <div className="mb-5 flex items-center gap-2 rounded-2xl border-b-[3px] border-purple-200 bg-purple-50 px-4 py-3">
                    <span className="text-xs font-bold text-purple-600">🔒 Secured by</span>
                    <span className="text-sm font-bold text-purple-700">Flutterwave</span>
                    <span className="ml-auto text-[11px] font-bold text-purple-500">Cards • Bank • USSD • Mobile Money</span>
                  </div>

                  {/* Quick amounts */}
                  <div className="mb-5">
                    <p className="mb-2 text-xs font-bold tracking-wide text-gray-600 uppercase">Quick Select</p>
                    <div className="flex flex-wrap gap-2">
                      {quickAmounts.map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setAmount(amt.toString())}
                          className={`rounded-full border-b-[3px] px-4 py-2 text-xs font-bold font-mono transition-all duration-75 active:translate-y-[3px] active:border-b-0 ${
                            amount === amt.toString()
                              ? "border-[#3d009e]/30 bg-[#4C00C2] text-white shadow-sm"
                              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                          }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="mb-1.5 block text-xs font-bold tracking-wide text-gray-600 uppercase">Amount (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full rounded-full border border-gray-200 bg-white py-3 pl-8 pr-5 font-mono text-lg text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                        placeholder="0.00"
                        min="1"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleDeposit}
                    disabled={isLoading || !amount || parseFloat(amount) <= 0}
                    className="w-full rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      "Deposit with Flutterwave"
                    )}
                  </button>
                </div>
              ) : (
                /* ── WITHDRAWAL FORM ── */
                <div>
                  <div className="mb-5">
                    <label className="mb-1.5 block text-xs font-bold tracking-wide text-gray-600 uppercase">Select Bank</label>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                    >
                      <option value="">-- Choose a bank --</option>
                      {banks.map((bank) => (
                        <option key={bank.code} value={bank.code}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                    {banks.length === 0 && (
                      <p className="mt-1 text-xs font-bold text-gray-400">Bank list loading...</p>
                    )}
                  </div>

                  <div className="mb-5">
                    <label className="mb-1.5 block text-xs font-bold tracking-wide text-gray-600 uppercase">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                      placeholder="0123456789"
                      maxLength={10}
                    />
                  </div>

                  <div className="mb-5">
                    <label className="mb-1.5 block text-xs font-bold tracking-wide text-gray-600 uppercase">Account Name</label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="mb-5">
                    <label className="mb-1.5 block text-xs font-bold tracking-wide text-gray-600 uppercase">Amount (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full rounded-full border border-gray-200 bg-white py-3 pl-8 pr-5 font-mono text-lg text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#4C00C2]/50 focus:ring-2 focus:ring-[#4C00C2]/20"
                        placeholder="0.00"
                        min="1"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="mb-5 rounded-2xl border-b-[3px] border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                    ⏳ Withdrawals require admin approval and may take 24-48 hours to process.
                  </div>

                  <button
                    onClick={handleWithdraw}
                    disabled={
                      isLoading ||
                      !amount ||
                      parseFloat(amount) <= 0 ||
                      !selectedBank ||
                      !accountNumber ||
                      accountNumber.length < 10 ||
                      !accountName
                    }
                    className="w-full rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      "Request Withdrawal"
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="mt-8">
              <h2 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">Recent Transactions</h2>
              <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                {transactions.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm font-bold text-gray-400">No transactions yet.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {transactions.slice(0, 10).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize ${
                            tx.type === "deposit" || tx.type === "win"
                              ? "border-b-[2px] border-emerald-200 bg-emerald-50 text-emerald-600"
                              : "border-b-[2px] border-red-200 bg-red-50 text-red-600"
                          }`}>{tx.type}</span>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize ${
                            tx.status === "completed"
                              ? "border-b-[2px] border-emerald-200 bg-emerald-50 text-emerald-600"
                              : tx.status === "failed"
                                ? "border-b-[2px] border-red-200 bg-red-50 text-red-600"
                                : "border-b-[2px] border-amber-200 bg-amber-50 text-amber-600"
                          }`}>{tx.status}</span>
                        </div>
                        <span className={`font-mono text-sm font-bold ${
                          tx.type === "deposit" || tx.type === "win"
                            ? "text-emerald-600"
                            : "text-red-500"
                        }`}>
                          {tx.type === "deposit" || tx.type === "win" ? "+" : "-"}${parseFloat(tx.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
