import { Suspense } from 'react';
import Link from 'next/link';
import prisma from '@/lib/db';
import { calculateIndex, getIndexHistory, formatCardName, INDEX_CONFIGS } from '@/lib/price-index';

// Loading skeleton
function TCG100Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton h-4 w-20 mb-2" />
            <div className="skeleton h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  );
}

// Format price in GBP
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(price);
}

// Format percentage
function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

interface Constituent {
  rank: number;
  cardId: string;
  name: string;
  setCode: string | null;
  rarity: string | null;
  language: string | null;
  imageUrl: string | null;
  priceGbp: number;
  weight: number;
}

async function TCG100Content() {
  const game = 'onepiece';

  // Calculate TOP_100 index
  const config = {
    ...INDEX_CONFIGS.TOP_100,
    filters: { ...INDEX_CONFIGS.TOP_100.filters, game },
  };
  const indexResult = await calculateIndex(config);

  // Get historical data
  const history = await getIndexHistory('TOP_100', 'top100', 30);

  // Get constituents
  const cards = await prisma.cardPriceV2.findMany({
    where: {
      game,
      bestPriceGbp: { not: null, gte: 1.0 },
    },
    select: {
      cardId: true,
      name: true,
      setCode: true,
      rarity: true,
      language: true,
      imageUrl: true,
      bestPriceGbp: true,
    },
    orderBy: { bestPriceGbp: 'desc' },
    take: 100,
  });

  const totalValue = cards.reduce((sum, c) => sum + (c.bestPriceGbp?.toNumber() ?? 0), 0);

  const constituents: Constituent[] = cards.map((card, idx) => ({
    rank: idx + 1,
    cardId: card.cardId,
    name: card.name,
    setCode: card.setCode,
    rarity: card.rarity,
    language: card.language,
    imageUrl: card.imageUrl,
    priceGbp: card.bestPriceGbp?.toNumber() ?? 0,
    weight: totalValue > 0 ? ((card.bestPriceGbp?.toNumber() ?? 0) / totalValue) * 100 : 1,
  }));

  return (
    <div className="space-y-6">
      {/* Index Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">Index Value</p>
          <p className="text-2xl font-bold text-prism-text">
            {formatPrice(indexResult.value)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">24h Change</p>
          <p className={`text-2xl font-bold ${
            indexResult.change24h >= 0 ? 'text-prism-success' : 'text-prism-danger'
          }`}>
            {formatPercent(indexResult.change24h)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">7d Change</p>
          <p className={`text-2xl font-bold ${
            indexResult.change7d >= 0 ? 'text-prism-success' : 'text-prism-danger'
          }`}>
            {formatPercent(indexResult.change7d)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">Total Market Cap</p>
          <p className="text-2xl font-bold text-prism-text">
            {formatPrice(indexResult.totalMarketCap)}
          </p>
        </div>
      </div>

      {/* Sparkline Chart */}
      {history.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-prism-text mb-4">30-Day Performance</h3>
          <div className="h-32 flex items-end gap-1">
            {history.map((point, i) => {
              const max = Math.max(...history.map(h => h.value));
              const min = Math.min(...history.map(h => h.value));
              const range = max - min || 1;
              const height = ((point.value - min) / range) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-prism-accent/60 rounded-t hover:bg-prism-accent transition-colors"
                  style={{ height: `${Math.max(10, height)}%` }}
                  title={`${point.date}: ${formatPrice(point.value)}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-prism-text-muted mt-2">
            <span>{history[0]?.date}</span>
            <span>{history[history.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Index Info */}
      <div className="card">
        <h3 className="font-semibold text-prism-text mb-2">About the TCG-100 Index</h3>
        <p className="text-sm text-prism-text-muted">
          The TCG-100 tracks the average price of the top 100 most valuable One Piece TCG cards.
          Cards are ranked by their current market price in GBP, with each constituent equally weighted.
          The index is recalculated twice daily to reflect market movements.
        </p>
      </div>

      {/* Constituents Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-prism-text">Index Constituents</h3>
          <span className="text-sm text-prism-text-muted">{constituents.length} cards</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-prism-border">
                <th className="text-left py-3 px-2 text-sm font-medium text-prism-text-muted">#</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-prism-text-muted">Card</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-prism-text-muted">Set</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-prism-text-muted">Rarity</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-prism-text-muted">Price</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-prism-text-muted">Weight</th>
              </tr>
            </thead>
            <tbody>
              {constituents.map((card) => (
                <tr
                  key={card.cardId}
                  className="border-b border-prism-border/50 hover:bg-prism-bg-secondary/50 transition-colors"
                >
                  <td className="py-3 px-2 text-sm text-prism-text-muted">
                    {card.rank}
                  </td>
                  <td className="py-3 px-2">
                    <Link
                      href={`/cards/${encodeURIComponent(card.cardId)}`}
                      className="text-sm font-medium text-prism-text hover:text-prism-accent transition-colors"
                    >
                      {formatCardName(card.name, card.language)}
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-sm text-prism-text-muted">
                    {card.setCode || '-'}
                  </td>
                  <td className="py-3 px-2 text-sm text-prism-text-muted">
                    {card.rarity || '-'}
                  </td>
                  <td className="py-3 px-2 text-sm text-prism-text font-medium text-right">
                    {formatPrice(card.priceGbp)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-prism-bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-prism-accent rounded-full"
                          style={{ width: `${Math.min(100, card.weight * 5)}%` }}
                        />
                      </div>
                      <span className="text-xs text-prism-text-muted w-12 text-right">
                        {card.weight.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function TCG100Page() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-prism-text-muted hover:text-prism-accent mb-2 inline-block">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-prism-text">TCG-100 Index</h1>
        <p className="text-prism-text-muted">Top 100 most valuable One Piece TCG cards</p>
      </div>
      <Suspense fallback={<TCG100Skeleton />}>
        <TCG100Content />
      </Suspense>
    </div>
  );
}
