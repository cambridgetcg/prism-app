/**
 * Price Index Calculation Engine (PRISM)
 * Standalone version for app.cambridgetcg.com
 */

import { Prisma } from '@prisma/client';
import prisma from './db';

// ============================================================================
// Types
// ============================================================================

export type IndexType = 'GAME' | 'SET' | 'RARITY' | 'TOP_100' | 'LANGUAGE' | 'VOLATILITY';
export type WeightMethod = 'market_cap' | 'equal' | 'card_count';

export interface IndexConfig {
  type: IndexType;
  key: string;
  weights: WeightMethod;
  filters: {
    game?: string;
    setCode?: string;
    rarity?: string;
    language?: string;
    minPrice?: number;
    topN?: number;
  };
}

export interface IndexResult {
  type: IndexType;
  key: string;
  value: number;
  change24h: number;
  change7d: number;
  change30d: number;
  cardCount: number;
  totalMarketCap: number;
  avgPrice: number;
  volatility: number;
  highPrice: number;
  lowPrice: number;
  calculatedAt: Date;
}

export interface TopMover {
  cardId: string;
  name: string;
  setCode: string | null;
  language: string | null;
  imageUrl: string | null;
  price: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  priceJpy: number | null;
  previousPriceJpy: number | null;
  changeJpy: number | null;
  volume24h: number;
  volumeRelative: number;
  rank: number;
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

export interface MarketHealth {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  gainersCount: number;
  losersCount: number;
  unchangedCount: number;
  totalCards: number;
  avgChange24h: number;
  medianChange24h: number;
  volatilityIndex: number;
  hotSets: {
    setCode: string;
    change: number;
    cardCount: number;
    reason: string;
  }[];
  sparkline: number[];
}

export interface CardVolatility {
  score: number;
  label: 'Stable' | 'Moderate' | 'Volatile' | 'Highly Volatile' | 'Insufficient Data';
  stdDev: number;
  coefficientOfVariation: number;
  dataPoints: number;
  priceRange: { high: number; low: number };
}

export interface CrystalNode {
  id: string;
  name: string;
  price: number;
  change: number;
  setCode: string | null;
  rarity: string | null;
  game: string;
}

export interface CrystalEdge {
  source: string;
  target: string;
  correlation: number;
}

export interface CrystalData {
  nodes: CrystalNode[];
  edges: CrystalEdge[];
  clusters: { id: string; cardCount: number }[];
}

// ============================================================================
// Index Configurations
// ============================================================================

export const INDEX_CONFIGS: Record<string, IndexConfig> = {
  GAME_onepiece: {
    type: 'GAME',
    key: 'onepiece',
    weights: 'market_cap',
    filters: { game: 'onepiece', minPrice: 0.5 },
  },
  TOP_100: {
    type: 'TOP_100',
    key: 'top100',
    weights: 'equal',
    filters: { minPrice: 1.0, topN: 100 },
  },
  LANG_EN: {
    type: 'LANGUAGE',
    key: 'EN',
    weights: 'equal',
    filters: { language: 'EN', minPrice: 0.5 },
  },
  LANG_JP: {
    type: 'LANGUAGE',
    key: 'JP',
    weights: 'equal',
    filters: { language: 'JP', minPrice: 0.5 },
  },
};

// ============================================================================
// Index Calculation Functions
// ============================================================================

export async function calculateIndex(config: IndexConfig): Promise<IndexResult> {
  const { filters } = config;

  const where: Prisma.CardPriceV2WhereInput = {
    bestPriceGbp: { not: null },
  };

  if (filters.game) where.game = filters.game;
  if (filters.setCode) where.setCode = filters.setCode;
  if (filters.rarity) where.rarity = filters.rarity;
  if (filters.language) where.language = filters.language;
  if (filters.minPrice) {
    where.bestPriceGbp = { gte: filters.minPrice };
  }

  const cards = await prisma.cardPriceV2.findMany({
    where,
    select: {
      cardId: true,
      name: true,
      setCode: true,
      rarity: true,
      bestPriceGbp: true,
      game: true,
    },
    orderBy: filters.topN ? { bestPriceGbp: 'desc' } : undefined,
    take: filters.topN,
  });

  if (cards.length === 0) {
    return createEmptyResult(config);
  }

  const prices = cards
    .map((c) => c.bestPriceGbp?.toNumber() ?? 0)
    .filter((p) => p > 0);

  const totalMarketCap = prices.reduce((sum, p) => sum + p, 0);
  const avgPrice = totalMarketCap / prices.length;
  const highPrice = Math.max(...prices);
  const lowPrice = Math.min(...prices);

  const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
  const volatility = Math.sqrt(variance);

  let value: number;
  switch (config.weights) {
    case 'market_cap':
      value = totalMarketCap / cards.length;
      break;
    case 'equal':
      value = avgPrice;
      break;
    case 'card_count':
      value = totalMarketCap;
      break;
    default:
      value = avgPrice;
  }

  const [change24h, change7d, change30d] = await Promise.all([
    getHistoricalChange(config.type, config.key, 1),
    getHistoricalChange(config.type, config.key, 7),
    getHistoricalChange(config.type, config.key, 30),
  ]);

  return {
    type: config.type,
    key: config.key,
    value,
    change24h,
    change7d,
    change30d,
    cardCount: cards.length,
    totalMarketCap,
    avgPrice,
    volatility,
    highPrice,
    lowPrice,
    calculatedAt: new Date(),
  };
}

async function getHistoricalChange(
  indexType: IndexType,
  indexKey: string,
  daysAgo: number
): Promise<number> {
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo);
    targetDate.setHours(0, 0, 0, 0);

