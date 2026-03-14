// ═══════════════════════════════════════════════════════
//  StockScan Pro — Batch Ticker Prices
//  File: api/ticker.js
//  Returns multiple prices in one call (for the top bar)
// ═══════════════════════════════════════════════════════

const API_KEY = process.env.FINNHUB_API_KEY;

const TICKER_SYMBOLS = [
  { name: 'NIFTY 50',   sym: '^NSEI',              type: 'index'  },
  { name: 'SENSEX',     sym: '^BSESN',             type: 'index'  },
  { name: 'BANK NIFTY', sym: '^NSEBANK',           type: 'index'  },
  { name: 'USD/INR',    sym: 'OANDA:USD_INR',      type: 'forex'  },
  { name: 'BTC/USD',    sym: 'BINANCE:BTCUSDT',    type: 'crypto' },
  { name: 'ETH/USD',    sym: 'BINANCE:ETHUSDT',    type: 'crypto' },
  { name: 'S&P 500',    sym: '^GSPC',              type: 'index'  },
  { name: 'NASDAQ',     sym: '^IXIC',              type: 'index'  },
  { name: 'RELIANCE',   sym: 'NSE:RELIANCE',       type: 'stock'  },
  { name: 'TCS',        sym: 'NSE:TCS',            type: 'stock'  },
  { name: 'INFOSYS',    sym: 'NSE:INFY',           type: 'stock'  },
  { name: 'HDFC BANK',  sym: 'NSE:HDFCBANK',       type: 'stock'  },
];

async function fetchOne(sym) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${API_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  return d;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate'); // cache 60 seconds

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key missing' });
  }

  try {
    // Fetch all in parallel
    const results = await Promise.allSettled(
      TICKER_SYMBOLS.map(t => fetchOne(t.sym))
    );

    const tickers = TICKER_SYMBOLS.map((t, i) => {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value.c) {
        const d = r.value;
        return {
          name:      t.name,
          price:     +d.c.toFixed(2),
          change:    +(d.c - d.pc).toFixed(2),
          changePct: +(((d.c - d.pc) / d.pc) * 100).toFixed(2),
          type:      t.type,
        };
      }
      return { name: t.name, price: null, change: 0, changePct: 0, type: t.type, error: true };
    });

    return res.status(200).json({ ok: true, data: tickers, ts: Date.now() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
