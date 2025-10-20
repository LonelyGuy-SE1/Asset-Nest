import { NextRequest, NextResponse } from 'next/server';
import {
  createOpenDelegationForAgent,
  createERC20SpendingDelegation,
  signAndStoreDelegation,
} from '@/lib/smart-account/delegation';
import { type Address, type Hex } from 'viem';

/**
 * API Route: Create Delegation
 * POST /api/delegation/create
 *
 * Creates a delegation allowing an AI agent to trade on behalf of the user's smart account
 * Reference: https://docs.metamask.io/delegation-toolkit/concepts/delegation/
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      smartAccountAddress,
      agentAddress,
      signerPrivateKey,
      type = 'open',
      tokenAddress,
      maxAmount,
    } = body;

    if (!smartAccountAddress || !agentAddress || !signerPrivateKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Creating delegation via API...');
    console.log('Type:', type);

    let delegation;

    if (type === 'open') {
      // Create open delegation (unrestricted)
      delegation = await createOpenDelegationForAgent(
        smartAccountAddress as Address,
        agentAddress as Address,
        signerPrivateKey as Hex
      );
    } else if (type === 'erc20') {
      // Create restricted ERC20 spending delegation
      if (!tokenAddress || !maxAmount) {
        return NextResponse.json(
          { error: 'Missing tokenAddress or maxAmount for ERC20 delegation' },
          { status: 400 }
        );
      }

      delegation = await createERC20SpendingDelegation(
        smartAccountAddress as Address,
        agentAddress as Address,
        tokenAddress as Address,
        BigInt(maxAmount),
        signerPrivateKey as Hex
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid delegation type' },
        { status: 400 }
      );
    }

    // Sign and store the delegation
    const { signature } = await signAndStoreDelegation(delegation, signerPrivateKey as Hex);

    // Serialize delegation with BigInt converted to string
    const serializedDelegation = {
      ...delegation,
      salt: delegation.salt.toString(),
    };

    return NextResponse.json({
      success: true,
      delegation: serializedDelegation,
      signature,
      message: 'Delegation created and stored successfully',
    });
  } catch (error: any) {
    console.error('Error creating delegation:', error);
    return NextResponse.json(
      {
        error: 'Failed to create delegation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
