export const MARKET_SYMBOLS = {
  Forex: [
    'XAU/USD',
    'EUR/USD',
    'GBP/USD',
    'USD/JPY',
    'AUD/USD',
    'USD/CAD',
  ],
  Crypto: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
  Indices: ['NASDAQ', 'SPX', 'DOW', 'FTSE'],
  'Synthetic Indices': [],
} as const;

export type Market = keyof typeof MARKET_SYMBOLS;
export type CanonicalSymbol = (typeof MARKET_SYMBOLS)[Market][number];

export const MARKET_OPTIONS: Array<{ value: Market; label: string; locked?: boolean }> = [
  { value: 'Forex', label: 'Forex' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'Indices', label: 'Indices — Coming Soon', locked: true },
  { value: 'Synthetic Indices', label: 'Synthetic Indices — Coming Soon', locked: true },
];

export function symbolsForMarket(market: Market): readonly string[] {
  return MARKET_SYMBOLS[market];
}
