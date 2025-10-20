# Deployment Guide for Asset Nest

This guide covers deploying Asset Nest for the hackathon and beyond.

## 🚀 Quick Deploy (Vercel)

### Prerequisites

1. GitHub account
2. Vercel account (free tier works)
3. Environment variables configured

### Steps

1. **Push to GitHub:**

```bash
git init
git add .
git commit -m "Initial commit: Asset Nest portfolio rebalancer"
git remote add origin https://github.com/YOUR_USERNAME/asset-nest.git
git push -u origin main
```

2. **Deploy to Vercel:**

- Go to [vercel.com](https://vercel.com)
- Click "Import Project"
- Select your GitHub repo
- Configure environment variables:

```
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_MONAD_CHAIN_ID=10143
NEXT_PUBLIC_BUNDLER_RPC_URL=https://api.pimlico.io/v2/10143/rpc?apikey=YOUR_KEY
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_MONORAIL_API_URL=https://testnet-pathfinder.monorail.xyz
NEXT_PUBLIC_MONORAIL_APP_ID=asset-nest-rebalancer
NEXT_PUBLIC_ENVIO_GRAPHQL_URL=your_envio_endpoint
```

- Click "Deploy"
- Your app will be live at `https://asset-nest-YOUR_ID.vercel.app`

## 🔧 Environment Setup

### Required API Keys

#### 1. Pimlico Bundler API Key

Get from: [https://pimlico.io](https://pimlico.io)

```bash
NEXT_PUBLIC_BUNDLER_RPC_URL=https://api.pimlico.io/v2/10143/rpc?apikey=YOUR_KEY
```

**Why:** Enables gasless transactions via ERC-4337 bundler

#### 2. OpenAI API Key

Get from: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

```bash
OPENAI_API_KEY=sk-...
```

**Why:** Powers AI rebalancing strategy computation

Alternative: Use Crestal IntentKit

```bash
CRESTAL_API_KEY=your_key
CRESTAL_API_URL=https://open.service.crestal.network/v1
```

#### 3. Monorail App ID

Register at: [https://testnet-preview.monorail.xyz/developers](https://testnet-preview.monorail.xyz/developers)

```bash
NEXT_PUBLIC_MONORAIL_APP_ID=your_app_id
```

**Why:** Identifies your app for swap routing analytics

### Optional API Keys

#### Envio GraphQL Endpoint

After deploying Envio indexer:

```bash
NEXT_PUBLIC_ENVIO_GRAPHQL_URL=https://indexer.envio.dev/YOUR_ID/v1/graphql
```

## 📦 Deploy Envio Indexer

### Step 1: Install Envio CLI

```bash
npm install -g envio
```

### Step 2: Configure Contract Addresses

Edit `envio/config.yaml` and replace placeholder addresses with actual deployed contracts:

```yaml
contracts:
  - name: SmartAccountFactory
    address: '0xACTUAL_FACTORY_ADDRESS' # Get from MetaMask docs
    ...

  - name: DelegationManager
    address: '0xACTUAL_DELEGATION_MANAGER' # Get from MetaMask docs
    ...

  - name: MonorailRouter
    address: '0xACTUAL_MONORAIL_ROUTER' # Get from Monorail docs
    ...
```

### Step 3: Add ABI Files

Download and place ABIs in `envio/abis/`:

```bash
# MetaMask Smart Account Factory ABI
wget https://raw.githubusercontent.com/metamask/delegation-toolkit/main/abis/SmartAccountFactory.json \
  -O envio/abis/SmartAccountFactory.json

# Add other ABIs similarly
```

### Step 4: Deploy to Envio Hosted Service

```bash
cd envio
envio login
envio deploy
```

This will:

- Validate your configuration
- Upload your indexer
- Start syncing from Monad testnet
- Provide a GraphQL endpoint

### Step 5: Get GraphQL Endpoint

```bash
envio status
```

Copy the GraphQL URL and add to `.env.local`:

```
NEXT_PUBLIC_ENVIO_GRAPHQL_URL=https://indexer.envio.dev/YOUR_ID/v1/graphql
```

## 🧪 Testing Deployment

### 1. Test API Endpoints

```bash
# Health check
curl https://asset-nest-YOUR_ID.vercel.app/api/health

# Create smart account
curl -X POST https://asset-nest-YOUR_ID.vercel.app/api/smart-account/create \
  -H "Content-Type: application/json" \
  -d '{"signerPrivateKey":"0x..."}'
```

### 2. Test Frontend

- Open `https://asset-nest-YOUR_ID.vercel.app`
- Create a smart account
- Create a delegation
- Verify transactions on [Monad Explorer](https://testnet.monadexplorer.com)

### 3. Test Envio Indexer

```bash
# Query GraphQL endpoint
curl -X POST https://indexer.envio.dev/YOUR_ID/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ globalStats(id: \"global\") { totalSmartAccounts } }"}'
```

## 🔐 Security Best Practices

### Production Checklist

- [ ] Remove all hardcoded private keys
- [ ] Use MetaMask SDK for wallet connection
- [ ] Enable rate limiting on API routes
- [ ] Add authentication for sensitive endpoints
- [ ] Use environment variables for all secrets
- [ ] Enable CORS only for trusted origins
- [ ] Monitor API usage and set quotas
- [ ] Use HTTPS everywhere
- [ ] Implement proper error handling
- [ ] Add logging and monitoring

### Private Key Management

**Never commit private keys!**

For production:

1. Use MetaMask SDK or embedded wallets
2. Let users connect their own wallets
3. Store agent keys in secure key management service (AWS KMS, HashiCorp Vault)
4. Implement key rotation policies

## 📊 Monitoring

### Vercel Analytics

Enable in Vercel dashboard:

- Page views
- User engagement
- Error tracking
- Performance metrics

### Envio Monitoring

View indexer health:

```bash
envio logs --tail
envio status
```

Monitor:

- Sync status
- Event processing rate
- Error logs
- GraphQL query performance

### Monad Explorer

Track your transactions:

- [https://testnet.monadexplorer.com/address/YOUR_SMART_ACCOUNT](https://testnet.monadexplorer.com)

## 🐛 Troubleshooting

### Issue: Bundler errors

**Solution:**

- Check Pimlico API key is valid
- Ensure smart account is funded with MON
- Verify gas prices are set correctly

### Issue: Monorail quote fails

**Solution:**

- Check token addresses are correct
- Verify liquidity exists for pair
- Try increasing slippage tolerance

### Issue: Envio not syncing

**Solution:**

- Check contract addresses in config.yaml
- Verify start_block is correct
- Review ABI files are present
- Check logs: `envio logs`

### Issue: AI returns no trades

**Solution:**

- Portfolio may already be balanced
- Check target allocations sum to 100%
- Verify holdings have non-zero values

## 🚀 Performance Optimization

### Frontend

- Enable Next.js Image Optimization
- Add caching headers
- Lazy load components
- Minimize bundle size

### API Routes

- Add Redis caching for portfolio data
- Batch database queries
- Use SWR for client-side caching
- Implement request debouncing

### Envio Indexer

- Optimize event handlers
- Use batch operations
- Add appropriate database indexes
- Monitor query performance

## 📈 Scaling

### For Production Use

1. **Add database** - PostgreSQL for persistent storage
2. **Implement queuing** - Bull/BullMQ for async jobs
3. **Add caching layer** - Redis for frequently accessed data
4. **Set up CDN** - Cloudflare for static assets
5. **Enable auto-scaling** - Vercel pro for more resources
6. **Add monitoring** - Sentry for error tracking
7. **Implement CI/CD** - GitHub Actions for automated testing

## 📝 Deployment Checklist

- [ ] Environment variables configured
- [ ] Pimlico bundler API key added
- [ ] OpenAI/Crestal API key added
- [ ] Monorail app ID registered
- [ ] Envio indexer deployed
- [ ] Frontend deployed to Vercel
- [ ] All API endpoints tested
- [ ] Transactions verified on Monad Explorer
- [ ] Demo video recorded
- [ ] GitHub repo updated
- [ ] README includes live demo link

## 🔗 Useful Links

- [Vercel Deployment Docs](https://vercel.com/docs)
- [Envio Hosted Service](https://docs.envio.dev/docs/HyperIndex/hosted-service)
- [Pimlico Dashboard](https://dashboard.pimlico.io/)
- [Monad Testnet](https://docs.monad.xyz/)
- [MetaMask Delegation Toolkit](https://docs.metamask.io/delegation-toolkit/)

---

**Your app is now ready for the hackathon! 🎉**
