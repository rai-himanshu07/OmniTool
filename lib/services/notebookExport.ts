import type { JSONContent } from '@tiptap/core';
import { AlignmentType, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, type ParagraphChild } from 'docx';

type ExportPage = { title: string; section?: string | null; content_json: string };

function inlineRuns(node: JSONContent): ParagraphChild[] {
  if (node.type === 'hardBreak') return [new TextRun({ text: '', break: 1 })];
  if (node.type === 'text') {
    const marks = node.marks || [];
    const run = new TextRun({ text: node.text || '', bold: marks.some((mark) => mark.type === 'bold'),
      italics: marks.some((mark) => mark.type === 'italic'), strike: marks.some((mark) => mark.type === 'strike'),
      underline: marks.some((mark) => mark.type === 'underline') ? {} : undefined });
    const href = marks.find((mark) => mark.type === 'link')?.attrs?.href;
    return typeof href === 'string' && /^https?:\/\//i.test(href) ? [new ExternalHyperlink({ children: [run], link: href })] : [run];
  }
  return (node.content || []).flatMap(inlineRuns);
}

function blocks(nodes: JSONContent[], depth = 0, ordered = false): (Paragraph | Table)[] {
  const output: (Paragraph | Table)[] = [];
  nodes.forEach((node, index) => {
    if (node.type === 'table') {
      const rows = (node.content || []).filter((row) => row.type === 'tableRow').map((row) => new TableRow({
        children: (row.content || []).map((cell) => {
          const children = blocks(cell.content || []);
          return new TableCell({ children: children.length ? children : [new Paragraph('')],
            ...(cell.type === 'tableHeader' ? { shading: { fill: 'E7EEE9' } } : {}) });
        }),
      }));
      if (rows.length) output.push(new Table({ rows }));
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      output.push(...blocks(node.content || [], depth + 1, node.type === 'orderedList'));
    } else if (node.type === 'listItem') {
      const [first, ...rest] = node.content || [];
      output.push(new Paragraph({ children: [new TextRun({ text: ordered ? `${index + 1}. ` : '• ' }), ...inlineRuns(first || { type: 'paragraph' })], indent: { left: depth * 320 } }));
      output.push(...blocks(rest, depth + 1));
    } else if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'blockquote') {
      const level = Number(node.attrs?.level);
      const textAlign = node.attrs?.textAlign;
      output.push(new Paragraph({ children: inlineRuns(node),
        ...(node.type === 'heading' ? { heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 } : {}),
        ...(textAlign === 'center' ? { alignment: AlignmentType.CENTER } : textAlign === 'right' ? { alignment: AlignmentType.RIGHT } : {}),
        ...(node.type === 'blockquote' ? { indent: { left: 480 } } : {}) }));
    } else if (node.content?.length) output.push(...blocks(node.content, depth));
  });
  return output;
}

export async function exportNotebookDocx(name: string, pages: ExportPage[]): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [new Paragraph({ text: name, heading: HeadingLevel.TITLE })];
  let lastSection = '';
  for (const page of pages) {
    if (page.section && page.section !== lastSection) children.push(new Paragraph({ text: page.section, heading: HeadingLevel.HEADING_1 }));
    lastSection = page.section || '';
    children.push(new Paragraph({ text: page.title, heading: HeadingLevel.HEADING_2 }));
    const document = JSON.parse(page.content_json) as JSONContent;
    children.push(...blocks(document.content || []));
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}