import { monadTestnet } from '@/lib/config/monad-chain';

/**
 * Chain utilities for handling network switching and validation
 */

export const MONAD_TESTNET_CHAIN_ID = 10143;

/**
 * Checks if the current chain is Monad Testnet
 */
export function isMonadTestnet(chainId: number | undefined): boolean {
  return chainId === MONAD_TESTNET_CHAIN_ID;
}

/**
 * Requests the user to switch to Monad Testnet
 */
export async function switchToMonadTestnet(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not detected');
  }

  try {
    // Try to switch to Monad Testnet
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${MONAD_TESTNET_CHAIN_ID.toString(16)}` }], // 0x279F
    });
    return true;
  } catch (switchError: any) {
    // If the chain doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${MONAD_TESTNET_CHAIN_ID.toString(16)}`,
              chainName: monadTestnet.name,
              nativeCurrency: monadTestnet.nativeCurrency,
              rpcUrls: [monadTestnet.rpcUrls.default.http[0]],
              blockExplorerUrls: [monadTestnet.blockExplorers?.default.url],
            },
          ],
        });
        return true;
      } catch (addError) {
        console.error('Error adding Monad Testnet:', addError);
        throw new Error('Failed to add Monad Testnet to wallet');
      }
    } else {
      console.error('Error switching to Monad Testnet:', switchError);
      throw new Error('Failed to switch to Monad Testnet');
    }
  }
}

/**
 * Gets a user-friendly error message for chain-related issues
 */
export function getChainErrorMessage(currentChainId: number | undefined): string {
  if (!currentChainId) {
    return 'Please connect your wallet first';
  }
  
  if (currentChainId !== MONAD_TESTNET_CHAIN_ID) {
    return `Please switch to Monad Testnet (Chain ID: ${MONAD_TESTNET_CHAIN_ID}). Currently on chain ${currentChainId}`;
  }
  
  return 'Unknown chain error';
}

/**
 * Validates that the user is on the correct chain before proceeding
 */
export function validateChain(chainId: number | undefined): boolean {
  if (!isMonadTestnet(chainId)) {
    throw new Error(getChainErrorMessage(chainId));
  }
  return true;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}