/**
 * Envio Event Handler for Delegation Events
 * Reference: https://docs.envio.dev/docs/HyperIndex/tutorial-op-bridge-deposits
 */

import { Delegation, SmartAccount } from '../generated/schema';
import { updateGlobalStats } from './smartAccountHandler';

/**
 * Handler for DelegationCreated event
 * Triggered when a delegation is created
 */
export async function handleDelegationCreated(event: any, context: any) {
  const { delegator, delegate, delegationHash } = event.params;
  const { timestamp, transactionHash } = event;

  console.log('Processing DelegationCreated event:', delegationHash);

  // Load SmartAccount entity
  const smartAccount = await context.SmartAccount.get(delegator.toLowerCase());

  if (!smartAccount) {
    console.warn('SmartAccount not found for delegation:', delegator);
    return;
  }

  // Create Delegation entity
  const delegation = new Delegation({
    id: delegationHash,
    delegator: smartAccount,
    delegatorAddress: delegator.toLowerCase(),
    delegate: delegate.toLowerCase(),
    delegationHash,
    createdAt: BigInt(timestamp),
    createdTxHash: transactionHash,
    isActive: true,
    type: 'OPEN', // Default to OPEN, can be enhanced with more logic
  });

  await context.Delegation.set(delegation);

  // Update global stats
  await updateGlobalStats(context, {
    incrementDelegations: 1,
    timestamp,
  });

  console.log('Delegation created:', delegationHash);
}

/**
 * Handler for DelegationRedeemed event
 * Triggered when a delegation is redeemed by the delegate
 */
export async function handleDelegationRedeemed(event: any, context: any) {
  const { delegate, delegationHash } = event.params;
  const { timestamp, transactionHash } = event;

  console.log('Processing DelegationRedeemed event:', delegationHash);

  // Load Delegation entity
  const delegation = await context.Delegation.get(delegationHash);

  if (delegation) {
    // Update redemption info
    delegation.redeemedAt = BigInt(timestamp);
    delegation.redeemedTxHash = transactionHash;

    await context.Delegation.set(delegation);
    console.log('Delegation redeemed:', delegationHash);
  } else {
    console.warn('Delegation not found for redemption:', delegationHash);
  }
}

/**
 * Handler for DelegationRevoked event
 * Triggered when a delegation is revoked by the delegator
 */
export async function handleDelegationRevoked(event: any, context: any) {
  const { delegator, delegationHash } = event.params;
  const { timestamp, transactionHash } = event;

  console.log('Processing DelegationRevoked event:', delegationHash);

  // Load Delegation entity
  const delegation = await context.Delegation.get(delegationHash);

  if (delegation) {
    // Update revocation info
    delegation.revokedAt = BigInt(timestamp);
    delegation.revokedTxHash = transactionHash;
    delegation.isActive = false;

    await context.Delegation.set(delegation);
    console.log('Delegation revoked:', delegationHash);
  } else {
    console.warn('Delegation not found for revocation:', delegationHash);
  }
}
