import { motion } from "framer-motion";
import SEO from "@/components/seo/SEO";

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

const badges = [
  { label: "Licensed & Regulated", icon: <ShieldIcon /> },
  { label: "Fair Gaming", icon: <TargetIcon /> },
  { label: "24/7 Support", icon: <HeartIcon /> },
  { label: "Fast Payouts", icon: <LightningIcon /> },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <SEO title="About Us – 247 Vegas Online Casino" ogUrl="https://247vegas.live/about" />
      <motion.div
        className="mx-auto max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="rounded-[24px] border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] sm:p-12">
          <div className="inline-block rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-2 text-sm font-bold text-white shadow-sm">
            ABOUT US
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold text-gray-900 sm:text-4xl">
            About <span className="text-[#4C00C2]">247 Vegas</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">Your premier destination for online casino gaming</p>

          <div className="mt-8 space-y-6 text-gray-700 leading-relaxed">
            <p>
              247 Vegas is a premium online casino platform offering a wide selection of
              slots, table games, and live dealer experiences. We are committed to providing
              a safe, fair, and entertaining gaming environment for players around the world.
            </p>

            <p>
              Licensed and regulated by the UK Gambling Commission, we adhere to the highest
              standards of player protection, responsible gaming, and operational integrity.
              Every game on our platform uses certified random number generators to ensure
              fair and unbiased outcomes.
            </p>

            <div className="rounded-2xl border-b-[4px] border-[#3d009e]/20 bg-[#4C00C2]/5 p-6">
              <h2 className="font-display text-xl font-bold text-gray-900">Our Mission</h2>
              <p className="mt-2">
                To deliver a world-class gaming experience that combines cutting-edge technology
                with exceptional customer service. We believe in putting our players first,
                offering 24/7 support, fast payouts, and a continuously growing library of
                games from the industry's top providers.
              </p>
            </div>

            <div className="rounded-2xl border-b-[4px] border-[#3d009e]/20 bg-[#4C00C2]/5 p-6">
              <h2 className="font-display text-xl font-bold text-gray-900">Responsible Gaming</h2>
              <p className="mt-2">
                We take player welfare seriously. 247 Vegas provides a range of responsible
                gaming tools including deposit limits, session reminders, self-exclusion, and
                reality checks. Our trained support team is always available to assist players
                who need help managing their gaming habits.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {badges.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-2 rounded-full border-b-[4px] border-[#3d009e]/30 bg-[#4C00C2] px-5 py-3 text-sm font-bold text-white shadow-sm active:translate-y-[4px] active:border-b-0 transition-all duration-75"
                >
                  {badge.icon}
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
