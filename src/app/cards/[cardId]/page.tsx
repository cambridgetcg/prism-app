import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCardById, getCardHistory, formatCardName, type CardDetail } from '@/lib/cards';
import { calculateCardVolatility } from '@/lib/price-index';

// Loading skeleton
function CardDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="skeleton h-64 w-full" />
        </div>
        <div className="card md:col-span-2">
          <div className="skeleton h-8 w-48 mb-4" />
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-6 w-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  );
}

// Format price in GBP
function formatPrice(price: number | null): string {
  if (price === null) return '--';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(price);
}

// Format percentage
function formatPercent(value: number | null): string {
  if (value === null) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

interface CardContentProps {
  card: CardDetail;
}

async function CardContent({ card }: CardContentProps) {
  const history = await getCardHistory(card.cardId, 30);

  const priceHistory = history?.history.map((h) => h.priceGbp) || [];
  const volatility = calculateCardVolatility(priceHistory);

  const stats = history?.stats;

  // Handle image URL - use as-is if already a full URL, otherwise prepend CDN base
  let imageUrl: string | null = null;
  if (card.imageUrl) {
    if (card.imageUrl.startsWith('http://') || card.imageUrl.startsWith('https://')) {
      imageUrl = card.imageUrl;
    } else {
      const cdnBase = process.env.CARD_IMAGE_CDN_URL || '';
      imageUrl = cdnBase ? `${cdnBase}/${card.imageUrl}` : null;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card Image */}
        <div className="card flex items-center justify-center p-6">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={card.name}
              className="max-h-80 object-contain rounded-lg shadow-lg"
            />
          ) : (
            <div className="h-80 w-full bg-prism-bg-secondary rounded-lg flex items-center justify-center">
              <span className="text-prism-text-muted">No image available</span>
            </div>
          )}
        </div>

        {/* Card Details */}
        <div className="card md:col-span-2">
          <h1 className="text-2xl font-bold text-prism-text mb-2">{formatCardName(card.name, card.language)}</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            {card.setCode && (
              <span className="px-2 py-1 bg-prism-accent/20 text-prism-accent rounded text-sm">
                {card.setCode}
              </span>
            )}
            {card.variantType && (
              <span className="px-2 py-1 bg-prism-bg-secondary text-prism-text-muted rounded text-sm capitalize">
                {card.variantType}
              </span>
            )}
            {card.rarity && (
              <span className="px-2 py-1 bg-prism-bg-secondary text-prism-text-muted rounded text-sm">
                {card.rarity}
              </span>
            )}
          </div>

          {/* Price */}
          <div className="mb-6">
            <p className="text-sm text-prism-text-muted mb-1">Current Price</p>
            <p className="text-4xl font-bold text-prism-text">
              {formatPrice(card.prices.bestPriceGbp)}
            </p>
            {stats && (
              <div className="flex items-center gap-4 mt-2">
                <span className={`text-sm font-medium ${
                  (stats.change7dGbp || 0) >= 0 ? 'text-prism-success' : 'text-prism-danger'
                }`}>
                  7d: {formatPercent(stats.change7dGbp)}
                </span>
                <span className={`text-sm font-medium ${
                  (stats.change30dGbp || 0) >= 0 ? 'text-prism-success' : 'text-prism-danger'
                }`}>
                  30d: {formatPercent(stats.change30dGbp)}
                </span>
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-prism-text-muted">Card ID</p>
              <p className="text-sm text-prism-text font-mono">{card.cardId}</p>
            </div>
            {card.fullCardNumber && (
              <div>
                <p className="text-xs text-prism-text-muted">Card Number</p>
                <p className="text-sm text-prism-text">{card.fullCardNumber}</p>
              </div>
            )}
            {card.releaseSet && (
              <div>
                <p className="text-xs text-prism-text-muted">Release Set</p>
                <p className="text-sm text-prism-text">{card.releaseSet}</p>
              </div>
            )}
            {card.language && (
              <div>
                <p className="text-xs text-prism-text-muted">Language</p>
                <p className="text-sm text-prism-text">{card.language}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-prism-text-muted">Trade-In Price</p>
              <p className="text-sm text-prism-text">{formatPrice(card.prices.tradeinPriceGbp)}</p>
            </div>
            <div>
              <p className="text-xs text-prism-text-muted">Last Updated</p>
              <p className="text-sm text-prism-text">
                {card.lastUpdated ? new Date(card.lastUpdated).toLocaleString('en-GB') : '--'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Price Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card">
          <p className="text-xs text-prism-text-muted mb-1">30d High</p>
          <p className="text-lg font-bold text-prism-text">{formatPrice(stats?.highGbp ?? null)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-prism-text-muted mb-1">30d Low</p>
          <p className="text-lg font-bold text-prism-text">{formatPrice(stats?.lowGbp ?? null)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-prism-text-muted mb-1">30d Average</p>
          <p className="text-lg font-bold text-prism-text">{formatPrice(stats?.avgGbp ?? null)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-prism-text-muted mb-1">Volatility</p>
          <p className="text-lg font-bold text-prism-text">{volatility.label}</p>
          <div className="w-full h-1.5 bg-prism-bg-secondary rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                volatility.score < 30
                  ? 'bg-prism-success'
                  : volatility.score < 60
                    ? 'bg-yellow-500'
                    : 'bg-prism-danger'
              }`}
              style={{ width: `${volatility.score}%` }}
            />
          </div>
        </div>
        <div className="card">
          <p className="text-xs text-prism-text-muted mb-1">Data Points</p>
          <p className="text-lg font-bold text-prism-text">{volatility.dataPoints}</p>
        </div>
      </div>

      {/* Price Chart */}
      {history && history.history.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-prism-text mb-4">30-Day Price History</h3>
          <div className="h-48 flex items-end gap-1">
            {history.history.map((point, i) => {
              const max = stats?.highGbp || 1;
              const min = stats?.lowGbp || 0;
              const range = max - min || 1;
              const height = ((point.priceGbp - min) / range) * 100;
              const isUp = i > 0 && point.priceGbp >= history.history[i - 1].priceGbp;

              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t transition-colors ${
                    isUp ? 'bg-prism-success/60 hover:bg-prism-success' : 'bg-prism-danger/60 hover:bg-prism-danger'
                  }`}
                  style={{ height: `${Math.max(5, height)}%` }}
                  title={`${point.date}: ${formatPrice(point.priceGbp)}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-prism-text-muted mt-2">
            <span>{history.history[0]?.date}</span>
            <span>{history.history[history.history.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Price Sources */}
      <div className="card">
        <h3 className="font-semibold text-prism-text mb-4">Price Sources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-prism-text-muted mb-1">TCGplayer (GBP)</p>
            <p className="text-sm font-medium text-prism-text">
              {formatPrice(card.prices.optcgTcgplayerGbp)}
            </p>
          </div>
          <div>
            <p className="text-xs text-prism-text-muted mb-1">TCGplayer (USD)</p>
            <p className="text-sm font-medium text-prism-text">
              {card.prices.optcgTcgplayerUsd !== null
                ? `$${card.prices.optcgTcgplayerUsd.toFixed(2)}`
                : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-prism-text-muted mb-1">CardMarket (GBP)</p>
            <p className="text-sm font-medium text-prism-text">
              {formatPrice(card.prices.limitlessCardmarketGbp)}
            </p>
          </div>
          <div>
            <p className="text-xs text-prism-text-muted mb-1">CardMarket (EUR)</p>
            <p className="text-sm font-medium text-prism-text">
              {card.prices.limitlessCardmarketEur !== null
                ? `€${card.prices.limitlessCardmarketEur.toFixed(2)}`
                : '--'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const decodedCardId = decodeURIComponent(cardId);

  const card = await getCardById(decodedCardId);

  if (!card) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/cards" className="text-sm text-prism-text-muted hover:text-prism-accent mb-2 inline-block">
          &larr; Back to Cards
        </Link>
      </div>
      <Suspense fallback={<CardDetailSkeleton />}>
        <CardContent card={card} />
      </Suspense>
    </div>
  );
}
