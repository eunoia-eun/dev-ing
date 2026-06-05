import type { HazardCatalog } from '@domain/hazard/HazardousSubstance';
import type { HazardCatalogProvider } from '@application/ports/HazardRepository';
import raw from './hazardousSubstances.json';

/**
 * [별표 22] 유해인자 카탈로그(읽기 전용).
 * JSON은 PDF에서 파싱한 정적 데이터이므로 그대로 타입 단언한다.
 */
export const hazardCatalog = raw as unknown as HazardCatalog;

export class StaticHazardCatalogProvider implements HazardCatalogProvider {
  getCatalog(): HazardCatalog {
    return hazardCatalog;
  }
}
