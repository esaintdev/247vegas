import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useWalletStore } from "@/store/walletStore";
import { useEffect, useState } from "react";
import AuthModal from "@/components/auth/AuthModal";

export default function Navbar() {
  const { 
    isAuthenticated, 
    user, 
    logout, 
    isAuthModalOpen, 
    authModalMode, 
    openAuthModal, 
    closeAuthModal 
  } = useAuthStore();
  const { wallet, fetchWallet } = useWalletStore();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWallet();
    }
  }, [isAuthenticated, fetchWallet]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const menuLinks = [
    { label: "About Us", path: "/about" },
    { label: "Contact", path: "/contact" },
    { label: "Terms & Conditions", path: "/terms" },
    { label: "Privacy Policy", path: "/privacy" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-[#32007E]">
      {/* Top Bar */}
      <div className="mx-auto flex h-16 md:h-20 max-w-[1600px] items-center justify-between px-4 md:px-8">
        
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1 shrink-0">
          <img src="/logo.png" alt="247 Vegas Logo" className="h-10 md:h-14 w-auto" />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-6">
          {isAuthenticated && wallet ? (
            <div className="flex items-center gap-2 md:gap-4">
              <Link to="/cashier" className="text-xs md:text-sm font-bold text-teal-400 whitespace-nowrap">
                ${parseFloat(wallet.available_balance).toFixed(2)}
              </Link>
              <Link to="/profile" className="text-xs md:text-sm font-bold text-white hover:text-gray-300">
                {user?.username}
              </Link>
              <button onClick={handleLogout} className="text-xs md:text-sm font-bold text-white hover:text-gray-300">
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => openAuthModal("login")}
                className="rounded-full px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-bold text-white transition-all duration-75 active:translate-y-[4px]"
              >
                Login
              </button>
              <button
                onClick={() => openAuthModal("register")}
                className="rounded-full border-b-[4px] border-teal-700 bg-teal-400 px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-bold text-[#2A095F] transition-all duration-75 active:translate-y-[4px] active:border-b-0"
              >
                Sign up
              </button>
            </div>
          )}

          {/* Menu Toggle */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex flex-col items-center justify-center gap-1 text-white hover:text-gray-300 ml-1 md:ml-2"
          >
            <div className="grid grid-cols-2 gap-[2px]">
              <div className="w-[5px] md:w-[6px] h-[5px] md:h-[6px] bg-current rounded-[1px]"></div>
              <div className="w-[5px] md:w-[6px] h-[5px] md:h-[6px] bg-current rounded-[1px]"></div>
              <div className="w-[5px] md:w-[6px] h-[5px] md:h-[6px] bg-current rounded-[1px]"></div>
              <div className="w-[5px] md:w-[6px] h-[5px] md:h-[6px] bg-current rounded-[1px]"></div>
            </div>
            <span className="text-[9px] md:text-[10px] font-bold">Menu</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {showMenu && (
        <div className="md:hidden border-t border-white/10 bg-[#2A095F] px-4 py-3">
          <div className="flex flex-col gap-2.5">
            {menuLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setShowMenu(false)}
                className="block rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-5 py-3 text-sm font-bold text-white shadow-sm transition-all duration-75 active:translate-y-[4px] active:border-b-0"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Navigation (Hub) */}
      <div className="relative mx-auto max-w-[1600px] px-4 md:px-8 pb-4">
        {/* Fade edges to hint scroll */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#32007E] to-transparent z-10 md:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#32007E] to-transparent z-10 md:hidden" />
        
        <div className="flex items-center gap-2 md:gap-3 overflow-x-auto scrollbar-hide py-1 -mx-4 md:mx-0 px-4 md:px-0">
          {/* Search Button */}
          <button className="shrink-0 flex items-center justify-center w-[38px] md:w-[46px] h-[38px] md:h-[46px] rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] text-white transition-all duration-75 active:translate-y-[4px] active:border-b-0">
            <svg className="w-4 md:w-5 h-4 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          
          {/* Home Button */}
          <Link to="/" className="shrink-0 flex items-center justify-center w-[38px] md:w-[46px] h-[38px] md:h-[46px] rounded-full border-b-[4px] border-gray-300 bg-white text-[#4C00C2] transition-all duration-75 active:translate-y-[4px] active:border-b-0">
            <svg className="w-4 md:w-5 h-4 md:h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.47 3.84a.75.75 0 011.06 0l8.99 9a.75.75 0 11-1.06 1.06l-1.21-1.21v7.56a1.5 1.5 0 01-1.5 1.5h-4.5v-4.5a1.5 1.5 0 00-1.5-1.5h-1.5a1.5 1.5 0 00-1.5 1.5v4.5h-4.5a1.5 1.5 0 01-1.5-1.5v-7.56l-1.21 1.21a.75.75 0 01-1.06-1.06l8.99-9z" />
            </svg>
          </Link>

          {/* Hub Links */}
          <Link to="/games" className="shrink-0 flex items-center gap-1.5 md:gap-2 rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-3 md:px-5 py-[8px] md:py-[11px] text-xs md:text-sm font-bold text-white transition-all duration-75 active:translate-y-[4px] active:border-b-0">
            <svg className="w-3.5 md:w-4 h-3.5 md:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
            Games
          </Link>
          
          <button className="shrink-0 flex items-center gap-1.5 md:gap-2 rounded-full border-b-[4px] border-[#3d009e]/30 bg-[#4C00C2]/50 px-3 md:px-5 py-[8px] md:py-[11px] text-xs md:text-sm font-bold text-white/50 transition-all duration-75 active:translate-y-[4px] active:border-b-0 cursor-not-allowed">
            <svg className="w-3.5 md:w-4 h-3.5 md:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
            Live
            <span className="text-[7px] md:text-[8px] uppercase tracking-wider text-white/30 ml-0.5">Soon</span>
          </button>

          <button className="shrink-0 flex items-center gap-1.5 md:gap-2 rounded-full border-b-[4px] border-[#3d009e]/30 bg-[#4C00C2]/50 px-3 md:px-5 py-[8px] md:py-[11px] text-xs md:text-sm font-bold text-white/50 transition-all duration-75 active:translate-y-[4px] active:border-b-0 cursor-not-allowed">
            <svg className="w-3.5 md:w-4 h-3.5 md:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.41l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.41zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>
            Promos
            <span className="text-[7px] md:text-[8px] uppercase tracking-wider text-white/30 ml-0.5">Soon</span>
          </button>

          <button className="shrink-0 flex items-center gap-1.5 md:gap-2 rounded-full border-b-[4px] border-[#3d009e]/30 bg-[#4C00C2]/50 px-3 md:px-5 py-[8px] md:py-[11px] text-xs md:text-sm font-bold text-white/50 transition-all duration-75 active:translate-y-[4px] active:border-b-0 cursor-not-allowed">
            <svg className="w-3.5 md:w-4 h-3.5 md:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            Jackpots
            <span className="text-[7px] md:text-[8px] uppercase tracking-wider text-white/30 ml-0.5">Soon</span>
          </button>
        </div>
      </div>
      <AuthModal open={isAuthModalOpen} onClose={closeAuthModal} defaultMode={authModalMode} />
    </nav>
  );
}
