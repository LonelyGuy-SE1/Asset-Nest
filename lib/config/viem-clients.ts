import { createPublicClient, http, createWalletClient, type PublicClient } from 'viem';
import { createBundlerClient, type BundlerClient } from 'viem/account-abstraction';
import { monadTestnet } from './monad-chain';

/**
 * Creates a Viem Public Client for interacting with Monad Testnet
 * Reference: https://docs.metamask.io/delegation-toolkit/get-started/install/
 */
export function createMonadPublicClient(): PublicClient {
  const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
  
  console.log('Creating public client for Monad Testnet');
  console.log('Chain ID:', monadTestnet.id);
  console.log('RPC URL:', rpcUrl);
  
  return createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl, {
      retryCount: 3,
      retryDelay: 1000,
    }),
  });
}

/**
 * Creates a Bundler Client for ERC-4337 UserOperations
 * Following MetaMask documentation pattern
 * Reference: https://docs.metamask.io/delegation-toolkit/get-started/smart-account-quickstart/
 */
export function createMonadBundlerClient(publicClient: PublicClient): BundlerClient {
  // Use environment variable or placeholder
  const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_RPC_URL || 'https://your-bundler-rpc.com';

  console.log('Creating bundler client');
  console.log('Bundler URL configured');

  return createBundlerClient({
    client: publicClient,
    transport: http(bundlerUrl, {
      retryCount: 3,
      retryDelay: 1000,
    }),
  });
}

/**
 * Creates a wallet client for signing operations
 * Used primarily for EOA interactions before smart account deployment
 */
export function createMonadWalletClient() {
  const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
  
  console.log('Creating wallet client for Monad Testnet');
  
  return createWalletClient({
    chain: monadTestnet,
    transport: http(rpcUrl, {
      retryCount: 3,
      retryDelay: 1000,
    }),
  });
}

// Export singleton instances
export const publicClient = createMonadPublicClient();
export const bundlerClient = createMonadBundlerClient(publicClient);
export const walletClient = createMonadWalletClient();
