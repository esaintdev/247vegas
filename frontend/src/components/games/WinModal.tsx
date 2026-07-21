import { motion, AnimatePresence } from "framer-motion";

interface WinModalProps {
  open: boolean;
  amount: string | number;
  message?: string;
  onClose: () => void;
}

export default function WinModal({ open, amount, message, onClose }: WinModalProps) {
  const formatted = typeof amount === "number" ? amount.toFixed(2) : amount;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 40 }}
            className="relative mx-4 w-full max-w-sm rounded-[32px] border border-amber-500/30 bg-gradient-to-b from-gray-900 to-black p-8 text-center shadow-2xl shadow-amber-500/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image space */}
            <div className="mx-auto mb-6 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-amber-500/30 bg-amber-500/5">
              <img
                src="/win-image.png"
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.classList.add("flex", "items-center", "justify-center");
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-5xl">🎉</span>';
                }}
              />
            </div>

            <p className="mb-1 text-sm font-bold uppercase tracking-[0.2em] text-amber-400/70">You Won!</p>
            <p className="font-display text-5xl font-black tracking-tight text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
              ${formatted}
            </p>

            {message && <p className="mt-3 text-sm text-gray-400">{message}</p>}

            <button
              onClick={onClose}
              className="mx-auto mt-8 rounded-full border-b-[4px] border-amber-500/50 bg-gradient-to-r from-amber-400 to-amber-500 px-10 py-3 text-sm font-bold text-black shadow-lg shadow-amber-500/20 transition-all duration-75 active:translate-y-[4px] active:border-b-0"
            >
              Nice!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
