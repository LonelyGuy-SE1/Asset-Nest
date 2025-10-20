import { NextResponse } from 'next/server';

/**
 * Health Check Endpoint
 * GET /api/health
 *
 * Returns the health status of the application and its dependencies
 */
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      monad: {
        rpc: process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'not configured',
        chainId: process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || 'not configured',
        status: 'unknown',
      },
      bundler: {
        url: process.env.NEXT_PUBLIC_BUNDLER_RPC_URL ? 'configured' : 'not configured',
        status: 'unknown',
      },
      ai: {
        provider: process.env.OPENAI_API_KEY
          ? 'OpenAI'
          : process.env.CRESTAL_API_KEY
            ? 'Crestal'
            : 'Fallback Algorithm',
        status: 'unknown',
      },
      monorail: {
        url: process.env.NEXT_PUBLIC_MONORAIL_API_URL || 'not configured',
        appId: process.env.NEXT_PUBLIC_MONORAIL_APP_ID || 'not configured',
        status: 'unknown',
      },
      envio: {
        url: process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL || 'not configured',
        status: 'unknown',
      },
    },
  };

  // Test Monad RPC connectivity
  try {
    const monadRpc = process.env.NEXT_PUBLIC_MONAD_RPC_URL;
    if (monadRpc) {
      const response = await fetch(monadRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });

      if (response.ok) {
        health.services.monad.status = 'healthy';
      } else {
        health.services.monad.status = 'unhealthy';
      }
    }
  } catch (error) {
    health.services.monad.status = 'error';
  }

  // Test Monorail API connectivity
  try {
    const monorailUrl = process.env.NEXT_PUBLIC_MONORAIL_API_URL;
    if (monorailUrl) {
      const response = await fetch(`${monorailUrl}/health`, {
        method: 'GET',
      });

      health.services.monorail.status = response.ok ? 'healthy' : 'unhealthy';
    }
  } catch (error) {
    health.services.monorail.status = 'unknown';
  }

  // Check AI configuration
  if (process.env.OPENAI_API_KEY) {
    health.services.ai.status = 'configured';
  } else if (process.env.CRESTAL_API_KEY) {
    health.services.ai.status = 'configured';
  } else {
    health.services.ai.status = 'fallback';
  }

  // Check bundler configuration
  if (process.env.NEXT_PUBLIC_BUNDLER_RPC_URL) {
    health.services.bundler.status = 'configured';
  } else {
    health.services.bundler.status = 'not configured';
  }

  // Check Envio configuration
  if (process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL) {
    health.services.envio.status = 'configured';
  } else {
    health.services.envio.status = 'not configured';
  }

  return NextResponse.json(health);
}
