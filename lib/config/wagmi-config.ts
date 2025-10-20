import { http, createConfig } from 'wagmi';
import { monadTestnet } from './monad-chain';
import { injected } from 'wagmi/connectors';

/**
 * Wagmi Configuration for Wallet Connection
 * Connects to Monad Testnet via injected wallet (MetaMask)
 */
export const config = createConfig({
  chains: [monadTestnet],
  connectors: [
    injected(), // Auto-detects MetaMask and other injected wallets
  ],
  transports: {
    [monadTestnet.id]: http(),
  },
  ssr: true, // Enable SSR support
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
