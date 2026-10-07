import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { inspectZip } from './boundedFiles';
import { AccessError } from './workspaceAccess';

export type TrackerSheet = { name: string; headers: string[]; rows: string[][] };
export type TrackerMapping = { key: number; title: number; due: number; waiting: number };
export async function parseTracker(file: File): Promise<TrackerSheet[]> {
  if (!/\.(xlsx|csv)$/i.test(file.name) || file.size > 10 * 1024 * 1024 || !file.size) throw new AccessError('Use an XLSX or CSV file under 10 MB');
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  if (/\.xlsx$/i.test(file.name)) {
    const entries = await inspectZip(buffer);
    if ([...entries.keys()].some((name) => /vbaProject\.bin/i.test(name))) throw new AccessError('Macro-enabled workbooks are not supported');
    await workbook.xlsx.load(buffer as any);
  } else await workbook.csv.read(Readable.from([buffer]), { map: (value: string) => value, parserOptions: { maxRows: 10002, ignoreEmpty: true } });
  if (workbook.worksheets.length > 20) throw new AccessError('Maximum 20 sheets');
  let cells = 0;
  const sheets = workbook.worksheets.filter((sheet) => sheet.actualRowCount > 0).map((sheet) => {
    if (sheet.rowCount > 10001 || sheet.columnCount > 100) throw new AccessError('Maximum 10000 data rows and 100 columns per sheet');
    cells += sheet.rowCount * sheet.columnCount;
    if (cells > 200000) throw new AccessError('Maximum 200000 cells per workbook');
    const rows: string[][] = [];
    for (let row = 1; row <= sheet.rowCount; row++) {
      rows.push(Array.from({ length: sheet.columnCount }, (_, index) => {
        const cell = sheet.getCell(row, index + 1);
        const value = cell.type === ExcelJS.ValueType.Date ? (cell.value as Date).toISOString().slice(0, 10) : cell.text;
        if (value.length > 10000) throw new AccessError('A cell exceeds the text limit');
        return value;
      }));
    }
    return { name: sheet.name, headers: rows.shift()!.map((value, index) => value || `Column ${index + 1}`), rows };
  });
  if (!sheets.length) throw new AccessError('Workbook has no data');
  if (JSON.stringify(sheets).length > 20 * 1024 * 1024) throw new AccessError('Parsed workbook exceeds storage limit');
  return sheets;
}

export function validateMapping(sheet: TrackerSheet, mapping: TrackerMapping) {
  if (!mapping || !Number.isInteger(mapping.key) || !Number.isInteger(mapping.title) || mapping.key < 0 || mapping.title < 0 || mapping.key >= sheet.headers.length || mapping.title >= sheet.headers.length) throw new AccessError('Select a stable ID column and title column');
  for (const value of [mapping.due, mapping.waiting]) if (!Number.isInteger(value) || value < -1 || value >= sheet.headers.length) throw new AccessError('Invalid column mapping');
  const keys = new Set<string>();
  for (const row of sheet.rows) { const key = row[mapping.key].trim(); if (!key) continue; if (keys.has(key)) throw new AccessError('The stable ID column contains duplicate values'); keys.add(key); }
}