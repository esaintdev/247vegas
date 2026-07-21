import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameCard from "@/components/games/GameCard";
import SEO from "@/components/seo/SEO";

const GAMES = [
  { name: "Slots", path: "/games/slots", image: "/slots.png", description: "Spin to win with exciting jackpots", category: "slots" },
  { name: "Blackjack", path: "/games/blackjack", image: "/blackjack.png", description: "Beat the dealer with strategy and skill", category: "table" },
  { name: "Roulette", path: "/games/roulette", image: "/roulette.png", description: "Spin the wheel and test your luck", category: "table" },
  { name: "Poker", path: "/games/poker", image: "/poker.png", description: "Go all-in at the poker table", category: "table" },
  { name: "Baccarat", path: "/games/baccarat", image: "/baccarat.png", description: "The classic game of chance", category: "table" },
  { name: "Crash", path: "/games/crash", image: "/crash.png", description: "Ride the multiplier to new heights", category: "popular" },
];

interface Category {
  key: string;
  label: string;
  disabled?: boolean;
}

const CATEGORIES: Category[] = [
  { key: "all", label: "All Games" },
  { key: "popular", label: "Popular" },
  { key: "slots", label: "Slots" },
  { key: "table", label: "Table Games" },
  { key: "jackpots", label: "Jackpots", disabled: true },
  { key: "live", label: "Live Casino", disabled: true },
];

type CategoryKey = (typeof CATEGORIES)[number]["key"];

export default function GamesPage() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGames = useMemo(() => {
    return GAMES.filter((game) => {
      const matchesCategory = activeCategory === "all" || game.category === activeCategory;
      const matchesSearch = !searchQuery.trim() ||
        game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <SEO
        title="Game Lobby – Play 500+ Online Casino Games"
        description="Browse 500+ casino games at 247 Vegas. Play slots, blackjack, roulette, poker, baccarat, crash and more. Filter by category and find your favourite game."
        ogUrl="https://247vegas.live/games"
      />
      <motion.div className="mx-auto max-w-7xl" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Game Lobby</h1>
          <p className="mt-1 text-sm text-gray-500">
            {filteredGames.length} game{filteredGames.length !== 1 ? "s" : ""} available
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search games..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 transition-all focus:border-[#4C00C2]/40 focus:ring-1 focus:ring-[#4C00C2]/20"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>

        {/* Categories */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => !cat.disabled && setActiveCategory(cat.key as CategoryKey)}
              disabled={cat.disabled}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${cat.disabled
                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                  : activeCategory === cat.key
                    ? "bg-[#4C00C2] text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                }`}
            >
              {cat.label}
              {cat.disabled && (
                <span className="ml-1.5 rounded bg-gray-200 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-gray-500">Soon</span>
              )}
            </button>
          ))}
        </div>

        {/* Grid */}
        <AnimatePresence mode="wait">
          {filteredGames.length > 0 ? (
            <motion.div
              key={activeCategory + searchQuery}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {filteredGames.map((game, i) => (
                <GameCard key={game.name} name={game.name} path={game.path} image={game.image} index={i} />
              ))}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16">
              <span className="mb-3 text-4xl">🔍</span>
              <p className="text-sm font-medium text-gray-600">No games found</p>
              <p className="mt-1 text-xs text-gray-400">Try a different category or search term</p>
              <button onClick={() => { setActiveCategory("all"); setSearchQuery(""); }}
                className="mt-4 text-xs font-medium text-[#4C00C2] hover:text-[#3d009e]">Clear filters</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Coming soon */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 shadow-sm">
            <span className="text-amber-500">✨</span>
            Live dealer games — coming soon
          </div>
        </div>
      </motion.div>
    </div>
  );
}
