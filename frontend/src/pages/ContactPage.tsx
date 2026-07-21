import { motion } from "framer-motion";
import SEO from "@/components/seo/SEO";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

const contactMethods = [
  {
    title: "Email",
    desc: "For general inquiries and support",
    value: "support@247vegas.live",
    href: "mailto:support@247vegas.live",
    icon: <MailIcon />,
  },
  {
    title: "Phone",
    desc: "Speak to our support team",
    value: "+44 800 123 4567",
    icon: <PhoneIcon />,
  },
  {
    title: "Live Chat",
    desc: "Instant messaging with our team",
    value: "Available 24/7",
    accent: "text-emerald-600",
    icon: <ChatIcon />,
  },
  {
    title: "Address",
    desc: "Registered office",
    value: ["The Unicorn Centre", "Triq il-Uqija, Swieqi", "SWQ 2335, Malta"],
    icon: <LocationIcon />,
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <SEO title="Contact Us – 247 Vegas Support" ogUrl="https://247vegas.live/contact" />
      <motion.div
        className="mx-auto max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="rounded-[24px] border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] sm:p-12">
          <div className="inline-block rounded-full border-b-[4px] border-[#3d009e] bg-[#4C00C2] px-6 py-2 text-sm font-bold text-white shadow-sm">
            CONTACT
          </div>
          <h1 className="font-display mt-6 text-3xl font-bold text-gray-900 sm:text-4xl">
            Contact <span className="text-[#4C00C2]">Us</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">We're here to help 24/7</p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {contactMethods.map((method) => (
              <div
                key={method.title}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-6 transition-all duration-75 active:translate-y-[4px] hover:shadow-md"
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[18px] border-b-[4px] border-[#3d009e] bg-[#4C00C2] text-xl text-white shadow-sm">
                  {method.icon}
                </div>
                <h2 className="font-display text-lg font-bold text-gray-900">{method.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{method.desc}</p>
                {method.href ? (
                  <a
                    href={method.href}
                    className="mt-2 inline-block text-sm font-medium text-[#4C00C2] hover:text-[#3d009e]"
                  >
                    {method.value}
                  </a>
                ) : Array.isArray(method.value) ? (
                  <p className="mt-2 text-sm text-gray-900">
                    {method.value.map((line, i) => (
                      <span key={i}>
                        {line}
                        {i < method.value.length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className={`mt-2 text-sm font-medium ${method.accent || "text-gray-900"}`}>
                    {method.value}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border-b-[4px] border-[#3d009e]/20 bg-[#4C00C2]/5 p-6">
            <h2 className="font-display text-lg font-bold text-gray-900">Get in Touch</h2>
            <p className="mt-1 text-sm text-gray-500">
              Our customer support team is available 24 hours a day, 7 days a week.
              We aim to respond to all inquiries within 2 hours during business hours.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
