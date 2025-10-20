# Quick Start Guide - Asset Nest

Get up and running in 5 minutes!

## ⚡ Prerequisites

- Node.js 18+ installed
- Git installed
- A code editor (VS Code recommended)

## 🚀 Installation (2 minutes)

```bash
# 1. Navigate to the project
cd asset-nest-rebalancer

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.local .env.local
```

## 🔑 Minimal Configuration (1 minute)

Edit `.env.local` and add at minimum:

```bash
# Required for basic functionality
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_MONAD_CHAIN_ID=10143
NEXT_PUBLIC_MONORAIL_API_URL=https://testnet-pathfinder.monorail.xyz
```

**Optional but recommended:**

```bash
# For AI rebalancing (otherwise uses fallback algorithm)
OPENAI_API_KEY=sk-your-key-here

# For gasless transactions (otherwise needs manual gas funding)
NEXT_PUBLIC_BUNDLER_RPC_URL=https://api.pimlico.io/v2/10143/rpc?apikey=YOUR_KEY
```

## ▶️ Run the App (30 seconds)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🧪 Test the App (2 minutes)

### Option 1: Using Test Private Keys

Generate two test private keys:

```bash
# In Node.js console or browser console:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Repeat for second key
```

Add `0x` prefix to each key.

### Option 2: Quick Test Flow

1. **Create Smart Account:**
   - Enter a private key (or generate one)
   - Click "Create Smart Account"
   - Copy the smart account address

2. **Fund the Smart Account:**
   - Go to [Monad Faucet](https://faucet.monad.xyz)
   - Request testnet MON tokens
   - Send to your smart account address

3. **Create Delegation:**
   - Enter agent private key (can be same or different)
   - Click "Create Delegation"

4. **View Portfolio:**
   - Click "Continue to Portfolio"
   - View your token balances

5. **Rebalance:**
   - Set target allocations
   - Click "Compute Strategy"
   - Click "Execute Rebalancing"

## 🎯 Quick Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Type checking
npm run type-check       # Check TypeScript types

# Envio (optional)
npm run envio:dev        # Start Envio indexer locally
npm run envio:deploy     # Deploy Envio to hosted service
npm run envio:logs       # View Envio logs
```

## 🐛 Troubleshooting

### "Module not found" errors

```bash
rm -rf node_modules package-lock.json
npm install
```

### "Network error" when creating smart account

- Check your internet connection
- Verify Monad RPC URL is correct
- Try a different RPC if available

### "Insufficient funds" error

- Fund your smart account with testnet MON
- Get tokens from [Monad Faucet](https://faucet.monad.xyz)

### "Bundler error" when executing

- Either configure a bundler (Pimlico)
- Or ensure smart account has gas tokens

## 📚 Next Steps

Once you have the basic flow working:

1. **Configure AI:**
   - Add OpenAI API key for intelligent rebalancing
   - Or add Crestal IntentKit credentials

2. **Set up Bundler:**
   - Get Pimlico API key for gasless transactions
   - Add to `.env.local`

3. **Deploy Envio:**
   - Index blockchain events
   - Enable analytics and history
   - Follow [envio/README.md](envio/README.md)

4. **Deploy to Production:**
   - Deploy to Vercel (free)
   - Follow [DEPLOYMENT.md](DEPLOYMENT.md)

5. **Record Demo:**
   - Follow [DEMO.md](DEMO.md) script
   - Record a compelling demo video

## 🔗 Useful Resources

- [Full README](README.md) - Complete documentation
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Demo Guide](DEMO.md) - Recording demo video
- [Monad Docs](https://docs.monad.xyz/)
- [MetaMask Toolkit](https://docs.metamask.io/delegation-toolkit/)

## 💡 Tips

- Use the **health check** endpoint: `http://localhost:3000/api/health`
- Check browser console for detailed logs
- View transactions on [Monad Explorer](https://testnet.monadexplorer.com)
- Join [Monad Discord](https://discord.com/invite/monaddev) for support

## ✅ Verification Checklist

- [ ] App runs on localhost:3000
- [ ] Can create smart account
- [ ] Can create delegation
- [ ] Can view portfolio balances
- [ ] Can compute rebalancing strategy
- [ ] Can execute rebalancing (if funded)

---

**You're ready to go! Start building and good luck with the hackathon! 🚀**
