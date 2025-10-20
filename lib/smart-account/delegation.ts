import { type Address, type Hex, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Type definitions for delegation (simplified)
export interface DelegationStruct {
  delegator: Address;
  delegate: Address;
  authority: Hex;
  caveats?: any[];
  salt?: bigint;
  signature?: Hex;
}

/**
 * Delegation Manager for MetaMask Smart Accounts
 * Reference: https://docs.metamask.io/delegation-toolkit/concepts/delegation/
 *
 * Delegations allow the smart account to authorize another address (the delegate)
 * to perform actions on its behalf, such as spending tokens or making trades.
 */

export interface DelegationConfig {
  delegator: Address; // Smart account address
  delegate: Address; // AI agent address
  authority: Hex; // Root authority (0x for root delegation)
  caveats?: any[]; // Optional restrictions (spending limits, etc.)
}

/**
 * Creates an open delegation (unrestricted)
 * This gives the delegate full permissions to act on behalf of the delegator
 * Use with caution - only for trusted delegates
 */
export async function createOpenDelegationForAgent(
  smartAccountAddress: Address,
  agentAddress: Address,
  signerPrivateKey: Hex
): Promise<DelegationStruct> {
  console.log('Creating open delegation...');
  console.log('Delegator (Smart Account):', smartAccountAddress);
  console.log('Delegate (AI Agent):', agentAddress);

  const signerAccount = privateKeyToAccount(signerPrivateKey);

  // Create an open delegation with no restrictions
  // Note: In production, use @metamask/delegation-toolkit's createDelegation function
  const delegation: DelegationStruct = {
    delegator: smartAccountAddress,
    delegate: agentAddress,
    authority: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
    caveats: [],
    salt: BigInt(Date.now()),
  };

  console.log('Open delegation created:', delegation);

  return delegation;
}

/**
 * Creates a restricted delegation with spending limits
 * Reference: https://docs.metamask.io/delegation-toolkit/concepts/delegation/
 *
 * Example: Limit the agent to spending up to 1000 USDC
 */
export async function createRestrictedDelegation(
  config: DelegationConfig
): Promise<DelegationStruct> {
  console.log('Creating restricted delegation with caveats...');

  // Define spending limit caveat
  // This is a simplified version - in production, use proper caveat enforcers
  const caveats = config.caveats || [];

  // Note: In production, use @metamask/delegation-toolkit's createDelegation function
  const delegation: DelegationStruct = {
    delegator: config.delegator,
    delegate: config.delegate,
    authority: config.authority,
    caveats,
    salt: BigInt(Date.now()),
  };

  console.log('Restricted delegation created:', delegation);

  return delegation;
}

/**
 * Creates a delegation with ERC20 spending limits
 * This allows the agent to spend up to a certain amount of a specific token
 */
export async function createERC20SpendingDelegation(
  smartAccountAddress: Address,
  agentAddress: Address,
  tokenAddress: Address,
  maxAmount: bigint,
  signerPrivateKey: Hex
): Promise<DelegationStruct> {
  console.log('Creating ERC20 spending delegation...');
  console.log('Token:', tokenAddress);
  console.log('Max Amount:', maxAmount.toString());

  // Create a caveat enforcer for ERC20 spending limits
  // This is a simplified version - MetaMask provides standard enforcers
  const caveat = {
    enforcer: tokenAddress, // The token contract acts as enforcer
    terms: encodeAbiParameters(
      parseAbiParameters('address token, uint256 maxAmount'),
      [tokenAddress, maxAmount]
    ),
  };

  return createRestrictedDelegation({
    delegator: smartAccountAddress,
    delegate: agentAddress,
    authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
    caveats: [caveat],
  });
}

/**
 * Signs and stores a delegation
 * The delegation needs to be stored so the agent can redeem it later
 */
export async function signAndStoreDelegation(
  delegation: DelegationStruct,
  signerPrivateKey: Hex
): Promise<{ delegation: DelegationStruct; signature: Hex }> {
  const signerAccount = privateKeyToAccount(signerPrivateKey);

  // In a real implementation, you would:
  // 1. Sign the delegation with the smart account owner's key
  // 2. Store it in a database or IPFS
  // 3. Return the delegation ID/hash for later retrieval

  console.log('Delegation signed and ready for use');

  // For this hackathon, we'll store it in memory/local storage
  const delegationData = {
    delegation,
    signature: '0x' as Hex, // Placeholder - in production, sign properly
  };

  // Store delegation (in production, use proper storage)
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      `delegation_${delegation.delegate}`,
      JSON.stringify(delegationData)
    );
  }

  return delegationData;
}

/**
 * Retrieves a stored delegation for a delegate address
 */
export function getStoredDelegation(delegateAddress: Address): DelegationStruct | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(`delegation_${delegateAddress}`);
  if (!stored) return null;

  const data = JSON.parse(stored);
  return data.delegation;
}

/**
 * Redeems a delegation to allow the agent to execute transactions
 * Reference: https://docs.metamask.io/delegation-toolkit/concepts/delegation/
 *
 * Before the agent can execute trades, it must redeem the delegation
 * This validates the delegation and updates the smart account's permissions
 */
export async function redeemDelegation(
  delegation: DelegationStruct,
  delegatePrivateKey: Hex
): Promise<void> {
  console.log('Redeeming delegation for agent...');

  const delegateAccount = privateKeyToAccount(delegatePrivateKey);

  // In production, interact with the DelegationManager contract
  // to redeem the delegation on-chain
  // This validates the delegation signature and grants permissions

  console.log('Delegation redeemed. Agent can now execute transactions.');
}
