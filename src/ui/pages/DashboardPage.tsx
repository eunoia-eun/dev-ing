import { Link } from 'react-router-dom';
import { employeeDisplayName } from '@domain/employee/Employee';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { Card, ErrorAlert, ProgressBar, Spinner, Stat } from '../components/ui';
import { ExposureStatusBadge } from '../components/StatusBadge';
import { describeDaysUntil, formatDateTime } from '../format';

export function DashboardPage() {
  const { hazard, symptom, program, employees: empService } = useServices();
  const { data, loading, error } = useAsync(async () => {
    const [overview, visits, lowStock, summaries] = await Promise.all([
      hazard.getOverview(),
      symptom.listVisits(),
      symptom.getLowStockMedicines(),
      program.getAllSummaries(),
    ]);
    return { overview, visits: visits.slice(0, 6), lowStock, summaries };
  }, []);

  const emp = useAsync(() => empService.listAll(), []);

  if (loading || emp.loading) return <Spinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!data) return null;

  const nameOf = (id: string) =>
    emp.data?.find((e) => e.id === id)?.name ?? '(알 수 없음)';

  const { overview, visits, lowStock, summaries } = data;
  const ongoing = summaries.filter((s) => s.program.status !== 'closed').length;

  return (
    <div className="stack">
      <div className="grid grid--stats">
        <Link to="/employees" className="stat-link">
          <Stat
            label="특수검진 기한 초과"
            value={overview.overdueCount}
            hint="클릭 → 건강명부에서 처리"
            tone={overview.overdueCount > 0 ? 'danger' : 'success'}
          />
        </Link>
        <Link to="/employees" className="stat-link">
          <Stat
            label="검진 임박 (30일 내)"
            value={overview.dueSoonCount}
            hint="클릭 → 건강명부"
            tone={overview.dueSoonCount > 0 ? 'warning' : 'success'}
          />
        </Link>
        <Link to="/medicine" className="stat-link">
          <Stat
            label="재고 부족 상비약"
            value={lowStock.length}
            hint="클릭 → 상비약"
            tone={lowStock.length > 0 ? 'warning' : 'success'}
          />
        </Link>
        <Link to="/program" className="stat-link">
          <Stat label="운영 중 프로그램" value={ongoing} hint={`클릭 → 건강프로그램 (전체 ${summaries.length}개)`} tone="info" />
        </Link>
      </div>

      <div className="grid grid--2">
        <Card
          title="특수검진 도래 임직원"
          bodyClassName=""
        >
          {overview.attentionItems.length === 0 ? (
            <div className="empty">
              <span className="ico">✅</span>모든 임직원이 검진 주기 안에 있어요.
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>임직원</th>
                    <th>유해인자</th>
                    <th>예정일</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.attentionItems.slice(0, 8).map(({ employee, assessment }) => (
                    <tr key={assessment.record.id}>
                      <td>
                        <Link to={`/employees/${employee.id}`}>{employeeDisplayName(employee)}</Link>
                      </td>
                      <td>{assessment.record.substanceName}</td>
                      <td>{assessment.nextExamDueDate}</td>
                      <td>
                        <ExposureStatusBadge status={assessment.status} />{' '}
                        <span className="muted small">
                          {describeDaysUntil(assessment.daysUntilDue)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="최근 보건실 방문"
          actions={
            <Link to="/symptom" className="btn btn--sm">
              차트 보기
            </Link>
          }
        >
          {visits.length === 0 ? (
            <div className="empty">
              <span className="ico">🩺</span>최근 방문 기록이 없어요.
            </div>
          ) : (
            <ul className="list-reset stack" style={{ gap: 10 }}>
              {visits.map((v) => (
                <li key={v.id} className="row spread" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <strong>{nameOf(v.employeeId)}</strong>{' '}
                    <span className="muted small">· {v.symptoms.join(', ')}</span>
                    <div className="muted small">{formatDateTime(v.visitedAt)}</div>
                  </div>
                  <span className="muted small">
                    {v.dispensedMedicines.length > 0
                      ? `약 ${v.dispensedMedicines.length}건`
                      : '투약 없음'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid--2">
        <Card title="재고 부족 상비약">
          {lowStock.length === 0 ? (
            <div className="muted small">부족한 상비약이 없어요. 👍</div>
          ) : (
            <ul className="list-reset stack" style={{ gap: 8 }}>
              {lowStock.map((m) => (
                <li key={m.id} className="row spread">
                  <span>
                    {m.name} <span className="muted small">({m.category})</span>
                  </span>
                  <span className="badge badge--warning">
                    재고 {m.stock}
                    {m.unit} / 기준 {m.lowStockThreshold}
                    {m.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="프로그램 참여 현황"
          actions={
            <Link to="/program" className="btn btn--sm">
              관리
            </Link>
          }
        >
          <ul className="list-reset stack" style={{ gap: 12 }}>
            {summaries.map(({ program: p, summary }) => (
              <li key={p.id}>
                <div className="row spread small">
                  <strong>{p.title}</strong>
                  <span className="muted">
                    {summary.occupied}/{p.capacity}명 · {summary.fillRate}%
                  </span>
                </div>
                <ProgressBar percent={summary.fillRate} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