    const snapshot = await prisma.priceIndexSnapshot.findFirst({
      where: {
        indexType,
        indexKey,
        snapshotDate: { lte: targetDate },
      },
      orderBy: { snapshotDate: 'desc' },
      select: { value: true },
    });

    if (!snapshot) return 0;

    const current = await prisma.priceIndexSnapshot.findFirst({
      where: { indexType, indexKey },
      orderBy: { snapshotDate: 'desc' },
      select: { value: true },
    });

    if (!current) return 0;

    const oldValue = snapshot.value.toNumber();
    const newValue = current.value.toNumber();

    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
  } catch {
    return 0;
  }
}

function createEmptyResult(config: IndexConfig): IndexResult {
  return {
    type: config.type,
    key: config.key,
    value: 0,
    change24h: 0,
    change7d: 0,
    change30d: 0,
    cardCount: 0,
    totalMarketCap: 0,
    avgPrice: 0,
    volatility: 0,
    highPrice: 0,
    lowPrice: 0,
    calculatedAt: new Date(),
  };
}

// ============================================================================
// Set Index Functions
// ============================================================================

export async function getSetIndexConfigs(game?: string): Promise<IndexConfig[]> {
  const where: Prisma.CardPriceV2WhereInput = {
    setCode: { not: null },
    bestPriceGbp: { not: null },
  };
  if (game) where.game = game;

  const sets = await prisma.cardPriceV2.findMany({
    where,
    select: { setCode: true, game: true },
    distinct: ['setCode'],
  });

  return sets
    .filter((s) => s.setCode)
    .map((s) => ({
      type: 'SET' as IndexType,
      key: s.setCode!,
      weights: 'equal' as WeightMethod,
      filters: { setCode: s.setCode!, game: s.game, minPrice: 0.5 },
    }));
}

export async function calculateAllSetIndices(game?: string): Promise<IndexResult[]> {
  const configs = await getSetIndexConfigs(game);
  const results = await Promise.all(configs.map((c) => calculateIndex(c)));
  return results.filter((r) => r.cardCount > 0);
}

// ============================================================================
// Query Functions
// ============================================================================

export async function getAllIndices(): Promise<Record<string, IndexResult>> {
  const results: Record<string, IndexResult> = {};

  for (const [key, config] of Object.entries(INDEX_CONFIGS)) {
    results[key] = await calculateIndex(config);
  }

  return results;
}

export async function getIndexHistory(
  indexType: IndexType,
  indexKey: string,
  days: number = 30
): Promise<{ date: string; value: number; change: number }[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshots = await prisma.priceIndexSnapshot.findMany({
      where: {
        indexType,
        indexKey,
        snapshotDate: { gte: startDate },
      },
      orderBy: { snapshotDate: 'asc' },
      select: {
        snapshotDate: true,
        value: true,
        change24h: true,
      },
    });

    return snapshots.map((s) => ({
      date: s.snapshotDate.toISOString().split('T')[0],
      value: s.value.toNumber(),
      change: s.change24h.toNumber(),
    }));
  } catch {
    return [];
  }
}

