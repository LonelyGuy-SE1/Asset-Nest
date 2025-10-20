import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Asset Nest - AI Portfolio Rebalancer',
  description: 'AI-powered smart portfolio rebalancer on Monad using MetaMask Smart Accounts',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-vscode-bg">
          <header className="bg-vscode-sidebar border-b border-vscode-border">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl font-bold text-vscode-accent">Asset Nest</div>
                  <div className="text-sm text-vscode-text/60">
                    AI Portfolio Rebalancer on Monad
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="status-dot status-success"></span>
                  <span className="text-sm">Monad Testnet</span>
                </div>
              </div>
            </div>
          </header>
          <main className="container mx-auto px-4 py-8">{children}</main>
          <footer className="bg-vscode-sidebar border-t border-vscode-border mt-12">
            <div className="container mx-auto px-4 py-6 text-center text-sm text-vscode-text/60">
              <p>
                Built with MetaMask Smart Accounts, Monad, Monorail, and AI |{' '}
                <a
                  href="https://docs.metamask.io/delegation-toolkit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vscode-accent hover:underline"
                >
                  Documentation
                </a>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
