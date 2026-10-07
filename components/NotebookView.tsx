'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Archive, Bold, Columns3, Copy, Download, History, Italic, Link2, List, ListOrdered, Pencil, Plus, Printer, Quote, Redo2, Rows3, Save, Search, Strikethrough, Table2, Underline, Undo2, PanelLeftClose, PanelLeftOpen, AlignLeft, AlignCenter, AlignRight, AlignJustify, ListTodo, Code2, Minus, RemoveFormatting, Highlighter, Palette, Trash2, IndentIncrease, IndentDecrease, Eye, PencilLine, Maximize2, Minimize2 } from 'lucide-react';
import type { Notebook, NotebookPage } from '@/lib/db/schema';
import { usePanelCollapsed } from '@/lib/client';

type PageSummary = Pick<NotebookPage, 'id' | 'title' | 'section' | 'archived' | 'updated_at'> & { preview?: string };
type Revision = { id: string; title: string; saved_at: string };
type Match = { id: string; notebook_id: string; notebook_name: string; title: string; section?: string; preview?: string };

function NotebookEditor({ notebook, page, revisions, onSaved, onDirtyChange, readOnly }: {
  notebook: Notebook; page: NotebookPage; revisions: Revision[]; onSaved: (page: NotebookPage) => void; onDirtyChange: (dirty: boolean) => void; readOnly: boolean;
}) {
  const [title, setTitle] = useState(page.title);
  const [section, setSection] = useState(page.section || '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState('');
  const [reading, setReading] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
  const editor = useEditor({
    extensions: [StarterKit, TableKit.configure({ table: { resizable: true, renderWrapper: true } }), TextAlign.configure({ types: ['heading', 'paragraph'] }), TextStyleKit, Highlight.configure({ multicolor: true }), TaskList, TaskItem.configure({ nested: true })],
    content: JSON.parse(page.content_json), immediatelyRender: false, editable: !page.archived && !readOnly,
    onUpdate: () => setDirty(true),
  }, [page.id]);
  const editorState = useEditorState({ editor, selector: ({ editor: current }) => ({ text: current?.getText() || '', from: current?.state.selection.from, to: current?.state.selection.to, style: current?.getAttributes('textStyle') || {}, highlight: current?.getAttributes('highlight') || {}, heading: current?.getAttributes('heading').level, alignment: ['left', 'center', 'right', 'justify'].map((value) => !!current?.isActive({ textAlign: value })), merge: !!current?.can().mergeCells(), split: !!current?.can().splitCell(), active: ['bold', 'italic', 'underline', 'strike', 'heading', 'bulletList', 'orderedList', 'taskList', 'table', 'codeBlock', 'blockquote', 'link'].map((name) => !!current?.isActive(name)) }) });
  const documentText = editorState?.text || editor?.getText() || '';
  useEffect(() => { editor?.setEditable(!page.archived && !readOnly && !reading, false); }, [editor, page.archived, readOnly, reading]);

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
    if (!editor || !title.trim() || readOnly) return;
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

  const tool = (label: string, active: boolean, run: () => void, icon: React.ReactNode, disabled = false) =>
    <button key={label} type="button" className={`notebook-tool ${active ? 'is-active' : ''}`} title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={run}>{icon}</button>;

  return <article className="notebook-page-editor">
    <div className="notebook-page-header">
      <div className="notebook-title-fields"><input className="notebook-page-title" aria-label="Page title" value={title} disabled={!!page.archived || readOnly || reading} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} />
        <input className="notebook-section-input" aria-label="Section" placeholder="Section (optional)" value={section} disabled={!!page.archived || readOnly || reading} onChange={(event) => { setSection(event.target.value); setDirty(true); }} /></div>
      <div className="notebook-page-actions"><span role="status" className="notebook-save-state">{saving ? 'Saving' : dirty ? 'Unsaved' : copied ? 'Link copied' : 'Saved'}</span>
        <button className="btn-capture" type="button" disabled={!dirty || saving || !!page.archived || readOnly} onClick={save}><Save size={15} /> Save</button>
        {!readOnly && !page.archived && <button className="btn-secondary" type="button" title={reading ? 'Edit page' : 'Read page'} aria-label={reading ? 'Edit page' : 'Read page'} onClick={() => setReading(!reading)}>{reading ? <PencilLine size={16} /> : <Eye size={16} />}</button>}
        <button className="btn-secondary" type="button" aria-label="Copy page link" title="Copy page link" onClick={copyPageLink}><Copy size={16} /></button>
        <a className="btn-secondary" aria-label="Export page as DOCX" title="Export page as DOCX" href={`/api/notebooks/${notebook.id}/export?page_id=${page.id}`}><Download size={16} /></a>
        <button className="btn-secondary" type="button" aria-label="Print or save as PDF" title="Print or save as PDF" onClick={() => window.print()}><Printer size={16} /></button>
      </div>
    </div>
    {error && <p role="alert" className="work-error">{error}</p>}
    {editor && <>
      {!page.archived && !readOnly && !reading &&
      <div className="notebook-toolbar" role="toolbar" aria-label="Document formatting">
        <select className="notebook-style-select" aria-label="Text style" value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'paragraph'} onChange={(event) => { const style = event.target.value; if (style === 'paragraph') editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: Number(style.slice(1)) as 1 | 2 | 3 }).run(); }}>
          <option value="paragraph">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
        </select>
        <select className="notebook-style-select" aria-label="Font family" value={editorState?.style.fontFamily || ''} onChange={(event) => event.target.value ? editor.chain().focus().setFontFamily(event.target.value).run() : editor.chain().focus().unsetFontFamily().run()}><option value="">Default font</option><option value="IBM Plex Sans">IBM Plex Sans</option><option value="IBM Plex Serif">IBM Plex Serif</option><option value="monospace">Monospace</option>{editorState?.style.fontFamily && !['IBM Plex Sans', 'IBM Plex Serif', 'monospace'].includes(editorState.style.fontFamily) && <option value={editorState.style.fontFamily}>{editorState.style.fontFamily}</option>}</select>
        <select className="notebook-style-select notebook-size-select" aria-label="Font size" value={editorState?.style.fontSize || ''} onChange={(event) => event.target.value ? editor.chain().focus().setFontSize(event.target.value).run() : editor.chain().focus().unsetFontSize().run()}><option value="">Size</option>{[10, 12, 14, 16, 18, 20, 24, 28, 32, 48, 72].map((size) => <option key={size} value={`${size}px`}>{size} px</option>)}</select>
        <label className="notebook-color" title="Text colour"><Palette size={15} /><input type="color" aria-label="Text colour" value={/^#[a-f0-9]{6}$/i.test(editorState?.style.color || '') ? editorState!.style.color : '#19342b'} onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} /></label>
        <label className="notebook-color" title="Highlight colour"><Highlighter size={15} /><input type="color" aria-label="Highlight colour" value={/^#[a-f0-9]{6}$/i.test(editorState?.highlight.color || '') ? editorState!.highlight.color : '#fff59d'} onChange={(event) => editor.chain().focus().setHighlight({ color: event.target.value }).run()} /></label>
        {tool('Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={16} />)}
        {tool('Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />)}
        {tool('Underline', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <Underline size={16} />)}
        {tool('Strikethrough', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), <Strikethrough size={16} />)}
        {tool('Bullet list', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List size={16} />)}
        {tool('Numbered list', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={16} />)}
        {tool('Checklist', editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), <ListTodo size={16} />)}
        {tool('Indent list item', false, () => editor.chain().focus().sinkListItem(editor.isActive('taskItem') ? 'taskItem' : 'listItem').run(), <IndentIncrease size={16} />)}
        {tool('Outdent list item', false, () => editor.chain().focus().liftListItem(editor.isActive('taskItem') ? 'taskItem' : 'listItem').run(), <IndentDecrease size={16} />)}
        {tool('Quote', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), <Quote size={16} />)}
        {tool('Code block', editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), <Code2 size={16} />)}
        {tool('Horizontal rule', false, () => editor.chain().focus().setHorizontalRule().run(), <Minus size={16} />)}
        {['left', 'center', 'right', 'justify'].map((alignment, index) => tool(`Align ${alignment}`, editor.isActive({ textAlign: alignment }), () => editor.chain().focus().setTextAlign(alignment).run(), [<AlignLeft size={16} key="left" />, <AlignCenter size={16} key="center" />, <AlignRight size={16} key="right" />, <AlignJustify size={16} key="justify" />][index]))}
        <select className="notebook-style-select notebook-size-select" aria-label="Line spacing" value={editorState?.style.lineHeight || ''} onChange={(event) => event.target.value ? editor.chain().focus().setLineHeight(event.target.value).run() : editor.chain().focus().unsetLineHeight().run()}><option value="">Spacing</option>{['1', '1.25', '1.5', '2'].map((spacing) => <option key={spacing}>{spacing}</option>)}</select>
        <details className="notebook-table-menu"><summary title="Insert table" aria-label="Insert table"><Table2 size={16} /></summary><div><label>Rows<input type="number" className="form-input" min="1" max="20" value={tableRows} onChange={(event) => setTableRows(Number(event.target.value))} /></label><label>Columns<input type="number" className="form-input" min="1" max="12" value={tableColumns} onChange={(event) => setTableColumns(Number(event.target.value))} /></label><button className="btn-secondary" type="button" disabled={!Number.isInteger(tableRows) || tableRows < 1 || tableRows > 20 || !Number.isInteger(tableColumns) || tableColumns < 1 || tableColumns > 12} onClick={() => editor.chain().focus().insertTable({ rows: tableRows, cols: tableColumns, withHeaderRow: true }).run()}>Insert</button></div></details>
        {editor.isActive('table') && <>{tool('Add row after', false, () => editor.chain().focus().addRowAfter().run(), <Rows3 size={16} />)}{tool('Delete row', false, () => editor.chain().focus().deleteRow().run(), <Minus size={16} />)}{tool('Add column after', false, () => editor.chain().focus().addColumnAfter().run(), <Columns3 size={16} />)}{tool('Delete column', false, () => editor.chain().focus().deleteColumn().run(), <Minus size={16} />)}{tool('Toggle header row', false, () => editor.chain().focus().toggleHeaderRow().run(), <Table2 size={16} />)}{tool('Merge cells', false, () => editor.chain().focus().mergeCells().run(), <Maximize2 size={16} />, !editor.can().mergeCells())}{tool('Split cell', false, () => editor.chain().focus().splitCell().run(), <Minimize2 size={16} />, !editor.can().splitCell())}{tool('Delete table', false, () => editor.chain().focus().deleteTable().run(), <Trash2 size={16} />)}</>}
        {tool('Add or edit link', editor.isActive('link'), () => { const current = editor.getAttributes('link').href || ''; const url = window.prompt('Link URL (clear to remove)', current); if (url === null) return; if (!url.trim()) editor.chain().focus().unsetLink().run(); else if (/^https?:\/\//i.test(url)) editor.chain().focus().setLink({ href: url.trim() }).run(); else setError('Use an http or https URL.'); }, <Link2 size={16} />)}
        {tool('Undo', false, () => editor.chain().focus().undo().run(), <Undo2 size={16} />)}
        {tool('Redo', false, () => editor.chain().focus().redo().run(), <Redo2 size={16} />)}
        {tool('Clear formatting', false, () => editor.chain().focus().unsetAllMarks().clearNodes().run(), <RemoveFormatting size={16} />)}
      </div>}
      <EditorContent editor={editor} className="notebook-editor-content" />
      <div className="notebook-document-status"><span>{documentText.trim() ? documentText.trim().split(/\s+/).length : 0} words</span><span>{documentText.length} characters</span><span>{readOnly || page.archived ? 'Read only' : reading ? 'Reading' : 'Editing'}</span></div>
    </>}
    <div className="notebook-history"><History size={16} aria-hidden="true" /><select aria-label="Saved revisions" value={selectedRevision} onChange={(event) => setSelectedRevision(event.target.value)}><option value="">Saved revisions</option>{revisions.map((revision) => <option key={revision.id} value={revision.id}>{revision.title} · {new Date(revision.saved_at).toLocaleString()}</option>)}</select><button className="btn-secondary" type="button" disabled={!selectedRevision || dirty || readOnly || !!page.archived} onClick={restore}>Restore</button></div>
  </article>;
}

export default function NotebookView() {
  const [booksCollapsed, setBooksCollapsed] = usePanelCollapsed('notebook-books');
  const [pagesCollapsed, setPagesCollapsed] = usePanelCollapsed('notebook-pages');
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
  const [role, setRole] = useState('viewer');

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
    fetch('/api/me').then((response) => response.json()).then((account) => setRole(account.role || 'viewer')).catch(() => setError('Could not verify account access'));
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

  return <div className={`notebook-shell ${booksCollapsed ? 'books-collapsed' : ''} ${pagesCollapsed ? 'pages-collapsed' : ''}`}>
    <aside className="notebook-rail"><div className="notebook-rail-heading"><h1 hidden={booksCollapsed}>Notebooks</h1><button className="notebook-tool" title={booksCollapsed ? 'Show notebooks' : 'Hide notebooks'} aria-label={booksCollapsed ? 'Show notebooks' : 'Hide notebooks'} aria-expanded={!booksCollapsed} onClick={() => setBooksCollapsed(!booksCollapsed)}>{booksCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>{!booksCollapsed && role !== 'viewer' && <button className="notebook-tool" title="New notebook" aria-label="New notebook" onClick={() => setCreatingNotebook(true)}><Plus size={18} /></button>}</div>
      <div hidden={booksCollapsed}>
      {creatingNotebook && <form onSubmit={createNotebook} className="notebook-inline-form"><input className="form-input" aria-label="Notebook name" placeholder="Notebook name" required value={newName} onChange={(event) => setNewName(event.target.value)} /><button type="submit" className="btn-capture">Create</button></form>}
      <label className="directory-filter"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show archived</label>
      <div className="notebook-list">{notebooks.filter((item) => showArchived || !item.archived).map((item) => <button key={item.id} className={`notebook-list-row ${notebook?.id === item.id ? 'active' : ''}`} onClick={() => openNotebook(item.id)}><strong>{item.name}{item.archived ? ' · Archived' : ''}</strong><small>{item.page_count || 0} {item.page_count === 1 ? 'page' : 'pages'}</small></button>)}</div>
      </div>
    </aside>
    <aside className="notebook-rail notebook-pages-rail"><div className="notebook-rail-heading"><h2 hidden={pagesCollapsed}>{notebook?.name || 'Pages'}</h2><button className="notebook-tool" title={pagesCollapsed ? 'Show pages' : 'Hide pages'} aria-label={pagesCollapsed ? 'Show pages' : 'Hide pages'} aria-expanded={!pagesCollapsed} onClick={() => setPagesCollapsed(!pagesCollapsed)}>{pagesCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>{!pagesCollapsed && role !== 'viewer' && notebook && !notebook.archived && <button className="notebook-tool" title="New page" aria-label="New page" onClick={() => setCreatingPage(true)}><Plus size={18} /></button>}</div>
      <div hidden={pagesCollapsed}>
      {notebook && <><div className="notebook-rail-actions"><a href={`/api/notebooks/${notebook.id}/export`} className="notebook-tool" title="Export notebook as DOCX" aria-label="Export notebook as DOCX"><Download size={16} /></a>{role !== 'viewer' && <button className="notebook-tool" title={notebook.archived ? 'Restore notebook' : 'Archive notebook'} aria-label={notebook.archived ? 'Restore notebook' : 'Archive notebook'} onClick={() => toggleArchive('notebook')}><Archive size={16} /></button>}</div>
      <select className="form-select" aria-label="Notebook visibility" disabled={role === 'viewer'} value={notebook.visibility || 'shared'} onChange={async (event) => { const response = await fetch(`/api/notebooks/${notebook.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: event.target.value }) }); const data = await response.json(); if (response.ok) { setNotebook(data.notebook); loadNotebooks(); } else setError(data.error || 'Could not change visibility'); }}><option value="private">Private</option><option value="shared">Shared</option></select>
      {role !== 'viewer' && <button className="notebook-tool" title="Rename notebook" aria-label="Rename notebook" onClick={() => { setRenamedName(notebook.name); setRenamingNotebook(true); }}><Pencil size={16} /></button>}
      {renamingNotebook && <form onSubmit={renameNotebook} className="notebook-inline-form"><input className="form-input" aria-label="New notebook name" required value={renamedName} onChange={(event) => setRenamedName(event.target.value)} /><button className="btn-capture" type="submit">Save</button></form>}
        {creatingPage && <form onSubmit={createPage} className="notebook-inline-form"><input className="form-input" aria-label="New page title" placeholder="Page title" required value={newPageTitle} onChange={(event) => setNewPageTitle(event.target.value)} /><button className="btn-capture" type="submit">Add</button></form>}
        <div className="notebook-list">{pages.filter((item) => showArchived || !item.archived).map((item) => <button key={item.id} className={`notebook-list-row ${page?.id === item.id ? 'active' : ''}`} onClick={() => openPage(notebook.id, item.id)}><strong>{item.title}{item.archived ? ' · Archived' : ''}</strong><small>{item.section || item.preview || 'No section'}</small></button>)}</div>
      </>}
      </div>
    </aside>
    <main className="notebook-workspace"><div className="notebook-search"><Search size={16} /><input aria-label="Search notebook pages" placeholder="Search pages and content" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {search.trim() && <div className="notebook-search-results">{matches.map((match) => <button key={match.id} onClick={() => { openPage(match.notebook_id, match.id); setSearch(''); }}><strong>{match.title}</strong><small>{match.notebook_name} · {match.preview}</small></button>)}{!matches.length && <p className="work-muted">No matching pages.</p>}</div>}
      {error && <p role="alert" className="work-error">{error}</p>}
      {page && notebook ? <><div className="notebook-page-meta"><span>{notebook.name}</span><div className="form-actions"><button type="button" className="notebook-tool" title={booksCollapsed && pagesCollapsed ? 'Show hierarchy' : 'Focus editor'} aria-label={booksCollapsed && pagesCollapsed ? 'Show hierarchy' : 'Focus editor'} onClick={() => { const hide = !(booksCollapsed && pagesCollapsed); setBooksCollapsed(hide); setPagesCollapsed(hide); }}>{booksCollapsed && pagesCollapsed ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>{role !== 'viewer' && <button type="button" className="notebook-tool" title={page.archived ? 'Restore page' : 'Archive page'} aria-label={page.archived ? 'Restore page' : 'Archive page'} onClick={() => toggleArchive('page')}><Archive size={16} /></button>}</div></div><NotebookEditor key={page.id + page.updated_at} notebook={notebook} page={page} revisions={revisions} onSaved={onSaved} onDirtyChange={setPageDirty} readOnly={role === 'viewer'} /></> : <div className="notebook-empty"><h2>{notebook ? 'Select a page' : 'Select a notebook'}</h2></div>}
    </main>
  </div>;
}