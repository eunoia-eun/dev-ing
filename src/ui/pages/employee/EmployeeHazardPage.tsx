import { useMemo, useState } from 'react';
import { findSubstance, type SubstanceRef } from '@domain/hazard/HazardousSubstance';
import { useServices } from '../../ServicesContext';
import { useAsync } from '../../hooks/useAsync';
import { Octopus } from '../../components/Octopus';
import { HazardSubstanceDetail } from '../../components/HazardSubstanceDetail';
import { formatDate } from '../../format';
import { useEmployeeId } from './EmployeeLayout';

export function EmployeeHazardPage() {
  const meId = useEmployeeId();
  const { profile, hazard } = useServices();
  const catalog = useMemo(() => hazard.getCatalog(), [hazard]);
  const [selectedRef, setSelectedRef] = useState<SubstanceRef | null>(null);

  const prof = useAsync(
    () => profile.getProfile(meId),
    [meId],
  );

  if (prof.loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <Octopus mood="neutral" size={90} className="emp-octopus" />
        <div style={{ color: '#2563eb', marginTop: 14, fontWeight: 700, fontSize: 13.5 }}>불러오는 중...</div>
      </div>
    );
  }

  const allExposures  = prof.data?.exposures ?? [];
  const activeList    = allExposures.filter((ex) => ex.status !== 'ended');
  const endedList     = allExposures.filter((ex) => ex.status === 'ended');

  if (selectedRef) {
    const found = findSubstance(catalog, selectedRef);
    return (
      <div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          style={{ marginBottom: 10, color: '#1d4ed8' }}
          onClick={() => setSelectedRef(null)}
        >
          ← 내 유해인자
        </button>
        {found ? (
          <HazardSubstanceDetail category={found.category} substance={found.substance} />
        ) : (
          <div className="emp-card" style={{ textAlign: 'center', padding: '24px 18px' }}>
            <div style={{ color: '#9ca3af' }}>카탈로그에서 이 유해인자를 찾을 수 없어요.</div>
          </div>
        )}
      </div>
    );
  }

  if (allExposures.length === 0) {
    return (
      <div>
        <h2 style={{ color: '#111827', fontSize: 16, margin: '0 0 16px', fontWeight: 900 }}>⚗️ 내 유해인자</h2>
        <div style={{ textAlign: 'center', paddingTop: 16 }}>
          <Octopus mood="happy" size={90} className="emp-octopus" />
        </div>
        <div className="emp-card" style={{ textAlign: 'center', padding: '24px 18px', marginTop: 8 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
          <div style={{ color: '#1d4ed8', fontWeight: 800, marginBottom: 5 }}>등록된 유해인자가 없어요</div>
          <div style={{ color: '#9ca3af', fontSize: 12.5, lineHeight: 1.6 }}>
            유해인자에 노출되지 않았거나<br/>보건관리자가 아직 등록하지 않았어요.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ color: '#111827', fontSize: 16, margin: '0 0 12px', fontWeight: 900 }}>⚗️ 내 유해인자</h2>

      {/* 진행 중 노출 */}
      {activeList.length > 0 && (
        <div className="emp-card">
          <div className="emp-card__title">진행 중 노출 ({activeList.length}종)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeList.map((ex) => (
              <button
                key={ex.record.id}
                type="button"
                onClick={() =>
                  setSelectedRef({ categoryCode: ex.record.categoryCode, substanceNo: ex.record.substanceNo })
                }
                style={{
                  background: '#eff6ff',
                  borderRadius: 12,
                  padding: '12px 14px',
                  border: '1px solid #dbeafe',
                  textAlign: 'left',
                  font: 'inherit',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>
                    {ex.record.substanceName}
                  </div>
                  <span style={{ color: '#93c5fd', fontWeight: 900 }}>›</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2 }}>
                  노출 시작: {formatDate(ex.record.startDate)}
                  {ex.record.department ? ` · ${ex.record.department}` : ''}
                </div>
                {ex.record.note && (
                  <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 5 }}>
                    📝 {ex.record.note}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 종료된 노출 */}
      {endedList.length > 0 && (
        <div className="emp-card">
          <div className="emp-card__title" style={{ color: '#9ca3af' }}>
            종료된 노출 ({endedList.length}종)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {endedList.map((ex) => (
              <div
                key={ex.record.id}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#9ca3af' }}
              >
                <span>{ex.record.substanceName}</span>
                <span>
                  {formatDate(ex.record.startDate)} ~ {ex.record.endDate ? formatDate(ex.record.endDate) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 안내 카드 */}
      <div className="emp-card" style={{ background: '#eff6ff' }}>
        <div style={{ fontSize: 13, color: '#1d4ed8', lineHeight: 1.7 }}>
          💡 <strong>특수건강진단</strong>이란?<br />
          유해인자에 노출되는 임직원은 정해진 주기마다 특수건강진단을 받아야 해요.
          검진 현황과 다음 일정은 홈 화면에서 확인할 수 있어요.
        </div>
      </div>
    </div>
  );
}
