/**
 * GET /api/tcg100
 * Get TCG-100 index data and constituents
 */

import { NextResponse } from 'next/server';
import { calculateIndex, getIndexHistory, INDEX_CONFIGS } from '@/lib/price-index';
import prisma from '@/lib/db';

export const revalidate = 300; // Cache for 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const game = searchParams.get('game') || 'onepiece';
    const includeConstituents = searchParams.get('constituents') !== 'false';

    // Calculate TOP_100 index
    const config = {
      ...INDEX_CONFIGS.TOP_100,
      filters: { ...INDEX_CONFIGS.TOP_100.filters, game },
    };
    const indexResult = await calculateIndex(config);

    // Get historical data
    const history = await getIndexHistory('TOP_100', 'top100', 30);

    // Get constituents if requested
    let constituents: {
      rank: number;
      cardId: string;
      name: string;
      setCode: string | null;
      rarity: string | null;
      imageUrl: string | null;
      priceGbp: number;
      weight: number;
    }[] = [];

    if (includeConstituents) {
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
          imageUrl: true,
          bestPriceGbp: true,
        },
        orderBy: { bestPriceGbp: 'desc' },
        take: 100,
      });

      const totalValue = cards.reduce((sum, c) => sum + (c.bestPriceGbp?.toNumber() ?? 0), 0);

      constituents = cards.map((card, idx) => ({
        rank: idx + 1,
        cardId: card.cardId,
        name: card.name,
        setCode: card.setCode,
        rarity: card.rarity,
        imageUrl: card.imageUrl,
        priceGbp: card.bestPriceGbp?.toNumber() ?? 0,
        weight: totalValue > 0 ? ((card.bestPriceGbp?.toNumber() ?? 0) / totalValue) * 100 : 1,
      }));
    }

    return NextResponse.json({
      index: indexResult,
      history,
      constituents,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching TCG-100 data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TCG-100 data' },
      { status: 500 }
    );
  }
}
