import { Suspense } from 'react';
import { getAllIndices, getMarketHealth, getTopMovers, formatCardName } from '@/lib/price-index';

// Loading skeleton for the dashboard
function DashboardSkeleton() {
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

// Format percentage change
function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-GB');
}

// Dashboard content with real data
async function DashboardContent() {
  const [indices, marketHealth, movers] = await Promise.all([
    getAllIndices(),
    getMarketHealth('onepiece'),
    getTopMovers(5),
  ]);

  const gameIndex = indices.GAME_onepiece;
  const top100Index = indices.TOP_100;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">Total Cards Tracked</p>
          <p className="text-2xl font-bold text-prism-text">{gameIndex?.cardCount.toLocaleString() || '--'}</p>
        </div>
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">TCG-100 Index</p>
          <p className="text-2xl font-bold text-prism-text">
            {top100Index ? formatPrice(top100Index.value) : '--'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">24h Change</p>
          <p className={`text-2xl font-bold ${
            (gameIndex?.change24h ?? 0) >= 0 ? 'text-prism-success' : 'text-prism-danger'
          }`}>
            {gameIndex ? formatChange(gameIndex.change24h) : '--'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-prism-text-muted mb-1">Last Updated</p>
          <p className="text-2xl font-bold text-prism-text">
            {gameIndex ? formatRelativeTime(gameIndex.calculatedAt) : '--'}
          </p>
        </div>
      </div>

      {/* Market Sentiment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card col-span-1 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-prism-text">Market Sentiment</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              marketHealth.sentiment === 'bullish'
                ? 'bg-prism-success/20 text-prism-success'
                : marketHealth.sentiment === 'bearish'
                  ? 'bg-prism-danger/20 text-prism-danger'
                  : 'bg-prism-text-muted/20 text-prism-text-muted'
            }`}>
              {marketHealth.sentiment.charAt(0).toUpperCase() + marketHealth.sentiment.slice(1)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-prism-success">{marketHealth.gainersCount}</p>
              <p className="text-xs text-prism-text-muted">Gainers</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-prism-danger">{marketHealth.losersCount}</p>
              <p className="text-xs text-prism-text-muted">Losers</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-prism-text-muted">{marketHealth.unchangedCount}</p>
              <p className="text-xs text-prism-text-muted">Unchanged</p>
            </div>
          </div>
          {marketHealth.sparkline.length > 0 && (
            <div className="mt-4 h-16 flex items-end gap-1">
              {marketHealth.sparkline.map((value, i) => {
                const max = Math.max(...marketHealth.sparkline);
                const min = Math.min(...marketHealth.sparkline);
                const range = max - min || 1;
                const height = ((value - min) / range) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-prism-accent/60 rounded-t"
                    style={{ height: `${Math.max(10, height)}%` }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Hot Sets */}
        <div className="card">
          <h3 className="font-semibold text-prism-text mb-4">Hot Sets</h3>
          <div className="space-y-2">
            {marketHealth.hotSets.slice(0, 5).map((set) => (
              <div key={set.setCode} className="flex items-center justify-between">
                <span className="text-sm text-prism-text">{set.setCode}</span>
                <span className={`text-sm font-medium ${
                  set.change >= 0 ? 'text-prism-success' : 'text-prism-danger'
                }`}>
                  {formatChange(set.change)}
                </span>
              </div>
            ))}
            {marketHealth.hotSets.length === 0 && (
              <p className="text-sm text-prism-text-muted">No hot sets today</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Movers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gainers */}
        <div className="card">
          <h3 className="font-semibold text-prism-text mb-4 flex items-center gap-2">
            <span className="text-prism-success">▲</span> Top Gainers
          </h3>
          <div className="space-y-3">
            {movers.gainers.map((card) => (
              <div key={card.cardId} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-prism-text truncate">{formatCardName(card.name, card.language)}</p>
                  <p className="text-xs text-prism-text-muted">{card.setCode || 'Unknown'}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-medium text-prism-text">{formatPrice(card.price)}</p>
                  <p className="text-xs text-prism-success">{formatChange(card.changePercent)}</p>
                </div>
              </div>
            ))}
            {movers.gainers.length === 0 && (
              <p className="text-sm text-prism-text-muted">No gainers today</p>
            )}
          </div>
        </div>

        {/* Losers */}
        <div className="card">
          <h3 className="font-semibold text-prism-text mb-4 flex items-center gap-2">
            <span className="text-prism-danger">▼</span> Top Losers
          </h3>
          <div className="space-y-3">
            {movers.losers.map((card) => (
              <div key={card.cardId} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-prism-text truncate">{formatCardName(card.name, card.language)}</p>
                  <p className="text-xs text-prism-text-muted">{card.setCode || 'Unknown'}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-medium text-prism-text">{formatPrice(card.price)}</p>
                  <p className="text-xs text-prism-danger">{formatChange(card.changePercent)}</p>
                </div>
              </div>
            ))}
            {movers.losers.length === 0 && (
              <p className="text-sm text-prism-text-muted">No losers today</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/tcg100" className="card hover:border-prism-accent transition-colors group">
          <h3 className="font-semibold text-prism-text mb-2 group-hover:text-prism-accent">TCG-100 Index</h3>
          <p className="text-sm text-prism-text-muted">
            Track the top 100 most valuable One Piece TCG cards
          </p>
        </a>
        <a href="/movers" className="card hover:border-prism-accent transition-colors group">
          <h3 className="font-semibold text-prism-text mb-2 group-hover:text-prism-accent">Top Movers</h3>
          <p className="text-sm text-prism-text-muted">
            See which cards had the biggest price changes
          </p>
        </a>
        <a href="/cards" className="card hover:border-prism-accent transition-colors group">
          <h3 className="font-semibold text-prism-text mb-2 group-hover:text-prism-accent">All Cards</h3>
          <p className="text-sm text-prism-text-muted">
            Browse the complete price database
          </p>
        </a>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-prism-text">Dashboard</h1>
        <p className="text-prism-text-muted">One Piece TCG market overview</p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
