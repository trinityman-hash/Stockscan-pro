// ═══════════════════════════════════════════════════════
//  StockScan Pro — Vercel Serverless Proxy
//  File: api/prices.js
//  This runs on Vercel's servers. Your API key stays
//  hidden here — never exposed to the browser.
// ═══════════════════════════════════════════════════════

const API_KEY = process.env.FINNHUB_API_KEY; // Set this in Vercel dashboard

// Map of symbols to Finnhub-compatible symbols
const SYMBOL_MAP = {
  // Indian indices (Finnhub uses these for NSE)
  'NIFTY50':    '^NSEI',
  'NIFTY 50':   '^NSEI',
  'SENSEX':     '^BSESN',
  'BANKNIFTY':  '^NSEBANK',
  'NIFTYIT':    '^CNXIT',
  // NSE Stocks (prefix NSE:)
  'RELIANCE':   'NSE:RELIANCE',
  'TCS':        'NSE:TCS',
  'HDFCBANK':   'NSE:HDFCBANK',
  'HDFC BANK':  'NSE:HDFCBANK',
  'INFOSYS':    'NSE:INFY',
  'INFY':       'NSE:INFY',
  'WIPRO':      'NSE:WIPRO',
  'ITC':        'NSE:ITC',
  'BAJFINANCE': 'NSE:BAJFINANCE',
  'TATASTEEL':  'NSE:TATASTEEL',
  'MARUTI':     'NSE:MARUTI',
  'HCLTECH':    'NSE:HCLTECH',
  'TITAN':      'NSE:TITAN',
  'ONGC':       'NSE:ONGC',
  'ICICIBANK':  'NSE:ICICIBANK',
  'AXISBANK':   'NSE:AXISBANK',
  'KOTAKBANK':  'NSE:KOTAKBANK',
  'SUNPHARMA':  'NSE:SUNPHARMA',
  'LT':         'NSE:LT',
  'NTPC':       'NSE:NTPC',
  'POWERGRID':  'NSE:POWERGRID',
  'BHARTIARTL': 'NSE:BHARTIARTL',
  'ASIANPAINT': 'NSE:ASIANPAINT',
  'DIVISLAB':   'NSE:DIVISLAB',
  // US Stocks
  'AAPL':  'AAPL',
  'GOOGL': 'GOOGL',
  'MSFT':  'MSFT',
  'AMZN':  'AMZN',
  'TSLA':  'TSLA',
  'NVDA':  'NVDA',
  'META':  'META',
  // Forex
  'USDINR': 'OANDA:USD_INR',
  'USD/INR':'OANDA:USD_INR',
  'EURINR': 'OANDA:EUR_INR',
  // Crypto
  'BTCUSD':  'BINANCE:BTCUSDT',
  'BTC/USD': 'BINANCE:BTCUSDT',
  'ETHUSD':  'BINANCE:ETHUSDT',
  'ETH/USD': 'BINANCE:ETHUSDT',
};

// Fetch quote from Finnhub
async function fetchQuote(symbol) {
  const finnhubSym = SYMBOL_MAP[symbol.toUpperCase()] || symbol;
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSym)}&token=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
  const data = await res.json();
  // Finnhub returns: c=current, h=high, l=low, o=open, pc=prev close
  if (!data.c || data.c === 0) throw new Error('No data returned');
  return {
    symbol,
    price:     +data.c.toFixed(2),
    open:      +data.o.toFixed(2),
    high:      +data.h.toFixed(2),
    low:       +data.l.toFixed(2),
    prevClose: +data.pc.toFixed(2),
    change:    +(data.c - data.pc).toFixed(2),
    changePct: +(((data.c - data.pc) / data.pc) * 100).toFixed(2),
    timestamp: Date.now(),
  };
}

// Fetch candle (OHLCV) history from Finnhub
async function fetchCandles(symbol, resolution = 'D', count = 60) {
  const finnhubSym = SYMBOL_MAP[symbol.toUpperCase()] || symbol;
  const to   = Math.floor(Date.now() / 1000);
  const from = to - count * 24 * 60 * 60 * (resolution === 'D' ? 1 : resolution === 'W' ? 7 : 30);
  const url  = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(finnhubSym)}&resolution=${resolution}&from=${from}&to=${to}&token=${API_KEY}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub candle error: ${res.status}`);
  const data = await res.json();
  if (data.s !== 'ok') throw new Error('No candle data');
  return data.t.map((ts, i) => ({
    t: new Date(ts * 1000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    o: +data.o[i].toFixed(2),
    h: +data.h[i].toFixed(2),
    l: +data.l[i].toFixed(2),
    c: +data.c[i].toFixed(2),
    v: data.v[i],
  }));
}

// Main handler
export default async function handler(req, res) {
  // CORS — allow your Blogger domain (or * for open access)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, symbol, resolution, count } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'symbol param required' });
  }
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    if (type === 'candles') {
      const candles = await fetchCandles(symbol, resolution || 'D', parseInt(count) || 60);
      return res.status(200).json({ ok: true, data: candles });
    } else {
      // Default: quote
      const quote = await fetchQuote(symbol);
      return res.status(200).json({ ok: true, data: quote });
    }
  } catch (err) {
    console.error('Proxy error:', err.message);
    return res.status(200).json({ ok: false, error: err.message, fallback: true });
  }
}
