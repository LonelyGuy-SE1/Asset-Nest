import { NextRequest, NextResponse } from 'next/server';
import {
  createOpenDelegationForAgent,
  createERC20SpendingDelegation,
  signAndStoreDelegation,
} from '@/lib/smart-account/delegation';
import { type Address, type Hex } from 'viem';
import { type Delegation } from '@metamask/delegation-toolkit';

/**
 * API Route: Create Delegation
 * POST /api/delegation/create
 *
 * Creates a delegation allowing an AI agent to trade on behalf of the user's smart account
 * Reference: https://docs.metamask.io/delegation-toolkit/concepts/delegation/
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[DELEGATION] API called');

    const body = await request.json();
    console.log('[DELEGATION] Request body:', JSON.stringify(body, null, 2));
    
    const {
      smartAccountAddress,
      agentAddress,
      userWalletAddress,
      type = 'open',
      tokenAddress,
      maxAmount,
      requestSignature = true,
      // New delegation parameters
      maxTradeAmount,
      maxTradesPerDay,
      riskLevel,
      expirationDays,
      allowedTokens,
    } = body;

    if (!smartAccountAddress || !agentAddress || !userWalletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Creating delegation via API using MetaMask Delegation Toolkit...');
    console.log('Type:', type);
    console.log('User Wallet Address:', userWalletAddress);

    let delegation: any;

    if (requestSignature) {
      // Old flow - use demo private key (for testing)
      const demoPrivateKey = `0x${userWalletAddress.slice(2).padStart(64, '0')}` as Hex;

      if (type === 'open') {
        delegation = await createOpenDelegationForAgent(
          smartAccountAddress as Address,
          agentAddress as Address,
          demoPrivateKey
        );
      } else if (type === 'erc20') {
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
          demoPrivateKey
        );
      }

      const { signature } = await signAndStoreDelegation(delegation, demoPrivateKey);
      
      return NextResponse.json({
        success: true,
        delegation: {
          ...delegation,
          salt: delegation.salt?.toString(),
        },
        signature,
        message: 'Delegation created and signed with demo key',
      });
    } else {
      // New flow - create unsigned delegation for wallet signing
      console.log('Creating unsigned delegation for wallet signing...');
      
      // Create comprehensive delegation structure with user parameters
      const caveats = [];

      // Add trade amount caveat if specified
      if (maxTradeAmount && parseFloat(maxTradeAmount) > 0) {
        caveats.push({
          enforcer: '0x1111111111111111111111111111111111111111', // Trade amount enforcer
          terms: JSON.stringify({
            type: 'maxTradeAmount',
            value: parseFloat(maxTradeAmount),
            currency: 'USD',
          }),
        });
      }

      // Add trade frequency caveat if specified
      if (maxTradesPerDay && parseInt(maxTradesPerDay) > 0) {
        caveats.push({
          enforcer: '0x2222222222222222222222222222222222222222', // Trade frequency enforcer
          terms: JSON.stringify({
            type: 'maxTradesPerDay',
            value: parseInt(maxTradesPerDay),
          }),
        });
      }

      // Add risk level caveat if specified
      if (riskLevel && riskLevel !== 'any') {
        caveats.push({
          enforcer: '0x3333333333333333333333333333333333333333', // Risk level enforcer
          terms: JSON.stringify({
            type: 'riskLevel',
            value: riskLevel,
          }),
        });
      }

      // Add allowed tokens caveat if specified
      if (allowedTokens) {
        let tokens: string[] = [];
        
        // Handle both string and array formats
        if (typeof allowedTokens === 'string') {
          tokens = allowedTokens.split(',').map((t: string) => t.trim()).filter((t: string) => t);
        } else if (Array.isArray(allowedTokens)) {
          tokens = allowedTokens.filter((t: string) => t && t.trim());
        }
        
        console.log('[DELEGATION] Processed tokens:', tokens);
        
        if (tokens.length > 0) {
          caveats.push({
            enforcer: '0x4444444444444444444444444444444444444444', // Token whitelist enforcer
            terms: JSON.stringify({
              type: 'allowedTokens',
              value: tokens,
            }),
          });
        }
      }

      console.log('[DELEGATION] Creating delegation structure with caveats:', caveats.length);
      
      // Calculate expiration timestamp
      const expiryTimestamp = expirationDays && parseInt(expirationDays) > 0 
        ? BigInt(Math.floor(Date.now() / 1000) + parseInt(expirationDays) * 24 * 60 * 60)
        : BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60); // Default 30 days

      delegation = {
        delegate: agentAddress,
        delegator: userWalletAddress, // Use wallet address as delegator
        authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
        caveats,
        salt: BigInt(Date.now()),
        expiry: expiryTimestamp,
      };
      
      console.log('[DELEGATION] Delegation structure created:', {
        delegate: delegation.delegate,
        delegator: delegation.delegator,
        caveatsCount: delegation.caveats.length,
        saltString: delegation.salt.toString(),
        expiryString: delegation.expiry.toString(),
      });

      // Properly serialize the delegation to handle BigInt values
      const serializedDelegation = {
        delegate: delegation.delegate,
        delegator: delegation.delegator,
        authority: delegation.authority,
        caveats: delegation.caveats,
        salt: delegation.salt.toString(),
        expiry: delegation.expiry.toString(),
      };

      return NextResponse.json({
        success: true,
        delegation: serializedDelegation,
        message: 'Unsigned delegation created, ready for wallet signing',
        requiresSignature: true,
      });
    }


  } catch (error: any) {
    console.error('[DELEGATION] API Error:', error);
    console.error('[DELEGATION] Error stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Failed to create delegation',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
