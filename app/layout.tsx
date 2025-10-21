import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ActivityLogs } from "@/components/ActivityLogs";

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
        {/* Background Image */}
        <div
          className="fixed inset-0 w-full h-full pointer-events-none"
          style={{
            backgroundImage: "url(/back.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "blur(25px)",
            opacity: 0.12,
            zIndex: -10,
          }}
        />
        <Providers>
          <div className="min-h-screen relative bg-black/90">
            <main className="container mx-auto px-4 py-8">{children}</main>
            <ActivityLogs />
          </div>
        </Providers>
      </body>
    </html>
  );
}
