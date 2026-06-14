import type {
  HazardCategory,
  HazardHealthDetail,
  HazardSubstance,
  KoreanExposureLimit,
} from '@domain/hazard/HazardousSubstance';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { Card, EmptyState, ErrorAlert, Spinner } from './ui';

/** 건강장해 본문을 읽기 좋게 블록 단위로 재정렬 */
function reflowHealth(text: string): string {
  return text
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*(\(\d+\)\s)/g, '\n\n$1') // (1)급성 (2)만성 (3)발암성 …
    // 절 제목((N) 급성/만성 건강영향·발암성)과 본문을 줄로 분리 → 제목만 머리글, 본문은 일반 글씨
    .replace(/(\(\d+\)\s*(?:급성|만성)\s*건강영향)\s+/g, '$1\n')
    .replace(/(\(\d+\)\s*발암성)\s+/g, '$1\n')
    .replace(/\s*(\d+\)\s*[가-힣]{2,6}(?:계|기관|장기)?\s*[:：])/g, '\n· $1') // 장기별 항목
    .replace(/\s*([①②③④⑤⑥⑦⑧⑨⑩])/g, '\n   $1')
    .trim();
}

function ExposureLimitCard({ limit }: { limit: KoreanExposureLimit }) {
  const rows: Array<[string, string]> = [];
  if (limit.twa) rows.push(['노출기준 (TWA)', limit.twa]);
  if (limit.stel) rows.push(['단시간노출 (STEL)', limit.stel]);
  if (limit.skin) rows.push(['피부흡수', '해당']);
  if (limit.carcinogen) rows.push(['발암성', limit.carcinogen]);
  if (limit.mutagen) rows.push(['생식세포 변이원성', limit.mutagen]);
  if (limit.reproToxic) rows.push(['생식독성', limit.reproToxic]);
  if (rows.length === 0) return null;

  return (
    <Card title="노출기준 (고용노동부 고시, 2020.1.14.)">
      <dl className="kv">
        {rows.map(([label, val]) => (
          <div key={label} className="kv__row">
            <dt>{label}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      <div className="muted small" style={{ marginTop: 10 }}>
        TWA=8시간 시간가중평균 · STEL=15분 단시간노출 · C=최고노출기준(Ceiling). 발암성·변이원성·생식독성
        등급은 1A·1B·2 (숫자가 작을수록 근거가 강함). 단위(ppm/㎎㎥)는 고시 기준이며 일부 항목은 추정될 수
        있어 고시 확인을 권장합니다.
      </div>
    </Card>
  );
}

function HealthText({ text }: { text: string }) {
  const blocks = reflowHealth(text).split('\n\n').filter(Boolean);
  return (
    <div className="stack" style={{ gap: 14 }}>
      {blocks.map((block, i) => {
        const nl = block.indexOf('\n');
        const head = nl >= 0 ? block.slice(0, nl) : block;
        const body = nl >= 0 ? block.slice(nl + 1) : '';
        // (N) 으로 시작하는 '짧은 절 제목'만 머리글로. 본문이 통째로 붙은 긴 줄은 일반 본문 처리.
        const isHead = /^\(\d+\)/.test(head) && head.replace(/\s+/g, ' ').trim().length <= 30;
        return (
          <div key={i}>
            {isHead ? (
              <div className="health-head">{head}</div>
            ) : (
              <div className="health-body">{head}</div>
            )}
            {body && <div className="health-body">{body}</div>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 유해인자 1종의 카탈로그 상세(노출기준·표적장기·건강장해 등).
 * 보건관리자 카탈로그(`CatalogPage`)와 임직원 '내 유해인자' 화면이 동일한 정보를 공유한다.
 */
export function HazardSubstanceDetail({
  category,
  substance,
}: {
  category: HazardCategory;
  substance: HazardSubstance;
}) {
  const { hazard } = useServices();
  const detail = useAsync<HazardHealthDetail | null>(
    () => hazard.getHealthDetail({ categoryCode: category.code, substanceNo: substance.no }),
    [category.code, substance.no],
  );

  return (
    <div className="stack">
      <Card>
        <div className="row spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 22 }}>{substance.nameKo}</h2>
            <div className="muted">
              {substance.nameEn ?? ''} {substance.cas ? `· CAS ${substance.cas}` : ''}
            </div>
          </div>
          <span className="badge badge--info">
            [{category.group}] {category.name}
          </span>
        </div>
        <div className="alert alert--info" style={{ marginTop: 14, marginBottom: 0 }}>
          특수건강진단 주기(별표23 분류 기본값): 배치 후 최초{' '}
          <strong>{category.firstExamMonths}개월</strong>, 주기{' '}
          <strong>{category.cycleMonths}개월</strong>
        </div>
      </Card>

      {detail.loading ? (
        <Spinner label="유해인자 자료를 불러오는 중…" />
      ) : detail.error ? (
        <ErrorAlert message={detail.error} />
      ) : !detail.data ? (
        <Card title="유해인자별 건강장해">
          <EmptyState icon="📄">이 유해인자에 대한 상세 자료가 없습니다.</EmptyState>
        </Card>
      ) : (
        <>
          {detail.data.exposureLimitKr && <ExposureLimitCard limit={detail.data.exposureLimitKr} />}

          {detail.data.targetOrgans.length > 0 && (
            <Card title="표적장기">
              <div className="row row--wrap" style={{ gap: 6 }}>
                {detail.data.targetOrgans.map((o) => (
                  <span key={o} className="badge badge--info">
                    {o}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {detail.data.synonyms && (
            <Card title="동의어">
              <div className="health-body">{detail.data.synonyms}</div>
            </Card>
          )}

          {detail.data.physicalChemical && (
            <Card title="물리·화학적 성질">
              <div className="health-body">{detail.data.physicalChemical}</div>
            </Card>
          )}

          {detail.data.absorption && (
            <Card title="흡수 · 대사 · 배설">
              <div className="health-body">{detail.data.absorption}</div>
            </Card>
          )}

          {(detail.data.uses || detail.data.process) && (
            <Card title="발생원 · 용도 · 노출 공정">
              {detail.data.uses && (
                <p className="health-body mt-0">
                  <strong>용도</strong> — {detail.data.uses}
                </p>
              )}
              {detail.data.process && (
                <p className="health-body">
                  <strong>주로 노출되는 공정</strong> — {detail.data.process}
                </p>
              )}
            </Card>
          )}

          {detail.data.healthEffects && (
            <Card title="표적장기별 건강장해 (급성 · 만성 · 발암성)">
              <HealthText text={detail.data.healthEffects} />
            </Card>
          )}

          <div className="muted small">
            출처: 근로자건강진단 실무지침 제3권 「유해인자별 건강장해」 및 화학물질 노출기준(고용노동부,
            2020) — 산업안전보건연구원. 참고용 요약이며 임상 판단을 대체하지 않습니다.
          </div>
        </>
      )}
    </div>
  );
}
