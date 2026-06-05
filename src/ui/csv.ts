/** CSV 다운로드 (엑셀 호환 — UTF-8 BOM 포함하여 한글 깨짐 방지) */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const content = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
