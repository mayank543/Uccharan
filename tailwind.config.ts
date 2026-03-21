import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./popup.tsx", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        mist: "#f4f7fb",
        brand: "#0f766e",
        accent: "#f97316"
      },
      boxShadow: {
        card: "0 20px 45px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
}

export default config
