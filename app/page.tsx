import { stockNamesandTicker } from '@/app/lib/stocks';
import Link from 'next/link';

export default function Page() {
  return (
    <main className="min-h-screen p-6">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Stocks</h1>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Ticker</th>
              <th className="px-4 py-3 font-medium text-gray-700">Exchange</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stockNamesandTicker.map((stock, index) => (
              <tr key={`${stock.ticker}-${index}`}>
                <td className="px-4 py-3 text-gray-900">{stock.name}</td>
                <td className="px-4 py-3 text-gray-700">
                  <Link
                    href={`/stocks/${stock.ticker}`}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {stock.ticker}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">{stock.exchange}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
