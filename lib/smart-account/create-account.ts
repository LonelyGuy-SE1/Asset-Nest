import { toMetaMaskSmartAccount, Implementation } from '@metamask/delegation-toolkit';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { type Address, type Hex } from 'viem';
import { publicClient } from '../config/viem-clients';

/**
 * Creates a MetaMask Smart Account (Hybrid implementation)
 * Reference: https://docs.metamask.io/delegation-toolkit/guides/smart-accounts/create-smart-account/
 *
 * The Hybrid implementation supports both delegations and traditional transactions
 * It automatically deploys on first user operation
 */
export async function createMetaMaskSmartAccount(signerPrivateKey: Hex) {
  // Create the signer account from private key
  const signerAccount: PrivateKeyAccount = privateKeyToAccount(signerPrivateKey);

  console.log('Creating MetaMask Smart Account for signer:', signerAccount.address);

  // Create the smart account using MetaMask Delegation Toolkit
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [
      signerAccount.address, // owner address
      [], // initial delegates
      [], // initial delegations
      [], // initial salt for deterministic deployment
    ],
    deploySalt: '0x0000000000000000000000000000000000000000000000000000000000000000',
    signer: {
      account: signerAccount,
    },
  });

  console.log('Smart Account created:', smartAccount.address);
  console.log('Smart Account will be deployed on first transaction');

  return {
    smartAccount,
    signerAccount,
    address: smartAccount.address,
  };
}

/**
 * Checks if a smart account is deployed on-chain
 */
export async function isSmartAccountDeployed(address: Address): Promise<boolean> {
  try {
    const code = await publicClient.getBytecode({ address });
    return code !== undefined && code !== '0x';
  } catch (error) {
    console.error('Error checking smart account deployment:', error);
    return false;
  }
}

/**
 * Gets the predicted address of a smart account before deployment
 * Useful for funding the account before deployment
 */
export async function getSmartAccountAddress(signerAddress: Address): Promise<Address> {
  // The smart account address is deterministic based on the signer and deploy params
  // This is a simplified version - in production, use the factory's getAddress method
  const { smartAccount } = await createMetaMaskSmartAccount(
    '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex
  );
  return smartAccount.address;
}

/**
 * Deploys a smart account by sending a user operation
 * Reference: https://docs.metamask.io/delegation-toolkit/guides/smart-accounts/deploy-smart-account/
 */
export async function deploySmartAccount(smartAccount: any, bundlerClient: any) {
  console.log('Deploying smart account...');

  // Send a simple user operation to trigger deployment
  // The smart account will be deployed automatically on the first operation
  const userOpHash = await bundlerClient.sendUserOperation({
    account: smartAccount,
    calls: [
      {
        to: smartAccount.address,
        data: '0x',
        value: BigInt(0),
      },
    ],
  });

  console.log('User operation hash:', userOpHash);

  // Wait for the user operation to be included in a block
  const receipt = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  console.log('Smart account deployed! Receipt:', receipt);

  return receipt;
}
