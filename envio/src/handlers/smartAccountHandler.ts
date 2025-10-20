/**
 * Envio Event Handler for Smart Account Events
 * Reference: https://docs.envio.dev/docs/HyperIndex/tutorial-op-bridge-deposits
 */

import { SmartAccount, GlobalStats } from '../generated/schema';

/**
 * Handler for AccountCreated event
 * Triggered when a new smart account is created
 */
export async function handleAccountCreated(event: any, context: any) {
  const { account, owner } = event.params;
  const { timestamp, blockNumber, transactionHash } = event;

  console.log('Processing AccountCreated event:', account);

  // Create SmartAccount entity
  const smartAccount = new SmartAccount({
    id: account.toLowerCase(),
    owner: owner.toLowerCase(),
    isDeployed: false,
    createdAt: BigInt(timestamp),
    totalTrades: 0,
    totalVolume: 0,
    delegations: [],
    trades: [],
  });

  await context.SmartAccount.set(smartAccount);

  // Update global stats
  await updateGlobalStats(context, {
    incrementSmartAccounts: 1,
    timestamp,
  });

  console.log('SmartAccount created:', account);
}

/**
 * Handler for AccountDeployed event
 * Triggered when a smart account is deployed on-chain
 */
export async function handleAccountDeployed(event: any, context: any) {
  const { account } = event.params;
  const { timestamp, blockNumber, transactionHash } = event;

  console.log('Processing AccountDeployed event:', account);

  // Load existing SmartAccount entity
  const smartAccount = await context.SmartAccount.get(account.toLowerCase());

  if (smartAccount) {
    // Update deployment status
    smartAccount.isDeployed = true;
    smartAccount.deployedAt = BigInt(timestamp);
    smartAccount.deploymentTxHash = transactionHash;

    await context.SmartAccount.set(smartAccount);
    console.log('SmartAccount deployed:', account);
  } else {
    console.warn('SmartAccount not found for deployment:', account);
  }
}

/**
 * Helper function to update global statistics
 */
async function updateGlobalStats(context: any, updates: any) {
  const globalId = 'global';
  let stats = await context.GlobalStats.get(globalId);

  if (!stats) {
    // Initialize global stats if it doesn't exist
    stats = new GlobalStats({
      id: globalId,
      totalSmartAccounts: 0,
      totalDelegations: 0,
      totalTrades: 0,
      totalVolumeUSD: 0,
      totalRebalancingEvents: 0,
      lastUpdatedAt: BigInt(updates.timestamp),
    });
  }

  // Apply updates
  if (updates.incrementSmartAccounts) {
    stats.totalSmartAccounts += updates.incrementSmartAccounts;
  }
  if (updates.incrementDelegations) {
    stats.totalDelegations += updates.incrementDelegations;
  }
  if (updates.incrementTrades) {
    stats.totalTrades += updates.incrementTrades;
  }
  if (updates.addVolume) {
    stats.totalVolumeUSD += updates.addVolume;
  }
  if (updates.incrementRebalancings) {
    stats.totalRebalancingEvents += updates.incrementRebalancings;
  }

  stats.lastUpdatedAt = BigInt(updates.timestamp);

  await context.GlobalStats.set(stats);
}

export { updateGlobalStats };
