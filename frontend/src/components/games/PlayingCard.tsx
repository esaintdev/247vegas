import { motion } from "framer-motion";

interface CardData {
  suit: string;
  rank: string;
  face_up: boolean;
  display: string;
}

interface PlayingCardProps {
  card: CardData;
  index?: number;
  small?: boolean;
}

const suitColors: Record<string, string> = {
  "♠": "text-gray-900 dark:text-gray-100",
  "♥": "text-red-500",
  "♣": "text-gray-900 dark:text-gray-100",
  "♦": "text-red-500",
};

function getSuitSymbol(suit: string): string {
  const map: Record<string, string> = {
    "♠": "♠", "♥": "♥", "♣": "♣", "♦": "♦",
    "?": "?",
  };
  return map[suit] || suit;
}

export default function PlayingCard({ card, index = 0, small = false }: PlayingCardProps) {
  const isHidden = !card.face_up;
  const colorClass = isHidden ? "text-gray-400" : suitColors[card.suit] || "text-white";
  const size = small ? "w-12 h-16 text-sm" : "w-16 h-24 text-base";

  return (
    <motion.div
      initial={{ opacity: 0, y: -40, rotateZ: -10 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      transition={{
        delay: index * 0.1,
        type: "spring",
        stiffness: 300,
        damping: 20,
      }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className={`relative ${size} rounded-xl border-2 shadow-xl select-none
        ${isHidden
          ? "border-casino-dark-border bg-gradient-to-br from-blue-900 to-blue-950"
          : "border-gray-200 bg-white"
        } flex flex-col items-center justify-between p-1.5 font-mono font-bold`}
    >
      {isHidden ? (
        // Card back design
        <div className="flex h-full w-full items-center justify-center">
          <div className="grid grid-cols-2 gap-1 opacity-60">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-2 w-2 rounded-sm bg-blue-400/30" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Top-left rank + suit */}
          <div className={`self-start leading-none ${colorClass}`}>
            <div className="text-xs sm:text-sm leading-none">{card.rank}</div>
            <div className="text-xs leading-none">{getSuitSymbol(card.suit)}</div>
          </div>

          {/* Center suit */}
          <div className={`absolute inset-0 flex items-center justify-center ${colorClass}`}>
            <span className={small ? "text-lg" : "text-2xl"}>
              {getSuitSymbol(card.suit)}
            </span>
          </div>

          {/* Bottom-right rank + suit (inverted) */}
          <div className={`self-end rotate-180 leading-none ${colorClass}`}>
            <div className="text-xs sm:text-sm leading-none">{card.rank}</div>
            <div className="text-xs leading-none">{getSuitSymbol(card.suit)}</div>
          </div>
        </>
      )}
    </motion.div>
  );
}
