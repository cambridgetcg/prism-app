/**
 * GET /api/crystal
 * Get crystal visualization data (nodes, edges, clusters)
 */

import { NextResponse } from 'next/server';
import { getCrystalData } from '@/lib/price-index';

export const revalidate = 300; // Cache for 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const game = searchParams.get('game') || 'onepiece';
    const maxNodes = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);

    const data = await getCrystalData(game, maxNodes);

    return NextResponse.json({
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching crystal data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crystal data' },
      { status: 500 }
    );
  }
}
