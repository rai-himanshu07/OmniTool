import type { JSONContent } from '@tiptap/core';

export const EMPTY_DOCUMENT: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

export function parseNotebookContent(value: unknown): { json: string; text: string } | null {
  if (!value || typeof value !== 'object' || (value as JSONContent).type !== 'doc') return null;
  const json = JSON.stringify(value);
  if (json.length > 1_000_000) return null;
  let count = 0;
  const lines: string[] = [];
  const walk = (node: JSONContent, depth: number): boolean => {
    if (depth > 32 || ++count > 10_000 || typeof node.type !== 'string') return false;
    if (node.text !== undefined) {
      if (typeof node.text !== 'string') return false;
      lines.push(node.text);
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) return false;
      for (const child of node.content) if (!walk(child, depth + 1)) return false;
      if (['paragraph', 'heading', 'listItem', 'tableRow'].includes(node.type)) lines.push('\n');
    }
    return true;
  };
  if (!walk(value as JSONContent, 0)) return null;
  return { json, text: lines.join('').trim() };
}