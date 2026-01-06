import { Suspense } from 'react';
import Link from 'next/link';
import { searchCards, getAllSets, getAllRarities, formatCardName, type CardSearchResult } from '@/lib/cards';

// Loading skeleton
function CardsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-10 w-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton h-20 w-full" />
          </div>
        ))}
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

// Card result component
function CardResultItem({ card }: { card: CardSearchResult }) {
  const changeColor = card.change24h === null
    ? 'text-prism-text-muted'
    : card.change24h >= 0
      ? 'text-prism-success'
      : 'text-prism-danger';

  return (
    <Link
      href={`/cards/${encodeURIComponent(card.cardId)}`}
      className="card hover:border-prism-accent transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-prism-text group-hover:text-prism-accent transition-colors truncate">
            {formatCardName(card.name, card.language)}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {card.setCode && (
              <span className="text-xs bg-prism-bg-secondary px-2 py-0.5 rounded">
                {card.setCode}
              </span>
            )}
            {card.variantType && (
              <span className="text-xs text-prism-text-muted capitalize">
                {card.variantType}
              </span>
            )}
            {card.rarity && (
              <span className="text-xs text-prism-text-muted">
                {card.rarity}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-medium text-prism-text">
            {formatPrice(card.priceGbp)}
          </p>
          <p className={`text-sm ${changeColor}`}>
            {formatPercent(card.change24h)}
          </p>
        </div>
      </div>
    </Link>
  );
}

interface SearchParams {
  q?: string;
  set?: string;
  rarity?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  order?: string;
  page?: string;
}

async function CardsContent({ searchParams }: { searchParams: SearchParams }) {
  const query = searchParams.q || '';
  const setCode = searchParams.set || undefined;
  const rarity = searchParams.rarity || undefined;
  const minPrice = searchParams.minPrice ? parseFloat(searchParams.minPrice) : undefined;
  const maxPrice = searchParams.maxPrice ? parseFloat(searchParams.maxPrice) : undefined;
  const sortBy = (searchParams.sort as 'price' | 'name') || 'price';
  const sortOrder = (searchParams.order as 'asc' | 'desc') || 'desc';
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 30;

  const [result, sets, rarities] = await Promise.all([
    searchCards({
      query: query || undefined,
      setCode,
      rarity,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      page,
      limit,
    }),
    getAllSets(),
    getAllRarities(),
  ]);

  const totalPages = Math.ceil(result.total / limit);

  // Build URL helper
  function buildUrl(params: Record<string, string | undefined>) {
    const base = new URLSearchParams();
    if (query) base.set('q', query);
    if (setCode) base.set('set', setCode);
    if (rarity) base.set('rarity', rarity);
    if (minPrice !== undefined) base.set('minPrice', String(minPrice));
    if (maxPrice !== undefined) base.set('maxPrice', String(maxPrice));
    if (sortBy !== 'price') base.set('sort', sortBy);
    if (sortOrder !== 'desc') base.set('order', sortOrder);

    // Override with new params
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        base.delete(key);
      } else {
        base.set(key, value);
      }
    });

    const search = base.toString();
    return search ? `?${search}` : '';
  }

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <form method="get" className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search Input */}
          <div className="md:col-span-2">
            <label className="block text-sm text-prism-text-muted mb-1">Search</label>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Card name or ID..."
              className="w-full px-3 py-2 bg-prism-bg-secondary border border-prism-border rounded-lg text-prism-text placeholder-prism-text-muted focus:outline-none focus:border-prism-accent"
            />
          </div>

          {/* Set Filter */}
          <div>
            <label className="block text-sm text-prism-text-muted mb-1">Set</label>
            <select
              name="set"
              defaultValue={setCode || ''}
              className="w-full px-3 py-2 bg-prism-bg-secondary border border-prism-border rounded-lg text-prism-text focus:outline-none focus:border-prism-accent"
            >
              <option value="">All Sets</option>
              {sets.map((s) => (
                <option key={s.setCode} value={s.setCode}>
                  {s.setCode} ({s.cardCount})
                </option>
              ))}
            </select>
          </div>

          {/* Rarity Filter */}
          <div>
            <label className="block text-sm text-prism-text-muted mb-1">Rarity</label>
            <select
              name="rarity"
              defaultValue={rarity || ''}
              className="w-full px-3 py-2 bg-prism-bg-secondary border border-prism-border rounded-lg text-prism-text focus:outline-none focus:border-prism-accent"
            >
              <option value="">All Rarities</option>
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm text-prism-text-muted mb-1">Sort By</label>
            <select
              name="sort"
              defaultValue={sortBy}
              className="w-full px-3 py-2 bg-prism-bg-secondary border border-prism-border rounded-lg text-prism-text focus:outline-none focus:border-prism-accent"
            >
              <option value="price">Price</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4">
          {/* Price Range */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="minPrice"
              defaultValue={minPrice}
              placeholder="Min"
              step="0.01"
              min="0"
              className="w-24 px-3 py-2 bg-prism-bg-secondary border border-prism-border rounded-lg text-prism-text placeholder-prism-text-muted focus:outline-none focus:border-prism-accent"
            />
            <span className="text-prism-text-muted">-</span>
            <input
              type="number"
              name="maxPrice"
              defaultValue={maxPrice}
              placeholder="Max"
              step="0.01"
              min="0"
              className="w-24 px-3 py-2 bg-prism-bg-secondary border border-prism-border rounded-lg text-prism-text placeholder-prism-text-muted focus:outline-none focus:border-prism-accent"
            />
          </div>

          {/* Order */}
          <select
            name="order"
            defaultValue={sortOrder}
            className="px-3 py-2 bg-prism-bg-secondary border border-prism-border rounded-lg text-prism-text focus:outline-none focus:border-prism-accent"
          >
            <option value="desc">High to Low</option>
            <option value="asc">Low to High</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-prism-accent text-white rounded-lg hover:bg-prism-accent/80 transition-colors"
          >
            Search
          </button>

          {(query || setCode || rarity || minPrice !== undefined || maxPrice !== undefined) && (
            <Link
              href="/cards"
              className="px-4 py-2 text-prism-text-muted hover:text-prism-text transition-colors"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-prism-text-muted">
          {result.total.toLocaleString()} cards found
          {query && <span> for &quot;{query}&quot;</span>}
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-prism-text-muted">
            Page {page} of {totalPages}
          </p>
        )}
      </div>

      {/* Results Grid */}
      {result.cards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.cards.map((card) => (
            <CardResultItem key={card.cardId} card={card} />
          ))}
        </div>
      ) : (
        <div className="card py-12 text-center">
          <p className="text-prism-text-muted">No cards found matching your criteria.</p>
          <Link href="/cards" className="text-prism-accent hover:underline mt-2 inline-block">
            Clear filters
          </Link>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/cards${buildUrl({ page: String(page - 1) })}`}
              className="px-4 py-2 bg-prism-bg-secondary border border-prism-border rounded-lg text-prism-text hover:border-prism-accent transition-colors"
            >
              Previous
            </Link>
          )}

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <Link
                  key={pageNum}
                  href={`/cards${buildUrl({ page: String(pageNum) })}`}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                    pageNum === page
                      ? 'bg-prism-accent text-white'
                      : 'bg-prism-bg-secondary text-prism-text hover:border-prism-accent border border-prism-border'
                  }`}
                >
                  {pageNum}
                </Link>
              );
            })}
          </div>

          {page < totalPages && (
            <Link
              href={`/cards${buildUrl({ page: String(page + 1) })}`}
              className="px-4 py-2 bg-prism-bg-secondary border border-prism-border rounded-lg text-prism-text hover:border-prism-accent transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-prism-text-muted hover:text-prism-accent mb-2 inline-block">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-prism-text">Card Database</h1>
        <p className="text-prism-text-muted">Search and browse the complete One Piece TCG price database</p>
      </div>
      <Suspense fallback={<CardsSkeleton />}>
        <CardsContent searchParams={params} />
      </Suspense>
    </div>
  );
}
