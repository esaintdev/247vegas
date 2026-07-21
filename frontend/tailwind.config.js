/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Casino brand colors
        casino: {
          gold: "#FFD700",
          green: {
            felt: "#1B5E20",
            light: "#2E7D32",
          },
          dark: {
            DEFAULT: "#0D1117",
            card: "#161B22",
            surface: "#1C2333",
            border: "#30363D",
          },
          red: {
            DEFAULT: "#DC2626",
            bright: "#FF4444",
          },
          accent: "#58A6FF",
        },
      },
      fontFamily: {
        display: ['"Sofia Sans"', 'sans-serif'],
        body: ['"Sofia Sans"', 'sans-serif'],
        mono: ['"Sofia Sans"', 'monospace'],
      },
      animation: {
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "bounce-gentle": "bounceGentle 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(255, 215, 0, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(255, 215, 0, 0.6)" },
        },
        bounceGentle: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};
