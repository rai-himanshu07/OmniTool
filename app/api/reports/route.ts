import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAccess, AccessError, apiError } from '@/lib/services/workspaceAccess';
import { queryWorkReport, exportWorkReport } from '@/lib/services/workReports';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const access = await getAccess(request); const params = new URL(request.url).searchParams; const format = params.get('format') || 'json';
    if (!['json', 'csv', 'xlsx'].includes(format)) throw new AccessError('Unsupported export format');
    const result = queryWorkReport(getDb(), access.workspaceId, { name: access.user.name, person_id: access.person_id }, params, format !== 'json');
    if (format === 'json') return NextResponse.json(result);
    const buffer = await exportWorkReport(result.rows, format as 'csv' | 'xlsx');
    return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="omnitool-work-report-${new Date().toISOString().slice(0, 10)}.${format}"`, 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}