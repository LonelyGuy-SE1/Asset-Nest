import { http, createConfig } from 'wagmi';
import { monadTestnet } from './monad-chain';
import { injected } from 'wagmi/connectors';

/**
 * Wagmi Configuration for MetaMask Wallet Connection
 * Connects to Monad Testnet
 */
export const config = createConfig({
  chains: [monadTestnet],
  connectors: [
    injected({ target: 'metaMask' }),
  ],
  transports: {
    [monadTestnet.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
