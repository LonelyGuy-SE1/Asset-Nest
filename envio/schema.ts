/**
 * Envio Schema for Asset Nest Indexer
 * Reference: https://docs.envio.dev/docs/HyperIndex/configuration-file
 *
 * Indexes ERC-4337 UserOperations from MetaMask Smart Accounts on Monad
 */

// UserOperation entity - tracks all operations from smart accounts
export interface UserOperation {
  id: string; // userOpHash
  userOpHash: string;
  sender: string; // Smart account address
  paymaster: string | null;
  nonce: bigint;
  success: boolean;
  actualGasCost: bigint;
  actualGasUsed: bigint;
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: string;
}

// SmartAccount entity - tracks smart accounts
export interface SmartAccount {
  id: string; // Smart account address
  address: string;
  factory: string | null;
  deployedAt: bigint | null;
  deploymentTxHash: string | null;
  totalOperations: number;
  totalGasUsed: bigint;
  firstSeenAt: bigint;
  lastActivityAt: bigint;
}

// AccountDeployment entity - tracks when accounts are deployed
export interface AccountDeployment {
  id: string; // userOpHash
  userOpHash: string;
  sender: string; // Smart account address
  factory: string;
  paymaster: string | null;
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: string;
}

// GlobalStats entity - aggregated statistics
export interface GlobalStats {
  id: string; // Always "global"
  totalSmartAccounts: number;
  totalUserOperations: number;
  totalSuccessfulOperations: number;
  totalFailedOperations: number;
  totalGasUsed: bigint;
  lastUpdatedAt: bigint;
}
