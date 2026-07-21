import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WinModalProps {
  open: boolean;
  amount: string | number;
  message?: string;
  onClose: () => void;
}

export default function WinModal({ open, amount, message, onClose }: WinModalProps) {
  const [imgError, setImgError] = useState(false);
  const formatted = typeof amount === "number" ? amount.toFixed(2) : amount;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl shadow-amber-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            {imgError ? (
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950 px-8 py-16">
                <span className="text-7xl mb-4">🎉</span>
                <p className="font-display text-5xl font-black tracking-tight text-amber-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.4)]">
                  ${formatted}
                </p>
                {message && <p className="mt-3 text-sm text-gray-400">{message}</p>}
                <button
                  onClick={onClose}
                  className="mt-8 rounded-full border-b-[4px] border-amber-500/50 bg-gradient-to-r from-amber-400 to-amber-500 px-10 py-3 text-sm font-bold text-black shadow-lg transition-all duration-75 active:translate-y-[4px] active:border-b-0"
                >
                  Nice!
                </button>
              </div>
            ) : (
              <div className="relative">
                <img
                  src="/win-image.png"
                  alt=""
                  className="w-full h-auto block"
                  onError={() => setImgError(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
                  <p className="font-display text-5xl font-black tracking-tight text-amber-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.6)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
                    ${formatted}
                  </p>
                  {message && <p className="mt-2 text-sm text-white/80 drop-shadow-md">{message}</p>}
                  <button
                    onClick={onClose}
                    className="mt-4 rounded-full border-b-[4px] border-amber-500/50 bg-gradient-to-r from-amber-400 to-amber-500 px-10 py-3 text-sm font-bold text-black shadow-lg transition-all duration-75 active:translate-y-[4px] active:border-b-0"
                  >
                    Nice!
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