export async function getTopMovers(limit: number = 10): Promise<{
  gainers: TopMover[];
  losers: TopMover[];
  mostVolume: TopMover[];
}> {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPrices = await prisma.cardPriceHistory.findMany({
      where: { snapshotDate: today },
      select: {
        cardId: true,
        priceGbp: true,
        priceJpy: true,
        change: true,
        changeJpy: true,
      },
    });

    const yesterdayPrices = await prisma.cardPriceHistory.findMany({
      where: { snapshotDate: yesterday },
      select: {
        cardId: true,
        priceGbp: true,
        priceJpy: true,
      },
    });

    const yesterdayMap = new Map(
      yesterdayPrices.map((p) => [
        p.cardId,
        { gbp: p.priceGbp.toNumber(), jpy: p.priceJpy?.toNumber() ?? null },
      ])
    );

    const cardIds = todayPrices.map((p) => p.cardId);
    const cards = await prisma.cardPriceV2.findMany({
      where: { cardId: { in: cardIds } },
      select: { cardId: true, name: true, setCode: true, language: true, imageUrl: true },
    });
    const cardMap = new Map(cards.map((c) => [c.cardId, c]));

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const volumeData = await prisma.cardPriceHistory.groupBy({
      by: ['cardId'],
      where: {
        snapshotDate: { gte: weekAgo },
        change: { not: 0 },
      },
      _count: { cardId: true },
    });

    const volumeMap = new Map(volumeData.map((v) => [v.cardId, v._count.cardId]));
    const maxVolume = Math.max(...volumeData.map((v) => v._count.cardId), 1);

    const movers: TopMover[] = todayPrices
      .filter((p) => yesterdayMap.has(p.cardId))
      .map((p) => {
        const card = cardMap.get(p.cardId);
        const prevData = yesterdayMap.get(p.cardId)!;
        const currentPrice = p.priceGbp.toNumber();
        const currentPriceJpy = p.priceJpy?.toNumber() ?? null;
        const priceChange = currentPrice - prevData.gbp;
        const volume = volumeMap.get(p.cardId) ?? 0;

        return {
          cardId: p.cardId,
          name: card?.name ?? p.cardId,
          setCode: card?.setCode ?? null,
          language: card?.language ?? null,
          imageUrl: card?.imageUrl ?? null,
          price: currentPrice,
          previousPrice: prevData.gbp,
          change: priceChange,
          changePercent: p.change.toNumber(),
          priceJpy: currentPriceJpy,
          previousPriceJpy: prevData.jpy,
          changeJpy: p.changeJpy?.toNumber() ?? null,
          volume24h: volume,
          volumeRelative: volume / maxVolume,
          rank: 0,
        };
      });

    const sortedByChange = [...movers].sort((a, b) => b.changePercent - a.changePercent);

    const gainers = sortedByChange
      .filter((m) => m.changePercent > 0)
      .slice(0, limit)
      .map((m, i) => ({ ...m, rank: i + 1 }));

    const losers = sortedByChange
      .filter((m) => m.changePercent < 0)
      .slice(-limit)
      .reverse()
      .map((m, i) => ({ ...m, rank: i + 1 }));

    const mostVolume = [...movers]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, limit)
      .map((m, i) => ({ ...m, rank: i + 1 }));

    return { gainers, losers, mostVolume };
  } catch {
    return { gainers: [], losers: [], mostVolume: [] };
  }
}

export async function getMarketHealth(game: string = 'onepiece'): Promise<MarketHealth> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPrices = await prisma.cardPriceHistory.findMany({
      where: {
        snapshotDate: today,
        game,
      },
      select: {
        cardId: true,
        setCode: true,
        change: true,
      },
    });

    if (todayPrices.length === 0) {
      return createEmptyMarketHealth();
    }

    const changes = todayPrices.map((p) => p.change.toNumber());
    const gainersCount = changes.filter((c) => c > 0).length;
    const losersCount = changes.filter((c) => c < 0).length;
    const unchangedCount = changes.filter((c) => c === 0).length;

    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

    const sortedChanges = [...changes].sort((a, b) => a - b);
    const medianChange = sortedChanges[Math.floor(sortedChanges.length / 2)];

    const variance = changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length;
    const volatilityIndex = Math.sqrt(variance);

    let sentiment: 'bullish' | 'bearish' | 'neutral';
    if (gainersCount > losersCount * 1.5 && avgChange > 1) {
      sentiment = 'bullish';
    } else if (losersCount > gainersCount * 1.5 && avgChange < -1) {
      sentiment = 'bearish';
    } else {
      sentiment = 'neutral';
    }

    const setChanges = new Map<string, { total: number; count: number }>();
    for (const p of todayPrices) {
      if (p.setCode) {
        const existing = setChanges.get(p.setCode) ?? { total: 0, count: 0 };
        existing.total += p.change.toNumber();
        existing.count++;
        setChanges.set(p.setCode, existing);
      }
    }

    const hotSets = Array.from(setChanges.entries())
      .map(([setCode, data]) => ({
        setCode,
        change: data.total / data.count,
        cardCount: data.count,
        reason:
          data.total / data.count > 5
            ? 'Rising demand'
            : data.total / data.count < -5
              ? 'Price correction'
              : 'Active trading',
      }))
      .filter((s) => Math.abs(s.change) > 2)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 5);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const snapshots = await prisma.priceIndexSnapshot.findMany({
      where: {
        indexType: 'GAME',
        indexKey: game,
        snapshotDate: { gte: weekAgo },
      },
      orderBy: { snapshotDate: 'asc' },
      select: { value: true },
    });

    const sparkline = snapshots.map((s) => s.value.toNumber());

    return {
      sentiment,
      gainersCount,
      losersCount,
      unchangedCount,
      totalCards: todayPrices.length,
      avgChange24h: avgChange,
      medianChange24h: medianChange,
      volatilityIndex,
      hotSets,
      sparkline,
    };
  } catch {
    return createEmptyMarketHealth();
  }
}

