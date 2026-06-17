/**
 * 작업환경측정 결과 보고서(Excel) 파싱 유틸리티.
 * xlsx(SheetJS)를 dynamic import로 지연 로드 — 일반 페이지 번들에는 포함되지 않음.
 */

export interface ParsedMeasRow {
  measureDate: string;
  department: string;
  substanceName: string;
  unit: string;
  limitTwa: string;
  limitStel: string;
  twa: string;
  stel: string;
  note: string;
}

export interface ParseExcelResult {
  rows: ParsedMeasRow[];
  headers: string[];      // 감지된 컬럼명 원문
  mapping: ColMapping;    // 어떤 컬럼이 어떤 필드로 매핑됐는지
  warnings: string[];
}

export interface ColMapping {
  measureDate?: number;
  department?: number;
  substanceName?: number;
  unit?: number;
  limitTwa?: number;
  limitStel?: number;
  twa?: number;
  stel?: number;
  note?: number;
}

// 컬럼명 감지 키워드 (소문자, 공백 제거 후 포함 여부 체크)
const KEYWORDS: Record<keyof ColMapping, string[]> = {
  measureDate:  ['측정일', '측정일자', '일자'],
  department:   ['부서명', '부서', '공정명', '공정', '작업공정'],
  substanceName:['유해인자', '측정대상', '물질명', '화학물질'],
  unit:         ['단위'],
  // limitTwa / limitStel 를 먼저 체크 (twa/stel 보다 구체적)
  limitTwa:     ['twa기준', '기준twa', 'twa노출기준', '노출기준(twa)', 'twa허용', '허용기준(twa)'],
  limitStel:    ['stel기준', '기준stel', 'stel노출기준', '노출기준(stel)', 'stel허용', '허용기준(stel)'],
  twa:          ['twa측정', '측정twa', 'twa실측', '실측(twa)', 'twa값', 'twa'],
  stel:         ['stel측정', '측정stel', 'stel실측', '실측(stel)', 'stel값', 'stel'],
  note:         ['비고', '메모', '특이사항'],
};

function norm(s: string) {
  return String(s ?? '').toLowerCase().replace(/[\s\(\)\[\]]/g, '');
}

function detectMapping(headers: string[]): ColMapping {
  const mapping: ColMapping = {};
  const assigned = new Set<number>();

  // limitTwa/limitStel 먼저 (twa/stel보다 구체적이라 우선 배정)
  const priority: (keyof ColMapping)[] = [
    'measureDate', 'department', 'substanceName', 'unit',
    'limitTwa', 'limitStel', 'twa', 'stel', 'note',
  ];

  for (const field of priority) {
    const kws = KEYWORDS[field];
    for (let i = 0; i < headers.length; i++) {
      if (assigned.has(i)) continue;
      const h = norm(headers[i]);
      if (kws.some((k) => h.includes(norm(k)))) {
        mapping[field] = i;
        assigned.add(i);
        break;
      }
    }
  }
  return mapping;
}

/** 헤더 행 추정: 매핑 키워드가 가장 많이 일치하는 행 인덱스 */
function findHeaderRow(rows: unknown[][]): number {
  let best = 0;
  let bestScore = 0;
  const allKws = Object.values(KEYWORDS).flat().map(norm);

  rows.slice(0, 20).forEach((row, i) => {
    const score = row.filter((cell) =>
      allKws.some((k) => norm(String(cell ?? '')).includes(k))
    ).length;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

function cellStr(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return '';
  return String(row[idx] ?? '').trim();
}

function isMeaningfulRow(row: unknown[], mapping: ColMapping): boolean {
  // department 또는 substanceName 중 하나라도 있으면 의미 있는 행
  const dept = cellStr(row, mapping.department);
  const sub  = cellStr(row, mapping.substanceName);
  return dept.length > 0 || sub.length > 0;
}

/** Excel/XLSX 파일을 파싱해 측정결과 행 배열 반환 */
export async function parseWorkplaceMeasurementExcel(file: File): Promise<ParseExcelResult> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellText: true, cellDates: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][];

  const headerIdx = findHeaderRow(rawRows);
  const headers = rawRows[headerIdx].map((c) => String(c ?? ''));
  const mapping = detectMapping(headers);
  const warnings: string[] = [];

  if (!mapping.substanceName && !mapping.department) {
    warnings.push('유해인자명 또는 부서 컬럼을 찾지 못했어요. 컬럼명을 확인해 주세요.');
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows: ParsedMeasRow[] = rawRows
    .slice(headerIdx + 1)
    .filter((r) => isMeaningfulRow(r, mapping))
    .map((r) => {
      // 날짜 셀은 XLSX가 Date 객체로 변환할 수 있음
      let measureDate = cellStr(r, mapping.measureDate);
      if (!measureDate || measureDate === '0') measureDate = today;
      // YYYY-MM-DD 형식 정규화
      if (/^\d{4}[\.\-\/]\d{1,2}[\.\-\/]\d{1,2}/.test(measureDate)) {
        measureDate = measureDate.replace(/[\.\/]/g, '-').slice(0, 10);
      }

      return {
        measureDate,
        department:    cellStr(r, mapping.department),
        substanceName: cellStr(r, mapping.substanceName),
        unit:          cellStr(r, mapping.unit),
        limitTwa:      cellStr(r, mapping.limitTwa),
        limitStel:     cellStr(r, mapping.limitStel),
        twa:           cellStr(r, mapping.twa),
        stel:          cellStr(r, mapping.stel),
        note:          cellStr(r, mapping.note),
      };
    })
    .filter((r) => r.substanceName || r.department); // 빈 행 제거

  if (rows.length === 0) {
    warnings.push('측정 데이터 행을 찾지 못했어요.');
  }

  return { rows, headers, mapping, warnings };
}

/** CSV 서식 문자열 (BOM 포함, Excel에서 열리도록) */
export function buildCsvTemplate(): string {
  const BOM = '﻿';
  const header = '측정일,부서(공정),유해인자명,단위,TWA기준,STEL기준,TWA측정값,STEL측정값,비고';
  const example = '2026-06-17,생산부,톨루엔,ppm,50 ppm,150 ppm,12,45,';
  return BOM + header + '\n' + example + '\n';
}
