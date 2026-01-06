/**
 * GET /api/history/[cardId]
 * Get price history for a card
 */

import { NextResponse } from 'next/server';
import { getCardHistory } from '@/lib/cards';

export const revalidate = 60; // Cache for 1 minute

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const decodedCardId = decodeURIComponent(cardId);

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 365);

    const history = await getCardHistory(decodedCardId, days);

    if (!history) {
      return NextResponse.json(
        { error: 'No history found for this card' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...history,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching card history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch card history' },
      { status: 500 }
    );
  }
}