function createEmptyMarketHealth(): MarketHealth {
  return {
    sentiment: 'neutral',
    gainersCount: 0,
    losersCount: 0,
    unchangedCount: 0,
    totalCards: 0,
    avgChange24h: 0,
    medianChange24h: 0,
    volatilityIndex: 0,
    hotSets: [],
    sparkline: [],
  };
}

export function calculateCardVolatility(priceHistory: number[]): CardVolatility {
  if (priceHistory.length < 7) {
    return {
      score: 50,
      label: 'Insufficient Data',
      stdDev: 0,
      coefficientOfVariation: 0,
      dataPoints: priceHistory.length,
      priceRange: { high: 0, low: 0 },
    };
  }

  const mean = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
  const squaredDiffs = priceHistory.map((p) => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / priceHistory.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? (stdDev / mean) * 100 : 0;

  const high = Math.max(...priceHistory);
  const low = Math.min(...priceHistory);

  let label: CardVolatility['label'];
  let score: number;

  if (coefficientOfVariation < 5) {
    label = 'Stable';
    score = 15;
  } else if (coefficientOfVariation < 15) {
    label = 'Moderate';
    score = 40;
  } else if (coefficientOfVariation < 30) {
    label = 'Volatile';
    score = 70;
  } else {
    label = 'Highly Volatile';
    score = 95;
  }

  return {
    score,
    label,
    stdDev,
    coefficientOfVariation,
    dataPoints: priceHistory.length,
    priceRange: { high, low },
  };
}

// ============================================================================
// Crystal Visualization Data
// ============================================================================

export async function getCrystalData(game: string, maxNodes: number = 200): Promise<CrystalData> {
  const cards = await prisma.cardPriceV2.findMany({
    where: {
      game,
      bestPriceGbp: { not: null, gte: 0.5 },
    },
    select: {
      cardId: true,
      name: true,
      setCode: true,
      rarity: true,
      bestPriceGbp: true,
      game: true,
    },
    orderBy: { bestPriceGbp: 'desc' },
    take: maxNodes,
  });

  const cardIds = cards.map((c) => c.cardId);
  let prevPriceMap = new Map<string, number>();

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const prevPrices = await prisma.cardPriceHistory.findMany({
      where: {
        cardId: { in: cardIds },
        snapshotDate: yesterday,
      },
      select: { cardId: true, priceGbp: true },
    });

    prevPriceMap = new Map(prevPrices.map((p) => [p.cardId, p.priceGbp.toNumber()]));
  } catch {
    // Table may not exist yet
  }

  const nodes: CrystalNode[] = cards.map((card) => {
    const price = card.bestPriceGbp?.toNumber() ?? 0;
    const prevPrice = prevPriceMap.get(card.cardId) ?? price;
    const change = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;

    return {
      id: card.cardId,
      name: card.name,
      price,
      change,
      setCode: card.setCode,
      rarity: card.rarity,
      game: card.game,
    };
  });

  let edges: CrystalEdge[] = [];
  try {
    const correlations = await prisma.priceCorrelation.findMany({
      where: {
        OR: [{ entityA: { in: cardIds } }, { entityB: { in: cardIds } }],
        correlation: { gte: 0.5 },
      },
      select: {
        entityA: true,
        entityB: true,
        correlation: true,
      },
      take: 500,
    });

    edges = correlations
      .filter((c) => cardIds.includes(c.entityA) && cardIds.includes(c.entityB))
      .map((c) => ({
        source: c.entityA,
        target: c.entityB,
        correlation: c.correlation.toNumber(),
      }));
  } catch {
    // Table may not exist yet
  }

  const setMap = new Map<string, number>();
  cards.forEach((c) => {
    if (c.setCode) {
      setMap.set(c.setCode, (setMap.get(c.setCode) ?? 0) + 1);
    }
  });

  const clusters = Array.from(setMap.entries()).map(([id, cardCount]) => ({
    id,
    cardCount,
  }));

  return { nodes, edges, clusters };
}
