import { Suspense } from 'react';
import Link from 'next/link';
import { getTopMovers, getMarketHealth, formatCardName, type TopMover } from '@/lib/price-index';

// Loading skeleton
function MoversSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton h-4 w-20 mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="skeleton h-12 w-full" />
              ))}
            </div>
          </div>
        ))}
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

// Mover card component
function MoverCard({ mover, type }: { mover: TopMover; type: 'gainer' | 'loser' | 'volume' }) {
  const changeColor = mover.changePercent >= 0 ? 'text-prism-success' : 'text-prism-danger';
  const bgColor = type === 'gainer'
    ? 'bg-prism-success/5'
    : type === 'loser'
      ? 'bg-prism-danger/5'
      : 'bg-prism-accent/5';

  return (
    <Link
      href={`/cards/${encodeURIComponent(mover.cardId)}`}
      className={`block p-3 rounded-lg ${bgColor} hover:opacity-80 transition-opacity`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-sm font-bold text-prism-text-muted w-6">
            #{mover.rank}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-prism-text truncate">
              {formatCardName(mover.name, mover.language)}
            </p>
            <p className="text-xs text-prism-text-muted">
              {mover.setCode || 'Unknown Set'}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-medium text-prism-text">
            {formatPrice(mover.price)}
          </p>
          <p className={`text-xs font-medium ${changeColor}`}>
            {formatPercent(mover.changePercent)}
          </p>
        </div>
      </div>
      {type === 'volume' && (
        <div className="mt-2">
          <div className="w-full h-1 bg-prism-bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-prism-accent rounded-full"
              style={{ width: `${Math.min(100, mover.volumeRelative * 100)}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}

async function MoversContent() {
  const [movers, marketHealth] = await Promise.all([
    getTopMovers(20),
    getMarketHealth('onepiece'),
  ]);

  return (
    <div className="space-y-6">
      {/* Market Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">Sentiment</p>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            marketHealth.sentiment === 'bullish'
              ? 'bg-prism-success/20 text-prism-success'
              : marketHealth.sentiment === 'bearish'
                ? 'bg-prism-danger/20 text-prism-danger'
                : 'bg-prism-text-muted/20 text-prism-text-muted'
          }`}>
            {marketHealth.sentiment.charAt(0).toUpperCase() + marketHealth.sentiment.slice(1)}
          </span>
        </div>
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">Gainers</p>
          <p className="text-2xl font-bold text-prism-success">{marketHealth.gainersCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">Losers</p>
          <p className="text-2xl font-bold text-prism-danger">{marketHealth.losersCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">Avg Change</p>
          <p className={`text-2xl font-bold ${
            marketHealth.avgChange24h >= 0 ? 'text-prism-success' : 'text-prism-danger'
          }`}>
            {formatPercent(marketHealth.avgChange24h)}
          </p>
        </div>
      </div>

      {/* Movers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Gainers */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-prism-success text-xl">&#9650;</span>
            <h3 className="font-semibold text-prism-text">Top Gainers</h3>
          </div>
          <div className="space-y-2">
            {movers.gainers.length > 0 ? (
              movers.gainers.map((mover) => (
                <MoverCard key={mover.cardId} mover={mover} type="gainer" />
              ))
            ) : (
              <p className="text-sm text-prism-text-muted py-4 text-center">
                No gainers today
              </p>
            )}
          </div>
        </div>

        {/* Top Losers */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-prism-danger text-xl">&#9660;</span>
            <h3 className="font-semibold text-prism-text">Top Losers</h3>
          </div>
          <div className="space-y-2">
            {movers.losers.length > 0 ? (
              movers.losers.map((mover) => (
                <MoverCard key={mover.cardId} mover={mover} type="loser" />
              ))
            ) : (
              <p className="text-sm text-prism-text-muted py-4 text-center">
                No losers today
              </p>
            )}
          </div>
        </div>

        {/* Most Active */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-prism-accent text-xl">&#9632;</span>
            <h3 className="font-semibold text-prism-text">Most Active</h3>
          </div>
          <div className="space-y-2">
            {movers.mostVolume.length > 0 ? (
              movers.mostVolume.map((mover) => (
                <MoverCard key={mover.cardId} mover={mover} type="volume" />
              ))
            ) : (
              <p className="text-sm text-prism-text-muted py-4 text-center">
                No volume data available
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hot Sets */}
      {marketHealth.hotSets.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-prism-text mb-4">Hot Sets</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {marketHealth.hotSets.map((set) => (
              <div
                key={set.setCode}
                className="p-3 bg-prism-bg-secondary/50 rounded-lg"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-prism-text">{set.setCode}</span>
                  <span className={`text-sm font-medium ${
                    set.change >= 0 ? 'text-prism-success' : 'text-prism-danger'
                  }`}>
                    {formatPercent(set.change)}
                  </span>
                </div>
                <p className="text-xs text-prism-text-muted">
                  {set.cardCount} cards &middot; {set.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="card">
        <h3 className="font-semibold text-prism-text mb-2">About Price Movements</h3>
        <p className="text-sm text-prism-text-muted">
          Price data is updated twice daily (8 AM and 8 PM UTC). Percentage changes are calculated
          against the previous day&apos;s closing price. Volume activity is measured by the number of
          price changes recorded over the past 7 days.
        </p>
      </div>
    </div>
  );
}

export default function MoversPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-prism-text-muted hover:text-prism-accent mb-2 inline-block">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-prism-text">Top Movers</h1>
        <p className="text-prism-text-muted">Cards with the biggest price changes today</p>
      </div>
      <Suspense fallback={<MoversSkeleton />}>
        <MoversContent />
      </Suspense>
    </div>
  );
}
