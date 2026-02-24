import {
  fetchStoredStockPrices,
  storeStockDailyPrices,
} from '../lib/data';
import type { NewStockDailyPrice } from '../lib/definitions';

type StockRequestBody = {
  symbol?: string;
  prices?: NewStockDailyPrice[];
};

function sanitizeSymbol(symbol: string | undefined) {
  return (symbol ?? 'IBM').trim().toUpperCase();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = sanitizeSymbol(searchParams.get('symbol') ?? undefined);
    const limitParam = Number(searchParams.get('limit') ?? '30');
    const limit = Number.isFinite(limitParam) ? limitParam : 30;

    const rows = await fetchStoredStockPrices(symbol, limit);
    return Response.json({ symbol, rows });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch stored stock prices.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StockRequestBody;
    const symbol = sanitizeSymbol(body.symbol);

    if (!body.prices?.length) {
      return Response.json(
        { error: 'Missing prices array in request body.' },
        { status: 400 },
      );
    }
    const prices = body.prices;

    const invalidPrice = prices.find(
      (price) =>
        !price.date ||
        !Number.isFinite(price.low) ||
        !Number.isFinite(price.high) ||
        !Number.isFinite(price.close) ||
        !Number.isFinite(price.volume),
    );

    if (invalidPrice) {
      return Response.json(
        {
          error:
            'Invalid price payload. Each row needs date, low, high, close, and volume as numeric values.',
        },
        { status: 400 },
      );
    }

    const result = await storeStockDailyPrices(symbol, prices);
    return Response.json({ message: 'Stock prices stored.', ...result });
  } catch (error) {
    return Response.json({ error: 'Failed to store stock prices.' }, { status: 500 });
  }
}
