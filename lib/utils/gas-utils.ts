/**
 * Gas estimation utilities for human-readable display
 */

/**
 * Convert gas units to human-readable MON estimate
 * @param gasUnits - Gas units as string or number
 * @param gasPrice - Optional gas price in gwei (defaults to estimated 2 gwei for Monad)
 * @returns Human-readable gas cost (e.g., "0.0004 MON")
 */
export function formatGasEstimate(gasUnits: string | number, gasPrice: number = 2): string {
  try {
    const gas = typeof gasUnits === 'string' ? parseInt(gasUnits) : gasUnits;
    
    if (isNaN(gas) || gas <= 0) {
      return "~0.0004 MON"; // Fallback estimate
    }

    // Calculate gas cost in MON
    // gas_units * gas_price_gwei * 1e-9 = cost_in_MON
    const gasCostMON = (gas * gasPrice) / 1e9;
    
    // Format with appropriate precision
    if (gasCostMON < 0.001) {
      return `~${gasCostMON.toFixed(6)} MON`;
    } else if (gasCostMON < 0.01) {
      return `~${gasCostMON.toFixed(4)} MON`;
    } else {
      return `~${gasCostMON.toFixed(3)} MON`;
    }
  } catch (error) {
    console.warn('Error formatting gas estimate:', error);
    return "~0.0004 MON";
  }
}

/**
 * Get detailed gas breakdown for display
 * @param gasUnits - Gas units as string or number  
 * @param gasPrice - Optional gas price in gwei
 * @returns Object with both units and MON estimate
 */
export function getGasBreakdown(gasUnits: string | number, gasPrice: number = 2) {
  const gas = typeof gasUnits === 'string' ? parseInt(gasUnits) : gasUnits;
  const monEstimate = formatGasEstimate(gasUnits, gasPrice);
  
  return {
    units: gas.toLocaleString(),
    monEstimate,
    display: `${monEstimate} (${gas.toLocaleString()} units)`
  };
}