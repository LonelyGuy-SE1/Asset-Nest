/**
 * ERC20 Token Approval Handler
 * Handle approvals for Monorail swaps
 */

import { type Address } from 'viem';

// ERC20 ABI for approve function
export const ERC20_ABI = [
  {
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
];

/**
 * Check if token approval is needed
 */
export async function checkTokenApproval(
  tokenAddress: Address,
  ownerAddress: Address,
  spenderAddress: Address,
  requiredAmount: string,
  decimals: number = 18
): Promise<{
  isApprovalNeeded: boolean;
  currentAllowance: string;
  requiredAmount: string;
  approvalAmountWei: bigint;
}> {
  if (!window.ethereum) {
    throw new Error('MetaMask not found');
  }

  try {
    // Clean addresses
    const cleanOwnerAddress = ownerAddress.toLowerCase().startsWith('0x') 
      ? ownerAddress.slice(2) 
      : ownerAddress;
    const cleanSpenderAddress = spenderAddress.toLowerCase().startsWith('0x')
      ? spenderAddress.slice(2)
      : spenderAddress;
    const cleanTokenAddress = tokenAddress.toLowerCase().startsWith('0x')
      ? tokenAddress
      : `0x${tokenAddress}`;
    
    // Get current allowance using allowance(owner, spender) function
    // Function selector: 0xdd62ed3e
    const allowanceData = '0xdd62ed3e' +
      cleanOwnerAddress.padStart(64, '0') +
      cleanSpenderAddress.padStart(64, '0');
    
    const allowanceResult = await window.ethereum.request({
      method: 'eth_call',
      params: [{
        to: cleanTokenAddress,
        data: allowanceData
      }, 'latest']
    });

    const currentAllowanceWei = BigInt(allowanceResult || '0');
    const requiredAmountWei = BigInt(parseFloat(requiredAmount) * Math.pow(10, decimals));
    
    const isApprovalNeeded = currentAllowanceWei < requiredAmountWei;
    
    return {
      isApprovalNeeded,
      currentAllowance: (Number(currentAllowanceWei) / Math.pow(10, decimals)).toString(),
      requiredAmount,
      approvalAmountWei: requiredAmountWei
    };
  } catch (error: any) {
    throw new Error(`Failed to check approval: ${error.message}`);
  }
}

/**
 * Execute token approval using ethers-style encoding
 */
export async function approveToken(
  tokenAddress: Address,
  spenderAddress: Address,
  amount: bigint
): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask not found');
  }

  // Validate inputs
  if (!tokenAddress) {
    throw new Error('tokenAddress is required');
  }
  if (!spenderAddress) {
    throw new Error('spenderAddress is required');
  }
  if (!amount) {
    throw new Error('amount is required');
  }

  try {
    // Use a much simpler approach with pre-built transaction
    // Let MetaMask handle the encoding
    const txParams = {
      to: tokenAddress,
      from: await window.ethereum.request({ method: 'eth_requestAccounts' }).then((accounts: string[]) => accounts[0]),
      data: '0x095ea7b3' + 
            spenderAddress.slice(2).toLowerCase().padStart(64, '0') + 
            amount.toString(16).padStart(64, '0'),
      gas: '0x15f90', // 90000 gas
    };
    
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [txParams]
    });
    return txHash;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    throw new Error(`Approval failed: ${errorMessage}`);
  }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(txHash: string, maxAttempts: number = 30): Promise<boolean> {
  if (!window.ethereum) {
    throw new Error('MetaMask not found');
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      });

      if (receipt) {
        return receipt.status === '0x1'; // Success
      }

      // Wait 2 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.warn(`Attempt ${attempt + 1} failed:`, error);
    }
  }

  throw new Error('Transaction confirmation timeout');
}