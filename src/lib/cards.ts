/**
 * Card Queries Library
 * Fetches card data and price history
 */

import prisma from './db';

// ============================================================================
// Types
// ============================================================================

export interface CardDetail {
  cardId: string;
  name: string;
  game: string;
  releaseSet: string | null;
  fullCardNumber: string | null;
  setCode: string | null;
  cardNumber: string | null;
  variantType: string | null;
  rarity: string | null;
  language: string | null;
  imageUrl: string | null;
  prices: {
    bestPriceGbp: number | null;
    tradeinPriceGbp: number | null;
    optcgTcgplayerGbp: number | null;
    optcgTcgplayerUsd: number | null;
    limitlessCardmarketGbp: number | null;
    limitlessCardmarketEur: number | null;
  };
  lastUpdated: Date | null;
}

export interface CardHistoryPoint {
  date: string;
  priceGbp: number;
  priceJpy: number | null;
  exchangeRate: number | null;
  change: number;
  changeJpy: number | null;
  changeFx: number | null;
}

export interface CardHistoryResponse {
  cardId: string;
  name: string | null;
  setCode: string | null;
  game: string;
  history: CardHistoryPoint[];
  stats: {
    currentGbp: number;
    currentJpy: number | null;
    highGbp: number;
    highJpy: number | null;
    lowGbp: number;
    lowJpy: number | null;
    avgGbp: number;
    avgJpy: number | null;
    change7dGbp: number;
    change7dJpy: number | null;
    change30dGbp: number;
    change30dJpy: number | null;
  };
  exchangeRate: {
    current: number | null;
    change24h: number | null;
  };
}

export interface CardSearchResult {
  cardId: string;
  name: string;
  setCode: string | null;
  rarity: string | null;
  variantType: string | null;
  language: string | null;
  imageUrl: string | null;
  priceGbp: number | null;
  change24h: number | null;
}

/**
 * Format card name with language suffix (-EN or -JP)
 * Adds suffix only if not already present
 */
export function formatCardName(name: string, language: string | null): string {
  if (!language) return name;

  const suffix = `-${language.toUpperCase()}`;
  if (name.endsWith('-EN') || name.endsWith('-JP')) {
    return name;
  }
  return `${name}${suffix}`;
}

