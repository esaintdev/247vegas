import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import GameModal from "./GameModal";
import AuthModal from "@/components/auth/AuthModal";

interface GameCardProps {
  name: string;
  path: string;
  image: string;
  index?: number;
}

export default function GameCard({ name, path, image, index = 0 }: GameCardProps) {
  const { isAuthenticated } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  if (isAuthenticated) {
    return (
      <Link to={path}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
          whileHover={{ y: -8, scale: 1.02 }}
          className="relative overflow-hidden rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] group cursor-pointer aspect-square bg-gray-100"
        >
          <img
            src={image}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute top-4 left-4 bg-[#4C00C2] text-white text-[13px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md z-10 tracking-wide">
            <span className="opacity-60 font-medium">#</span> {name}
          </div>
        </motion.div>
      </Link>
    );
  }

  return (
    <>
      <button onClick={() => setShowModal(true)} className="w-full text-left">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
          whileHover={{ y: -8, scale: 1.02 }}
          className="relative overflow-hidden rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] group cursor-pointer aspect-square bg-gray-100"
        >
          <img
            src={image}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute top-4 left-4 bg-[#4C00C2] text-white text-[13px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md z-10 tracking-wide">
            <span className="opacity-60 font-medium">#</span> {name}
          </div>
        </motion.div>
      </button>
      <GameModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onOpenAuth={() => setShowAuth(true)}
        name={name}
        image={image}
        path={path}
      />
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} defaultMode="login" />
    </>
  );
}
