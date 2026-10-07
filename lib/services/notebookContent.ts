import type { JSONContent } from '@tiptap/core';
import { TinyColor } from '@ctrl/tinycolor';

export const EMPTY_DOCUMENT: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

export function parseNotebookContent(value: unknown): { json: string; text: string } | null {
  if (!value || typeof value !== 'object' || (value as JSONContent).type !== 'doc') return null;
  if (JSON.stringify(value).length > 1_000_000) return null;
  const document = structuredClone(value) as JSONContent;
  let count = 0;
  const lines: string[] = [];
  const walk = (node: JSONContent, depth: number): boolean => {
    if (depth > 32 || ++count > 10_000 || typeof node.type !== 'string') return false;
    if (node.attrs !== undefined && (!node.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs))) return false;
    if (node.attrs?.textAlign && !['left', 'center', 'right', 'justify'].includes(node.attrs.textAlign)) return false;
    if (node.type === 'taskItem' && node.attrs?.checked !== undefined && typeof node.attrs.checked !== 'boolean') return false;
    if (['tableCell', 'tableHeader'].includes(node.type) && node.attrs) {
      for (const key of ['colspan', 'rowspan']) if (node.attrs[key] !== undefined && (!Number.isInteger(node.attrs[key]) || node.attrs[key] < 1 || node.attrs[key] > 100)) return false;
      if (node.attrs.colwidth !== undefined && node.attrs.colwidth !== null && (!Array.isArray(node.attrs.colwidth) || node.attrs.colwidth.length > 100 || node.attrs.colwidth.some((width: unknown) => typeof width !== 'number' || !Number.isFinite(width) || width < 0 || width > 5000))) return false;
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks) || node.marks.length > 20) return false;
      for (const mark of node.marks) {
        if (!mark || typeof mark.type !== 'string') return false;
        if (mark.attrs !== undefined && (!mark.attrs || typeof mark.attrs !== 'object' || Array.isArray(mark.attrs))) return false;
        if (['textStyle', 'highlight'].includes(mark.type) && mark.attrs) {
          for (const key of ['color', 'backgroundColor']) if (mark.attrs[key]) {
            const value = mark.attrs[key];
            if (typeof value !== 'string' || value.length > 80 || /[;{}]|url\(|expression|var\(/i.test(value)) return false;
            const color = new TinyColor(value); if (!color.isValid) return false;
            mark.attrs[key] = color.toHexString();
          }
          if (mark.attrs.fontFamily && (typeof mark.attrs.fontFamily !== 'string' || !/^[a-zA-Z0-9\s,'"-]{1,120}$/.test(mark.attrs.fontFamily))) return false;
          if (mark.attrs.fontSize && (typeof mark.attrs.fontSize !== 'string' || !/^\d{1,2}(?:\.\d+)?(?:px|pt)$/.test(mark.attrs.fontSize) || parseFloat(mark.attrs.fontSize) < 8 || parseFloat(mark.attrs.fontSize) > 96)) return false;
          if (mark.attrs.lineHeight && (typeof mark.attrs.lineHeight !== 'string' || !/^(?:1(?:\.\d{1,2})?|2(?:\.\d{1,2})?|3)$/.test(mark.attrs.lineHeight))) return false;
        }
      }
    }
    if (node.text !== undefined) {
      if (typeof node.text !== 'string') return false;
      lines.push(node.text);
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) return false;
      for (const child of node.content) if (!walk(child, depth + 1)) return false;
      if (['paragraph', 'heading', 'listItem', 'taskItem', 'tableRow', 'codeBlock'].includes(node.type)) lines.push('\n');
    }
    return true;
  };
  if (!walk(document, 0)) return null;
  return { json: JSON.stringify(document), text: lines.join('').trim() };
}