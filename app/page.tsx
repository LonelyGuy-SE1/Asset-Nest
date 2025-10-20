'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

interface Holding {
  token: string;
  symbol: string;
  balance: string;
  decimals: number;
  valueUSD: number;
  percentage: number;
}

interface Target {
  symbol: string;
  targetPercentage: number;
}

interface Trade {
  fromToken: string;
  toToken: string;
  fromSymbol: string;
  toSymbol: string;
  amount: string;
  reason: string;
}

interface Strategy {
  trades: Trade[];
  rationale: string;
  estimatedGas: string;
}

export default function Home() {
  const [step, setStep] = useState<'setup' | 'portfolio' | 'rebalance' | 'execute'>('setup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Setup state
  const [userPrivateKey, setUserPrivateKey] = useState('');
  const [agentPrivateKey, setAgentPrivateKey] = useState('');
  const [smartAccountAddress, setSmartAccountAddress] = useState('');
  const [delegationCreated, setDelegationCreated] = useState(false);

  // Portfolio state
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalValueUSD, setTotalValueUSD] = useState(0);

  // Rebalance state
  const [targets, setTargets] = useState<Target[]>([
    { symbol: 'MON', targetPercentage: 40 },
    { symbol: 'USDC', targetPercentage: 30 },
    { symbol: 'USDT', targetPercentage: 20 },
    { symbol: 'WETH', targetPercentage: 10 },
  ]);
  const [strategy, setStrategy] = useState<Strategy | null>(null);

  // Execute state
  const [txHash, setTxHash] = useState('');

  const handleCreateSmartAccount = async () => {
    if (!userPrivateKey) {
      setError('Please enter your private key');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/smart-account/create', {
        signerPrivateKey: userPrivateKey,
      });

      setSmartAccountAddress(response.data.smartAccountAddress);
      setSuccess(
        `Smart Account created: ${response.data.smartAccountAddress.slice(0, 10)}...${response.data.smartAccountAddress.slice(-8)}`
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create smart account');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDelegation = async () => {
    if (!smartAccountAddress || !agentPrivateKey) {
      setError('Please create smart account first and enter agent private key');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/delegation/create', {
        smartAccountAddress,
        agentAddress: agentPrivateKey, // In production, derive address from private key
        signerPrivateKey: userPrivateKey,
        type: 'open',
      });

      setDelegationCreated(true);
      setSuccess('Delegation created! Agent can now trade on your behalf.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create delegation');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPortfolio = async () => {
    if (!smartAccountAddress) {
      setError('Please create smart account first');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`/api/portfolio/balances?address=${smartAccountAddress}`);

      setHoldings(response.data.holdings);
      setTotalValueUSD(response.data.totalValueUSD);
      setSuccess('Portfolio fetched successfully');
      setStep('portfolio');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleComputeStrategy = async () => {
    if (holdings.length === 0) {
      setError('Please fetch portfolio first');
      return;
    }

    // Validate targets sum to 100%
    const targetSum = targets.reduce((sum, t) => sum + t.targetPercentage, 0);
    if (Math.abs(targetSum - 100) > 0.1) {
      setError(`Target percentages must sum to 100%, got ${targetSum}%`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/rebalance/strategy', {
        holdings: holdings.map((h) => ({
          token: h.token,
          symbol: h.symbol,
          balance: h.balance,
          valueUSD: h.valueUSD,
        })),
        targets,
      });

      setStrategy(response.data.strategy);
      setSuccess(
        `Rebalancing strategy computed: ${response.data.strategy.trades.length} trades required`
      );
      setStep('rebalance');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to compute strategy');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRebalance = async () => {
    if (!strategy) {
      setError('Please compute strategy first');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/rebalance/execute', {
        trades: strategy.trades,
        smartAccountPrivateKey: userPrivateKey,
      });

      setTxHash(response.data.userOpHash);
      setSuccess(
        `Rebalancing executed! ${response.data.tradesExecuted} trades completed. TX: ${response.data.userOpHash.slice(0, 10)}...`
      );
      setStep('execute');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to execute rebalance');
    } finally {
      setLoading(false);
    }
  };

  const updateTarget = (symbol: string, value: number) => {
    setTargets((prev) =>
      prev.map((t) => (t.symbol === symbol ? { ...t, targetPercentage: value } : t))
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="card bg-vscode-error/20 border-vscode-error fade-in">
          <div className="flex items-center">
            <span className="status-dot status-error"></span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="card bg-vscode-success/20 border-vscode-success fade-in">
          <div className="flex items-center">
            <span className="status-dot status-success"></span>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Step Indicator */}
      <div className="card">
        <div className="flex items-center justify-between space-x-4">
          {['setup', 'portfolio', 'rebalance', 'execute'].map((s, index) => (
            <div
              key={s}
              className={`flex-1 text-center py-2 rounded ${
                step === s ? 'bg-vscode-accent text-white' : 'bg-vscode-panel text-vscode-text/60'
              }`}
            >
              {index + 1}. {s.toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Setup Step */}
      {step === 'setup' && (
        <div className="card fade-in">
          <h2 className="text-2xl font-bold mb-4 text-vscode-accent">
            Step 1: Setup Smart Account & Delegation
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-sm font-medium">Your Private Key (Signer)</label>
              <input
                type="password"
                value={userPrivateKey}
                onChange={(e) => setUserPrivateKey(e.target.value)}
                placeholder="0x..."
                className="mb-2"
              />
              <button
                onClick={handleCreateSmartAccount}
                disabled={loading || !userPrivateKey}
                className="btn btn-primary"
              >
                {loading ? 'Creating...' : 'Create Smart Account'}
              </button>
            </div>

            {smartAccountAddress && (
              <div className="space-y-4 pt-4 border-t border-vscode-border">
                <div>
                  <label className="block mb-2 text-sm font-medium">Smart Account Address</label>
                  <div className="mono p-3 bg-vscode-panel rounded">{smartAccountAddress}</div>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium">
                    AI Agent Private Key (Delegate)
                  </label>
                  <input
                    type="password"
                    value={agentPrivateKey}
                    onChange={(e) => setAgentPrivateKey(e.target.value)}
                    placeholder="0x..."
                    className="mb-2"
                  />
                  <button
                    onClick={handleCreateDelegation}
                    disabled={loading || !agentPrivateKey || delegationCreated}
                    className="btn btn-primary"
                  >
                    {loading ? 'Creating...' : 'Create Delegation'}
                  </button>
                </div>

                {delegationCreated && (
                  <button onClick={handleFetchPortfolio} className="btn btn-success w-full">
                    Continue to Portfolio →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Portfolio Step */}
      {step === 'portfolio' && (
        <div className="card fade-in">
          <h2 className="text-2xl font-bold mb-4 text-vscode-accent">Step 2: Current Portfolio</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-3xl font-bold">${totalValueUSD.toFixed(2)}</div>
                <div className="text-sm text-vscode-text/60">Total Portfolio Value</div>
              </div>
              <button onClick={handleFetchPortfolio} className="btn btn-secondary">
                Refresh
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Balance</th>
                  <th>Value (USD)</th>
                  <th>Allocation</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.symbol}>
                    <td className="font-bold">{h.symbol}</td>
                    <td className="mono">
                      {(Number(h.balance) / 10 ** h.decimals).toFixed(6)}
                    </td>
                    <td>${h.valueUSD.toFixed(2)}</td>
                    <td>
                      <div className="flex items-center">
                        <div className="w-32 bg-vscode-panel rounded-full h-2 mr-2">
                          <div
                            className="bg-vscode-accent h-2 rounded-full"
                            style={{ width: `${h.percentage}%` }}
                          ></div>
                        </div>
                        <span>{h.percentage.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-4 border-t border-vscode-border">
              <h3 className="text-xl font-bold mb-3">Target Allocation</h3>
              <div className="grid grid-cols-2 gap-4">
                {targets.map((t) => (
                  <div key={t.symbol}>
                    <label className="block mb-1 text-sm">{t.symbol}</label>
                    <input
                      type="number"
                      value={t.targetPercentage}
                      onChange={(e) => updateTarget(t.symbol, parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="1"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 text-sm text-vscode-text/60">
                Total:{' '}
                {targets.reduce((sum, t) => sum + t.targetPercentage, 0).toFixed(1)}% (must equal
                100%)
              </div>
            </div>

            <button onClick={handleComputeStrategy} className="btn btn-success w-full">
              Compute Rebalancing Strategy →
            </button>
          </div>
        </div>
      )}

      {/* Rebalance Step */}
      {step === 'rebalance' && strategy && (
        <div className="card fade-in">
          <h2 className="text-2xl font-bold mb-4 text-vscode-accent">
            Step 3: Rebalancing Strategy
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-vscode-panel rounded">
              <h3 className="font-bold mb-2">AI Rationale:</h3>
              <p className="text-sm">{strategy.rationale}</p>
            </div>

            <div>
              <h3 className="font-bold mb-2">Required Trades ({strategy.trades.length})</h3>
              <table>
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Amount</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.trades.map((trade, index) => (
                    <tr key={index}>
                      <td className="font-bold">{trade.fromSymbol}</td>
                      <td className="font-bold">{trade.toSymbol}</td>
                      <td className="mono text-sm">{trade.amount}</td>
                      <td className="text-sm">{trade.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-vscode-panel rounded">
              <div className="text-sm text-vscode-text/60">
                Estimated Gas: <span className="mono">{strategy.estimatedGas}</span>
              </div>
            </div>

            <div className="flex space-x-4">
              <button onClick={() => setStep('portfolio')} className="btn btn-secondary flex-1">
                ← Back to Portfolio
              </button>
              <button onClick={handleExecuteRebalance} className="btn btn-success flex-1">
                Execute Rebalancing →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execute Step */}
      {step === 'execute' && (
        <div className="card fade-in">
          <h2 className="text-2xl font-bold mb-4 text-vscode-accent">
            Step 4: Rebalancing Complete!
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="text-6xl mb-4">✓</div>
                <div className="text-2xl font-bold text-vscode-success">
                  Rebalancing Successful
                </div>
              </div>
            </div>

            {txHash && (
              <div>
                <label className="block mb-2 text-sm font-medium">Transaction Hash</label>
                <div className="mono p-3 bg-vscode-panel rounded break-all">
                  <a
                    href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-vscode-accent hover:underline"
                  >
                    {txHash}
                  </a>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-vscode-border">
              <button
                onClick={() => {
                  setStep('setup');
                  setSuccess('');
                  setError('');
                }}
                className="btn btn-primary w-full"
              >
                Start New Rebalancing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card text-center">
            <div className="spinner mx-auto mb-4"></div>
            <div>Processing...</div>
          </div>
        </div>
      )}
    </div>
  );
}
