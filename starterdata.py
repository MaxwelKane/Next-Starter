"""
Fetch stock data using yfinance and store directly in PostgreSQL.

No API keys needed. Fetches company info + daily price history
for every symbol and upserts into the stocks and company_overviews tables.

Usage:
    pip install yfinance psycopg2-binary
    python starterdata.py
"""

import os
import yfinance as yf
import psycopg2
from psycopg2.extras import execute_values

POSTGRES_URL = os.environ["POSTGRES_URL"]

SYMBOLS = [
    "AMD", "TSM", "MU", "SMCI", "VRT", "AVGO", "MRVL", "ANET",
    "NVDA", "INTC", "QCOM", "TXN", "ADI", "AMAT", "LRCX", "KLAC", "ASML",
]


def ensure_tables(conn):
    with conn.cursor() as cur:
        cur.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
        cur.execute("""
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
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS stocks (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                date DATE NOT NULL,
                low NUMERIC(12, 4) NOT NULL,
                high NUMERIC(12, 4) NOT NULL,
                close NUMERIC(12, 4) NOT NULL,
                volume BIGINT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(symbol, date)
            );
        """)
        cur.execute("ALTER TABLE stocks ADD COLUMN IF NOT EXISTS volume BIGINT NOT NULL DEFAULT 0;")
    conn.commit()
    print("[db] Tables ready.\n")


def upsert_overview(conn, overview):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO company_overviews
                (symbol, asset_type, name, description, exchange, sector, industry, market_capitalization, updated_at)
            VALUES (%(symbol)s, %(asset_type)s, %(name)s, %(description)s, %(exchange)s, %(sector)s, %(industry)s, %(market_cap)s, NOW())
            ON CONFLICT (symbol) DO UPDATE SET
                asset_type = EXCLUDED.asset_type,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                exchange = EXCLUDED.exchange,
                sector = EXCLUDED.sector,
                industry = EXCLUDED.industry,
                market_capitalization = EXCLUDED.market_capitalization,
                updated_at = NOW();
        """, overview)
    conn.commit()


def upsert_prices(conn, symbol, rows):
    values = [(symbol, r["date"], r["low"], r["high"], r["close"], r["volume"]) for r in rows]
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO stocks (symbol, date, low, high, close, volume)
            VALUES %s
            ON CONFLICT (symbol, date) DO UPDATE SET
                low = EXCLUDED.low,
                high = EXCLUDED.high,
                close = EXCLUDED.close,
                volume = EXCLUDED.volume;
        """, values)
    conn.commit()


def main():
    conn = psycopg2.connect(POSTGRES_URL)
    ensure_tables(conn)

    total = len(SYMBOLS)
    overview_count = 0
    price_count = 0

    for i, s in enumerate(SYMBOLS, 1):
        ticker = yf.Ticker(s)

        # ── Overview ──
        print(f"[{i}/{total}] {s} overview...", end=" ")
        try:
            info = ticker.info
            if info and info.get("symbol"):
                overview = {
                    "symbol": info.get("symbol", s),
                    "asset_type": info.get("quoteType", "N/A"),
                    "name": info.get("longName") or info.get("shortName", "N/A"),
                    "description": info.get("longBusinessSummary", "N/A"),
                    "exchange": info.get("exchange", "N/A"),
                    "sector": info.get("sector", "N/A"),
                    "industry": info.get("industry", "N/A"),
                    "market_cap": str(info.get("marketCap", "N/A")),
                }
                upsert_overview(conn, overview)
                overview_count += 1
                print("ok")
            else:
                print("empty")
        except Exception as e:
            print(f"error: {e}")

        # ── Prices ──
        print(f"[{i}/{total}] {s} prices...", end=" ")
        try:
            df = ticker.history(period="max")
            if not df.empty:
                rows = []
                for date, row in df.iterrows():
                    rows.append({
                        "date": date.strftime("%Y-%m-%d"),
                        "low": round(float(row["Low"]), 4),
                        "high": round(float(row["High"]), 4),
                        "close": round(float(row["Close"]), 4),
                        "volume": int(row["Volume"]),
                    })
                upsert_prices(conn, s, rows)
                price_count += 1
                print(f"ok ({len(rows)} rows)")
            else:
                print("empty")
        except Exception as e:
            print(f"error: {e}")

        print()

    conn.close()
    print(f"Done! {overview_count}/{total} overviews, {price_count}/{total} price histories stored.")


if __name__ == "__main__":
    main()