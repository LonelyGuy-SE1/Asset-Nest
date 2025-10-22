// Test Crestal AI API directly
const axios = require('axios');
const fs = require('fs');

// Load .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

async function testCrestal() {
  const API_KEY = process.env.CRESTAL_API_KEY;
  const BASE_URL = 'https://open.service.crestal.network/v1';

  if (!API_KEY) {
    console.error('❌ CRESTAL_API_KEY not set in environment');
    return;
  }

  console.log('🔵 Testing Crestal AI API...');
  console.log('📍 Base URL:', BASE_URL);

  try {
    // Step 1: Create chat thread
    console.log('\n📝 Step 1: Creating chat thread...');
    const chatResponse = await axios.post(
      `${BASE_URL}/chats`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const chatId = chatResponse.data.id;
    console.log('✅ Chat thread created:', chatId);

    // Step 2: Send portfolio analysis request
    const prompt = `You are an expert DeFi portfolio rebalancer. Analyze this portfolio:

PORTFOLIO:
Token 1: MON (Monad) - $100 (50% allocation) - 10 tokens
Token 2: USDC - $80 (40% allocation) - 80 tokens
Token 3: aprMON - $20 (10% allocation) - 20 tokens

CRITICAL: RESPOND WITH VALID JSON ONLY. NO MARKDOWN, NO CODE BLOCKS.
START YOUR RESPONSE WITH { AND END WITH }

REQUIRED JSON FORMAT:
{
  "trades": [
    {
      "fromToken": "0xcontract",
      "toToken": "0xcontract",
      "fromSymbol": "TOKEN1",
      "toSymbol": "TOKEN2",
      "amount": "5",
      "reason": "why this trade"
    }
  ],
  "rationale": "Your analysis of portfolio health and trade reasoning",
  "estimatedGas": "0.01 ETH"
}

PROVIDE AT LEAST 2 TRADES TO REBALANCE THIS PORTFOLIO.`;

    console.log('\n📝 Step 2: Sending analysis request...');
    console.log('📨 Prompt length:', prompt.length, 'chars');

    const messageResponse = await axios.post(
      `${BASE_URL}/chats/${chatId}/messages`,
      {
        message: prompt,
        stream: false,
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    console.log('\n✅ Response received!');
    console.log('📦 Response keys:', Object.keys(messageResponse.data));

    let aiContent = '';
    if (messageResponse.data.message) {
      aiContent = messageResponse.data.message;
    } else if (messageResponse.data.content) {
      aiContent = messageResponse.data.content;
    } else {
      aiContent = JSON.stringify(messageResponse.data);
    }

    console.log('\n📝 AI Response Content:');
    console.log('─'.repeat(80));
    console.log(aiContent);
    console.log('─'.repeat(80));

    // Try to parse JSON
    let cleanContent = aiContent.trim();
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
    }

    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('\n✅ Successfully parsed JSON:');
        console.log('  - Trades:', parsed.trades?.length || 0);
        console.log('  - Rationale length:', parsed.rationale?.length || 0);
        console.log('\n📋 Parsed trades:');
        parsed.trades?.forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.fromSymbol} → ${t.toSymbol}: ${t.amount}`);
          console.log(`     Reason: ${t.reason}`);
        });
      } catch (e) {
        console.error('❌ Failed to parse JSON:', e.message);
      }
    } else {
      console.error('❌ No JSON found in response');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  }
}

testCrestal();
