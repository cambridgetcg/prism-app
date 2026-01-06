/**
 * GET /api/cron/calculate-tcg100
 * Cron job to calculate and store TCG-100 index snapshot
 * Should be called by Vercel cron at 8:15 and 20:15 UTC (after price sync)
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/db';
import { calculateIndex, INDEX_CONFIGS } from '@/lib/price-index';

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

    console.log('Starting TCG-100 calculation cron job...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate main indices
    const results: { key: string; value: number; cardCount: number }[] = [];

    for (const [key, config] of Object.entries(INDEX_CONFIGS)) {
      try {
        const result = await calculateIndex(config);

        // Store snapshot
        await prisma.priceIndexSnapshot.upsert({
          where: {
            indexType_indexKey_snapshotDate: {
              indexType: result.type,
              indexKey: result.key,
              snapshotDate: today,
            },
          },
          update: {
            value: result.value,
            change24h: result.change24h,
            change7d: result.change7d,
            change30d: result.change30d,
            cardCount: result.cardCount,
            totalMarketCap: result.totalMarketCap,
            avgPrice: result.avgPrice,
            volatility: result.volatility,
            highPrice: result.highPrice,
            lowPrice: result.lowPrice,
          },
          create: {
            indexType: result.type,
            indexKey: result.key,
            value: result.value,
            change24h: result.change24h,
            change7d: result.change7d,
            change30d: result.change30d,
            cardCount: result.cardCount,
            totalMarketCap: result.totalMarketCap,
            avgPrice: result.avgPrice,
            volatility: result.volatility,
            highPrice: result.highPrice,
            lowPrice: result.lowPrice,
            snapshotDate: today,
          },
        });

        results.push({
          key,
          value: result.value,
          cardCount: result.cardCount,
        });

        console.log(`Calculated ${key}:`, {
          value: result.value.toFixed(2),
          cardCount: result.cardCount,
        });
      } catch (error) {
        console.error(`Failed to calculate ${key}:`, error);
      }
    }

    console.log('TCG-100 calculation complete:', { indicesCalculated: results.length });

    return NextResponse.json({
      success: true,
      indices: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('TCG-100 cron error:', error);
    return NextResponse.json(
      { error: 'TCG-100 calculation failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
