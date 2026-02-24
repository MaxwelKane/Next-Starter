'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
);

type PricePoint = {
  date: string;
  close: number;
};

export default function PriceChart({ prices }: { prices: PricePoint[] }) {
  // Prices come newest-first from the DB; reverse for chronological left→right
  const chronological = [...prices].reverse();

  const labels = chronological.map((p) => {
    const d = new Date(p.date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const closes = chronological.map((p) => p.close);

  const first = closes[0] ?? 0;
  const last = closes[closes.length - 1] ?? 0;
  const isUp = last >= first;

  const lineColor = isUp ? 'rgb(16, 185, 129)' : 'rgb(244, 63, 94)';
  const fillColor = isUp ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)';

  const data = {
    labels,
    datasets: [
      {
        label: 'Close',
        data: closes,
        borderColor: lineColor,
        backgroundColor: fillColor,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 8,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) =>
            `Close: $${(ctx.parsed.y ?? 0).toFixed(2)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 10,
          color: '#94a3b8',
          font: { size: 11 },
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (value: string | number) => `$${Number(value).toFixed(0)}`,
        },
        grid: { color: 'rgba(148,163,184,0.15)' },
      },
    },
  };

  return (
    <div className="h-[300px] w-full">
      <Line data={data} options={options} />
    </div>
  );
}
