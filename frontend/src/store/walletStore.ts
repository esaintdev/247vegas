import { create } from "zustand";
import apiClient from "@/api/client";

interface Wallet {
  id: string;
  balance: string;
  bonus_balance: string;
  locked_amount: string;
  available_balance: string;
  currency: string;
}

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

interface WalletState {
  wallet: Wallet | null;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;

  fetchWallet: () => Promise<void>;
  fetchTransactions: (limit?: number) => Promise<void>;
  setWallet: (wallet: Wallet) => void;
  clearWallet: () => void;
}

export const useWalletStore = create<WalletState>()((set) => ({
  wallet: null,
  transactions: [],
  isLoading: false,
  error: null,

  fetchWallet: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.get<Wallet>("/wallet/balance");
      set({ wallet: data, isLoading: false });
    } catch {
      set({ error: "Failed to fetch wallet", isLoading: false });
    }
  },

  fetchTransactions: async (limit = 20) => {
    try {
      const { data } = await apiClient.get<Transaction[]>(
        `/wallet/transactions?limit=${limit}`,
      );
      set({ transactions: data });
    } catch {
      // Silent fail for transactions
    }
  },

  setWallet: (wallet) => set({ wallet }),
  clearWallet: () => set({ wallet: null, transactions: [] }),
}));
