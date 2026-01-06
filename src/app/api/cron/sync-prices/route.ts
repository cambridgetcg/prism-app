/**
 * GET /api/cron/sync-prices
 * Cron job to sync prices from external sources
 * Should be called by Vercel cron at 8:00 and 20:00 UTC
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/db';

// Verify cron secret to prevent unauthorized calls
async function verifyCronSecret(): Promise<boolean> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');

  // Vercel cron jobs send the CRON_SECRET in the Authorization header
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Also allow localhost during development
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

    console.log('Starting price sync cron job...');

    // This is a read-only app - we don't actually sync prices here
    // The trading-card-pricer Lambda handles the actual syncing
    // This endpoint is for health monitoring and statistics

    const stats = await prisma.cardPriceV2.aggregate({
      _count: { cardId: true },
      _max: { lastUpdated: true },
    });

    const lastUpdate = stats._max.lastUpdated;
    const cardCount = stats._count.cardId;

    // Check if prices are stale (> 12 hours old)
    const staleHours = 12;
    const isStale =
      lastUpdate &&
      new Date().getTime() - lastUpdate.getTime() > staleHours * 60 * 60 * 1000;

    if (isStale) {
      console.warn('Price data is stale:', {
        lastUpdate: lastUpdate?.toISOString(),
        hoursAgo: lastUpdate
          ? (new Date().getTime() - lastUpdate.getTime()) / (60 * 60 * 1000)
          : null,
      });
    }

    console.log('Price sync check complete:', {
      cardCount,
      lastUpdate: lastUpdate?.toISOString(),
      isStale,
    });

    return NextResponse.json({
      success: true,
      stats: {
        cardCount,
        lastUpdate: lastUpdate?.toISOString(),
        isStale,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Price sync cron error:', error);
    return NextResponse.json(
      { error: 'Price sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
