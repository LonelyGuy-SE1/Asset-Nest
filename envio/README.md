# Envio HyperIndex Setup for Asset Nest

This directory contains the Envio indexer configuration for Asset Nest, which indexes MetaMask Smart Account events, delegations, and swap transactions on Monad Testnet.

## Reference Documentation

- [Envio HyperIndex Overview](https://docs.envio.dev/docs/HyperIndex/overview)
- [Monad Testnet Indexing Guide](https://docs.envio.dev/docs/HyperIndex/monad-testnet)
- [Configuration File Reference](https://docs.envio.dev/docs/HyperIndex/configuration-file)
- [Tutorial: OP Bridge Deposits](https://docs.envio.dev/docs/HyperIndex/tutorial-op-bridge-deposits)

## Installation

1. Install Envio CLI:

```bash
npm install -g envio
```

2. Initialize the indexer:

```bash
cd envio
envio init
```

3. Configure your contracts in `config.yaml`:
   - Update contract addresses with actual deployed addresses
   - Add ABI files to `./abis/` directory
   - Verify network configuration

## Configuration Files

### `config.yaml`

Main configuration file that defines:

- Networks to index (Monad Testnet)
- Contracts and their events
- Event handlers
- HyperSync endpoints

### `schema.graphql`

GraphQL schema defining the data model:

- `SmartAccount` - User smart accounts
- `Delegation` - Delegation records
- `Trade` - Individual swap transactions
- `PortfolioSnapshot` - Historical portfolio states
- `GlobalStats` - Aggregated statistics

### Event Handlers

Located in `src/handlers/`:

- `smartAccountHandler.ts` - Handles smart account creation and deployment
- `delegationHandler.ts` - Handles delegation lifecycle events
- `swapHandler.ts` - Handles Monorail swap events

## Running the Indexer

### Local Development

```bash
envio dev
```

This starts a local indexer with:

- GraphQL playground at `http://localhost:8080`
- Auto-reload on file changes
- Hot reloading of handlers

### Production Deployment

Option 1: Envio Hosted Service (Recommended)

```bash
envio deploy
```

This deploys to Envio's hosted infrastructure with:

- Automatic scaling
- High availability
- Built-in monitoring
- Free tier available

Reference: [Hosted Service Docs](https://docs.envio.dev/docs/HyperIndex/hosted-service)

Option 2: Self-Hosted

```bash
envio start
```

Run on your own infrastructure with Docker/Kubernetes.

## GraphQL Queries

Once deployed, you can query the indexer via GraphQL:

### Get Smart Account Details

```graphql
query GetSmartAccount($address: String!) {
  smartAccount(id: $address) {
    id
    owner
    isDeployed
    totalTrades
    totalVolume
    delegations {
      id
      delegate
      isActive
      createdAt
    }
    trades {
      id
      tokenIn
      tokenOut
      amountIn
      amountOut
      executedAt
    }
  }
}
```

### Get Recent Trades

```graphql
query GetRecentTrades($limit: Int!) {
  trades(orderBy: executedAt, orderDirection: desc, first: $limit) {
    id
    smartAccountAddress
    tokenIn
    tokenOut
    amountIn
    amountOut
    executedAt
    txHash
  }
}
```

### Get Global Statistics

```graphql
query GetGlobalStats {
  globalStats(id: "global") {
    totalSmartAccounts
    totalDelegations
    totalTrades
    totalVolumeUSD
    lastUpdatedAt
  }
}
```

## Integration with Frontend

The frontend can query indexed data via the Envio GraphQL endpoint:

```typescript
const response = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      query GetSmartAccount($address: String!) {
        smartAccount(id: $address) {
          totalTrades
          totalVolume
        }
      }
    `,
    variables: { address: smartAccountAddress },
  }),
});
```

## HyperSync

Envio's HyperSync provides ultra-fast historical data querying:

```typescript
import { HyperSync } from '@envio/hypersync-client';

const client = HyperSync.create({
  url: 'https://monad-testnet.hypersync.xyz',
});

const events = await client.getEvents({
  fromBlock: 0,
  toBlock: 'latest',
  address: smartAccountAddress,
});
```

Reference: [HyperSync Overview](https://docs.envio.dev/docs/HyperSync/overview)

## Monitoring and Logs

View indexer logs:

```bash
envio logs
```

View indexer status:

```bash
envio status
```

Reference: [Logging Documentation](https://docs.envio.dev/docs/HyperIndex/logging)

## Troubleshooting

### Indexer not syncing

1. Check network connectivity to Monad RPC
2. Verify contract addresses are correct
3. Check ABI files are present
4. Review logs for errors: `envio logs --tail`

### Missing events

1. Verify `start_block` in config.yaml
2. Check event signatures match ABI
3. Ensure contracts are deployed on Monad Testnet

### GraphQL schema errors

1. Run `envio codegen` to regenerate types
2. Check schema.graphql for syntax errors
3. Verify entity relationships are correct

## Additional Resources

- [Envio GitHub](https://github.com/enviodev)
- [Envio Discord](https://discord.com/invite/envio)
- [Envio Twitter](https://x.com/envio_indexer)
- [Scaffold-ETH-2 Extension](https://github.com/enviodev/scaffold-eth-2-extension)

## Hackathon Bonus

This indexer qualifies for the Envio bonus prize by:

1. ✓ Using HyperIndex to index smart account events
2. ✓ Providing GraphQL queries for frontend consumption
3. ✓ Tracking delegations and trades on Monad
4. ✓ Aggregating analytics and statistics
5. ✓ Supporting portfolio history and analytics
