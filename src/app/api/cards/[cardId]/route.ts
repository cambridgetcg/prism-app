/**
 * GET /api/cards/[cardId]
 * Get card details by ID
 */

import { NextResponse } from 'next/server';
import { getCardById } from '@/lib/cards';

export const revalidate = 60; // Cache for 1 minute

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const decodedCardId = decodeURIComponent(cardId);

    const card = await getCardById(decodedCardId);

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      card,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching card:', error);
    return NextResponse.json(
      { error: 'Failed to fetch card' },
      { status: 500 }
    );
  }
}
