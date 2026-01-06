/**
 * GET /api/index
 * Returns all price indices and market health data
 */

import { NextResponse } from 'next/server';
import { getAllIndices, getMarketHealth } from '@/lib/price-index';

export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    const [indices, marketHealth] = await Promise.all([
      getAllIndices(),
      getMarketHealth('onepiece'),
    ]);

    return NextResponse.json({
      indices,
      marketHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching index data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch index data' },
      { status: 500 }
    );
  }
}
