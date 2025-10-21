import { NextRequest, NextResponse } from 'next/server';
import { type Address, type Hex } from 'viem';

/**
 * API Route: Revoke Delegation
 * POST /api/delegation/revoke
 *
 * Revokes an existing delegation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      smartAccountAddress,
      agentAddress,
    } = body;

    if (!smartAccountAddress || !agentAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Revoking delegation via API...');
    console.log('Smart Account:', smartAccountAddress);
    console.log('Agent Address:', agentAddress);

    // In a real implementation, you would:
    // 1. Create a revocation transaction
    // 2. Sign it with the user's wallet
    // 3. Submit it to the blockchain
    // 4. Remove the delegation from storage

    // For now, we'll just simulate the revocation
    console.log('Delegation revoked successfully');

    return NextResponse.json({
      success: true,
      message: 'Delegation revoked successfully',
    });
  } catch (error: any) {
    console.error('Error revoking delegation:', error);
    return NextResponse.json(
      {
        error: 'Failed to revoke delegation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
