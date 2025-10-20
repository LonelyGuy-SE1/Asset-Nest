# Asset Nest - AI-Driven Smart Portfolio Rebalancer

An autonomous AI-powered portfolio rebalancer built on Monad L1 using MetaMask Smart Accounts, with best-price execution via Monorail and blockchain indexing via Envio.

**Hackathon Submission for:** MetaMask Smart Accounts x Monad x Envio Dev Cook-Off

## 🏆 Qualifying Tracks

This project qualifies for the following tracks:

- ✅ **Best AI Agent** - Uses AI (OpenAI/Crestal IntentKit) to autonomously compute optimal rebalancing strategies
- ✅ **Best On-Chain Automation** - Automated portfolio rebalancing with delegated execution
- ✅ **Most Innovative Use of Delegations** - Leverages MetaMask delegations for agent-based trading
- ✅ **Best Use of Envio** - Comprehensive indexing of smart account events, trades, and analytics

## 🎯 Project Overview

Asset Nest enables users to:

1. **Create MetaMask Smart Accounts** on Monad Testnet
2. **Delegate trading permissions** to an AI agent using MetaMask delegations
3. **Set target portfolio allocations** (e.g., 40% MON, 30% USDC, 20% USDT, 10% WETH)
4. **Compute AI-powered rebalancing strategies** using OpenAI or Crestal IntentKit
5. **Execute gasless trades** via Monorail swap API with optimal routing
6. **Track portfolio history** using Envio HyperIndex for analytics

## 🏗️ Architecture

```
┌─────────────────┐
│   React/Next.js │  Dark-themed VS Code style UI
│    Frontend     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   API Routes    │  Backend endpoints for portfolio management
│  (Next.js API)  │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬───────────┐
    ▼         ▼          ▼           ▼
┌────────┐ ┌─────┐  ┌──────┐   ┌────────┐
│MetaMask│ │ AI  │  │Monorail  │Envio   │
│Smart   │ │Agent│  │Swap API│ │HyperIndex
│Accounts│ │     │  │        │ │        │
└────────┘ └─────┘  └──────┘   └────────┘
    │         │          │           │
    └─────────┴──────────┴───────────┘
                    │
                    ▼
            ┌──────────────┐
            │ Monad Testnet│
            │   (Chain ID: │
            │     10143)   │
            └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- npm or yarn
- MetaMask wallet
- Monad testnet MON tokens ([Get from faucet](https://faucet.monad.xyz))

### Installation

1. **Clone and install dependencies:**

```bash
cd asset-nest-rebalancer
npm install
```

2. **Configure environment variables:**

Copy `.env.local` and fill in your keys:

```bash
# Required
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_MONAD_CHAIN_ID=10143

# For Bundler (Pimlico recommended)
NEXT_PUBLIC_BUNDLER_RPC_URL=https://api.pimlico.io/v2/10143/rpc?apikey=YOUR_KEY

# For AI Rebalancing (choose one)
OPENAI_API_KEY=your_openai_key
# OR
CRESTAL_API_KEY=your_crestal_key
CRESTAL_API_URL=https://open.service.crestal.network/v1

# For Monorail Swaps
NEXT_PUBLIC_MONORAIL_API_URL=https://testnet-pathfinder.monorail.xyz
NEXT_PUBLIC_MONORAIL_APP_ID=asset-nest-rebalancer

