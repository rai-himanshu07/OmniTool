import { NextResponse } from 'next/server';
import { processRecurrences } from '@/lib/services/recurrenceEngine';

export async function POST() {
  try {
    const result = processRecurrences();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
