import { NextResponse } from 'next/server';
import { syncCalendar } from '@/lib/services/msGraphCalendar';

export async function POST() {
  try {
    const result = await syncCalendar();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
