import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface GameModalProps {
  open: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  name: string;
  image: string;
  path: string;
}

export default function GameModal({ open, onClose, onOpenAuth, name, image, path }: GameModalProps) {
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

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-[420px] aspect-square overflow-hidden rounded-2xl bg-[#4C00C2] shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-lg text-white transition-all hover:bg-white/30"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-6 w-6">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            </button>

            {/* Image */}
            <div className="h-[60%] overflow-hidden">
              <img src={image} alt={name} className="h-full w-full object-cover" />
            </div>

            {/* Divider */}
            <div className="h-px bg-white/10" />

            {/* Content */}
            <div className="flex h-[40%] flex-col justify-center px-6 py-4">
              <h2 className="font-display text-xl font-bold text-white">
                <span className="text-[#FFD700]">#</span> {name}
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => { onClose(); navigate(path); }}
                  className="rounded-full border-b-[4px] border-white/30 bg-white/10 py-3 text-sm font-bold text-white transition-all duration-75 active:translate-y-[4px] active:border-b-0"
                >
                  Demo
                </button>
                <button
                  onClick={() => { onClose(); onOpenAuth(); }}
                  className="rounded-full border-b-[4px] border-teal-700 bg-teal-400 py-3 text-sm font-bold text-black transition-all duration-75 active:translate-y-[4px] active:border-b-0"
                >
                  Login
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
