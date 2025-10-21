import { keccak256, toHex, Address } from 'viem';

/**
 * Generate a deterministic agent address from a wallet address
 * This ensures the same wallet always gets the same agent address
 * @param walletAddress - The user's wallet address
 * @returns A deterministic agent address
 */
export function getDeterministicAgentAddress(walletAddress: Address): Address {
  // Use keccak256 hash of wallet address + salt to generate deterministic agent address
  const salt = 'asset-nest-ai-agent-v1';
  const hash = keccak256(toHex(`${walletAddress}${salt}`));

  // Take first 20 bytes (40 hex chars) as the address
  const agentAddress = `0x${hash.slice(2, 42)}` as Address;

  return agentAddress;
}

/**
 * Generate a deterministic private key for the agent from wallet address
 * WARNING: This is for demo purposes only. In production, use proper key management.
 * @param walletAddress - The user's wallet address
 * @returns A deterministic private key (32 bytes / 64 hex chars)
 */
export function getDeterministicAgentPrivateKey(walletAddress: Address): `0x${string}` {
  // Use keccak256 hash of wallet address + different salt for private key
  const salt = 'asset-nest-ai-agent-pk-v1';
  const hash = keccak256(toHex(`${walletAddress}${salt}`));

  return hash as `0x${string}`;
}
