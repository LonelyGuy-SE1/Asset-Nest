/**
 * Permit2 Integration for Gasless Token Approvals
 * Reference: https://testnet-preview.monorail.xyz/developers/documentation
 * 
 * Monorail provides Permit2 integration for seamless user experience
 * Users can approve tokens without separate approval transactions
 */

import { type Address, type Hex } from 'viem';

export interface Permit2Signature {
  token: Address;
  amount: bigint;
  deadline: bigint;
  nonce: bigint;
  signature: Hex;
}

export interface GaslessApprovalParams {
  token: Address;
  spender: Address;
  amount: bigint;
  owner: Address;
  deadline?: bigint;
}

/**
 * Enhanced Permit2 client for gasless token approvals
 * Integrates with Monorail's Permit2 infrastructure
 */
export class Permit2Client {
  private readonly PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'; // Canonical Permit2

  /**
   * Check if token supports Permit2
   */
  async supportsPermit2(tokenAddress: Address): Promise<boolean> {
    // In production, check if token has Permit2 approval for the canonical contract
    // For Monorail integration, most tokens support it
    const permit2SupportedTokens = [
      '0xf817257fed379853cde0fa4f97ab987181b1e5ea', // USDC on Monad
      '0x0000000000000000000000000000000000000000', // Native MON (wrapped)
      // Add more Monad testnet tokens that support Permit2
    ];

    return permit2SupportedTokens.includes(tokenAddress.toLowerCase());
  }

  /**
   * Generate Permit2 signature for gasless approval
   * Used with Monorail swaps to avoid separate approval transactions
   */
  async signPermit2(
    params: GaslessApprovalParams,
    signer: any
  ): Promise<Permit2Signature> {
    const deadline = params.deadline || BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour
    const nonce = BigInt(Date.now()); // In production, get from contract

    // EIP-712 domain for Permit2
    const domain = {
      name: 'Permit2',
      chainId: 10143, // Monad Testnet
      verifyingContract: this.PERMIT2_ADDRESS as Address,
    };

    // Permit2 message structure
    const types = {
      PermitSingle: [
        { name: 'details', type: 'PermitDetails' },
        { name: 'spender', type: 'address' },
        { name: 'sigDeadline', type: 'uint256' },
      ],
      PermitDetails: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint160' },
        { name: 'expiration', type: 'uint48' },
        { name: 'nonce', type: 'uint48' },
      ],
    };

    const message = {
      details: {
        token: params.token,
        amount: params.amount,
        expiration: deadline,
        nonce,
      },
      spender: params.spender,
      sigDeadline: deadline,
    };

    console.log('Signing Permit2 for gasless approval:', {
      token: params.token,
      amount: params.amount.toString(),
      spender: params.spender,
      deadline: deadline.toString(),
    });

    // Sign the permit (this would use the user's wallet in production)
    const signature = await signer.signTypedData({
      domain,
      types,
      message,
    });

    return {
      token: params.token,
      amount: params.amount,
      deadline,
      nonce,
      signature: signature as Hex,
    };
  }

  /**
   * Prepare swap with Permit2 for Monorail
   * Combines token approval and swap in single transaction
   */
  async preparePermit2Swap(
    swapParams: {
      fromToken: Address;
      toToken: Address;
      amount: bigint;
      recipient: Address;
    },
    signer: any
  ): Promise<{
    permit2Signature: Permit2Signature;
    swapCalldata: Hex;
  }> {
    // Check if token supports Permit2
    const supportsPermit2 = await this.supportsPermit2(swapParams.fromToken);
    
    if (!supportsPermit2) {
      throw new Error(`Token ${swapParams.fromToken} does not support Permit2`);
    }

    // Generate Permit2 signature
    const permit2Signature = await this.signPermit2(
      {
        token: swapParams.fromToken,
        spender: this.PERMIT2_ADDRESS, // Monorail router will use Permit2
        amount: swapParams.amount,
        owner: swapParams.recipient,
      },
      signer
    );

    console.log('Permit2 signature generated for gasless swap');

    // Return combined data for Monorail
    return {
      permit2Signature,
      swapCalldata: '0x', // Would be actual swap calldata from Monorail
    };
  }

  /**
   * Execute gasless swap via Monorail with Permit2
   */
  async executeGaslessSwap(
    permit2Data: {
      permit2Signature: Permit2Signature;
      swapCalldata: Hex;
    },
    monorailClient: any
  ): Promise<string> {
    console.log('Executing gasless swap with Permit2 integration...');

    // In production, this would call Monorail's Permit2-enabled swap endpoint
    // Monorail handles the Permit2 approval and swap in a single transaction
    
    const swapResult = await monorailClient.executePermit2Swap({
      permit2: permit2Data.permit2Signature,
      swapData: permit2Data.swapCalldata,
    });

    console.log('Gasless swap executed via Permit2:', swapResult);
    
    return swapResult.transactionHash;
  }
}

/**
 * Gasless transaction utilities for MetaMask Smart Accounts
 */
export class GaslessTransactionManager {
  /**
   * Execute gasless user operation via bundler
   * Reference: https://docs.metamask.io/delegation-toolkit/guides/smart-accounts/send-gasless-transaction/
   */
  async executeGaslessUserOp(
    smartAccount: any,
    bundlerClient: any,
    calls: Array<{
      to: Address;
      data: Hex;
      value?: bigint;
    }>
  ): Promise<string> {
    console.log('Executing gasless user operation...');

    // MetaMask Smart Accounts support gasless transactions via bundlers
    const userOpHash = await bundlerClient.sendUserOperation({
      account: smartAccount,
      calls,
      // No maxFeePerGas/maxPriorityFeePerGas = gasless for user
    });

    console.log('Gasless user operation submitted:', userOpHash);

    // Wait for confirmation
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    console.log('Gasless transaction confirmed:', receipt.receipt.transactionHash);
    
    return receipt.receipt.transactionHash;
  }

  /**
   * Batch multiple operations into single gasless transaction
   */
  async batchGaslessOperations(
    operations: Array<{
      type: 'swap' | 'approval' | 'delegation';
      data: any;
    }>,
    smartAccount: any,
    bundlerClient: any
  ): Promise<string> {
    console.log(`Batching ${operations.length} operations into single gasless transaction`);

    const calls = operations.map(op => {
      switch (op.type) {
        case 'swap':
          return {
            to: op.data.to as Address,
            data: op.data.calldata as Hex,
            value: BigInt(op.data.value || 0),
          };
        case 'approval':
          return {
            to: op.data.token as Address,
            data: op.data.approvalCalldata as Hex,
            value: BigInt(0),
          };
        case 'delegation':
          return {
            to: op.data.delegationManager as Address,
            data: op.data.delegationCalldata as Hex,
            value: BigInt(0),
          };
        default:
          throw new Error(`Unknown operation type: ${op.type}`);
      }
    });

    return this.executeGaslessUserOp(smartAccount, bundlerClient, calls);
  }
}

// Export singletons
export const permit2Client = new Permit2Client();
export const gaslessManager = new GaslessTransactionManager();