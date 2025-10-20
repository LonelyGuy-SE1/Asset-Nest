import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'vscode-bg': '#1e1e1e',
        'vscode-sidebar': '#252526',
        'vscode-panel': '#2d2d30',
        'vscode-accent': '#007acc',
        'vscode-text': '#cccccc',
        'vscode-border': '#3e3e42',
      },
    },
  },
  plugins: [],
}
export default config
