import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";

interface Announcement {
  enabled: boolean;
  text: string | null;
  type: string;
}

function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/settings/announcement", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: Announcement) => setAnnouncement(data))
      .catch(() => { });
    return () => controller.abort();
  }, []);

  if (!announcement || !announcement.enabled || !announcement.text) return null;

  const typeStyles: Record<string, string> = {
    info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    danger: "bg-red-500/10 border-red-500/30 text-red-400",
  };

  return (
    <div className={`border-b px-4 py-2.5 text-center text-sm font-medium ${typeStyles[announcement.type] || typeStyles.info}`}>
      {announcement.text}
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0D1117]">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBanner />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 bg-gray-200 py-10 px-4 md:px-12">
        <div className="mx-auto max-w-[1200px]">
          {/* Top Row: Region and 18+ */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <img src="/footer/uk-flag.png" alt="UK Flag" className="w-8 object-contain" />
              <span className="text-sm font-bold text-[#6a7380]">United Kingdom</span>
            </div>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#8b929e] text-white text-[11px] font-bold">
              18+
            </div>
          </div>

          {/* Gambling Commission Logo */}
          <div className="mb-6">
            <img src="/footer/gambling-commission.svg" alt="Gambling Commission" className="h-10 object-contain opacity-70" />
          </div>

          {/* First Text Block */}
          <p className="text-[13px] text-[#6a7380] mb-6 font-medium leading-relaxed max-w-6xl">
            247 Vegas is officially licensed by the UK Gambling Commission. Our aim is to create a safer environment for our players, ensuring their well-being as well as a more responsible gaming conduct within the industry.
          </p>

          {/* Second Text Block */}
          <p className="text-[12px] text-[#8b929e] mb-10 leading-relaxed max-w-6xl">
            Recro Limited is a company incorporated under the Laws of Malta with company registration no. C77858, and having its registered address at 'The Unicorn Centre, Triq il-Uqija, Swieqi, SWQ 2335, Malta'. Recro Limited is licensed and regulated in the United Kingdom. This website provides facilities for gambling to persons in Great Britain in reliance to Gambling Commission Account Number 61549. Find out more about the UKGC on <a href="https://www.gamblingcommission.gov.uk" className="underline hover:text-[#6a7380] transition-colors">www.gamblingcommission.gov.uk</a>. Contact us on <a href="mailto:support@247vegas.live" className="underline hover:text-[#6a7380] transition-colors">support@247vegas.live</a>. Gambling can be addictive. Please play responsibly. If you need support in relation to your gambling habits you find more information at <a href="https://www.gamblingtherapy.org" className="underline hover:text-[#6a7380] transition-colors">Gambling Therapy</a>. Read more about <a href="#" className="underline hover:text-[#6a7380] transition-colors">Play Okay</a>.
          </p>

          {/* Footer Links */}
          <div className="mb-8 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Link to="/about" className="text-[#6a7380] hover:text-[#4C00C2] transition-colors font-medium">About Us</Link>
            <Link to="/contact" className="text-[#6a7380] hover:text-[#4C00C2] transition-colors font-medium">Contact</Link>
            <Link to="/terms" className="text-[#6a7380] hover:text-[#4C00C2] transition-colors font-medium">Terms & Conditions</Link>
            <Link to="/privacy" className="text-[#6a7380] hover:text-[#4C00C2] transition-colors font-medium">Privacy Policy</Link>
          </div>

          {/* Bottom Logos */}
          <div className="flex flex-wrap items-center gap-6 md:gap-10 opacity-70">
            <img src="/footer/begambleaware.svg" alt="BeGambleAware" className="h-6 object-contain" />
            <img src="/footer/problem-gambling.svg" alt="Problem Gambling Support" className="h-8 object-contain" />
            <img src="/footer/gamstop.svg" alt="GAMSTOP" className="h-8 object-contain" />

            <div className="ml-auto">
              <img src="/footer/iso.svg" alt="ISO 27001" className="h-8 object-contain" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