# For Envio Indexing (after deployment)
NEXT_PUBLIC_ENVIO_GRAPHQL_URL=your_envio_endpoint
```

3. **Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Guide

### Step 1: Setup Smart Account & Delegation

1. Enter your private key (will be used to create smart account)
2. Click "Create Smart Account" - this creates a MetaMask Smart Account
3. Enter an AI agent private key (can be a new generated key)
4. Click "Create Delegation" - grants the agent permission to trade on your behalf

> **Security Note:** In production, use MetaMask SDK or embedded wallets instead of raw private keys.

### Step 2: View Portfolio

- Your current token balances will be displayed
- Set target allocations using the percentage inputs
- Ensure targets sum to 100%

### Step 3: Compute Rebalancing Strategy

- Click "Compute Rebalancing Strategy"
- AI analyzes your portfolio and suggests optimal trades
- Review the trade list, rationale, and estimated gas

### Step 4: Execute Rebalancing

- Click "Execute Rebalancing"
- The agent executes all trades via Monorail swap API
- Transactions are sent as a batch UserOperation via the smart account
- View transaction on [Monad Explorer](https://testnet.monadexplorer.com)

## 🔧 Technical Implementation

### MetaMask Smart Accounts

Implementation: [`lib/smart-account/create-account.ts`](lib/smart-account/create-account.ts)

```typescript
const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [signerAccount.address, [], [], []],
  deploySalt: '0x',
  signer: { account: signerAccount },
});
```

**References:**

- [MetaMask Delegation Toolkit Docs](https://docs.metamask.io/delegation-toolkit)
- [Smart Account Quickstart](https://docs.metamask.io/delegation-toolkit/get-started/smart-account-quickstart/)

### Delegations

Implementation: [`lib/smart-account/delegation.ts`](lib/smart-account/delegation.ts)

```typescript
const delegation = await createOpenDelegationForAgent(
  smartAccountAddress,
  agentAddress,
  signerPrivateKey
);
```

**References:**

- [Delegation Concepts](https://docs.metamask.io/delegation-toolkit/concepts/delegation/)
- [Create Delegation Guide](https://docs.metamask.io/delegation-toolkit/guides/smart-accounts/create-smart-account/)

### AI Rebalancing

Implementation: [`lib/ai/rebalancer.ts`](lib/ai/rebalancer.ts)

Supports:

- **OpenAI GPT-4** for intelligent strategy computation
- **Crestal IntentKit** for intent-based trading
- **Fallback algorithm** if no AI API is configured

```typescript
const rebalancer = createRebalancer();
const strategy = await rebalancer.computeRebalancingTrades(holdings, targets);
```

**References:**

- [Crestal IntentKit API](https://open.service.crestal.network/v1/redoc)
- [OpenAI API Docs](https://platform.openai.com/docs)

### Monorail Swap Integration

Implementation: [`lib/monorail/swap.ts`](lib/monorail/swap.ts)

```typescript
const quote = await monorailClient.getQuote({
  from: tokenInAddress,
  to: tokenOutAddress,
  amount: amountInWei,
  slippage: 0.5,
});

const swapTx = monorailClient.prepareSwapTransaction(quote);
```

**References:**

- [Monorail Developer Docs](https://testnet-preview.monorail.xyz/developers)
- [Quote API Documentation](https://testnet-preview.monorail.xyz/developers/documentation)

### Envio HyperIndex

Setup: [`envio/`](envio/) directory

Indexes:

- Smart Account creation and deployment events
- Delegation lifecycle (created, redeemed, revoked)
- Swap transactions from Monorail
- Portfolio snapshots and analytics

**Deploy Indexer:**

```bash
cd envio
npm install -g envio
envio deploy
```

**Query Example:**

```graphql
query GetSmartAccount($address: String!) {
  smartAccount(id: $address) {
    totalTrades
    totalVolume
    trades {
      tokenIn
      tokenOut
      amountIn
      amountOut
      executedAt
    }
  }
}
```

**References:**

- [Envio HyperIndex Overview](https://docs.envio.dev/docs/HyperIndex/overview)
- [Monad Testnet Indexing](https://docs.envio.dev/docs/HyperIndex/monad-testnet)
- [Configuration Guide](https://docs.envio.dev/docs/HyperIndex/configuration-file)

## 🎨 Frontend

Built with:

- **Next.js 15** with App Router
- **Tailwind CSS** with VS Code dark theme
- **TypeScript** for type safety
- **Responsive design** for mobile and desktop

Key features:

- Real-time portfolio display
- Interactive target allocation inputs
- Step-by-step wizard interface
- Transaction status tracking
- Loading states and error handling

## 📁 Project Structure

```
asset-nest-rebalancer/
├── app/
│   ├── api/                    # Next.js API routes
│   │   ├── smart-account/      # Smart account endpoints
│   │   ├── delegation/         # Delegation endpoints
│   │   ├── portfolio/          # Portfolio data endpoints
│   │   ├── rebalance/          # Rebalancing logic endpoints
│   │   └── analytics/          # Envio analytics endpoints
│   ├── page.tsx                # Main UI component
│   ├── layout.tsx              # App layout
│   └── globals.css             # Global styles
├── lib/
│   ├── config/                 # Configuration files
│   │   ├── monad-chain.ts      # Monad chain config
│   │   └── viem-clients.ts     # Viem client setup
│   ├── smart-account/          # Smart account utilities
│   │   ├── create-account.ts   # Account creation
│   │   └── delegation.ts       # Delegation management
│   ├── ai/                     # AI rebalancing logic
│   │   └── rebalancer.ts       # AI strategies
│   └── monorail/               # Monorail integration
│       └── swap.ts             # Swap API client
├── envio/                      # Envio indexer
│   ├── config.yaml             # Indexer configuration
│   ├── schema.graphql          # Data schema
│   └── src/handlers/           # Event handlers
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### End-to-End Testing on Monad Testnet

