# Asset Nest - AI Portfolio Rebalancer

AI-powered smart portfolio rebalancer on Monad using MetaMask Smart Accounts.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and connect your MetaMask wallet!

## ✨ Features

- **MetaMask Wallet Connection** - Connect with one click
- **Auto Portfolio Detection** - Automatically fetches your holdings
- **AI-Powered Rebalancing** - Smart strategies using OpenAI
- **Monad Testnet** - Fast, low-cost transactions
- **Dark Theme** - Professional VS Code aesthetic

## 🔧 Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create `.env.local`:
   ```bash
   NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
   NEXT_PUBLIC_MONAD_CHAIN_ID=10143
   OPENAI_API_KEY=your_openai_key
   ```

3. **Add Monad Testnet to MetaMask:**
   - Network Name: Monad Testnet
   - RPC URL: https://testnet-rpc.monad.xyz
   - Chain ID: 10143
   - Currency: MON
   - Explorer: https://testnet.monadexplorer.com

4. **Get testnet tokens:**
   - Visit https://faucet.monad.xyz
   - Enter your wallet address
   - Receive test MON tokens

5. **Run the app:**
   ```bash
   npm run dev
   ```

## 📱 How to Use

1. **Connect Wallet** - Click "Connect MetaMask"
2. **View Portfolio** - Your tokens are automatically loaded
3. **Set Targets** - Adjust your desired allocation percentages
4. **Compute Strategy** - AI calculates optimal trades
5. **Execute** - Rebalance your portfolio

## 🏗️ Architecture

- **Frontend**: Next.js 15 + React 18 + Tailwind CSS
- **Wallet**: Wagmi + Viem for MetaMask connection
- **Blockchain**: Monad Testnet (ERC-4337)
- **AI**: OpenAI GPT-4 for strategy computation
- **Swaps**: Monorail API for optimal routing
- **Indexing**: Envio HyperIndex

## 📚 Deploy Envio Indexer

1. **Push to GitHub:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/asset-nest.git
   git push -u origin main
   git push origin envio
   ```

2. **Deploy on Envio Hosted Service**
   - The `envio` branch is ready for deployment
   - See `envio/SETUP.md` for details

## 🏆 Hackathon Tracks

- ✅ Best AI Agent
- ✅ Best On-Chain Automation
- ✅ Most Innovative Use of Delegations
- ✅ Best Use of Envio

## 🔗 Links

- **Monad**: https://docs.monad.xyz/
- **MetaMask**: https://docs.metamask.io/delegation-toolkit/
- **Envio**: https://docs.envio.dev/
- **Monorail**: https://testnet-preview.monorail.xyz/developers

---

Built for MetaMask Smart Accounts x Monad Hackathon
