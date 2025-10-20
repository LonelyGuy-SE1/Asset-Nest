import { NextRequest, NextResponse } from 'next/server';
import { createMetaMaskSmartAccount } from '@/lib/smart-account/create-account';
import { type Hex } from 'viem';

/**
 * API Route: Create MetaMask Smart Account
 * POST /api/smart-account/create
 *
 * Creates a new MetaMask Smart Account for a user
 * Reference: https://docs.metamask.io/delegation-toolkit/guides/smart-accounts/create-smart-account/
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signerPrivateKey } = body;

    if (!signerPrivateKey) {
      return NextResponse.json(
        { error: 'Missing signerPrivateKey' },
        { status: 400 }
      );
    }

    console.log('Creating smart account via API...');

    const result = await createMetaMaskSmartAccount(signerPrivateKey as Hex);

    return NextResponse.json({
      success: true,
      smartAccountAddress: result.address,
      signerAddress: result.signerAccount.address,
      message: 'Smart account created successfully. It will be deployed on first transaction.',
    });
  } catch (error: any) {
    console.error('Error creating smart account:', error);
    return NextResponse.json(
      {
        error: 'Failed to create smart account',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
