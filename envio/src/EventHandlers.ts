/**
 * Envio Event Handlers for Asset Nest
 * Reference: https://docs.envio.dev/docs/HyperIndex/tutorial-op-bridge-deposits
 *
 * Handles ERC-4337 UserOperation events from MetaMask Smart Accounts
 */

import {
  EntryPoint,
  UserOperation,
  SmartAccount,
  AccountDeployment,
  GlobalStats,
} from '../generated';

/**
 * Handler for UserOperationEvent
 * Triggered when a user operation is executed
 */
EntryPoint.UserOperationEvent.handler(async ({ event, context }) => {
  const { userOpHash, sender, paymaster, nonce, success, actualGasCost, actualGasUsed } =
    event.params;

  console.log('Processing UserOperationEvent:', userOpHash);

  // Create or update SmartAccount
  let smartAccount = await context.SmartAccount.get(sender.toLowerCase());

  if (!smartAccount) {
    // First time seeing this smart account
    smartAccount = {
      id: sender.toLowerCase(),
      address: sender.toLowerCase(),
      factory: null,
      deployedAt: null,
      deploymentTxHash: null,
      totalOperations: 0,
      totalGasUsed: BigInt(0),
      firstSeenAt: BigInt(event.block.timestamp),
      lastActivityAt: BigInt(event.block.timestamp),
    };

    console.log('New smart account discovered:', sender);

    // Update global stats - new account
    await updateGlobalStats(context, {
      incrementAccounts: 1,
      timestamp: event.block.timestamp,
    });
  }

  // Update smart account stats
  smartAccount.totalOperations += 1;
  smartAccount.totalGasUsed = smartAccount.totalGasUsed + BigInt(actualGasUsed.toString());
  smartAccount.lastActivityAt = BigInt(event.block.timestamp);

  await context.SmartAccount.set(smartAccount);

  // Create UserOperation record
  const userOperation: UserOperation = {
    id: userOpHash,
    userOpHash,
    sender: sender.toLowerCase(),
    paymaster: paymaster ? paymaster.toLowerCase() : null,
    nonce: BigInt(nonce.toString()),
    success,
    actualGasCost: BigInt(actualGasCost.toString()),
    actualGasUsed: BigInt(actualGasUsed.toString()),
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  await context.UserOperation.set(userOperation);

  // Update global stats
  await updateGlobalStats(context, {
    incrementOperations: 1,
    incrementSuccessful: success ? 1 : 0,
    incrementFailed: !success ? 1 : 0,
    addGasUsed: BigInt(actualGasUsed.toString()),
    timestamp: event.block.timestamp,
  });

  console.log('UserOperation indexed:', userOpHash);
});

/**
 * Handler for AccountDeployed event
 * Triggered when a smart account is deployed
 */
EntryPoint.AccountDeployed.handler(async ({ event, context }) => {
  const { userOpHash, sender, factory, paymaster } = event.params;

  console.log('Processing AccountDeployed:', sender);

  // Update SmartAccount with deployment info
  let smartAccount = await context.SmartAccount.get(sender.toLowerCase());

  if (smartAccount) {
    smartAccount.factory = factory.toLowerCase();
    smartAccount.deployedAt = BigInt(event.block.timestamp);
    smartAccount.deploymentTxHash = event.transaction.hash;

    await context.SmartAccount.set(smartAccount);
  }

  // Create AccountDeployment record
  const deployment: AccountDeployment = {
    id: userOpHash,
    userOpHash,
    sender: sender.toLowerCase(),
    factory: factory.toLowerCase(),
    paymaster: paymaster ? paymaster.toLowerCase() : null,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  await context.AccountDeployment.set(deployment);

  console.log('Account deployment indexed:', sender);
});

/**
 * Helper function to update global statistics
 */
async function updateGlobalStats(
  context: any,
  updates: {
    incrementAccounts?: number;
    incrementOperations?: number;
    incrementSuccessful?: number;
    incrementFailed?: number;
    addGasUsed?: bigint;
    timestamp: number;
  }
) {
  const globalId = 'global';
  let stats = await context.GlobalStats.get(globalId);

  if (!stats) {
    // Initialize global stats
    stats = {
      id: globalId,
      totalSmartAccounts: 0,
      totalUserOperations: 0,
      totalSuccessfulOperations: 0,
      totalFailedOperations: 0,
      totalGasUsed: BigInt(0),
      lastUpdatedAt: BigInt(updates.timestamp),
    };
  }

  // Apply updates
  if (updates.incrementAccounts) {
    stats.totalSmartAccounts += updates.incrementAccounts;
  }
  if (updates.incrementOperations) {
    stats.totalUserOperations += updates.incrementOperations;
  }
  if (updates.incrementSuccessful) {
    stats.totalSuccessfulOperations += updates.incrementSuccessful;
  }
  if (updates.incrementFailed) {
    stats.totalFailedOperations += updates.incrementFailed;
  }
  if (updates.addGasUsed) {
    stats.totalGasUsed = stats.totalGasUsed + updates.addGasUsed;
  }

  stats.lastUpdatedAt = BigInt(updates.timestamp);

  await context.GlobalStats.set(stats);
}
