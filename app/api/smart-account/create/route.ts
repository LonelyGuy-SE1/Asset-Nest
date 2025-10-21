import { NextRequest, NextResponse } from 'next/server';
import { createMetaMaskSmartAccountSimple } from '@/lib/smart-account/create-account-simple';
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

    // Validate private key format
    if (typeof signerPrivateKey !== 'string' || !signerPrivateKey.startsWith('0x') || signerPrivateKey.length !== 66) {
      return NextResponse.json(
        { error: 'Invalid private key format. Must be a 32-byte hex string starting with 0x' },
        { status: 400 }
      );
    }

    console.log('Creating smart account via API...');
    console.log('Signer private key length:', signerPrivateKey.length);

    const result = await createMetaMaskSmartAccountSimple(signerPrivateKey as Hex);

    return NextResponse.json({
      success: true,
      smartAccountAddress: result.address,
      signerAddress: result.signerAccount.address,
      message: 'Smart account created successfully. It will be deployed on first transaction.',
    });
  } catch (error: any) {
    console.error('Error creating smart account:', error);
    console.error('Error stack:', error.stack);
    console.error('Error cause:', error.cause);
    
    // Provide more specific error messages based on error type
    let userMessage = 'Failed to create smart account';
    let details = error.message;
    
    if (error.message?.includes('fetch')) {
      userMessage = 'Network connection error';
      details = 'Unable to connect to Monad testnet. Please check your internet connection.';
    } else if (error.message?.includes('Chain ID mismatch')) {
      userMessage = 'Wrong network';
      details = 'Please connect to Monad Testnet in your wallet.';
    } else if (error.message?.includes('Unknown implementation')) {
      userMessage = 'MetaMask configuration error';
      details = 'MetaMask Delegation Toolkit configuration issue. Please check the implementation.';
    } else if (error.message?.includes('client')) {
      userMessage = 'RPC client error';
      details = 'Issue with blockchain RPC connection. Please try again.';
    }

    return NextResponse.json(
      {
        error: userMessage,
        details: details,
        timestamp: new Date().toISOString(),
        errorType: error.constructor.name,
      },
      { status: 500 }
    );
  }
}
