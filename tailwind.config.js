export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Contraste (WCAG AA, 4,5:1): a paleta padrão deixava o texto secundário e o verde dos botões claros demais.
        // Estes tons ficam um passo mais escuros só onde isso importa.
        slate: { 400: '#64748b' },
        emerald: { 500: '#059669', 600: '#047857' },
        rose: { 600: '#be123c' },
      },
    },
  },
  plugins: [],
}
