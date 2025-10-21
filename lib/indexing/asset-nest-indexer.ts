/**
 * Enhanced Transaction Indexing using Envio patterns
 * Reference: https://docs.envio.dev/docs/HyperIndex/monad-testnet
 * 
 * This module provides enhanced transaction indexing and analytics
 * for Asset Nest operations on Monad Testnet
 */

export interface IndexedTransaction {
  id: string;
  hash: string;
  blockNumber: bigint;
  timestamp: number;
  from: string;
  to: string;
  type: 'swap' | 'rebalance' | 'delegation' | 'smart-account-creation';
  status: 'pending' | 'success' | 'failed';
  gasUsed: bigint;
  gasPrice: bigint;
  value: bigint;
  metadata: {
    tokens?: {
      fromToken: string;
      toToken: string;
      fromSymbol: string;
      toSymbol: string;
      fromAmount: string;
      toAmount: string;
    };
    delegation?: {
      delegate: string;
      delegator: string;
      permissions: string[];
    };
    smartAccount?: {
      owner: string;
      implementation: string;
    };
  };
}

export interface PortfolioSnapshot {
  id: string;
  address: string;
  timestamp: number;
  totalValueUSD: number;
  tokenCount: number;
  tokens: Array<{
    address: string;
    symbol: string;
    balance: string;
    valueUSD: number;
    percentage: number;
  }>;
}

/**
 * Enhanced Transaction Indexer inspired by Envio HyperIndex
 * Provides real-time indexing of Asset Nest transactions on Monad
 */
export class AssetNestIndexer {
  private transactions: Map<string, IndexedTransaction> = new Map();
  private portfolioSnapshots: Map<string, PortfolioSnapshot[]> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor() {
    console.log('AssetNestIndexer initialized with Envio-inspired patterns');
  }

  /**
   * Index a new transaction (similar to Envio event handlers)
   */
  async indexTransaction(tx: Partial<IndexedTransaction>): Promise<void> {
    const transaction: IndexedTransaction = {
      id: tx.id || `${tx.hash}_${Date.now()}`,
      hash: tx.hash || '',
      blockNumber: tx.blockNumber || BigInt(0),
      timestamp: tx.timestamp || Date.now(),
      from: tx.from || '',
      to: tx.to || '',
      type: tx.type || 'swap',
      status: tx.status || 'pending',
      gasUsed: tx.gasUsed || BigInt(0),
      gasPrice: tx.gasPrice || BigInt(0),
      value: tx.value || BigInt(0),
      metadata: tx.metadata || {},
    };

    this.transactions.set(transaction.id, transaction);
    
    // Emit events for real-time updates (Envio pattern)
    this.emit('transaction:indexed', transaction);
    this.emit(`transaction:${transaction.type}`, transaction);

    console.log(`Transaction indexed: ${transaction.type} - ${transaction.hash}`);
  }

  /**
   * Create portfolio snapshot (Envio-style entity management)
   */
  async createPortfolioSnapshot(
    address: string, 
    portfolio: {
      totalValueUSD: number;
      tokens: Array<{
        address: string;
        symbol: string;
        balance: string;
        valueUSD: number;
        percentage: number;
      }>;
    }
  ): Promise<void> {
    const snapshot: PortfolioSnapshot = {
      id: `${address}_${Date.now()}`,
      address,
      timestamp: Date.now(),
      totalValueUSD: portfolio.totalValueUSD,
      tokenCount: portfolio.tokens.length,
      tokens: portfolio.tokens,
    };

    if (!this.portfolioSnapshots.has(address)) {
      this.portfolioSnapshots.set(address, []);
    }
    
    this.portfolioSnapshots.get(address)!.push(snapshot);

    // Keep only last 100 snapshots per address
    const snapshots = this.portfolioSnapshots.get(address)!;
    if (snapshots.length > 100) {
      snapshots.splice(0, snapshots.length - 100);
    }

    this.emit('portfolio:snapshot', snapshot);
  }

  /**
   * Get transaction history for an address
   */
  getTransactionHistory(address: string, type?: string): IndexedTransaction[] {
    const transactions = Array.from(this.transactions.values())
      .filter(tx => tx.from.toLowerCase() === address.toLowerCase() || tx.to.toLowerCase() === address.toLowerCase())
      .filter(tx => !type || tx.type === type)
      .sort((a, b) => b.timestamp - a.timestamp);

    return transactions;
  }

  /**
   * Get portfolio evolution over time
   */
  getPortfolioHistory(address: string): PortfolioSnapshot[] {
    return this.portfolioSnapshots.get(address.toLowerCase()) || [];
  }

  /**
   * Get analytics similar to Envio dashboards
   */
  getAnalytics(address: string) {
    const transactions = this.getTransactionHistory(address);
    const portfolioHistory = this.getPortfolioHistory(address);

    const swaps = transactions.filter(tx => tx.type === 'swap');
    const rebalances = transactions.filter(tx => tx.type === 'rebalance');

    const totalGasUsed = transactions.reduce((sum, tx) => sum + tx.gasUsed, BigInt(0));
    const totalVolume = swaps.reduce((sum, tx) => {
      const metadata = tx.metadata.tokens;
      return sum + (metadata ? parseFloat(metadata.fromAmount) : 0);
    }, 0);

    return {
      totalTransactions: transactions.length,
      totalSwaps: swaps.length,
      totalRebalances: rebalances.length,
      totalGasUsed: totalGasUsed.toString(),
      totalVolume,
      portfolioSnapshots: portfolioHistory.length,
      latestPortfolioValue: portfolioHistory[portfolioHistory.length - 1]?.totalValueUSD || 0,
      firstActivity: transactions[transactions.length - 1]?.timestamp,
      lastActivity: transactions[0]?.timestamp,
    };
  }

  /**
   * Event system for real-time updates (Envio pattern)
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Export data for Envio HyperSync (for production integration)
   */
  exportForEnvio(): {
    transactions: IndexedTransaction[];
    portfolios: PortfolioSnapshot[];
  } {
    return {
      transactions: Array.from(this.transactions.values()),
      portfolios: Array.from(this.portfolioSnapshots.values()).flat(),
    };
  }
}

// Export singleton instance
export const assetNestIndexer = new AssetNestIndexer();

/**
 * Integration helpers for Envio HyperIndex
 */
export const envioHelpers = {
  /**
   * Format transaction for Envio schema
   */
  formatTransactionForEnvio(tx: IndexedTransaction) {
    return {
      id: tx.id,
      transactionHash: tx.hash,
      blockNumber: tx.blockNumber.toString(),
      timestamp: new Date(tx.timestamp).toISOString(),
      fromAddress: tx.from,
      toAddress: tx.to,
      transactionType: tx.type,
      status: tx.status,
      gasUsed: tx.gasUsed.toString(),
      gasPrice: tx.gasPrice.toString(),
      value: tx.value.toString(),
      metadata: JSON.stringify(tx.metadata),
    };
  },

  /**
   * Format portfolio for Envio schema  
   */
  formatPortfolioForEnvio(snapshot: PortfolioSnapshot) {
    return {
      id: snapshot.id,
      userAddress: snapshot.address,
      timestamp: new Date(snapshot.timestamp).toISOString(),
      totalValueUSD: snapshot.totalValueUSD.toString(),
      tokenCount: snapshot.tokenCount,
      tokens: JSON.stringify(snapshot.tokens),
    };
  },
};