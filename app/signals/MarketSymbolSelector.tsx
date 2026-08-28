'use client';

import { useEffect, useMemo, useState } from 'react';
import { MARKET_OPTIONS, Market, symbolsForMarket } from '@/lib/markets';

export default function MarketSymbolSelector() {
  const [market, setMarket] = useState<Market>('Forex');
  const symbols = useMemo(() => symbolsForMarket(market), [market]);
  const [symbol, setSymbol] = useState<string>(symbols[0] ?? '');

  useEffect(() => {
    setSymbol(symbols[0] ?? '');
  }, [symbols]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-sm font-medium">Market</span>
        <select
          value={market}
          onChange={(event) => setMarket(event.target.value as Market)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        >
          {MARKET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} disabled={option.locked}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium">Symbol</span>
        <select
          value={symbol}
          onChange={(event) => setSymbol(event.target.value)}
          disabled={symbols.length === 0}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {symbols.length === 0 ? (
            <option value="">Coming Soon</option>
          ) : (
            symbols.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))
          )}
        </select>
      </label>
    </div>
  );
}
