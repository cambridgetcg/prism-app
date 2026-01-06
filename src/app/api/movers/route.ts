/**
 * GET /api/movers
 * Returns top gainers, losers, and volume leaders
 */

import { NextResponse } from 'next/server';
import { getTopMovers } from '@/lib/price-index';

export const revalidate = 60; // Cache for 1 minute

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const movers = await getTopMovers(Math.min(limit, 50));

    return NextResponse.json({
      ...movers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching movers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch movers' },
      { status: 500 }
    );
  }
}
