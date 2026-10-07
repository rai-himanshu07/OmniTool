import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { getDb().prepare('SELECT 1').get(); return NextResponse.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ status: 'unavailable' }, { status: 503 }); }
}