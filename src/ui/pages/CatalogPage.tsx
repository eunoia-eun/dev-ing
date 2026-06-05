import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  HazardCategory,
  HazardCategoryCode,
  HazardHealthDetail,
  HazardSubstance,
  KoreanExposureLimit,
} from '@domain/hazard/HazardousSubstance';
import type { DepartmentHazardView } from '@domain/hazard/DepartmentHazard';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { Card, EmptyState, ErrorAlert, Modal, Spinner } from '../components/ui';

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

export function CatalogPage() {
  const { hazard, departments } = useServices();
  const catalog = useMemo(() => hazard.getCatalog(), [hazard]);
  const [categoryCode, setCategoryCode] = useState<HazardCategoryCode | null>(null);
  const [substanceNo, setSubstanceNo] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  // 사용(노출 등록)된 유해인자 키 — 분류 목록의 '사용' 뱃지용
  const usage = useAsync(() => hazard.getHazardUsage(), []);
  const usageItems = usage.data ?? [];
  const usedKeys = new Set(usageItems.map((u) => `${u.categoryCode}-${u.substanceNo}`));

  // 부서↔유해인자 직접 매핑(공정)
  const deptList = useAsync(() => departments.list(), []);
  const deptNames = (deptList.data ?? []).map((d) => d.name);
  const deptHaz = useAsync(() => hazard.getDepartmentHazards(), []);
  const deptHazItems = deptHaz.data ?? [];
  const [mapDept, setMapDept] = useState(''); // '' = 전체
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expandedMapping, setExpandedMapping] = useState<string | null>(null); // 적용현황 펼친 매핑 id
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set()); // 접힌 부서(기본 펼침)
  const toggleDept = (dept: string) =>
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  const mapDeptNames = [...new Set(deptHazItems.map((m) => m.department))].sort();
  const filteredDeptHaz = mapDept
    ? deptHazItems.filter((m) => m.department === mapDept)
    : deptHazItems;
  // 부서별로 묶기 (서비스가 부서·물질명순 정렬 → 삽입 순서 유지)
  const deptGroupMap = new Map<string, DepartmentHazardView[]>();
  for (const item of filteredDeptHaz) {
    const arr = deptGroupMap.get(item.department) ?? [];
    arr.push(item);
    deptGroupMap.set(item.department, arr);
  }
  const deptGroups = [...deptGroupMap.entries()];
  const allCollapsed = deptGroups.length > 0 && deptGroups.every(([d]) => collapsedDepts.has(d));

  async function applyOne(m: DepartmentHazardView) {
    if (m.employeeCount === 0) return;
    setBusy(true);
    try {
      const r = await hazard.applyDepartmentHazardToEmployees(m.id);
      window.alert(
        `${m.department} · ${m.substanceName}\n신규 등록 ${r.created}명 · 이미 있음 ${r.skipped}명 (대상 ${r.total}명)`,
      );
      deptHaz.reload();
      usage.reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function unlink(m: DepartmentHazardView) {
    if (!window.confirm(`${m.department}의 '${m.substanceName}' 매핑을 삭제할까요?\n(이미 등록된 임직원 노출 기록은 유지됩니다)`)) return;
    setBusy(true);
    try {
      await hazard.unlinkDepartmentHazard(m.id);
      deptHaz.reload();
    } finally {
      setBusy(false);
    }
  }

  const category = categoryCode
    ? catalog.categories.find((c) => c.code === categoryCode) ?? null
    : null;
  const substance =
    category && substanceNo != null
      ? category.substances.find((s) => s.no === substanceNo) ?? null
      : null;

  const results = useMemo(
    () => (search.trim() ? hazard.searchCatalog(search).slice(0, 50) : []),
    [search, hazard],
  );

  function openSubstance(code: HazardCategoryCode, no: number) {
    setCategoryCode(code);
    setSubstanceNo(no);
  }

  // 상세 보기
  if (category && substance) {
    return (
      <SubstanceDetail
        category={category}
        substance={substance}
        onBack={() => setSubstanceNo(null)}
        onHome={() => {
          setCategoryCode(null);
          setSubstanceNo(null);
        }}
      />
    );
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <input
          className="input grow"
          placeholder="전체 검색: 물질명·영문명·CAS (예: 벤젠, toluene, 71-43-2)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 부서별 유해인자 (직접 매핑 / 공정) — 검색/분류 진입 전 기본 화면에 표시 */}
      {search.trim() === '' && !category && (
        <Card
          title={
            <span className="row" style={{ gap: 8 }}>
              부서별 유해인자 (공정) · 노출 임직원
              <span className="badge badge--info">{deptHazItems.length}건</span>
            </span>
          }
          actions={
            <div className="row" style={{ gap: 6 }}>
              {deptGroups.length > 0 && (
                <button
                  className="btn btn--sm"
                  onClick={() =>
                    setCollapsedDepts(allCollapsed ? new Set() : new Set(deptGroups.map(([d]) => d)))
                  }
                >
                  {allCollapsed ? '모두 펼치기' : '모두 접기'}
                </button>
              )}
              <button
                className="btn btn--primary btn--sm"
                onClick={() => setAddOpen(true)}
                disabled={deptNames.length === 0}
              >
                ＋ 유해인자 추가
              </button>
            </div>
          }
          bodyClassName=""
        >
          <div className="toolbar">
            <button
              className={`chip-toggle${mapDept === '' ? ' active' : ''}`}
              onClick={() => setMapDept('')}
            >
              전체 부서
            </button>
            {mapDeptNames.map((d) => (
              <button
                key={d}
                className={`chip-toggle${mapDept === d ? ' active' : ''}`}
                onClick={() => setMapDept(d)}
              >
                {d}
              </button>
            ))}
          </div>
          {deptHaz.loading ? (
            <Spinner />
          ) : filteredDeptHaz.length === 0 ? (
            <EmptyState icon="🏭">
              묶인 부서 유해인자가 없습니다. ‘＋ 유해인자 추가’로 부서의 공정 유해인자를 등록하세요.
            </EmptyState>
          ) : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>유해인자</th>
                    <th>공정</th>
                    <th className="num">적용 현황</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {deptGroups.map(([dept, items]) => {
                    const deptOpen = !collapsedDepts.has(dept);
                    const empTotal = items[0]?.employeeCount ?? 0;
                    return (
                      <Fragment key={dept}>
                        <tr className="group-row">
                          <td colSpan={4}>
                            <span
                              onClick={() => toggleDept(dept)}
                              style={{ cursor: 'pointer', userSelect: 'none' }}
                              title={deptOpen ? '접기' : '펼치기'}
                            >
                              <span style={{ marginRight: 6, color: 'var(--text-muted)' }}>
                                {deptOpen ? '▾' : '▸'}
                              </span>
                              <strong>{dept}</strong>
                              <span className="muted small">
                                {' '}
                                · 유해인자 {items.length}건 · 소속 {empTotal}명
                              </span>
                            </span>
                          </td>
                        </tr>
                        {deptOpen &&
                          items.map((m) => {
                            const open = expandedMapping === m.id;
                            const full = m.employeeCount > 0 && m.appliedCount >= m.employeeCount;
                            return (
                              <Fragment key={m.id}>
                                <tr>
                                  <td style={{ paddingLeft: 20 }}>
                                    <button
                                      className="btn btn--ghost btn--sm"
                                      style={{ padding: 0 }}
                                      onClick={() => openSubstance(m.categoryCode, m.substanceNo)}
                                    >
                                      <strong>{m.substanceName}</strong>
                                    </button>
                                  </td>
                                  <td className="muted small">{m.process ?? '-'}</td>
                                  <td className="num">
                                    <span
                                      className={`badge ${full ? 'badge--ok' : 'badge--muted'}`}
                                      style={{ cursor: 'pointer', userSelect: 'none' }}
                                      title="노출 임직원 명단 보기"
                                      onClick={() => setExpandedMapping(open ? null : m.id)}
                                    >
                                      {m.appliedCount}/{m.employeeCount}명 {open ? '▾' : '▸'}
                                    </span>
                                  </td>
                                  <td className="num">
                                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                                      <button
                                        className="btn btn--sm"
                                        disabled={m.employeeCount === 0 || busy}
                                        title={m.employeeCount === 0 ? '해당 부서 임직원이 없습니다' : '이 부서 임직원에게 노출 일괄 등록'}
                                        onClick={() => applyOne(m)}
                                      >
                                        임직원 적용
                                      </button>
                                      <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => unlink(m)}>
                                        삭제
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {open && (
                                  <tr>
                                    <td colSpan={4} style={{ background: 'var(--surface)' }}>
                                      {m.appliedEmployees.length === 0 ? (
                                        <span className="muted small">
                                          진행 중 노출로 등록된 임직원이 없습니다. ‘임직원 적용’으로 등록하세요.
                                        </span>
                                      ) : (
                                        <div className="row row--wrap" style={{ gap: 6, alignItems: 'center' }}>
                                          <span className="muted small">
                                            노출 임직원 ({m.appliedEmployees.length}명):
                                          </span>
                                          {m.appliedEmployees.map((emp) => (
                                            <Link
                                              key={emp.id}
                                              to={`/employees/${emp.id}`}
                                              className="badge badge--info"
                                              style={{ textDecoration: 'none' }}
                                              title="건강명부(프로필)로 이동"
                                            >
                                              {emp.name} ›
                                            </Link>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="muted small" style={{ marginTop: 8 }}>
            ※ ‘적용 현황(n/n명)’을 누르면 해당 유해인자에 노출된 임직원 명단이 펼쳐지고, 이름을 누르면 건강명부로
            이동합니다. ‘임직원 적용’은 그 부서 임직원에게 노출을 일괄 등록(이미 등록된 사람은 건너뜀)합니다.
          </div>
        </Card>
      )}

      {/* 전체 검색 결과 */}
      {search.trim() !== '' ? (
        <Card title={`검색 결과 (${results.length})`} bodyClassName="">
          {results.length === 0 ? (
            <EmptyState icon="🔍">검색 결과가 없습니다.</EmptyState>
          ) : (
            <ul className="list-reset">
              {results.map(({ category: c, substance: s }) => (
                <li key={`${c.code}-${s.no}`}>
                  <button className="catalog-row" onClick={() => openSubstance(c.code, s.no)}>
                    <span>
                      <strong>{s.nameKo}</strong>
                      {s.nameEn && <span className="muted small"> · {s.nameEn}</span>}
                    </span>
                    <span className="muted small">
                      {c.name}
                      {s.cas ? ` · ${s.cas}` : ''} ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : category ? (
        /* 2단계: 분류 내 물질 목록 */
        <Card
          title={
            <span className="row" style={{ gap: 8 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setCategoryCode(null)}>
                ← 분류
              </button>
              <span>
                [{category.group}] {category.name}
              </span>
              <span className="badge badge--muted">{category.substances.length}종</span>
            </span>
          }
          bodyClassName=""
        >
          <ul className="list-reset">
            {category.substances.map((s) => (
              <li key={s.no}>
                <button className="catalog-row" onClick={() => openSubstance(category.code, s.no)}>
                  <span>
                    <span className="muted small">{s.no}.</span> <strong>{s.nameKo}</strong>
                    {usedKeys.has(`${category.code}-${s.no}`) && (
                      <span className="badge badge--info" style={{ marginLeft: 6 }}>
                        사용
                      </span>
                    )}
                    {s.nameEn && <span className="muted small"> · {s.nameEn}</span>}
                  </span>
                  <span className="muted small">{s.cas ? `${s.cas} ` : ''}›</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        /* 1단계: 분류 카드 */
        <>
          <div className="muted small">
            {catalog.source} · {catalog.revision}. 분류를 선택하면 물질 목록과 건강장해 상세를 볼 수
            있습니다.
          </div>
          <div className="grid grid--stats">
            {catalog.categories.map((c) => (
              <button key={c.code} className="category-card" onClick={() => setCategoryCode(c.code)}>
                <span className="category-card__group">{c.group}</span>
                <span className="category-card__name">{c.name}</span>
                <span className="category-card__count">{c.substances.length}종 ›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {addOpen && (
        <AddDeptHazardModal
          departments={deptNames}
          defaultDept={mapDept}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            deptHaz.reload();
          }}
        />
      )}
    </div>
  );
}

/** 부서에 유해인자를 묶는 모달 — 카탈로그 검색으로 물질을 고른다 */
function AddDeptHazardModal({
  departments,
  defaultDept,
  onClose,
  onAdded,
}: {
  departments: string[];
  defaultDept: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { hazard } = useServices();
  const [dept, setDept] = useState(defaultDept || departments[0] || '');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<{
    code: HazardCategoryCode;
    no: number;
    name: string;
  } | null>(null);
  const [process, setProcess] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const results = useMemo(
    () => (query.trim() ? hazard.searchCatalog(query).slice(0, 30) : []),
    [query, hazard],
  );

  async function save() {
    if (!dept) return setError('부서를 선택하세요.');
    if (!picked) return setError('유해인자를 선택하세요.');
    setSaving(true);
    try {
      await hazard.linkDepartmentHazard({
        department: dept,
        ref: { categoryCode: picked.code, substanceNo: picked.no },
        process,
      });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="부서 유해인자 추가"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            추가
          </button>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}
      <div className="field">
        <label>부서</label>
        <select className="select" value={dept} onChange={(e) => setDept(e.target.value)}>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>유해인자 선택</label>
        {picked ? (
          <div className="row spread" style={{ alignItems: 'center' }}>
            <span>
              선택됨: <strong>{picked.name}</strong>
            </span>
            <button className="btn btn--ghost btn--sm" onClick={() => setPicked(null)}>
              변경
            </button>
          </div>
        ) : (
          <input
            className="input"
            placeholder="물질명·영문·CAS 검색 (예: 톨루엔, benzene, 71-43-2)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        )}
      </div>

      {!picked && query.trim() !== '' && (
        <div className="table-wrap" style={{ maxHeight: 220, overflow: 'auto', marginBottom: 12 }}>
          <ul className="list-reset">
            {results.map(({ category: c, substance: s }) => (
              <li key={`${c.code}-${s.no}`}>
                <button
                  className="catalog-row"
                  onClick={() => {
                    setPicked({ code: c.code, no: s.no, name: s.nameKo });
                    setError(null);
                  }}
                >
                  <span>
                    <strong>{s.nameKo}</strong>
                    {s.nameEn && <span className="muted small"> · {s.nameEn}</span>}
                  </span>
                  <span className="muted small">
                    {c.name}
                    {s.cas ? ` · ${s.cas}` : ''} ›
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="muted small" style={{ padding: 8 }}>
                검색 결과가 없습니다.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="field">
        <label>공정/작업 (선택)</label>
        <input
          className="input"
          placeholder="예: 스프레이 도장 부스"
          value={process}
          onChange={(e) => setProcess(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function SubstanceDetail({
  category,
  substance,
  onBack,
  onHome,
}: {
  category: HazardCategory;
  substance: HazardSubstance;
  onBack: () => void;
  onHome: () => void;
}) {
  const { hazard } = useServices();
  const detail = useAsync<HazardHealthDetail | null>(
    () => hazard.getHealthDetail({ categoryCode: category.code, substanceNo: substance.no }),
    [category.code, substance.no],
  );

  return (
    <div className="stack">
      <div className="row small" style={{ gap: 6, color: 'var(--text-muted)' }}>
        <button className="btn btn--ghost btn--sm" onClick={onHome}>
          전체
        </button>
        <span>›</span>
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          {category.name}
        </button>
        <span>›</span>
        <strong style={{ color: 'var(--text)' }}>{substance.nameKo}</strong>
      </div>

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
