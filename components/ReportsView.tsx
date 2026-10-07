'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Filter, ChevronLeft, ChevronRight, Search, RotateCcw } from 'lucide-react';
import { requestJson, useColumnWidths } from '@/lib/client';
import ColumnResizeHandle from '@/components/ColumnResizeHandle';
import type { ReportRow } from '@/lib/services/workReports';

const REPORT_COLUMNS = [
  { id: 'type', label: 'Type', width: 104 }, { id: 'title', label: 'Title', width: 320 },
  { id: 'project', label: 'Project', width: 220 }, { id: 'client', label: 'Client', width: 180 },
  { id: 'owner', label: 'Owner', width: 160 }, { id: 'status', label: 'Status', width: 150 },
  { id: 'priority', label: 'Priority', width: 120 }, { id: 'due', label: 'Due / Delivery', width: 160 },
  { id: 'completed', label: 'Completed', width: 160 },
];

export default function ReportsView() {
  const columns = useColumnWidths('work-reports', REPORT_COLUMNS);
  const [filters, setFilters] = useState({ kind: 'all', scope: 'workspace', status: '', priority: '', project_id: '', client_id: '', person_id: '', date_basis: 'due', from: '', through: '', q: '', archived: 'false' });
  const [offset, setOffset] = useState(0); const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<any>({ projects: [], clients: [], people: [] });
  useEffect(() => { Promise.all([requestJson('/api/projects'), requestJson('/api/clients'), requestJson('/api/people')]).then(([projects, clients, people]) => setOptions({ projects: projects.projects || [], clients: clients.clients || [], people: people.people || [] })).catch((cause) => setError(String(cause))); }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    const timer = window.setTimeout(() => requestJson(`/api/reports?${new URLSearchParams({ ...filters, offset: String(offset) })}`, { signal: controller.signal }).then((result) => { if (!controller.signal.aborted) { setData(result); setError(''); } }).catch((cause) => { if (!controller.signal.aborted) setError(String(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }), 200);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [filters, offset]);
  const update = (key: keyof typeof filters, value: string) => { setOffset(0); setFilters({ ...filters, [key]: value }); };
  const download = async (format: string) => {
    try { const response = await fetch(`/api/reports?${new URLSearchParams({ ...filters, format })}`); if (!response.ok) throw new Error((await response.json()).error || 'Export failed'); const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = `omnitool-work-report.${format}`; link.click(); URL.revokeObjectURL(url); } catch (cause) { setError(String(cause)); }
  };
  return <div className="reports-view"><div className="page-header"><h1>Work Reports</h1></div>
    <div className="tabs">{[{ value: 'all', label: 'Projects & Tasks' }, { value: 'project', label: 'Projects' }, { value: 'task', label: 'Tasks' }].map(({ value, label }) => <button className={`tab ${filters.kind === value ? 'active' : ''}`} key={value} onClick={() => update('kind', value)}>{label}</button>)}</div>
    <section className="report-filters"><div className="file-toolbar"><label><Search size={15} /><input className="form-input" aria-label="Search report" placeholder="Search" value={filters.q} onChange={(event) => update('q', event.target.value)} /></label><label>Scope<select className="form-select" value={filters.scope} onChange={(event) => update('scope', event.target.value)}><option value="workspace">Workspace</option><option value="mine">Assigned to me</option></select></label><label>Status<select className="form-select" value={filters.status} onChange={(event) => update('status', event.target.value)}><option value="">All statuses</option><option value="active">Open / active</option><option value="completed">Completed</option><option value="waiting">Waiting / blocked</option><option value="cancelled">Cancelled</option><option value="on_hold">On hold</option></select></label><label>Priority<select className="form-select" value={filters.priority} onChange={(event) => update('priority', event.target.value)}><option value="">All</option>{['critical', 'high', 'medium', 'low'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
      <details><summary><Filter size={15} /> Date & Relationship Filters</summary><div className="configuration-grid">{(['project_id', 'client_id', 'person_id'] as const).map((key) => <label key={key}>{key.replace('_id', '')}<select className="form-select" value={filters[key]} onChange={(event) => update(key, event.target.value)}><option value="">All</option>{options[key === 'project_id' ? 'projects' : key === 'client_id' ? 'clients' : 'people'].map((entry: any) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>)}<label>Date basis<select className="form-select" value={filters.date_basis} onChange={(event) => update('date_basis', event.target.value)}><option value="due">Due / delivery date</option><option value="created">Created (UTC)</option><option value="completed">Completed date</option></select></label><label>From<input className="form-input" type="date" value={filters.from} onChange={(event) => update('from', event.target.value)} /></label><label>Through<input className="form-input" type="date" min={filters.from} value={filters.through} onChange={(event) => update('through', event.target.value)} /></label></div></details>
      <div className="file-toolbar"><label><input type="checkbox" checked={filters.archived === 'true'} onChange={(event) => update('archived', String(event.target.checked))} /> Include archived</label><button className="btn-secondary" onClick={() => { setFilters({ kind: 'all', scope: 'workspace', status: '', priority: '', project_id: '', client_id: '', person_id: '', date_basis: 'due', from: '', through: '', q: '', archived: 'false' }); setOffset(0); }}>Reset filters</button><button className="btn-secondary" disabled={loading} onClick={() => download('csv')}><Download size={16} /> CSV</button><button className="btn-capture" disabled={loading} onClick={() => download('xlsx')}><Download size={16} /> Excel</button></div>
    </section>{error && <p role="alert" className="work-error">{error}</p>}
    {data && <><div className="report-summary"><span><strong>{data.summary.total}</strong> records</span><span><strong>{data.summary.projects}</strong> projects</span><span><strong>{data.summary.tasks}</strong> tasks</span><span><strong>{data.summary.completed}</strong> completed</span><span>{filters.from || filters.through ? `${filters.from || 'Beginning'} - ${filters.through || 'Present'}` : 'All time'}</span><button className="notification-trigger" title="Reset column widths" aria-label="Reset column widths" onClick={columns.reset}><RotateCcw size={16} /></button></div>
      <div className="file-table-scroll" role="region" aria-label="Consolidated work report" tabIndex={0} aria-busy={loading}>
        <table className="file-table report-table resizable-table" style={{ width: columns.widths.reduce((sum, width) => sum + width, 0) }}>
          <colgroup>{REPORT_COLUMNS.map((column, index) => <col key={column.id} style={{ width: columns.widths[index] }} />)}</colgroup>
          <thead><tr>{REPORT_COLUMNS.map((column, index) => <th key={column.id}><span>{column.label}</span><ColumnResizeHandle label={column.label} width={columns.widths[index]} onChange={(width) => columns.setWidth(column.id, width)} /></th>)}</tr></thead>
          <tbody>{data.rows.map((row: ReportRow) => <tr key={`${row.kind}:${row.id}`}><td>{row.kind}</td><td><Link href={row.kind === 'task' ? `/tasks/${row.id}` : `/projects/${row.id}`}>{row.title}</Link>{!!row.archived && <span className="badge">Archived</span>}</td><td>{row.project_name || '-'}</td><td>{row.client_name || '-'}</td><td>{row.owner}</td><td><span className="badge">{row.status.replace(/_/g, ' ')}</span>{row.health && <small className="report-health">{row.health}</small>}</td><td>{row.priority}</td><td>{row.due_date || '-'}</td><td>{row.completed_at?.slice(0, 10) || '-'}</td></tr>)}</tbody>
        </table>
      </div>
      {!data.rows.length && <p className="work-muted">No matching work.</p>}<div className="file-pagination"><span>{data.summary.total ? `${offset + 1}-${Math.min(offset + 50, data.summary.total)} of ${data.summary.total}` : '0 records'}</span><button className="notification-trigger" title="Previous report page" disabled={!offset || loading} onClick={() => setOffset(Math.max(0, offset - 50))}><ChevronLeft size={18} /></button><button className="notification-trigger" title="Next report page" disabled={!data.has_more || loading} onClick={() => setOffset(offset + 50)}><ChevronRight size={18} /></button></div></>}
    {loading && <p role="status">Loading report...</p>}
  </div>;
}