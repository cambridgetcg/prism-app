/**
 * GET /api/health
 * Health check endpoint for monitoring
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const revalidate = 0; // No caching

export async function GET() {
  try {
    // Check database connection
    const dbCheck = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW()`;
    const dbConnected = dbCheck.length > 0;

    // Get basic stats
    const stats = await prisma.cardPriceV2.aggregate({
      _count: { cardId: true },
      _max: { lastUpdated: true },
    });

    const lastUpdate = stats._max.lastUpdated;
    const cardCount = stats._count.cardId;

    // Check data freshness
    const maxStaleHours = 24;
    const hoursAgo = lastUpdate
      ? (new Date().getTime() - lastUpdate.getTime()) / (60 * 60 * 1000)
      : null;
    const dataFresh = hoursAgo !== null && hoursAgo < maxStaleHours;

    const status = dbConnected && dataFresh ? 'healthy' : 'degraded';

    return NextResponse.json({
      status,
      checks: {
        database: dbConnected ? 'connected' : 'disconnected',
        dataFreshness: dataFresh ? 'fresh' : 'stale',
      },
      stats: {
        cardCount,
        lastUpdate: lastUpdate?.toISOString(),
        hoursAgo: hoursAgo?.toFixed(1),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
