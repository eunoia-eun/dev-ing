import type { HazardHealthDetail, SubstanceRef } from '@domain/hazard/HazardousSubstance';
import type { HazardHealthDetailProvider } from '@application/ports/HazardRepository';

type DetailMap = Record<string, HazardHealthDetail>;

/**
 * 유해인자별 건강장해 상세 공급자.
 *
 * 데이터(약 1MB)는 카탈로그 상세를 처음 열 때만 **동적 import** 로 불러온다.
 * → 초기 번들에 포함되지 않아 첫 로딩이 가벼움. (Vite가 별도 청크로 분리)
 */
export class StaticHazardHealthProvider implements HazardHealthDetailProvider {
  private cache: DetailMap | null = null;

  private async load(): Promise<DetailMap> {
    if (!this.cache) {
      const mod = await import('./hazardHealthDetails.json');
      this.cache = ((mod as { default?: DetailMap }).default ?? (mod as unknown)) as DetailMap;
    }
    return this.cache;
  }

  async getDetail(ref: SubstanceRef): Promise<HazardHealthDetail | null> {
    const data = await this.load();
    return data[`${ref.categoryCode}-${ref.substanceNo}`] ?? null;
  }
}
