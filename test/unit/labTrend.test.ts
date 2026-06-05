import { describe, expect, it } from 'vitest';
import { buildLabTrend, defaultLabRange } from '@domain/checkup/labTrend';
import { aCheckup } from '@test/harness/builders';

const checkups = [
  aCheckup({
    id: 'c1',
    examDate: '2024-05-01',
    labResults: [
      { code: 'glucose', name: '공복혈당', value: '95', unit: 'mg/dL' },
      { code: 'ast', name: 'AST(SGOT)', value: '24', unit: 'IU/L' },
    ],
  }),
  aCheckup({
    id: 'c2',
    examDate: '2025-05-01',
    labResults: [{ code: 'glucose', name: '공복혈당', value: '110', unit: 'mg/dL' }],
  }),
  aCheckup({
    id: 'c0',
    examDate: '2019-05-01', // 범위 밖
    labResults: [{ code: 'glucose', name: '공복혈당', value: '90', unit: 'mg/dL' }],
  }),
];

const range = { start: '2023-01-01', end: '2025-12-31' };

describe('buildLabTrend', () => {
  it('범위 내 검진만 시간순(오래된→최신) 열로 만든다', () => {
    const t = buildLabTrend(checkups, range);
    expect(t.columns.map((c) => c.checkupId)).toEqual(['c1', 'c2']);
  });

  it('검사항목을 행으로, 값을 열 순서대로 채운다(없으면 null)', () => {
    const t = buildLabTrend(checkups, range);
    expect(t.rows.find((r) => r.code === 'glucose')!.cells.map((c) => c.value)).toEqual(['95', '110']);
    expect(t.rows.find((r) => r.code === 'ast')!.cells.map((c) => c.value)).toEqual(['24', null]);
  });

  it('정상범위를 벗어나면 abnormal로 표시한다(공복혈당 110 > 100)', () => {
    const glucose = buildLabTrend(checkups, range).rows.find((r) => r.code === 'glucose')!;
    expect(glucose.cells[0].abnormal).toBe(false); // 95
    expect(glucose.cells[1].abnormal).toBe(true); // 110
  });

  it('defaultLabRange는 올해 포함 5개년', () => {
    expect(defaultLabRange(2026)).toEqual({ start: '2022-01-01', end: '2026-12-31' });
  });

  it('전달된 검사항목 목록의 정상범위로 이상치를 판정한다(커스텀 항목)', () => {
    const cks = [
      aCheckup({
        id: 'c1',
        examDate: '2025-01-01',
        labResults: [{ code: 'custom_x', name: 'X검사', value: '50' }],
      }),
    ];
    const items = [{ code: 'custom_x', name: 'X검사', group: '기타', refHigh: 40 }];
    const t = buildLabTrend(cks, range, items);
    expect(t.rows[0].name).toBe('X검사');
    expect(t.rows[0].cells[0].abnormal).toBe(true); // 50 > 40
  });
});
