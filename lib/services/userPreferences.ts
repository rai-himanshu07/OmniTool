import { getDb } from '@/lib/db';
import { AccessError } from './workspaceAccess';

export const defaultPreferences = { desktop_alerts: true, enabled_types: ['overdue', 'due_soon', 'followup_aging', 'meeting_soon', 'reminder', 'recurring_due'], quiet_start: '', quiet_end: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', meeting_lead_minutes: 30, work_start: '09:00', work_end: '17:00', weekend_days: [0, 6], daily_minutes: 420 };
export function preferences(workspaceId: string, userId: string) {
  const row = getDb().prepare('SELECT value_json FROM user_preferences WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId) as { value_json: string } | undefined;
  return { ...defaultPreferences, ...(row ? JSON.parse(row.value_json) : {}) } as typeof defaultPreferences;
}
export function validatePreferences(value: any) {
  const result = { ...defaultPreferences, ...value };
  if (typeof result.desktop_alerts !== 'boolean' || !Array.isArray(result.enabled_types) || result.enabled_types.some((type: string) => !defaultPreferences.enabled_types.includes(type))) throw new AccessError('Invalid alert preferences');
  for (const key of ['quiet_start', 'quiet_end', 'work_start', 'work_end'] as const) if (typeof result[key] !== 'string' || result[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(result[key])) throw new AccessError('Use valid 24-hour times');
  if (!!result.quiet_start !== !!result.quiet_end || !result.work_start || !result.work_end || result.work_start >= result.work_end) throw new AccessError('Use a complete quiet-hours range and a working day ending after it starts');
  try { new Intl.DateTimeFormat('en', { timeZone: result.timezone }).format(); } catch { throw new AccessError('Invalid timezone'); }
  if (!Number.isInteger(result.meeting_lead_minutes) || result.meeting_lead_minutes < 0 || result.meeting_lead_minutes > 1440 || !Number.isInteger(result.daily_minutes) || result.daily_minutes < 0 || result.daily_minutes > 1440 || !Array.isArray(result.weekend_days) || result.weekend_days.some((day: number) => !Number.isInteger(day) || day < 0 || day > 6)) throw new AccessError('Invalid working time or meeting lead time');
  return Object.fromEntries(Object.keys(defaultPreferences).map((key) => [key, result[key]]));
}