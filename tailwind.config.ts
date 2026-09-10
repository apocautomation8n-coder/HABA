import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        haba: {
          // Primarios
          primary:        "#3BB578", // Verde CTA principal
          primaryHover:   "#2E9E65", // Hover de botones
          primaryText:    "#1F7A4C", // Texto verde fuerte
          // Highlights y fondos suaves
          highlight:      "#DCF4D7", // Bg highlight / fondo suave
          highlightBorder:"#C3EBC0", // Borde sobre highlight
          // Fondos de app
          bg:             "#F6F7F2", // Fondo general de la app
          card:           "#FFFFFF", // Tarjetas, inputs, modales
          border:         "#EAF0E8", // Bordes suaves
          // Textos
          textMain:       "#2B2B2B", // Texto principal
          textSub:        "#7A7A7A", // Texto secundario
          // Pasteles de apoyo (dashboard accesos directos)
          pastelGreen:    "#E4F5E2",
          pastelPink:     "#FFE3E3",
          pastelYellow:   "#FFF2CE",
          pastelLila:     "#EBDDF9",
        },
      },
      fontFamily: {
        display: ["var(--font-fredoka)", "Fredoka", "system-ui", "sans-serif"],
        body:    ["var(--font-nunito)",  "Nunito",  "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
