/**
 * GET /api/cron/calculate-movers
 * Cron job to calculate card price snapshots for movers tracking
 * Should be called by Vercel cron at 8:30 and 20:30 UTC (after TCG-100)
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/db';

async function verifyCronSecret(): Promise<boolean> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV !== 'development') {
      return false;
    }
  }
  return true;
}

export async function GET() {
  try {
    if (!(await verifyCronSecret())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting movers calculation cron job...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Get all current card prices
    const cards = await prisma.cardPriceV2.findMany({
      where: {
        bestPriceGbp: { not: null },
      },
      select: {
        cardId: true,
        game: true,
        setCode: true,
        bestPriceGbp: true,
        optcgTcgplayerGbp: true,
        limitlessCardmarketGbp: true,
        justtcgTcgplayerGbp: true,
      },
    });

    console.log(`Found ${cards.length} cards with prices`);

    // Get yesterday's prices for change calculation
    const previousPrices = await prisma.cardPriceHistory.findMany({
      where: { snapshotDate: yesterday },
      select: { cardId: true, priceGbp: true },
    });

    const prevPriceMap = new Map(previousPrices.map((p) => [p.cardId, p.priceGbp.toNumber()]));

    // Prepare snapshots
    const snapshots = cards.map((card) => {
      const price = card.bestPriceGbp?.toNumber() ?? 0;
      const prevPrice = prevPriceMap.get(card.cardId) ?? price;
      const change = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;

      // Determine source
      let sourceUsed = 'unknown';
      if (card.optcgTcgplayerGbp?.toNumber() === price) sourceUsed = 'optcg';
      else if (card.limitlessCardmarketGbp?.toNumber() === price) sourceUsed = 'limitless';
      else if (card.justtcgTcgplayerGbp?.toNumber() === price) sourceUsed = 'justtcg';

      return {
        cardId: card.cardId,
        game: card.game,
        setCode: card.setCode,
        priceGbp: price,
        sourceUsed,
        change,
        snapshotDate: today,
      };
    });

    // Batch upsert (use raw SQL for performance)
    let insertedCount = 0;
    const batchSize = 500;

    for (let i = 0; i < snapshots.length; i += batchSize) {
      const batch = snapshots.slice(i, i + batchSize);

      try {
        await prisma.$executeRaw`
          INSERT INTO card_price_history (id, card_id, game, set_code, price_gbp, source_used, change, snapshot_date)
          SELECT
            gen_random_uuid()::text,
            unnest(${batch.map((s) => s.cardId)}::text[]),
            unnest(${batch.map((s) => s.game)}::text[]),
            unnest(${batch.map((s) => s.setCode)}::text[]),
            unnest(${batch.map((s) => s.priceGbp)}::decimal[]),
            unnest(${batch.map((s) => s.sourceUsed)}::text[]),
            unnest(${batch.map((s) => s.change)}::decimal[]),
            ${today}::date
          ON CONFLICT (card_id, snapshot_date) DO UPDATE SET
            price_gbp = EXCLUDED.price_gbp,
            source_used = EXCLUDED.source_used,
            change = EXCLUDED.change
        `;

        insertedCount += batch.length;
      } catch (error) {
        console.error(`Failed to insert batch starting at ${i}:`, error);
      }
    }

    console.log('Movers calculation complete:', { insertedCount });

    return NextResponse.json({
      success: true,
      stats: {
        totalCards: cards.length,
        insertedCount,
        date: today.toISOString().split('T')[0],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Movers cron error:', error);
    return NextResponse.json(
      { error: 'Movers calculation failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
