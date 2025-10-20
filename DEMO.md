# Demo Video Guide for Asset Nest

This guide helps you record a compelling demo video for the hackathon submission.

## 📹 Video Requirements

- **Duration:** 3-5 minutes
- **Format:** MP4, 1080p recommended
- **Content:** Must show working MetaMask Smart Accounts integration on Monad

## 🎬 Demo Script

### Introduction (30 seconds)

"Hi! I'm presenting Asset Nest, an AI-powered smart portfolio rebalancer built on Monad using MetaMask Smart Accounts."

**Show:** Landing page with project title and description

### Problem Statement (30 seconds)

"Managing crypto portfolios is challenging. Users need to constantly monitor prices, compute optimal trades, and pay high gas fees. Asset Nest solves this with autonomous AI-powered rebalancing."

**Show:** Current portfolio with imbalanced allocations

### Solution Overview (1 minute)

"Asset Nest uses four key technologies:

1. **MetaMask Smart Accounts** - For gasless, automated trading
2. **Monad L1** - High-performance blockchain with 10,000 TPS
3. **Monorail** - Optimal swap routing and best prices
4. **AI Agent** - Intelligent rebalancing strategies using OpenAI or Crestal

**Show:** Architecture diagram or component overview

### Live Demo (2-3 minutes)

#### Step 1: Create Smart Account (30 seconds)

"First, I'll create a MetaMask Smart Account on Monad testnet."

**Show:**
- Entering signer private key
- Clicking "Create Smart Account"
- Smart account address appearing

**Narrate:**
- "This creates an ERC-4337 smart account that supports delegations and gasless transactions"
- "The account is counterfactually deployed - it will be deployed on first use"

#### Step 2: Create Delegation (30 seconds)

"Next, I'll grant my AI agent permission to trade on my behalf using MetaMask delegations."

**Show:**
- Entering agent private key
- Clicking "Create Delegation"
- Success message

**Narrate:**
- "This delegation allows the agent to execute trades without requiring my signature each time"
- "It's secure because delegations can be revoked anytime"

#### Step 3: View Portfolio (30 seconds)

"Now let's look at my current portfolio."

**Show:**
- Portfolio balances table
- Current allocation percentages
- Total portfolio value

**Narrate:**
- "I have MON, USDC, USDT, and WETH"
- "My current allocation is imbalanced - let me set target percentages"

#### Step 4: Compute Strategy (45 seconds)

"I'll set my target allocation to 40% MON, 30% USDC, 20% USDT, and 10% WETH."

**Show:**
- Adjusting target percentage inputs
- Clicking "Compute Rebalancing Strategy"
- AI rationale appearing
- List of required trades

**Narrate:**
- "The AI analyzes my portfolio and computes the optimal trades"
- "It minimizes the number of swaps and gas costs"
- "Here's the AI's rationale and the exact trades needed"

#### Step 5: Execute Rebalancing (45 seconds)

"Let's execute the rebalancing."

**Show:**
- Clicking "Execute Rebalancing"
- Loading indicator
- Success message with transaction hash
- Opening Monad Explorer
- Transaction details on explorer

**Narrate:**
- "The agent batches all swaps into a single UserOperation"
- "This is sent via the smart account through a bundler"
- "Let's verify on Monad Explorer..."
- "Here you can see the transaction executed successfully on Monad testnet"

#### Bonus: Envio Indexing (optional, 30 seconds)

If time permits:

**Show:**
- Envio GraphQL playground
- Querying smart account data
- Historical trades and analytics

**Narrate:**
- "We also use Envio HyperIndex to track all events"
- "This provides analytics, historical data, and portfolio insights"

### Conclusion (30 seconds)

"Asset Nest demonstrates the power of combining MetaMask Smart Accounts, Monad's performance, AI intelligence, and decentralized infrastructure."

"This qualifies for multiple tracks:
- Best AI Agent
- Best On-Chain Automation
- Most Innovative Use of Delegations
- Best Use of Envio"

"Thank you for watching! The code is open source and ready to deploy."

**Show:** GitHub repo link or final slide with project name

## 🎥 Recording Tips

### Setup

1. **Clean browser window** - Close unnecessary tabs
2. **Full screen** - Record in fullscreen mode
3. **Good lighting** - If showing yourself
4. **Clear audio** - Use a decent microphone
5. **Zoom in** - Make sure text is readable

### Before Recording

1. **Fund your smart account** with testnet tokens
2. **Test the complete flow** at least twice
3. **Have private keys ready** (or pre-filled)
4. **Open Monad Explorer** in another tab
5. **Check Envio endpoint** is working

### During Recording

1. **Speak clearly and confidently**
2. **Don't rush** - give viewers time to read text
3. **Highlight key features** with cursor
4. **Show real transactions** on Monad Explorer
5. **Demonstrate working integrations**

### After Recording

1. **Edit out mistakes** - keep it polished
2. **Add captions** if possible
3. **Check audio levels**
4. **Export in high quality** (1080p)
5. **Upload to YouTube/Loom**

## 📝 Submission Checklist

- [ ] Video shows MetaMask Smart Account creation
- [ ] Video shows delegation being created
- [ ] Video shows AI computing rebalancing strategy
- [ ] Video shows trade execution on Monad
- [ ] Video shows transaction on Monad Explorer
- [ ] Video is 3-5 minutes long
- [ ] Audio is clear and professional
- [ ] All integrations are working
- [ ] GitHub repo link is included
- [ ] Demo is compelling and easy to follow

## 🔗 Quick Test Transactions

Before recording, ensure these work:

```bash
# 1. Create smart account
curl -X POST http://localhost:3000/api/smart-account/create \
  -H "Content-Type: application/json" \
  -d '{"signerPrivateKey":"0x..."}'

# 2. Create delegation
curl -X POST http://localhost:3000/api/delegation/create \
  -H "Content-Type: application/json" \
  -d '{"smartAccountAddress":"0x...","agentAddress":"0x...","signerPrivateKey":"0x...","type":"open"}'

# 3. Fetch portfolio
curl http://localhost:3000/api/portfolio/balances?address=0x...

# 4. Compute strategy
curl -X POST http://localhost:3000/api/rebalance/strategy \
  -H "Content-Type: application/json" \
  -d '{"holdings":[...],"targets":[...]}'

# 5. Execute rebalancing
curl -X POST http://localhost:3000/api/rebalance/execute \
  -H "Content-Type: application/json" \
  -d '{"trades":[...],"smartAccountPrivateKey":"0x..."}'
```

## 🎯 Key Points to Emphasize

1. **MetaMask Smart Accounts** - Show delegation creation
2. **Monad Testnet** - Verify transactions on explorer
3. **AI Intelligence** - Highlight AI rationale
4. **Monorail Integration** - Mention optimal routing
5. **Envio Indexing** - Query historical data
6. **Gasless Transactions** - Explain bundler and paymasters
7. **User Experience** - Smooth, automated flow
8. **Security** - Delegations can be revoked

## 📱 Social Media Snippet (30 seconds)

For Twitter/X post:

"Just built Asset Nest - an AI-powered portfolio rebalancer on @monad_xyz using @MetaMask Smart Accounts!

🤖 AI computes optimal trades
💸 Gasless execution via delegations
⚡ 10,000 TPS on Monad
📊 @envio_indexer for analytics

Check it out 👇"

[Link to full demo video]

---

**Good luck with your demo! Make it engaging and show off the technology!** 🚀