export interface CardSearchOptions {
  query?: string;
  game?: string;
  setCode?: string;
  rarity?: string;
  language?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'name' | 'change';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// ============================================================================
// Card Queries
// ============================================================================

/**
 * Get a single card by ID with all details
 */
export async function getCardById(cardId: string): Promise<CardDetail | null> {
  const card = await prisma.cardPriceV2.findFirst({
    where: {
      OR: [{ cardId }, { fullCardNumber: cardId }],
    },
  });

  if (!card) return null;

  return {
    cardId: card.cardId,
    name: card.name,
    game: card.game,
    releaseSet: card.releaseSet,
    fullCardNumber: card.fullCardNumber,
    setCode: card.setCode,
    cardNumber: card.cardNumber,
    variantType: card.variantType,
    rarity: card.rarity,
    language: card.language,
    imageUrl: card.imageUrl,
    prices: {
      bestPriceGbp: card.bestPriceGbp?.toNumber() ?? null,
      tradeinPriceGbp: card.tradeinPriceGbp?.toNumber() ?? null,
      optcgTcgplayerGbp: card.optcgTcgplayerGbp?.toNumber() ?? null,
      optcgTcgplayerUsd: card.optcgTcgplayerUsd?.toNumber() ?? null,
      limitlessCardmarketGbp: card.limitlessCardmarketGbp?.toNumber() ?? null,
      limitlessCardmarketEur: card.limitlessCardmarketEur?.toNumber() ?? null,
    },
    lastUpdated: card.lastUpdated,
  };
}

/**
 * Get price history for a card
 */
export async function getCardHistory(
  cardId: string,
  days: number = 30
): Promise<CardHistoryResponse | null> {
  // First try exact cardId match
  let card = await prisma.cardPriceV2.findFirst({
    where: { cardId },
    select: { cardId: true, name: true, setCode: true, game: true, fullCardNumber: true },
  });

  // If not found, try matching by fullCardNumber
  if (!card) {
    card = await prisma.cardPriceV2.findFirst({
      where: { fullCardNumber: cardId },
      select: { cardId: true, name: true, setCode: true, game: true, fullCardNumber: true },
    });
  }

  const targetCardId = card?.cardId || cardId;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const history = await prisma.cardPriceHistory.findMany({
    where: {
      cardId: targetCardId,
      snapshotDate: { gte: startDate },
    },
    orderBy: { snapshotDate: 'asc' },
    select: {
      snapshotDate: true,
      priceGbp: true,
      priceJpy: true,
      exchangeRate: true,
      change: true,
      changeJpy: true,
      changeFx: true,
    },
  });

  if (history.length === 0) {
    return null;
  }

  const historyPoints: CardHistoryPoint[] = history.map((h) => ({
    date: h.snapshotDate.toISOString().split('T')[0],
    priceGbp: h.priceGbp.toNumber(),
    priceJpy: h.priceJpy?.toNumber() || null,
    exchangeRate: h.exchangeRate?.toNumber() || null,
    change: h.change.toNumber(),
    changeJpy: h.changeJpy?.toNumber() || null,
    changeFx: h.changeFx?.toNumber() || null,
  }));

  const pricesGbp = historyPoints.map((h) => h.priceGbp);
  const pricesJpy = historyPoints.map((h) => h.priceJpy).filter((p): p is number => p !== null);

  const currentGbp = pricesGbp[pricesGbp.length - 1] || 0;
  const currentJpy = pricesJpy.length > 0 ? pricesJpy[pricesJpy.length - 1] : null;

  const highGbp = Math.max(...pricesGbp);
  const lowGbp = Math.min(...pricesGbp);
  const avgGbp = pricesGbp.reduce((a, b) => a + b, 0) / pricesGbp.length;

  const highJpy = pricesJpy.length > 0 ? Math.max(...pricesJpy) : null;
  const lowJpy = pricesJpy.length > 0 ? Math.min(...pricesJpy) : null;
  const avgJpy =
    pricesJpy.length > 0 ? pricesJpy.reduce((a, b) => a + b, 0) / pricesJpy.length : null;

  // Calculate 7d and 30d changes
  let change7dGbp = 0;
  let change30dGbp = 0;
  let change7dJpy: number | null = null;
  let change30dJpy: number | null = null;

  if (historyPoints.length >= 7) {
    const price7dAgo = historyPoints[historyPoints.length - 7]?.priceGbp;
    if (price7dAgo && price7dAgo > 0) {
      change7dGbp = ((currentGbp - price7dAgo) / price7dAgo) * 100;
    }

    const priceJpy7dAgo = historyPoints[historyPoints.length - 7]?.priceJpy;
    if (priceJpy7dAgo && priceJpy7dAgo > 0 && currentJpy) {
      change7dJpy = ((currentJpy - priceJpy7dAgo) / priceJpy7dAgo) * 100;
    }
  }

  if (historyPoints.length >= 30) {
    const price30dAgo = historyPoints[historyPoints.length - 30]?.priceGbp;
    if (price30dAgo && price30dAgo > 0) {
      change30dGbp = ((currentGbp - price30dAgo) / price30dAgo) * 100;
    }

    const priceJpy30dAgo = historyPoints[historyPoints.length - 30]?.priceJpy;
    if (priceJpy30dAgo && priceJpy30dAgo > 0 && currentJpy) {
      change30dJpy = ((currentJpy - priceJpy30dAgo) / priceJpy30dAgo) * 100;
    }
  }

  // Get current exchange rate
  const latestRate = await prisma.exchangeRateHistory.findFirst({
    orderBy: { date: 'desc' },
    select: { jpyToGbp: true, change24h: true },
  });

  return {
    cardId: targetCardId,
    name: card?.name || null,
    setCode: card?.setCode || null,
    game: card?.game || 'onepiece',
    history: historyPoints,
    stats: {
      currentGbp,
      currentJpy,
      highGbp,
      highJpy,
      lowGbp,
      lowJpy,
      avgGbp,
      avgJpy,
      change7dGbp,
      change7dJpy,
      change30dGbp,
      change30dJpy,
    },
    exchangeRate: {
      current: latestRate?.jpyToGbp.toNumber() || null,
      change24h: latestRate?.change24h?.toNumber() || null,
    },
  };
}

/**
 * Search cards with filters
 */
export async function searchCards(
  options: CardSearchOptions
): Promise<{ cards: CardSearchResult[]; total: number; page: number; limit: number }> {
  const {
    query,
    game = 'onepiece',
    setCode,
    rarity,
    language,
    minPrice,
    maxPrice,
    sortBy = 'price',
    sortOrder = 'desc',
    page = 1,
    limit = 50,
  } = options;

  // Build where clause
  const where: Record<string, unknown> = { game };

  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { cardId: { contains: query, mode: 'insensitive' } },
      { fullCardNumber: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (setCode) where.setCode = setCode;
  if (rarity) where.rarity = rarity;
  if (language) where.language = language;

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.bestPriceGbp = {
      ...(minPrice !== undefined ? { gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
    };
  }

  // Build order by
  const orderBy: Record<string, string> = {};
  switch (sortBy) {
    case 'price':
      orderBy.bestPriceGbp = sortOrder;
      break;
    case 'name':
      orderBy.name = sortOrder;
      break;
    default:
      orderBy.bestPriceGbp = 'desc';
  }

  const offset = (page - 1) * limit;

  const [cards, total] = await Promise.all([
    prisma.cardPriceV2.findMany({
      where,
      select: {
        cardId: true,
        name: true,
        setCode: true,
        rarity: true,
        variantType: true,
        language: true,
        imageUrl: true,
        bestPriceGbp: true,
      },
      orderBy,
      skip: offset,
      take: limit,
    }),
    prisma.cardPriceV2.count({ where }),
  ]);

  // Get change data for these cards
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cardIds = cards.map((c) => c.cardId);
  const changes = await prisma.cardPriceHistory.findMany({
    where: {
      cardId: { in: cardIds },
      snapshotDate: today,
    },
    select: { cardId: true, change: true },
  });

  const changeMap = new Map(changes.map((c) => [c.cardId, c.change.toNumber()]));

  const results: CardSearchResult[] = cards.map((card) => ({
    cardId: card.cardId,
    name: card.name,
    setCode: card.setCode,
    rarity: card.rarity,
    variantType: card.variantType,
    language: card.language,
    imageUrl: card.imageUrl,
    priceGbp: card.bestPriceGbp?.toNumber() ?? null,
    change24h: changeMap.get(card.cardId) ?? null,
  }));

  return { cards: results, total, page, limit };
}

/**
 * Get all unique sets
 */
export async function getAllSets(
  game: string = 'onepiece'
): Promise<{ setCode: string; cardCount: number }[]> {
  const sets = await prisma.cardPriceV2.groupBy({
    by: ['setCode'],
    where: { game, setCode: { not: null } },
    _count: { cardId: true },
  });

  return sets
    .filter((s) => s.setCode)
    .map((s) => ({
      setCode: s.setCode!,
      cardCount: s._count.cardId,
    }))
    .sort((a, b) => a.setCode.localeCompare(b.setCode));
}

/**
 * Get all unique rarities
 */
export async function getAllRarities(game: string = 'onepiece'): Promise<string[]> {
  const rarities = await prisma.cardPriceV2.groupBy({
    by: ['rarity'],
    where: { game, rarity: { not: null } },
  });

  return rarities
    .map((r) => r.rarity!)
    .filter(Boolean)
    .sort();
}
