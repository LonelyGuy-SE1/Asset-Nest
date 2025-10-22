/**
 * Dedicated Swap History Logger
 * Separate from general activity log, focused on swap transactions
 */

export interface SwapRecord {
  id: string;
  timestamp: number;
  txHash?: string;
  fromToken: string;
  toToken: string;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  toAmount: string;
  gasUsed?: string;
  gasCost?: string;
  status: 'pending' | 'success' | 'failed';
  type: 'manual' | 'rebalance';
  notes?: string;
}

class SwapHistoryLogger {
  private readonly storageKey = 'asset-nest-swap-history';
  private readonly maxRecords = 100; // Keep last 100 swaps

  /**
   * Add a swap record to history
   */
  public addSwap(swap: Omit<SwapRecord, 'id' | 'timestamp'>): SwapRecord {
    const record: SwapRecord = {
      ...swap,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    const history = this.getHistory();
    history.unshift(record); // Add to beginning

    // Keep only the latest records
    if (history.length > this.maxRecords) {
      history.splice(this.maxRecords);
    }

    this.saveHistory(history);
    console.log('💱 Swap recorded:', record);
    
    return record;
  }

  /**
   * Update existing swap record (e.g., when transaction confirms)
   */
  public updateSwap(id: string, updates: Partial<SwapRecord>): boolean {
    const history = this.getHistory();
    const index = history.findIndex(record => record.id === id);
    
    if (index === -1) return false;

    history[index] = { ...history[index], ...updates };
    this.saveHistory(history);
    
    console.log('💱 Swap updated:', history[index]);
    return true;
  }

  /**
   * Get all swap history
   */
  public getHistory(): SwapRecord[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load swap history:', error);
      return [];
    }
  }

  /**
   * Get swaps for a specific time period
   */
  public getSwapsInPeriod(hours: number): SwapRecord[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.getHistory().filter(swap => swap.timestamp >= cutoff);
  }

  /**
   * Get swaps by type
   */
  public getSwapsByType(type: 'manual' | 'rebalance'): SwapRecord[] {
    return this.getHistory().filter(swap => swap.type === type);
  }

  /**
   * Get successful swaps only
   */
  public getSuccessfulSwaps(): SwapRecord[] {
    return this.getHistory().filter(swap => swap.status === 'success');
  }

  /**
   * Calculate total volume traded
   */
  public getTotalVolumeUSD(): number {
    // This would need price data to calculate properly
    // For now, return count of successful swaps
    return this.getSuccessfulSwaps().length;
  }

  /**
   * Get swap statistics
   */
  public getStats() {
    const history = this.getHistory();
    const successful = history.filter(s => s.status === 'success');
    const failed = history.filter(s => s.status === 'failed');
    const pending = history.filter(s => s.status === 'pending');
    
    return {
      total: history.length,
      successful: successful.length,
      failed: failed.length,
      pending: pending.length,
      successRate: history.length > 0 ? (successful.length / history.length) * 100 : 0,
      last24h: this.getSwapsInPeriod(24).length,
      manual: history.filter(s => s.type === 'manual').length,
      rebalance: history.filter(s => s.type === 'rebalance').length,
    };
  }

  /**
   * Clear all swap history
   */
  public clearHistory(): void {
    localStorage.removeItem(this.storageKey);
    console.log('💱 Swap history cleared');
  }

  /**
   * Export swap history as JSON
   */
  public exportHistory(): string {
    return JSON.stringify(this.getHistory(), null, 2);
  }

  private generateId(): string {
    return `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private saveHistory(history: SwapRecord[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save swap history:', error);
    }
  }
}

// Export singleton instance
export const swapHistory = new SwapHistoryLogger();