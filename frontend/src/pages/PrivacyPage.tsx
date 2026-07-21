import { motion } from "framer-motion";
import SEO from "@/components/seo/SEO";

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

const sections = [
  {
    title: "1. Information We Collect",
    content: "We collect information you provide during registration including your name, email address, date of birth, and payment details. We also collect usage data such as IP address, browser type, device information, and gameplay statistics to improve our services.",
  },
  {
    title: "2. How We Use Your Information",
    content: "Your information is used to operate your account, process transactions, verify your identity, comply with legal obligations, and provide customer support. We may also use anonymised data for analytics and service improvement.",
  },
  {
    title: "3. Data Protection",
    content: "We implement industry-standard security measures including SSL encryption, firewalls, and secure servers to protect your personal data. Access to your information is restricted to authorised personnel only.",
  },
  {
    title: "4. Data Sharing",
    content: "We do not sell your personal information to third parties. We may share your data with trusted service providers for payment processing, identity verification, and fraud prevention, subject to strict confidentiality agreements.",
  },
  {
    title: "5. Cookies",
    content: "Our website uses cookies to enhance your experience, remember your preferences, and analyse site traffic. You can control cookie settings through your browser. Disabling cookies may affect website functionality.",
  },
  {
    title: "6. Your Rights",
    content: "You have the right to access, correct, or delete your personal data at any time. You may also request a copy of the data we hold about you. To exercise these rights, contact our Data Protection Officer.",
  },
  {
    title: "7. Data Retention",
    content: "We retain your personal data for as long as your account is active and for a minimum of five years after account closure to comply with regulatory requirements.",
  },
  {
    title: "8. Changes to This Policy",
    content: "We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on our website and, where appropriate, by email.",
  },
  {
    title: "9. Contact Us",
    content: (
      <>
        If you have any questions about this Privacy Policy, please contact us at{' '}
        <a href="mailto:support@247vegas.live" className="text-[#4C00C2] hover:text-[#3d009e] font-medium">
          support@247vegas.live
        </a>.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <SEO title="Privacy Policy – 247 Vegas" ogUrl="https://247vegas.live/privacy" />
      <motion.div
        className="mx-auto max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="rounded-[24px] border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] sm:p-12">
          <div className="inline-block rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-2 text-sm font-bold text-white shadow-sm">
            <span className="flex items-center gap-2">
              <LockIcon /> PRIVACY
            </span>
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold text-gray-900 sm:text-4xl">
            Privacy <span className="text-[#4C00C2]">Policy</span>
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
