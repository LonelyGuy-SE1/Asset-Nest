import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * API Route: Get Smart Account Analytics from Envio
 * GET /api/analytics/history?address=0x...
 *
 * Queries Envio HyperIndex for historical data and analytics
 * Reference: https://docs.envio.dev/docs/HyperIndex/overview
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
    }

    const envioUrl = process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL;

    if (!envioUrl) {
      return NextResponse.json(
        { error: 'Envio GraphQL URL not configured' },
        { status: 500 }
      );
    }

    console.log('Fetching analytics from Envio for:', address);

    // GraphQL query to fetch smart account data
    const query = `
      query GetSmartAccountAnalytics($address: String!) {
        smartAccount(id: $address) {
          id
          owner
          isDeployed
          createdAt
          totalTrades
          totalVolume
          delegations {
            id
            delegate
            isActive
            createdAt
            redeemedAt
            revokedAt
          }
          trades(orderBy: executedAt, orderDirection: desc, first: 50) {
            id
            tokenIn
            tokenOut
            amountIn
            amountOut
            executedAt
            txHash
            blockNumber
          }
        }
      }
    `;

    // Query Envio GraphQL endpoint
    const response = await axios.post(
      envioUrl,
      {
        query,
        variables: { address: address.toLowerCase() },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const smartAccount = response.data.data?.smartAccount;

    if (!smartAccount) {
      return NextResponse.json({
        success: true,
        found: false,
        message: 'Smart account not found in index',
      });
    }

    // Calculate analytics
    const analytics = {
      smartAccount: {
        address: smartAccount.id,
        owner: smartAccount.owner,
        isDeployed: smartAccount.isDeployed,
        createdAt: smartAccount.createdAt,
      },
      portfolio: {
        totalTrades: smartAccount.totalTrades,
        totalVolume: smartAccount.totalVolume,
      },
      delegations: {
        total: smartAccount.delegations.length,
        active: smartAccount.delegations.filter((d: any) => d.isActive).length,
        list: smartAccount.delegations,
      },
      trades: {
        recent: smartAccount.trades,
        total: smartAccount.totalTrades,
      },
    };

    console.log('Analytics fetched successfully');

    return NextResponse.json({
      success: true,
      found: true,
      analytics,
    });
  } catch (error: any) {
    console.error('Error fetching analytics from Envio:', error);

    // If Envio is not deployed yet, return mock data
    if (error.code === 'ENOTFOUND' || error.response?.status === 404) {
      return NextResponse.json({
        success: true,
        found: false,
        message: 'Envio indexer not deployed yet. Deploy with: cd envio && envio deploy',
        mockData: true,
      });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch analytics',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get Global Statistics
 * Internal function to fetch global stats from Envio
 */
async function getGlobalStats() {
  const envioUrl = process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL;

  if (!envioUrl) {
    throw new Error('Envio GraphQL URL not configured');
  }

  const query = `
    query GetGlobalStats {
      globalStats(id: "global") {
        totalSmartAccounts
        totalDelegations
        totalTrades
        totalVolumeUSD
        totalRebalancingEvents
        lastUpdatedAt
      }
    }
  `;

  const response = await axios.post(
    envioUrl,
    { query },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.data?.globalStats;
}
