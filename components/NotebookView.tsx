'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Archive, Bold, Columns3, Copy, Download, History, Italic, Link2, List, ListOrdered, Pencil, Plus, Printer, Quote, Redo2, Rows3, Save, Search, Strikethrough, Table2, Underline, Undo2 } from 'lucide-react';
import type { Notebook, NotebookPage } from '@/lib/db/schema';

type PageSummary = Pick<NotebookPage, 'id' | 'title' | 'section' | 'archived' | 'updated_at'> & { preview?: string };
type Revision = { id: string; title: string; saved_at: string };
type Match = { id: string; notebook_id: string; notebook_name: string; title: string; section?: string; preview?: string };

function NotebookEditor({ notebook, page, revisions, onSaved, onDirtyChange }: {
  notebook: Notebook; page: NotebookPage; revisions: Revision[]; onSaved: (page: NotebookPage) => void; onDirtyChange: (dirty: boolean) => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [section, setSection] = useState(page.section || '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState('');
  const editor = useEditor({
    extensions: [StarterKit, TableKit, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: JSON.parse(page.content_json), immediatelyRender: false, editable: !page.archived,
    onUpdate: () => setDirty(true),
  }, [page.id]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    const warnOnNavigation = (event: MouseEvent) => {
      if (dirty && (event.target as HTMLElement).closest('a[href]') && !confirm('Discard unsaved page changes?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', warnOnNavigation, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', warnOnNavigation, true); };
  }, [dirty]);

  const save = async () => {
    if (!editor || !title.trim()) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/notebooks/${notebook.id}/pages/${page.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), section: section.trim(), content: editor.getJSON(), if_match_updated_at: page.updated_at }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save page');
      setDirty(false); onSaved(data.page);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save page'); }
    finally { setSaving(false); }
  };

  const restore = async () => {
    if (!selectedRevision || !confirm('Restore this revision? The current version will remain in history.')) return;
    const response = await fetch(`/api/notebooks/${notebook.id}/pages/${page.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore_revision_id: selectedRevision, if_match_updated_at: page.updated_at }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Could not restore revision'); return; }
    setDirty(false); onSaved(data.page);
  };

  const copyPageLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable in this browser context');
      await navigator.clipboard.writeText(`${window.location.origin}/notebooks?notebook_id=${notebook.id}&page_id=${page.id}`);
      setCopied(true);
    } catch { setError('Could not copy page link.'); }
  };

  const tool = (label: string, active: boolean, run: () => void, icon: React.ReactNode) =>
    <button type="button" className={`notebook-tool ${active ? 'is-active' : ''}`} title={label} aria-label={label} aria-pressed={active} onClick={run}>{icon}</button>;

  return <article className="notebook-page-editor">
    <div className="notebook-page-header">
      <div className="notebook-title-fields"><input className="notebook-page-title" aria-label="Page title" value={title} disabled={!!page.archived} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} />
        <input className="notebook-section-input" aria-label="Section" placeholder="Section (optional)" value={section} disabled={!!page.archived} onChange={(event) => { setSection(event.target.value); setDirty(true); }} /></div>
      <div className="notebook-page-actions"><span role="status" className="notebook-save-state">{saving ? 'Saving' : dirty ? 'Unsaved' : copied ? 'Link copied' : 'Saved'}</span>
        <button className="btn-capture" type="button" disabled={!dirty || saving || !!page.archived} onClick={save}><Save size={15} /> Save</button>
        <button className="btn-secondary" type="button" aria-label="Copy page link" title="Copy page link" onClick={copyPageLink}><Copy size={16} /></button>
        <a className="btn-secondary" aria-label="Export page as DOCX" title="Export page as DOCX" href={`/api/notebooks/${notebook.id}/export?page_id=${page.id}`}><Download size={16} /></a>
        <button className="btn-secondary" type="button" aria-label="Print or save as PDF" title="Print or save as PDF" onClick={() => window.print()}><Printer size={16} /></button>
      </div>
    </div>
    {error && <p role="alert" className="work-error">{error}</p>}
    {editor && <>
      {!page.archived &&
      <div className="notebook-toolbar" role="toolbar" aria-label="Document formatting">
        <select className="notebook-style-select" aria-label="Text style" value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'paragraph'} onChange={(event) => { const style = event.target.value; if (style === 'paragraph') editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: Number(style.slice(1)) as 1 | 2 | 3 }).run(); }}>
          <option value="paragraph">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
        </select>
        {tool('Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={16} />)}
        {tool('Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />)}
        {tool('Underline', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <Underline size={16} />)}
        {tool('Strikethrough', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), <Strikethrough size={16} />)}
        {tool('Bullet list', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List size={16} />)}
        {tool('Numbered list', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={16} />)}
        {tool('Quote', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), <Quote size={16} />)}
        {tool('Insert table', editor.isActive('table'), () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), <Table2 size={16} />)}
        {editor.isActive('table') && <>{tool('Add row', false, () => editor.chain().focus().addRowAfter().run(), <Rows3 size={16} />)}{tool('Add column', false, () => editor.chain().focus().addColumnAfter().run(), <Columns3 size={16} />)}{tool('Delete table', false, () => editor.chain().focus().deleteTable().run(), <Archive size={16} />)}</>}
        {tool('Add or edit link', editor.isActive('link'), () => { const current = editor.getAttributes('link').href || ''; const url = window.prompt('Link URL (clear to remove)', current); if (url === null) return; if (!url.trim()) editor.chain().focus().unsetLink().run(); else if (/^https?:\/\//i.test(url)) editor.chain().focus().setLink({ href: url.trim() }).run(); else setError('Use an http or https URL.'); }, <Link2 size={16} />)}
        {tool('Undo', false, () => editor.chain().focus().undo().run(), <Undo2 size={16} />)}
        {tool('Redo', false, () => editor.chain().focus().redo().run(), <Redo2 size={16} />)}
      </div>}
      <EditorContent editor={editor} className="notebook-editor-content" />
    </>}
    <div className="notebook-history"><History size={16} aria-hidden="true" /><select aria-label="Saved revisions" value={selectedRevision} onChange={(event) => setSelectedRevision(event.target.value)}><option value="">Saved revisions</option>{revisions.map((revision) => <option key={revision.id} value={revision.id}>{revision.title} · {new Date(revision.saved_at).toLocaleString()}</option>)}</select><button className="btn-secondary" type="button" disabled={!selectedRevision || dirty} onClick={restore}>Restore</button></div>
  </article>;
}

export default function NotebookView() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [page, setPage] = useState<NotebookPage | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [newName, setNewName] = useState('');
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [renamingNotebook, setRenamingNotebook] = useState(false);
  const [renamedName, setRenamedName] = useState('');
  const [newPageTitle, setNewPageTitle] = useState('');
  const [creatingPage, setCreatingPage] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState('');
  const [pageDirty, setPageDirty] = useState(false);

  const loadNotebooks = async () => {
    const response = await fetch('/api/notebooks');
    if (!response.ok) { setError('Could not load notebooks.'); return; }
    setNotebooks((await response.json()).notebooks || []);
  };
  const openNotebook = async (id: string) => {
    if (notebook?.id === id) return;
    if (pageDirty && !confirm('Discard unsaved page changes?')) return;
    const response = await fetch(`/api/notebooks/${id}`);
    if (!response.ok) { setError('Could not open notebook.'); return; }
    const data = await response.json();
    setNotebook(data.notebook); setPages(data.pages); setPage(null); setPageDirty(false); setRevisions([]); setError('');
  };
  const openPage = async (notebookId: string, pageId: string) => {
    if (pageDirty && !confirm('Discard unsaved page changes?')) return;
    const response = await fetch(`/api/notebooks/${notebookId}/pages/${pageId}`);
    if (!response.ok) { setError('Could not open page.'); return; }
    const data = await response.json();
    if (notebook?.id !== notebookId) await openNotebook(notebookId);
    setPage(data.page); setPageDirty(false); setRevisions(data.revisions || []); setError('');
  };
  useEffect(() => {
    loadNotebooks();
    const params = new URLSearchParams(window.location.search);
    const notebookId = params.get('notebook_id');
    const pageId = params.get('page_id');
    if (!notebookId || !pageId) return;
    Promise.all([fetch(`/api/notebooks/${notebookId}`), fetch(`/api/notebooks/${notebookId}/pages/${pageId}`)])
      .then(async ([bookResponse, pageResponse]) => {
        if (!bookResponse.ok || !pageResponse.ok) throw new Error('Page not found');
        const bookData = await bookResponse.json();
        const pageData = await pageResponse.json();
        setNotebook(bookData.notebook); setPages(bookData.pages); setPage(pageData.page); setRevisions(pageData.revisions || []);
      }).catch(() => setError('Could not open linked page.'));
  }, []);
  useEffect(() => {
    if (!search.trim()) { setMatches([]); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/notebooks?q=${encodeURIComponent(search.trim())}`, { signal: controller.signal })
        .then((response) => response.json()).then((data) => setMatches(data.matches || [])).catch(() => undefined);
    }, 220);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [search]);

  const createNotebook = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch('/api/notebooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) });
    if (!response.ok) { setError('Could not create notebook.'); return; }
    const created: Notebook = (await response.json()).notebook;
    setNewName(''); setCreatingNotebook(false); loadNotebooks(); openNotebook(created.id);
  };
  const renameNotebook = async (event: FormEvent) => {
    event.preventDefault();
    if (!notebook) return;
    const response = await fetch(`/api/notebooks/${notebook.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renamedName.trim() }) });
    if (!response.ok) { setError('Could not rename notebook.'); return; }
    setNotebook((await response.json()).notebook); setRenamingNotebook(false); loadNotebooks();
  };
  const createPage = async (event: FormEvent) => {
    event.preventDefault();
    if (!notebook) return;
    if (pageDirty && !confirm('Discard unsaved page changes?')) return;
    const response = await fetch(`/api/notebooks/${notebook.id}/pages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newPageTitle.trim() }) });
    if (!response.ok) { setError('Could not create page.'); return; }
    const created: NotebookPage = (await response.json()).page;
    setNewPageTitle(''); setCreatingPage(false); setPages((current) => [created, ...current]); openPage(notebook.id, created.id); loadNotebooks();
  };
  const toggleArchive = async (kind: 'notebook' | 'page') => {
    if (!notebook || kind === 'page' && !page) return;
    if (pageDirty && !confirm('Discard unsaved page changes?')) return;
    const url = kind === 'notebook' ? `/api/notebooks/${notebook.id}` : `/api/notebooks/${notebook.id}/pages/${page!.id}`;
    const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: kind === 'notebook' ? notebook.archived ? 0 : 1 : page!.archived ? 0 : 1 }) });
    if (!response.ok) { setError('Could not change archive state.'); return; }
    if (kind === 'notebook') { setNotebook(null); setPage(null); loadNotebooks(); }
    else { const updated: NotebookPage = (await response.json()).page; setPage(null); setPages((current) => current.map((item) => item.id === updated.id ? { ...item, archived: updated.archived } : item)); }
  };
  const onSaved = (saved: NotebookPage) => {
    setPageDirty(false);
    setPage(saved); setPages((current) => current.map((item) => item.id === saved.id ? { ...item, title: saved.title, section: saved.section, updated_at: saved.updated_at } : item));
    fetch(`/api/notebooks/${saved.notebook_id}/pages/${saved.id}`).then((response) => response.json()).then((data) => setRevisions(data.revisions || [])).catch(() => undefined);
  };

  return <div className="notebook-shell">
    <aside className="notebook-rail"><div className="notebook-rail-heading"><h1>Notebooks</h1><button className="notebook-tool" title="New notebook" aria-label="New notebook" onClick={() => setCreatingNotebook(true)}><Plus size={18} /></button></div>
      {creatingNotebook && <form onSubmit={createNotebook} className="notebook-inline-form"><input className="form-input" aria-label="Notebook name" placeholder="Notebook name" required value={newName} onChange={(event) => setNewName(event.target.value)} /><button type="submit" className="btn-capture">Create</button></form>}
      <label className="directory-filter"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show archived</label>
      <div className="notebook-list">{notebooks.filter((item) => showArchived || !item.archived).map((item) => <button key={item.id} className={`notebook-list-row ${notebook?.id === item.id ? 'active' : ''}`} onClick={() => openNotebook(item.id)}><strong>{item.name}{item.archived ? ' · Archived' : ''}</strong><small>{item.page_count || 0} {item.page_count === 1 ? 'page' : 'pages'}</small></button>)}</div>
    </aside>
    <aside className="notebook-rail notebook-pages-rail"><div className="notebook-rail-heading"><h2>{notebook?.name || 'Pages'}</h2>{notebook && !notebook.archived && <button className="notebook-tool" title="New page" aria-label="New page" onClick={() => setCreatingPage(true)}><Plus size={18} /></button>}</div>
      {notebook && <><div className="notebook-rail-actions"><a href={`/api/notebooks/${notebook.id}/export`} className="notebook-tool" title="Export notebook as DOCX" aria-label="Export notebook as DOCX"><Download size={16} /></a><button className="notebook-tool" title={notebook.archived ? 'Restore notebook' : 'Archive notebook'} aria-label={notebook.archived ? 'Restore notebook' : 'Archive notebook'} onClick={() => toggleArchive('notebook')}><Archive size={16} /></button></div>
      <button className="notebook-tool" title="Rename notebook" aria-label="Rename notebook" onClick={() => { setRenamedName(notebook.name); setRenamingNotebook(true); }}><Pencil size={16} /></button>
      {renamingNotebook && <form onSubmit={renameNotebook} className="notebook-inline-form"><input className="form-input" aria-label="New notebook name" required value={renamedName} onChange={(event) => setRenamedName(event.target.value)} /><button className="btn-capture" type="submit">Save</button></form>}
        {creatingPage && <form onSubmit={createPage} className="notebook-inline-form"><input className="form-input" aria-label="New page title" placeholder="Page title" required value={newPageTitle} onChange={(event) => setNewPageTitle(event.target.value)} /><button className="btn-capture" type="submit">Add</button></form>}
        <div className="notebook-list">{pages.filter((item) => showArchived || !item.archived).map((item) => <button key={item.id} className={`notebook-list-row ${page?.id === item.id ? 'active' : ''}`} onClick={() => openPage(notebook.id, item.id)}><strong>{item.title}{item.archived ? ' · Archived' : ''}</strong><small>{item.section || item.preview || 'No section'}</small></button>)}</div>
      </>}
    </aside>
    <main className="notebook-workspace"><div className="notebook-search"><Search size={16} /><input aria-label="Search notebook pages" placeholder="Search pages and content" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {search.trim() && <div className="notebook-search-results">{matches.map((match) => <button key={match.id} onClick={() => { openPage(match.notebook_id, match.id); setSearch(''); }}><strong>{match.title}</strong><small>{match.notebook_name} · {match.preview}</small></button>)}{!matches.length && <p className="work-muted">No matching pages.</p>}</div>}
      {error && <p role="alert" className="work-error">{error}</p>}
      {page && notebook ? <><div className="notebook-page-meta"><span>{notebook.name}</span><button type="button" className="notebook-tool" title={page.archived ? 'Restore page' : 'Archive page'} aria-label={page.archived ? 'Restore page' : 'Archive page'} onClick={() => toggleArchive('page')}><Archive size={16} /></button></div><NotebookEditor key={page.id + page.updated_at} notebook={notebook} page={page} revisions={revisions} onSaved={onSaved} onDirtyChange={setPageDirty} /></> : <div className="notebook-empty"><h2>{notebook ? 'Select a page' : 'Select a notebook'}</h2></div>}
    </main>
  </div>;
}