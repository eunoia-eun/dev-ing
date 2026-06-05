/** 화면 표기용 포맷 헬퍼 */

/** '2026-06-02' → '2026.06.02' */
export function formatDate(iso?: string): string {
  if (!iso) return '-';
  return iso.slice(0, 10).replace(/-/g, '.');
}

/** ISO 일시 → '2026.06.02 18:30' (로컬) */
export function formatDateTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

/** 남은 일수를 사람이 읽기 좋게 */
export function describeDaysUntil(days: number): string {
  if (days < 0) return `${Math.abs(days)}일 초과`;
  if (days === 0) return '오늘';
  return `${days}일 남음`;
}

/** 오늘 'YYYY-MM-DD' (로컬) */
export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** n일 전 'YYYY-MM-DD' (로컬) */
export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => x.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
