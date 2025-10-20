import { defineChain } from 'viem';

/**
 * Monad Testnet Chain Configuration
 * Reference: https://docs.monad.xyz/developer-essentials/
 * RPC: https://testnet-rpc.monad.xyz
 * Chain ID: 10143
 * Explorer: https://testnet.monadexplorer.com
 */
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'MonadExplorer',
      url: process.env.NEXT_PUBLIC_MONAD_EXPLORER || 'https://testnet.monadexplorer.com',
    },
  },
  testnet: true,
});

// Common token addresses on Monad Testnet
// These will need to be updated with actual deployed token addresses
export const MONAD_TOKENS = {
  MON: '0x0000000000000000000000000000000000000000', // Native token
  USDC: '0x0000000000000000000000000000000000000001', // Placeholder - update with actual USDC address
  USDT: '0x0000000000000000000000000000000000000002', // Placeholder - update with actual USDT address
  WETH: '0x0000000000000000000000000000000000000003', // Placeholder - update with actual WETH address
};

export const TOKEN_METADATA: Record<string, { symbol: string; decimals: number; name: string }> = {
  [MONAD_TOKENS.MON]: { symbol: 'MON', decimals: 18, name: 'Monad' },
  [MONAD_TOKENS.USDC]: { symbol: 'USDC', decimals: 6, name: 'USD Coin' },
  [MONAD_TOKENS.USDT]: { symbol: 'USDT', decimals: 6, name: 'Tether USD' },
  [MONAD_TOKENS.WETH]: { symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
};
