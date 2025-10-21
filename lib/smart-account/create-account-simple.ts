/**
 * MetaMask Smart Account Creation - Corrected Implementation
 * Based on official MetaMask Delegation Toolkit documentation
 * Reference: https://docs.metamask.io/delegation-toolkit/get-started/smart-account-quickstart/
 */
import { toMetaMaskSmartAccount, Implementation } from '@metamask/delegation-toolkit';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { type Hex } from 'viem';
import { publicClient } from '../config/viem-clients';

/**
 * Creates a MetaMask Smart Account following official documentation
 */
export async function createMetaMaskSmartAccountSimple(signerPrivateKey: Hex) {
  console.log('Creating MetaMask smart account...');
  
  // Create the signer account from private key
  const account = privateKeyToAccount(signerPrivateKey);
  console.log('Signer account:', account.address);

  // Create the smart account exactly as shown in MetaMask docs
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [account.address, [], [], []],
    deploySalt: "0x",
    signer: { account },
  });

  console.log('Smart account created:', smartAccount.address);

  return {
    smartAccount,
    signerAccount: account,
    address: smartAccount.address,
  };
}