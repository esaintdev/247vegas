import { motion } from "framer-motion";
import SEO from "@/components/seo/SEO";

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: "By accessing or using the 247 Vegas website, you agree to be bound by these Terms & Conditions. If you do not agree with any part of these terms, you must not use our services.",
  },
  {
    title: "2. Eligibility",
    content: "You must be at least 18 years old to use this service. It is your responsibility to ensure that online gambling is legal in your jurisdiction. 247 Vegas reserves the right to verify your age and identity at any time.",
  },
  {
    title: "3. Account Registration",
    content: "You agree to provide accurate and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials. Any activity conducted through your account is your responsibility.",
  },
  {
    title: "4. Deposits & Withdrawals",
    content: "All deposits and withdrawals are subject to our verification procedures. 247 Vegas reserves the right to delay or refuse withdrawals pending identity verification. Withdrawal processing times vary by payment method.",
  },
  {
    title: "5. Fair Play",
    content: "Any attempt to manipulate games, exploit bugs, or engage in fraudulent activity will result in account suspension and forfeiture of all funds. All games use certified random number generators to ensure fair outcomes.",
  },
  {
    title: "6. Responsible Gaming",
    content: "247 Vegas promotes responsible gaming. We provide tools to help you manage your play, including deposit limits, time limits, and self-exclusion. If you feel you may have a gambling problem, please contact GamCare or Gambling Therapy for support.",
  },
  {
    title: "7. Limitation of Liability",
    content: "247 Vegas shall not be liable for any loss or damage arising from your use of the website, including but not limited to technical failures, force majeure events, or loss of data.",
  },
  {
    title: "8. Changes to Terms",
    content: "We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms. We will notify you of material changes via email or website notice.",
  },
  {
    title: "9. Contact",
    content: (
      <>
        For questions about these terms, please contact us at{' '}
        <a href="mailto:support@247vegas.live" className="text-[#4C00C2] hover:text-[#3d009e] font-medium">
          support@247vegas.live
        </a>.
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <SEO title="Terms & Conditions – 247 Vegas" ogUrl="https://247vegas.live/terms" />
      <motion.div
        className="mx-auto max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="rounded-[24px] border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] sm:p-12">
          <div className="inline-block rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-2 text-sm font-bold text-white shadow-sm">
            <span className="flex items-center gap-2">
              <DocumentIcon /> TERMS
            </span>
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold text-gray-900 sm:text-4xl">
            Terms & <span className="text-[#4C00C2]">Conditions</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: July 2026</p>

          <div className="mt-8 space-y-6 text-gray-700 leading-relaxed text-sm">
            {sections.map((section, i) => (
              <section
                key={i}
                className="rounded-2xl border-b-[4px] border-gray-200 bg-gray-50 p-5 transition-all duration-75 hover:shadow-sm"
              >
                <h2 className="font-display text-lg font-bold text-gray-900">{section.title}</h2>
                <p className="mt-2">{section.content}</p>
              </section>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
