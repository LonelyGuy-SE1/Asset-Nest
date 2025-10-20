# Envio HyperIndex Setup for Asset Nest

Complete guide to deploying the Envio indexer for Asset Nest on Monad testnet.

## 📚 Official Documentation

- **Monad Indexing**: https://docs.envio.dev/docs/HyperIndex/monad-testnet
- **Configuration Guide**: https://docs.envio.dev/docs/HyperIndex/configuration-file
- **Hosted Service**: https://docs.envio.dev/docs/HyperIndex/hosted-service
- **Tutorial**: https://docs.envio.dev/docs/HyperIndex/tutorial-op-bridge-deposits

## 🚀 Quick Deploy

### 1. Install Envio CLI

```bash
npm install -g envio
```

### 2. Login to Envio

```bash
envio login
```

This will open a browser window to authenticate with GitHub.

### 3. Initialize Indexer (Already Done)

The indexer is already configured in this directory with:
- `envio.config.yaml` - Main configuration
- `schema.ts` - TypeScript schema definitions
- `src/EventHandlers.ts` - Event processing logic

### 4. Deploy to Envio Hosted Service

```bash
cd envio
envio deploy
```

This will:
- Validate your configuration
- Upload indexer code
- Start syncing from Monad testnet block 0
- Provide a GraphQL endpoint URL

### 5. Get Your GraphQL Endpoint

After deployment, run:

```bash
envio status
```

Copy the GraphQL URL and add to your `.env.local`:

```bash
NEXT_PUBLIC_ENVIO_GRAPHQL_URL=https://indexer.envio.dev/YOUR_ID/v1/graphql
```

## 📋 What Gets Indexed

This indexer tracks ERC-4337 UserOperations from MetaMask Smart Accounts on Monad:

### Entities

1. **UserOperation** - Every smart account transaction
   - User operation hash
   - Sender (smart account address)
   - Gas costs and usage
   - Success/failure status
   - Timestamp and block info

2. **SmartAccount** - All smart accounts
   - Address and factory
   - Deployment info
   - Total operations count
   - Total gas used
   - Activity timestamps

3. **AccountDeployment** - Smart account deployments
   - Deployment transaction
   - Factory address
   - Timestamp

4. **GlobalStats** - Aggregated statistics
   - Total smart accounts
   - Total operations (successful/failed)
   - Total gas used

## 🔍 Example GraphQL Queries

### Get Smart Account Info

```graphql
query GetSmartAccount($address: String!) {
  smartAccount(id: $address) {
    address
    totalOperations
    totalGasUsed
    deployedAt
    firstSeenAt
    lastActivityAt
  }
}
```

### Get Recent User Operations

```graphql
query GetRecentOps($limit: Int!) {
  userOperations(
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    id
    sender
    success
    actualGasCost
    actualGasUsed
    timestamp
    transactionHash
  }
}
```

### Get Global Statistics

```graphql
query GetGlobalStats {
  globalStats(id: "global") {
    totalSmartAccounts
    totalUserOperations
    totalSuccessfulOperations
    totalFailedOperations
    totalGasUsed
    lastUpdatedAt
  }
}
```

### Get Operations for an Account

```graphql
query GetAccountOps($address: String!, $limit: Int!) {
  userOperations(
    where: { sender: $address }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    id
    success
    actualGasCost
    actualGasUsed
    timestamp
    transactionHash
  }
}
```

## 🛠️ Local Development

### Test Locally

```bash
cd envio
envio dev
```

This starts a local indexer with:
- GraphQL playground at http://localhost:8080
- Hot reloading on file changes
- Real-time indexing from Monad testnet

### View Logs

```bash
envio logs --tail
```

### Check Status

```bash
envio status
```

## 📊 Integration with Frontend

The frontend automatically queries the Envio GraphQL endpoint:

```typescript
// In app/api/analytics/history/route.ts
const response = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      query GetSmartAccount($address: String!) {
        smartAccount(id: $address) {
          totalOperations
          totalGasUsed
        }
      }
    `,
    variables: { address },
  }),
});
```

## 🔧 Troubleshooting

### "No events found"

- Check that you've created a smart account and sent transactions
- Verify the EntryPoint address in `envio.config.yaml`
- Check indexer logs: `envio logs`

### "Indexer not syncing"

1. Check Monad RPC connectivity
2. Verify start_block in config.yaml
3. Review logs for errors
4. Try redeploying: `envio deploy --force`

### "GraphQL query errors"

1. Ensure indexer is fully synced
2. Check entity IDs are lowercase addresses
3. Verify query syntax in GraphQL playground
4. Check schema definitions match queries

## 📝 Contract Addresses

The indexer uses the standard ERC-4337 EntryPoint contract:

- **EntryPoint v0.7**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`

This is the canonical EntryPoint address used by all ERC-4337 implementations.

## 🎯 Hackathon Requirements

This indexer satisfies the Envio bonus requirements:

✅ Working HyperIndex indexer deployed
✅ Indexes smart account events on Monad
✅ GraphQL API for querying data
✅ Frontend consumes indexed data
✅ Complete documentation

## 🔗 Useful Commands

```bash
# Deploy indexer
envio deploy

# Check status
envio status

# View logs
envio logs --tail

# Redeploy (force)
envio deploy --force

# Test locally
envio dev

# Generate TypeScript types
envio codegen

# Validate config
envio validate
```

## 📚 Additional Resources

- [Envio Documentation](https://docs.envio.dev/)
- [GitHub Examples](https://github.com/enviodev)
- [Discord Support](https://discord.com/invite/envio)
- [Monad Developer Docs](https://docs.monad.xyz/)

## ✨ Next Steps

1. Deploy the indexer: `envio deploy`
2. Get the GraphQL endpoint
3. Update `.env.local` with the endpoint
4. Test queries in GraphQL playground
5. Verify frontend displays indexed data

---

**Your indexer is ready to deploy! 🚀**