1. Fund your smart account with testnet tokens
2. Run through the complete flow:
   - Create smart account
   - Create delegation
   - Fetch portfolio
   - Compute strategy
   - Execute rebalancing
3. Verify transactions on [Monad Explorer](https://testnet.monadexplorer.com)

## 📊 Demo Video

[Link to demo video showing:]

1. Creating MetaMask Smart Account on Monad
2. Granting delegation to AI agent
3. Setting target portfolio allocations
4. AI computing rebalancing strategy
5. Executing gasless swaps via smart account
6. Viewing transaction on Monad Explorer
7. Querying indexed data from Envio

## 🏅 Hackathon Qualification Checklist

### MetaMask Smart Accounts ✅

- [x] Uses MetaMask Delegation Toolkit SDK
- [x] Creates and deploys smart accounts on Monad testnet
- [x] Implements delegations for agent-based execution
- [x] Sends gasless transactions via bundler
- [x] Demo video shows MetaMask Smart Accounts integration

### Monad ✅

- [x] Deployed on Monad testnet (Chain ID: 10143)
- [x] Uses Monad RPC: https://testnet-rpc.monad.xyz
- [x] Integrates with Monorail for swaps
- [x] Transactions viewable on Monad Explorer

### AI Agent Track ✅

- [x] Implements AI agent for portfolio management
- [x] Uses AI (OpenAI/Crestal) to compute optimal trades
- [x] Agent acts autonomously via delegations
- [x] Minimizes gas costs and trade count
- [x] Provides rationale for rebalancing decisions

### Best On-Chain Automation Track ✅

- [x] Automated portfolio rebalancing
- [x] Delegated execution via smart accounts
- [x] Batch trade execution in single transaction
- [x] Scheduled/triggered rebalancing capability

### Envio Bonus ✅

- [x] Working HyperIndex indexer
- [x] Indexes smart account events on Monad
- [x] GraphQL API for querying indexed data
- [x] Frontend consumes Envio data
- [x] Documentation and code demonstrate Envio usage

## 🔗 Important Links

### Documentation

- [MetaMask Delegation Toolkit](https://docs.metamask.io/delegation-toolkit)
- [Monad Developer Docs](https://docs.monad.xyz/)
- [Monorail Developers](https://testnet-preview.monorail.xyz/developers)
- [Envio Docs](https://docs.envio.dev/)

### Explorers

- [Monad Testnet Explorer](https://testnet.monadexplorer.com/)
- [MonadScan](https://testnet.monadscan.com/)

### Tools

- [Monad Faucet](https://faucet.monad.xyz)
- [Pimlico Bundler](https://pimlico.io/)
- [Envio Hosted Service](https://envio.dev/)

## 🤝 Contributing

This is a hackathon project. Contributions, issues, and feature requests are welcome!

## 📜 License

MIT License - see LICENSE file for details

## 👥 Team

Built for the MetaMask Smart Accounts x Monad x Envio Hackathon

## 🙏 Acknowledgments

- MetaMask team for the Delegation Toolkit
- Monad team for the high-performance L1
- Monorail for optimal swap routing
- Envio for blockchain indexing infrastructure
- OpenAI / Crestal for AI capabilities

---

**Built with ❤️ for the MetaMask Smart Accounts Hackathon**
