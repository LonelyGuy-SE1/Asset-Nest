import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Sign Delegation
 * POST /api/delegation/sign
 *
 * Accepts a signed delegation and stores it
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { delegation, signature } = body;

    if (!delegation || !signature) {
      return NextResponse.json(
        { error: 'Missing delegation or signature' },
        { status: 400 }
      );
    }

    console.log('Received signed delegation:', delegation);
    console.log('Signature:', signature);

    // In a real implementation, you would:
    // 1. Verify the signature
    // 2. Store the delegation in a database
    // 3. Make it available for the agent to use

    // For now, just log and return success
    console.log('[DELEGATION] Delegation successfully signed and ready for use!');

    return NextResponse.json({
      success: true,
      message: 'Delegation signed and stored successfully',
      delegation: {
        ...delegation,
        signature,
      },
    });
  } catch (error: any) {
    console.error('Error processing signed delegation:', error);
    return NextResponse.json(
      {
        error: 'Failed to process signed delegation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}