'use client';
import { useDeferredValue, useEffect, useState } from 'react';
import Link from 'next/link';
import { Upload, RefreshCw, Search, Columns3, Save, ArrowUpDown, CheckSquare, Clock, ChevronLeft, ChevronRight, Archive, PanelLeftClose, PanelLeftOpen, RotateCcw } from 'lucide-react';
import { requestJson, usePanelCollapsed, useColumnWidths } from '@/lib/client';
import ColumnResizeHandle from '@/components/ColumnResizeHandle';
import type { TrackerSheet, TrackerMapping } from '@/lib/services/trackerFiles';

export default function FileViewsView() {
  const [railCollapsed, setRailCollapsed] = usePanelCollapsed('file-trackers');
  const [trackers, setTrackers] = useState<any[]>([]);
  const [tracker, setTracker] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query);
  const [filterColumn, setFilterColumn] = useState(-1);
  const [sortColumn, setSortColumn] = useState(-1);
  const [descending, setDescending] = useState(false);
  const [hidden, setHidden] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [mapping, setMapping] = useState<TrackerMapping>({ key: 0, title: 0, due: -1, waiting: -1 });
  const [project, setProject] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [role, setRole] = useState('viewer');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => { try { setTrackers((await requestJson('/api/file-views')).trackers); } catch (error) { setStatus(String(error)); } };
  const open = async (id: string) => {
    try { const data = await requestJson(`/api/file-views?id=${id}`); setTracker(data.tracker); setLinks(data.links); const sheet = data.tracker.sheets[0]; setSheetName(sheet.name); setMapping(data.tracker.mapping[sheet.name] || { key: 0, title: 0, due: -1, waiting: -1 }); setSelected([]); setHidden([]); setPage(0); setQuery(''); }
    catch (error) { setStatus(String(error)); }
  };
  useEffect(() => { load(); requestJson('/api/projects').then((data) => setProjects(data.projects || [])).catch((error) => setStatus(String(error))); requestJson('/api/me').then((data) => setRole(data.role)).catch((error) => setStatus(String(error))); }, []);
  const sheet = tracker?.sheets.find((entry: TrackerSheet) => entry.name === sheetName) as TrackerSheet | undefined;
  const columns = useColumnWidths(`tracker:${tracker?.id || 'none'}:${tracker?.sheets.findIndex((entry: TrackerSheet) => entry.name === sheetName) ?? 0}`, [...(sheet?.headers || []).map((_, index) => ({ id: String(index), width: 180 })), { id: 'linked', width: 150 }]);
  const tableWidth = 36 + (sheet?.headers || []).reduce((sum, _, index) => sum + (hidden.includes(index) ? 0 : columns.widths[index]), 0) + columns.widths[columns.widths.length - 1];
  const rows = (sheet?.rows || []).map((row, index) => ({ row, index })).filter(({ row }) => (filterColumn < 0 ? row.join(' ') : row[filterColumn] || '').toLowerCase().includes(search.toLowerCase()));
  if (sortColumn >= 0) rows.sort((first, second) => (first.row[sortColumn] || '').localeCompare(second.row[sortColumn] || '', undefined, { numeric: true }) * (descending ? -1 : 1));
  const pages = Math.max(1, Math.ceil(rows.length / 100)); const currentPage = Math.min(page, pages - 1); const visible = rows.slice(currentPage * 100, (currentPage + 1) * 100);
  const upload = async (refresh: boolean) => {
    if (!file || refresh && !tracker) return; setBusy(true); setStatus('');
    try { const form = new FormData(); form.set('file', file); form.set('name', name); form.set('visibility', visibility); if (refresh) form.set('id', tracker.id); const result = await requestJson('/api/file-views', { method: 'POST', body: form }); await load(); await open(result.id); setFile(null); setName(''); setStatus(refresh ? 'Tracker refreshed. Linked work items were not overwritten.' : 'Imported'); }
    catch (error) { setStatus(String(error)); } finally { setBusy(false); }
  };
  const saveMapping = async () => { await requestJson('/api/file-views', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tracker.id, sheet: sheetName, mapping }) }); };
  const convert = async (type: string) => {
    if (!confirm(`Create or link ${selected.length} ${type === 'task' ? 'tasks' : 'follow-ups'} from these rows?`)) return;
    setBusy(true); setStatus('');
    try { if (tracker.can_edit) await saveMapping(); const result = await requestJson('/api/file-views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tracker.id, sheet: sheetName, type, rows: selected, project_id: project || null }) }); setStatus(`${result.outcomes.filter((item: any) => !item.existing).length} created; ${result.outcomes.filter((item: any) => item.existing).length} already linked`); setSelected([]); const data = await requestJson(`/api/file-views?id=${tracker.id}`); setLinks(data.links); }
    catch (error) { setStatus(String(error)); } finally { setBusy(false); }
  };
  const chooseSheet = (name: string) => { setSheetName(name); setMapping(tracker.mapping[name] || { key: 0, title: 0, due: -1, waiting: -1 }); setHidden([]); setSelected([]); setPage(0); setFilterColumn(-1); setSortColumn(-1); };
  return <div><div className="page-header"><h1>File Views</h1></div>{status && <p role="status">{status}</p>}
    {role !== 'viewer' && <div className="file-import"><input type="file" aria-label="Excel or CSV tracker" accept=".xlsx,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} /><input className="form-input" aria-label="Tracker name" placeholder="Tracker name" value={name} onChange={(event) => setName(event.target.value)} /><select className="form-select" aria-label="New tracker visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="private">Private</option><option value="shared">Shared</option></select><button className="btn-capture" disabled={busy || !file} onClick={() => upload(false)}><Upload size={16} /> Import</button>{tracker?.can_edit && <button className="btn-secondary" disabled={busy || !file} onClick={() => upload(true)}><RefreshCw size={16} /> Refresh selected</button>}</div>}
    <div className={`file-view-layout ${railCollapsed ? 'is-rail-collapsed' : ''}`}><aside className="file-rail"><div className="panel-heading"><strong hidden={railCollapsed}>Trackers</strong><button className="notebook-tool" title={railCollapsed ? 'Show trackers' : 'Hide trackers'} aria-label={railCollapsed ? 'Show trackers' : 'Hide trackers'} aria-expanded={!railCollapsed} onClick={() => setRailCollapsed(!railCollapsed)}>{railCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div><div hidden={railCollapsed}>{trackers.map((record) => <button className={`notebook-list-row ${tracker?.id === record.id ? 'active' : ''}`} key={record.id} onClick={() => open(record.id)}><strong>{record.name}</strong><small>{record.visibility} · {new Date(record.imported_at).toLocaleDateString()}</small></button>)}</div></aside>
      <section className="file-workspace">{tracker && sheet ? <><div className="entity-card-header"><h2>{tracker.name}</h2><span className="work-muted">{tracker.file_name} · Imported {new Date(tracker.imported_at).toLocaleString()}</span></div>
        <div className="file-toolbar"><select className="form-select" aria-label="Worksheet" value={sheetName} onChange={(event) => chooseSheet(event.target.value)}>{tracker.sheets.map((entry: TrackerSheet) => <option key={entry.name}>{entry.name}</option>)}</select><label className="file-search"><Search size={16} /><input className="form-input" aria-label="Search rows" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label><select className="form-select" aria-label="Filter column" value={filterColumn} onChange={(event) => { setFilterColumn(Number(event.target.value)); setPage(0); }}><option value={-1}>All columns</option>{sheet.headers.map((header, index) => <option value={index} key={index}>{header}</option>)}</select><details><summary><Columns3 size={16} /> Columns</summary><div className="file-columns">{sheet.headers.map((header, index) => <label key={index}><input type="checkbox" checked={!hidden.includes(index)} onChange={(event) => setHidden(event.target.checked ? hidden.filter((value) => value !== index) : [...hidden, index])} /> {header}</label>)}</div></details></div>
        {tracker.can_edit && <details className="file-mapping"><summary>Column mapping</summary><div className="form-row">{(['key', 'title', 'due', 'waiting'] as const).map((key) => <label key={key}>{key === 'key' ? 'Stable row ID' : key === 'waiting' ? 'Waiting on' : key === 'due' ? 'Due date' : 'Title'}<select className="form-select" value={mapping[key]} onChange={(event) => setMapping({ ...mapping, [key]: Number(event.target.value) })}>{['due', 'waiting'].includes(key) && <option value={-1}>Not mapped</option>}{sheet.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label>)}<button className="btn-secondary" onClick={async () => { try { await saveMapping(); setStatus('Mapping saved'); const data = await requestJson(`/api/file-views?id=${tracker.id}`); setTracker(data.tracker); } catch (error) { setStatus(String(error)); } }}><Save size={16} /> Save mapping</button><select className="form-select" aria-label="Tracker visibility" value={tracker.visibility} onChange={async (event) => { try { await requestJson('/api/file-views', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tracker.id, visibility: event.target.value }) }); setTracker({ ...tracker, visibility: event.target.value }); load(); } catch (error) { setStatus(String(error)); } }}><option value="private">Private</option><option value="shared">Shared</option></select><button className="btn-secondary" onClick={async () => { try { await requestJson('/api/file-views', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tracker.id, archived: true }) }); setTracker(null); load(); } catch (error) { setStatus(String(error)); } }}><Archive size={16} /> Archive</button></div></details>}
        {selected.length > 0 && <div className="bulk-toolbar"><strong>{selected.length} selected</strong><select className="form-select" aria-label="Conversion project" value={project} onChange={(event) => setProject(event.target.value)}><option value="">No project</option>{projects.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</select><button className="btn-secondary" disabled={busy} onClick={() => convert('task')}><CheckSquare size={16} /> Create tasks</button><button className="btn-secondary" disabled={busy} onClick={() => convert('followup')}><Clock size={16} /> Create follow-ups</button></div>}
        <div className="file-toolbar"><button className="btn-secondary" title="Reset column widths" onClick={columns.reset}><RotateCcw size={16} /> Reset widths</button></div>
        <div className="file-table-scroll" role="region" aria-label="Scrollable tracker table" tabIndex={0}>
          <table className="file-table selection-table resizable-table" style={{ width: tableWidth }}>
            <colgroup><col style={{ width: 36 }} />{sheet.headers.map((_, index) => !hidden.includes(index) && <col key={index} style={{ width: columns.widths[index] }} />)}<col style={{ width: columns.widths[columns.widths.length - 1] }} /></colgroup>
            <thead><tr><th>{role !== 'viewer' && <input type="checkbox" aria-label="Select visible rows" checked={!!visible.length && visible.every((record) => selected.includes(record.index))} onChange={(event) => setSelected(event.target.checked ? visible.map((record) => record.index) : [])} />}</th>{sheet.headers.map((header, index) => !hidden.includes(index) && <th key={index}><button title={`Sort by ${header}`} onClick={() => { setSortColumn(index); setDescending(sortColumn === index ? !descending : false); }}><span>{header}</span><ArrowUpDown size={12} /></button><ColumnResizeHandle label={header} width={columns.widths[index]} onChange={(width) => columns.setWidth(String(index), width)} /></th>)}<th>Linked work<ColumnResizeHandle label="Linked work" width={columns.widths[columns.widths.length - 1]} onChange={(width) => columns.setWidth('linked', width)} /></th></tr></thead>
            <tbody>{visible.map(({ row, index }) => <tr key={index}><td>{role !== 'viewer' && <input type="checkbox" aria-label={`Select row ${index + 2}`} checked={selected.includes(index)} disabled={!selected.includes(index) && selected.length >= 100} onChange={(event) => setSelected(event.target.checked ? [...selected, index] : selected.filter((value) => value !== index))} />}</td>{row.map((value, column) => !hidden.includes(column) && <td key={column}>{value}</td>)}<td>{links.filter((link) => link.sheet_name === sheetName && link.row_key === row[mapping.key]?.trim()).map((link) => <Link key={link.entity_type} href={link.entity_type === 'task' ? `/tasks/${link.entity_id}` : `/followups?focus=${link.entity_id}`}>{link.entity_type}</Link>)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="file-pagination"><span>{rows.length} rows · Page {currentPage + 1} of {pages}</span><button className="notification-trigger" title="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} /></button><button className="notification-trigger" title="Next page" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} /></button></div>
      </> : <p className="work-muted">{trackers.length ? 'Select a tracker.' : 'No file views.'}</p>}</section>
    </div>
  </div>;
}