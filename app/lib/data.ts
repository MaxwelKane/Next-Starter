import postgres from 'postgres';
import {
  CompanyOverviewRow,
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  NewStockDailyPrice,
  Revenue,
  StockDailyPrice,
} from './definitions';
import { formatCurrency } from './utils';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export type CompanyOverview = {
  symbol: string;
  assetType: string;
  name: string;
  description: string;
  exchange: string;
  sector: string;
  industry: string;
  marketCapitalization: string;
};

export type HistoricalPrice = {
  date: string;
  close: number;
  volume: number;
  changePercent: number | null;
};

export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await sql<Revenue[]>`SELECT * FROM revenue`;

    // console.log('Data fetch completed after 3 seconds.');

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    const invoiceStatusPromise = sql`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0][0].count ?? '0');
    const numberOfCustomers = Number(data[1][0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2][0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2][0].pending ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql<InvoicesTable[]>`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const data = await sql`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.amount::text ILIKE ${`%${query}%`} OR
      invoices.date::text ILIKE ${`%${query}%`} OR
      invoices.status ILIKE ${`%${query}%`}
  `;

    const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm[]>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    const invoice = data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const customers = await sql<CustomerField[]>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType[]>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function createStocksTable() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql`
    CREATE TABLE IF NOT EXISTS stocks (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      symbol VARCHAR(20) NOT NULL,
      date DATE NOT NULL,
      low NUMERIC(12, 4) NOT NULL,
      high NUMERIC(12, 4) NOT NULL,
      close NUMERIC(12, 4) NOT NULL,
      volume BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(symbol, date)
    );
  `;

  // Add volume column if it doesn't exist (migration for existing tables)
  await sql`
    ALTER TABLE stocks ADD COLUMN IF NOT EXISTS volume BIGINT NOT NULL DEFAULT 0;
  `;
}

export async function createCompanyOverviewsTable() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql`
    CREATE TABLE IF NOT EXISTS company_overviews (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      symbol VARCHAR(20) NOT NULL UNIQUE,
      asset_type VARCHAR(50) NOT NULL DEFAULT 'N/A',
      name VARCHAR(255) NOT NULL DEFAULT 'N/A',
      description TEXT NOT NULL DEFAULT 'N/A',
      exchange VARCHAR(50) NOT NULL DEFAULT 'N/A',
      sector VARCHAR(100) NOT NULL DEFAULT 'N/A',
      industry VARCHAR(100) NOT NULL DEFAULT 'N/A',
      market_capitalization VARCHAR(50) NOT NULL DEFAULT 'N/A',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
}

export async function storeCompanyOverview(overview: CompanyOverview) {
  await createCompanyOverviewsTable();

  const cleanedSymbol = overview.symbol.trim().toUpperCase();

  await sql`
    INSERT INTO company_overviews (symbol, asset_type, name, description, exchange, sector, industry, market_capitalization, updated_at)
    VALUES (
      ${cleanedSymbol},
      ${overview.assetType},
      ${overview.name},
      ${overview.description},
      ${overview.exchange},
      ${overview.sector},
      ${overview.industry},
      ${overview.marketCapitalization},
      NOW()
    )
    ON CONFLICT (symbol)
    DO UPDATE SET
      asset_type = EXCLUDED.asset_type,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      exchange = EXCLUDED.exchange,
      sector = EXCLUDED.sector,
      industry = EXCLUDED.industry,
      market_capitalization = EXCLUDED.market_capitalization,
      updated_at = NOW();
  `;

  return { symbol: cleanedSymbol };
}

export async function fetchStoredCompanyOverview(symbol: string): Promise<CompanyOverview | null> {
  await createCompanyOverviewsTable();

  const cleanedSymbol = symbol.trim().toUpperCase();

  const rows = await sql<CompanyOverviewRow[]>`
    SELECT id, symbol, asset_type, name, description, exchange, sector, industry, market_capitalization, updated_at
    FROM company_overviews
    WHERE symbol = ${cleanedSymbol}
    LIMIT 1;
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    symbol: row.symbol,
    assetType: row.asset_type,
    name: row.name,
    description: row.description,
    exchange: row.exchange,
    sector: row.sector,
    industry: row.industry,
    marketCapitalization: row.market_capitalization,
  };
}

export async function storeStockDailyPrices(
  symbol: string,
  prices: NewStockDailyPrice[],
) {
  await createStocksTable();

  const cleanedSymbol = symbol.trim().toUpperCase();

  await Promise.all(
    prices.map((price) =>
      sql`
        INSERT INTO stocks (symbol, date, low, high, close, volume)
        VALUES (
          ${cleanedSymbol},
          ${price.date},
          ${price.low},
          ${price.high},
          ${price.close},
          ${price.volume}
        )
        ON CONFLICT (symbol, date)
        DO UPDATE SET
          low = EXCLUDED.low,
          high = EXCLUDED.high,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume;
      `,
    ),
  );

  return { symbol: cleanedSymbol, rows: prices.length };
}

export async function fetchStoredStockPrices(symbol: string, limit = 30) {
  await createStocksTable();

  const cleanedSymbol = symbol.trim().toUpperCase();
  const safeLimit = Math.max(1, Math.min(limit, 365));

  return sql<StockDailyPrice[]>`
    SELECT id, symbol, date, low, high, close, volume, created_at
    FROM stocks
    WHERE symbol = ${cleanedSymbol}
    ORDER BY date DESC
    LIMIT ${safeLimit};
  `;
}

/**
 * Fetch stored daily prices and convert them to the HistoricalPrice format
 * used by the stock detail page (with changePercent computed).
 */
export async function fetchStoredDailyPricesAsHistorical(
  symbol: string,
  limit = 90,
): Promise<HistoricalPrice[]> {
  await createStocksTable();

  const cleanedSymbol = symbol.trim().toUpperCase();
  const safeLimit = Math.max(1, Math.min(limit, 365));

  // Fetch one extra row to compute changePercent for the last visible day
  const rows = await sql<StockDailyPrice[]>`
    SELECT id, symbol, date, low, high, close, volume, created_at
    FROM stocks
    WHERE symbol = ${cleanedSymbol}
    ORDER BY date DESC
    LIMIT ${safeLimit + 1};
  `;

  return rows.slice(0, safeLimit).map((row, index) => {
    const close = Number(row.close);
    const volume = Number(row.volume);
    const previousRow = rows[index + 1];
    const previousClose = previousRow ? Number(previousRow.close) : NaN;

    const changePercent =
      Number.isFinite(close) && Number.isFinite(previousClose) && previousClose !== 0
        ? ((close - previousClose) / previousClose) * 100
        : null;

    return {
      date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
      close,
      volume,
      changePercent,
    };
  });
}

