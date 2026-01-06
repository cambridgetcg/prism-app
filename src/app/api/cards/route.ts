/**
 * GET /api/cards
 * Search and list cards with filters
 */

import { NextResponse } from 'next/server';
import { searchCards, getAllSets, getAllRarities } from '@/lib/cards';

export const revalidate = 300; // Cache for 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Check if requesting filters
    const filters = searchParams.get('filters');
    if (filters === 'true') {
      const game = searchParams.get('game') || 'onepiece';
      const [sets, rarities] = await Promise.all([
        getAllSets(game),
        getAllRarities(game),
      ]);

      return NextResponse.json({ sets, rarities });
    }

    // Otherwise, search cards
    const options = {
      query: searchParams.get('q') || undefined,
      game: searchParams.get('game') || 'onepiece',
      setCode: searchParams.get('set') || undefined,
      rarity: searchParams.get('rarity') || undefined,
      language: searchParams.get('language') || undefined,
      minPrice: searchParams.get('minPrice')
        ? parseFloat(searchParams.get('minPrice')!)
        : undefined,
      maxPrice: searchParams.get('maxPrice')
        ? parseFloat(searchParams.get('maxPrice')!)
        : undefined,
      sortBy: (searchParams.get('sortBy') as 'price' | 'name' | 'change') || 'price',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: Math.min(parseInt(searchParams.get('limit') || '50', 10), 100),
    };

    const result = await searchCards(options);

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error searching cards:', error);
    return NextResponse.json(
      { error: 'Failed to search cards' },
      { status: 500 }
    );
  }
}
