import { createPublicClient, http, createWalletClient, type PublicClient } from 'viem';
import { createBundlerClient, type BundlerClient } from 'viem/account-abstraction';
import { monadTestnet } from './monad-chain';

/**
 * Creates a Viem Public Client for interacting with Monad Testnet
 * Reference: https://docs.metamask.io/delegation-toolkit/get-started/install/
 */
export function createMonadPublicClient(): PublicClient {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'),
  });
}

/**
 * Creates a Bundler Client for ERC-4337 UserOperations
 * This enables gas abstraction for MetaMask Smart Accounts
 *
 * Using Pimlico as the bundler service for Monad
 * Alternative: Use MetaMask's bundler or Alchemy's AccountKit
 * Reference: https://docs.metamask.io/delegation-toolkit/guides/smart-accounts/send-gasless-transaction/
 */
export function createMonadBundlerClient(publicClient: PublicClient): BundlerClient {
  const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_RPC_URL || 'http://localhost:3000/bundler';

  return createBundlerClient({
    client: publicClient,
    transport: http(bundlerUrl),
  });
}

/**
 * Creates a wallet client for signing operations
 * Used primarily for EOA interactions before smart account deployment
 */
export function createMonadWalletClient() {
  return createWalletClient({
    chain: monadTestnet,
    transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'),
  });
}

// Export singleton instances
export const publicClient = createMonadPublicClient();
export const bundlerClient = createMonadBundlerClient(publicClient);
export const walletClient = createMonadWalletClient();
