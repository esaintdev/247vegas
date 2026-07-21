import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import GameCard from "@/components/games/GameCard";
import SEO from "@/components/seo/SEO";

// ─── Hero background: Unsplash casino/poker atmosphere ───────────────────────
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=1920&q=85&auto=format&fit=crop";

const games = [
  {
    name: "Blackjack",
    path: "/games/blackjack",
    image: "/blackjack.png",
    description: "Beat the dealer with strategy and skill",
  },
  {
    name: "Roulette",
    path: "/games/roulette",
    image: "/roulette.png",
    description: "Spin the wheel and test your luck",
  },
  {
    name: "Slots",
    path: "/games/slots",
    image: "/slots.png",
    description: "Spin to win with exciting jackpots",
  },

  {
    name: "Crash",
    path: "/games/crash",
    image: "/crash.png",
    description: "Ride the multiplier to new heights",
  },
  {
    name: "Poker",
    path: "/games/poker",
    image: "/poker.png",
    description: "Go all-in at the poker table",
  },
  {
    name: "Baccarat",
    path: "/games/baccarat",
    image: "/baccarat.png",
    description: "The classic game of chance",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

// Floating decorative elements
const floatingItems = [
  { icon: "♠", delay: 0, x: "10%", size: "text-4xl", opacity: 0.15 },
  { icon: "♥", delay: 0.8, x: "85%", size: "text-3xl", opacity: 0.12 },
  { icon: "♦", delay: 1.6, x: "20%", size: "text-2xl", opacity: 0.10 },
  { icon: "♣", delay: 2.4, x: "75%", size: "text-5xl", opacity: 0.08 },
  { icon: "🎲", delay: 0.4, x: "60%", size: "text-3xl", opacity: 0.12 },
  { icon: "🃏", delay: 1.2, x: "40%", size: "text-2xl", opacity: 0.10 },
];

const stats = [
  { label: "Active Players", value: "12,847" },
  { label: "Total Payouts", value: "$4.2M" },
  { label: "Games Available", value: "50+" },
  { label: "Winners Today", value: "3,219" },
];

export default function HomePage() {
  const heroRef = useRef<HTMLElement>(null);

  // Subtle parallax on scroll
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const bg = hero.querySelector<HTMLElement>(".hero-bg");
    const onScroll = () => {
      if (bg) bg.style.transform = `translateY(${window.scrollY * 0.35}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen">
      <SEO
        title="Play Online Casino Games at 247 Vegas – Slots, Blackjack, Roulette, Poker & More"
        description="Experience the thrill of world-class casino games at 247 Vegas. Play slots, blackjack, roulette, poker and more. 24/7 action, fast payouts, secure gaming."
        ogUrl="https://247vegas.live"
      />
      {/* ── Hero Section ───────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-[65vh] overflow-hidden flex flex-col">

        {/* 1. The actual gradient box for the hero */}
        <div className="absolute inset-0 bg-[#4C00C2]" />

        {/*    Change 'mix-blend-overlay' to 'mix-blend-multiply', 'mix-blend-screen', 'mix-blend-luminosity', etc. to change the blend mode */}
        <div
          className="hero-bg absolute -inset-y-[150px] inset-x-0 will-change-transform opacity-10 mix-blend-multiply"
          style={{
            backgroundImage: `url("${HERO_IMAGE}")`,
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* ── Floating suit decorations ── */}
        {floatingItems.map((item, i) => (
          <motion.div
            key={i}
            className={`absolute top-0 pointer-events-none select-none ${item.size}`}
            style={{ left: item.x, opacity: item.opacity, color: "#FFD700" }}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: ["0%", "-18px", "0%"], opacity: item.opacity }}
            transition={{
              y: { duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: item.delay },
              opacity: { duration: 1, delay: item.delay },
            }}
          >
            {item.icon}
          </motion.div>
        ))}

        {/* ── Main hero content ── */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">

          {/* Headline */}
          <motion.h1
            className="font-display text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl xl:text-8xl drop-shadow-2xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          >
            Where{" "}
            <span className="text-gradient drop-shadow-lg">Fortune</span>
            <br />
            Meets{" "}
            <span className="text-white">Entertainment</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg text-gray-300 sm:text-xl drop-shadow-md leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Experience the thrill of world-class casino games — from classic
            table games to exciting slots. Your next big win awaits.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
          >
            <Link
              to="/register"
              className="inline-block rounded-full border-b-[4px] border-teal-700 bg-teal-400 px-9 py-4 text-base font-bold text-black transition-all duration-75 active:translate-y-[4px] active:border-b-0"
            >
              🎰 Start Playing Free
            </Link>
            <Link
              to="/games"
              className="inline-block rounded-full border-b-[4px] border-white/40 bg-white px-9 py-4 text-base font-bold text-black transition-all duration-75 active:translate-y-[4px] active:border-b-0"
            >
              Browse Games
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Games Grid */}
      <section className="px-4 py-20 bg-gray-50">
        <motion.div
          className="mx-auto max-w-5xl"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              Our Games
            </h2>
            <p className="mt-3 text-gray-600">
              Choose from a wide selection of premium casino games
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
            {games.map((game, i) => (
              <GameCard key={game.name} name={game.name} path={game.path} image={game.image} index={i} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* 1. Live Casino Promo Section */}
      <section className="bg-[#f2f4f5] px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h4 className="text-[#ff7676] font-extrabold text-xl mb-2">Settle in...</h4>
          <h2 className="text-[#4C00C2] font-display text-4xl md:text-5xl font-black mb-6 tracking-tight">
            At your favourite table in our online Live Casino.
          </h2>
          <p className="text-[#0e1628] text-lg md:text-xl leading-relaxed mb-6 font-medium max-w-4xl opacity-90">
            Take on Blackjack, Lightning Roulette, and more in 247 Vegas's very own Live Casino. Real dealers, real action — all from the comfort of your sofa, whether you're in London, Edinburgh, or Cardiff.
          </p>
          <Link to="/games" className="text-[#6a7380] font-bold underline decoration-2 underline-offset-4 hover:text-[#0e1628] transition-colors">
            See casino games
          </Link>
        </div>
      </section>

      {/* 2. Promo Cards Section */}
      <section className="bg-[#f2f4f5] px-4 pb-16">
        <div className="mx-auto max-w-5xl grid md:grid-cols-2 gap-6">
          {/* Card 1 */}
          <div className="bg-[#4C00C2] rounded-[32px] p-8 md:p-12 text-center text-white flex flex-col items-center">
            <div className="w-full max-w-[280px] aspect-video mb-8 relative flex items-center justify-center">
              {/* Placeholder for image 1 */}
              <img src="/promo1.png" alt="Fast payouts" className="absolute inset-0 w-full h-full object-contain" />
            </div>
            <h3 className="font-display text-3xl font-bold mb-4 tracking-tight">Fast payouts. Safe play. Zero faff.</h3>
            <p className="text-white/90 mb-8 font-medium text-[15px]">Quick withdrawals, smooth play, no fuss.</p>
            <Link to="/signup">
              <button className="bg-[#00E5C4] text-[#2A095F] font-bold px-8 py-3.5 rounded-full hover:bg-teal-300 transition-colors shadow-lg active:translate-y-[2px]">
                Jump In
              </button>
            </Link>
          </div>
          
          {/* Card 2 */}
          <div className="bg-[#4C00C2] rounded-[32px] p-8 md:p-12 text-center text-white flex flex-col items-center">
            <div className="w-full max-w-[280px] aspect-video mb-8 relative flex items-center justify-center">
              {/* Placeholder for image 2 */}
              <img src="/promo2.png" alt="Play Okay" className="absolute inset-0 w-full h-full object-contain" />
            </div>
            <h3 className="font-display text-3xl font-bold mb-4 tracking-tight">Stay safe. Stay in control.</h3>
            <p className="text-white/90 mb-8 font-medium text-[15px]">Set your limits, take a breather, and keep play sound.</p>
            <Link to="/login">
              <button className="bg-[#00E5C4] text-[#2A095F] font-bold px-8 py-3.5 rounded-full hover:bg-teal-300 transition-colors shadow-lg active:translate-y-[2px]">
                Play smart
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Fast Payments Section */}
      <section className="bg-[#f2f4f5] px-4 pb-16">
        <div className="mx-auto max-w-5xl bg-white rounded-[32px] p-8 md:p-12 shadow-sm border border-gray-100">
          <h2 className="font-display text-[#0e1628] text-3xl font-black mb-4 tracking-tight">Fast Payments</h2>
          <p className="text-[#6a7380] text-[17px] font-medium mb-12 max-w-3xl leading-relaxed">
            You won it, you want it, you got it. Withdrawals reviewed and processed in a matter of hours.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            <div className="flex gap-4">
              <div className="shrink-0 flex items-center justify-center w-[60px] h-[60px] bg-[#3d009e] rounded-full text-white">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <div>
                <h3 className="text-[#0e1628] font-bold text-xl mb-2 tracking-tight">No Fuss</h3>
                <p className="text-[#6a7380] font-medium leading-relaxed text-[15px]">Our secure payment methods are second to none, keeping your sensitive information safe.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="shrink-0 flex items-center justify-center w-[60px] h-[60px] bg-[#3d009e] rounded-full text-white">
                <span className="font-extrabold text-3xl">!</span>
              </div>
              <div>
                <h3 className="text-[#0e1628] font-bold text-xl mb-2 tracking-tight">No Fees</h3>
                <p className="text-[#6a7380] font-medium leading-relaxed text-[15px]">That's right, we don't charge anything for any withdrawals over £10.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Payment Methods Logos Section */}
      <section className="bg-[#f2f4f5] px-4 pb-24">
        <div className="mx-auto max-w-5xl flex flex-wrap justify-center gap-4">
          {["visa", "mastercard", "applepay", "paypal", "trustly", "paysafecard"].map((method) => (
            <div key={method} className="bg-white rounded-xl py-3 px-6 shadow-sm flex items-center justify-center w-[120px] h-[64px] border border-gray-100">
              <img src={`/payments/${method}.png`} alt={method} className="max-h-full max-w-full object-contain opacity-90 hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
