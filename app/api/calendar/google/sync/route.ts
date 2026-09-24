import { NextResponse } from 'next/server';
import { syncGoogleCalendar } from '@/lib/services/googleCalendar';

export async function POST() {
  try {
    return NextResponse.json({ success: true, ...await syncGoogleCalendar() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Google sync failed' }, { status: 500 });
  }
}