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
      // Refresh wallet after redirect
      fetchWallet();
      fetchTransactions();
      // Clean URL params
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
        // Redirect to Flutterwave payment page
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-display text-3xl font-bold">Cashier</h1>
        <p className="mt-1 text-gray-400">
          Deposit funds or request a withdrawal
        </p>

        {/* Balance Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="card">
            <p className="text-sm text-gray-400">Balance</p>
            <p className="font-display text-2xl font-bold text-casino-gold">
              ${parseFloat(wallet?.balance || "0").toFixed(2)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400">Available</p>
            <p className="font-display text-2xl font-bold text-green-400">
              ${parseFloat(wallet?.available_balance || "0").toFixed(2)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400">Locked</p>
            <p className="font-display text-2xl font-bold text-red-400">
              ${parseFloat(wallet?.locked_amount || "0").toFixed(2)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8">
          <div className="mb-6 flex gap-1 rounded-lg bg-casino-dark-card p-1">
            <button
              onClick={() => setTab("deposit")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                tab === "deposit"
                  ? "bg-casino-gold text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Deposit
            </button>
            <button
              onClick={() => setTab("withdraw")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                tab === "withdraw"
                  ? "bg-casino-gold text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Withdraw
            </button>
          </div>

          <div className="card">
            {/* Status Message */}
            <AnimatePresence>
              {message && (
                <motion.div
                  className={`mb-4 rounded-lg px-4 py-3 text-sm ${
                    message.type === "success"
                      ? "bg-green-500/10 text-green-400"
                      : message.type === "error"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-blue-500/10 text-blue-400"
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
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-purple-900/20 px-3 py-2">
                  <span className="text-sm text-purple-300">
                    🔒 Secured by
                  </span>
                  <span className="text-sm font-bold text-purple-200">
                    Flutterwave
                  </span>
                  <span className="ml-auto text-xs text-purple-400">
                    Cards • Bank • USSD • Mobile Money
                  </span>
                </div>

                {/* Quick amounts */}
                <div className="mb-4">
                  <p className="mb-2 text-sm font-medium text-gray-400">
                    Quick Select
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {quickAmounts.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmount(amt.toString())}
                        className={`rounded-lg border px-4 py-2 text-sm font-mono transition-all ${
                          amount === amt.toString()
                            ? "border-casino-gold bg-casino-gold/10 text-casino-gold"
                            : "border-casino-dark-border text-gray-400 hover:border-gray-600 hover:text-white"
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="input-field pl-8 font-mono text-lg"
                      placeholder="0.00"
                      min="1"
                      step="0.01"
                    />
                  </div>
                </div>

                <button
                  onClick={handleDeposit}
                  disabled={isLoading || !amount || parseFloat(amount) <= 0}
                  className="btn-primary w-full"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
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
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Select Bank
                  </label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">-- Choose a bank --</option>
                    {banks.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                  {banks.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Bank list loading...
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) =>
                      setAccountNumber(e.target.value.replace(/\D/g, ""))
                    }
                    className="input-field w-full font-mono"
                    placeholder="0123456789"
                    maxLength={10}
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="input-field w-full"
                    placeholder="John Doe"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="input-field pl-8 font-mono text-lg"
                      placeholder="0.00"
                      min="1"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="mb-4 rounded-lg bg-amber-900/10 px-3 py-2 text-xs text-amber-400">
                  ⏳ Withdrawals require admin approval and may take 24-48
                  hours to process.
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
                  className="btn-primary w-full !bg-red-600 hover:!bg-red-500 disabled:!bg-red-800 disabled:!opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
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
            <h2 className="mb-4 font-display text-xl font-bold">
              Recent Transactions
            </h2>
            <div className="card">
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No transactions yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {transactions.slice(0, 10).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-lg bg-casino-dark-card px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="chip capitalize">{tx.type}</span>
                        <span
                          className={`chip capitalize ${
                            tx.status === "completed"
                              ? "!border-green-500/30 !bg-green-500/10 !text-green-400"
                              : tx.status === "failed"
                                ? "!border-red-500/30 !bg-red-500/10 !text-red-400"
                                : tx.status === "pending"
                                  ? "!border-amber-500/30 !bg-amber-500/10 !text-amber-400"
                                  : ""
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-mono text-sm font-bold ${
                            tx.type === "deposit" || tx.type === "win"
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {tx.type === "deposit" || tx.type === "win"
                            ? "+"
                            : "-"}
                          ${parseFloat(tx.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
