import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Asset Nest - AI Portfolio Rebalancer",
  description:
    "AI-powered smart portfolio rebalancer on Monad using MetaMask Smart Accounts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen bg-black">
            <header className="bg-black border-b-2 border-cyan-400">
              <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl font-bold neon-text">
                      ASSET NEST
                    </div>
                    <div className="text-sm text-gray-300">
                      AI Portfolio Rebalancer on Monad
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="status-dot status-success"></span>
                    <span className="text-sm text-white">Monad Testnet</span>
                  </div>
                </div>
              </div>
            </header>
            <main className="container mx-auto px-4 py-8">{children}</main>
            <footer className="bg-black border-t-2 border-cyan-400 mt-12">
              <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-300">
                <p>
                  Built with MetaMask Smart Accounts, Monad, Monorail, and AI |{" "}
                  <a
                    href="https://docs.metamask.io/delegation-toolkit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    Documentation
                  </a>
                </p>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
