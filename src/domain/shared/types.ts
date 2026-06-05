/**
 * 도메인 전역에서 쓰는 공통 타입.
 * 도메인 계층은 어떤 외부 라이브러리에도 의존하지 않는다(순수 TypeScript).
 */

/** 'YYYY-MM-DD' 형식의 날짜 문자열 */
export type ISODate = string;

/** ISO 8601 일시 문자열 (예: '2026-06-02T09:30:00.000Z') */
export type ISODateTime = string;

/** 식별자 — 현재는 문자열(UUID 등). 저장소 교체와 무관하게 도메인은 문자열만 안다. */
export type Id = string;
