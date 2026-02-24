import {
  fetchStoredCompanyOverview,
  fetchStoredDailyPricesAsHistorical,
} from '@/app/lib/data';
import type { CompanyOverview, HistoricalPrice } from '@/app/lib/data';
import PriceChart from '@/app/ui/stocks/price-chart';

type StockDetailsPageProps = {
  params: Promise<{
    symbol: string;
  }>;
};

type YahooQuoteResponse = {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
      };
    }[];
  };
};

async function fetchCurrentPrice(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooQuoteResponse;
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose ?? price;
    const change = price - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
    return { price, change, changePercent };
  } catch {
    return null;
  }
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const numberFormatter = new Intl.NumberFormat('en-US');

function formatClosePrice(value: number) {
  return Number.isFinite(value) ? currencyFormatter.format(value) : 'N/A';
}

function formatVolume(value: number) {
  return Number.isFinite(value) ? numberFormatter.format(value) : 'N/A';
}

function formatPercentChange(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getPercentColorClass(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return 'text-gray-500';
  }

  if (value > 0) {
    return 'text-emerald-600';
  }

  if (value < 0) {
    return 'text-rose-600';
  }

  return 'text-gray-700';
}

export default async function StockDetailsPage({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  const cleanedSymbol = symbol.trim().toUpperCase();

  let overview: CompanyOverview | null = null;
  let prices: HistoricalPrice[] = [];
  let hasOverviewError = false;
  let hasPricesError = false;

  // --- Company overview (from DB) ---
  try {
    overview = await fetchStoredCompanyOverview(cleanedSymbol);
  } catch {
    hasOverviewError = true;
  }

  // --- Historical prices (from DB) ---
  try {
    prices = await fetchStoredDailyPricesAsHistorical(cleanedSymbol, 90);
  } catch {
    hasPricesError = true;
  }

  // --- Current price (Yahoo Finance) ---
  const currentQuote = await fetchCurrentPrice(cleanedSymbol);

  const overviewData = {
    symbol: overview?.symbol ?? 'N/A',
    assetType: overview?.assetType ?? 'N/A',
    name: overview?.name ?? 'N/A',
    description: overview?.description ?? 'N/A',
    exchange: overview?.exchange ?? 'N/A',
    sector: overview?.sector ?? 'N/A',
    industry: overview?.industry ?? 'N/A',
    marketCapitalization: overview?.marketCapitalization ?? 'N/A',
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Stock Details</p>
          <h1 className="mt-2 text-3xl font-semibold">{overviewData.symbol}</h1>
          <p className="mt-2 text-sm text-slate-200">{overviewData.name}</p>
          {currentQuote && (
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-2xl font-bold">
                {currencyFormatter.format(currentQuote.price)}
              </span>
              <span
                className={`text-sm font-medium ${
                  currentQuote.change >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {/* {currentQuote.change >= 0 ? '+' : ''}
                {currentQuote.change.toFixed(2)} ({currentQuote.changePercent >= 0 ? '+' : ''}
                {currentQuote.changePercent.toFixed(2)}%) */}
              </span>
            </div>
          )}
        </section>

        {(hasOverviewError || hasPricesError) && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {hasOverviewError && <p>Company overview is temporarily unavailable.</p>}
            {hasPricesError && <p>Historical prices are temporarily unavailable.</p>}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Company Overview</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Symbol</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{overviewData.symbol}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Asset Type</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{overviewData.assetType}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Exchange</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{overviewData.exchange}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Market Cap</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{overviewData.marketCapitalization}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Sector</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{overviewData.sector}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Industry</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{overviewData.industry}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 lg:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
              <p className="mt-2 text-sm leading-6 text-slate-900">{overviewData.description}</p>
            </div>
          </div>
        </section>

        {prices.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Price History</h2>
            <div className="mt-4">
              <PriceChart prices={prices} />
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Historical Prices</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-700">Date</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Close</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Volume</th>
                  <th className="px-4 py-3 font-medium text-slate-700">% Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={4}>
                      No historical prices available.
                    </td>
                  </tr>
                ) : (
                  prices.map((item) => (
                    <tr key={item.date} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{item.date}</td>
                      <td className="px-4 py-3 text-slate-700">{formatClosePrice(item.close)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatVolume(item.volume)}</td>
                      <td className={`px-4 py-3 font-medium ${getPercentColorClass(item.changePercent)}`}>
                        {formatPercentChange(item.changePercent)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
