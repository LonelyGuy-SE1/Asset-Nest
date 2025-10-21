/**
 * Monorail API Test - Following Official Documentation Exactly
 * Based on: https://testnet-preview.monorail.xyz/developers/documentation
 */

export async function testMonorailQuote() {
  // Define your Monorail app ID
  const appId = '0';

  // MON (native token)
  const tokenIn = '0x0000000000000000000000000000000000000000'; 
  // USDC (example token)
  const tokenOut = '0xf817257fed379853cde0fa4f97ab987181b1e5ea'; 

  // Set the amount of MON to swap
  const amountToSwap = 1.5;

  // Construct the quote URL exactly as shown in Monorail docs
  const quoteUrl = new URL('https://testnet-pathfinder.monorail.xyz/v4/quote');
  quoteUrl.searchParams.set('source', appId);
  quoteUrl.searchParams.set('from', tokenIn);
  quoteUrl.searchParams.set('to', tokenOut);
  quoteUrl.searchParams.set('amount', amountToSwap.toString());

  console.log('Testing Monorail API with exact documentation parameters:');
  console.log('URL:', quoteUrl.toString());

  try {
    // Fetch the quote exactly as shown in docs
    const response = await fetch(quoteUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Monorail API Error:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return null;
    }

    const result = await response.json();
    
    // Output the estimated USDC from the swap
    console.log(`USDC from swap: ${result.output_formatted}`);
    console.log('Full response:', result);
    
    return result;
  } catch (error) {
    console.error('Network error:', error);
    return null;
  }
}