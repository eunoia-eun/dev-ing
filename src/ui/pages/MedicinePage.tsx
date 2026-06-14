import { Fragment, useState } from 'react';
import { isLowStock, type Medicine } from '@domain/symptom/Medicine';
import { MOVEMENT_TYPE_LABEL, type MovementType } from '@domain/inventory/InventoryMovement';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { Card, ErrorAlert, Modal, Spinner } from '../components/ui';
import { downloadCsv } from '../csv';
import { daysAgoISO, formatDateTime, todayISO } from '../format';

/** 상비약 반출입 — 분류별 재고·입고(사유) + 입출고 대장(구간·약품·구분 조회 + 엑셀) */
export function MedicinePage() {
  const { symptom, employees } = useServices();
  const meds = useAsync(() => symptom.listMedicines(), []);
  const movements = useAsync(() => symptom.listMovements(), []);
  const emp = useAsync(() => employees.list(), []);

  const [modal, setModal] = useState<{ open: boolean; editing: Medicine | null }>({ open: false, editing: null });
  const [restockFor, setRestockFor] = useState<Medicine | null>(null);
  // 대장 조회 조건
  const [start, setStart] = useState(daysAgoISO(90));
  const [end, setEnd] = useState(todayISO());
  const [medFilter, setMedFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | MovementType>('');

  const nameOf = (id?: string) => (id ? emp.data?.find((e) => e.id === id)?.name ?? '(알 수 없음)' : '-');
  function reloadAll() {
    meds.reload();
    movements.reload();
  }

  async function removeMed(m: Medicine) {
    if (!confirm(`'${m.name}'을(를) 목록에서 삭제할까요? (입출고 대장 기록은 보존돼요)`)) return;
    await symptom.removeMedicine(m.id);
    reloadAll();
  }

  const list = meds.data ?? [];
  const lowCount = list.filter(isLowStock).length;
  const categories = [...new Set(list.map((m) => m.category))];
  const grouped = categories.map((cat) => ({ cat, items: list.filter((m) => m.category === cat) }));

  // 입출고 대장 — 구간·약품·구분 필터(서비스에서 최신순 정렬됨)
  const filteredMoves = (movements.data ?? []).filter((m) => {
    const day = m.at.slice(0, 10);
    if (start && day < start) return false;
    if (end && day > end) return false;
    if (typeFilter && m.type !== typeFilter) return false;
    if (medFilter && m.medicineId !== medFilter) return false;
    return true;
  });

  function exportCsv() {
    const header = ['일시', '구분', '약품', '수량', '단위', '사유', '임직원', '처리자'];
    const rows = filteredMoves.map((m) => [
      formatDateTime(m.at),
      MOVEMENT_TYPE_LABEL[m.type],
      m.medicineName,
      (m.type === 'in' ? '+' : '-') + m.quantity,
      m.unit,
      m.reason ?? '',
      nameOf(m.employeeId),
      m.managedBy ?? '',
    ]);
    downloadCsv(`입출고대장_${start}_${end}.csv`, [header, ...rows]);
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="grow muted small">
          분류 {grouped.length}개 · 약품 {list.length}품목 · 재고 부족{' '}
          <strong style={{ color: lowCount > 0 ? 'var(--warning)' : 'var(--success)' }}>{lowCount}</strong>
        </div>
        <button className="btn btn--primary" onClick={() => setModal({ open: true, editing: null })}>
          ＋ 약품 등록
        </button>
      </div>

      <Card title="상비약 재고 · 입고(반입)" bodyClassName="">
        {meds.loading ? (
          <Spinner />
        ) : meds.error ? (
          <ErrorAlert message={meds.error} />
        ) : list.length === 0 ? (
          <div className="empty">
            <span className="ico">💊</span>등록된 상비약이 없어요. "＋ 약품 등록"으로 추가해 보세요.
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>약품</th>
                  <th className="num">재고</th>
                  <th className="num">적정 보유량</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ cat, items }) => (
                  <Fragment key={cat}>
                    <tr className="group-row">
                      <td colSpan={5}>
                        {cat} <span className="muted">({items.length})</span>
                      </td>
                    </tr>
                    {items.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.name}</strong>
                        </td>
                        <td className="num">
                          {m.stock}
                          {m.unit}
                        </td>
                        <td className="num muted">
                          {m.lowStockThreshold}
                          {m.unit}
                        </td>
                        <td>
                          {isLowStock(m) ? (
                            <span className="badge badge--warning">부족</span>
                          ) : (
                            <span className="badge badge--success">충분</span>
                          )}
                        </td>
                        <td className="num">
                          <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                            <button className="btn btn--sm" onClick={() => setRestockFor(m)}>
                              ＋ 입고
                            </button>
                            <button className="btn btn--sm" onClick={() => setModal({ open: true, editing: m })}>
                              수정
                            </button>
                            <button className="btn btn--danger btn--sm" onClick={() => removeMed(m)}>
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="입출고 대장"
        actions={
          <button className="btn btn--sm" onClick={exportCsv} disabled={filteredMoves.length === 0}>
            ⬇ 엑셀 다운로드
          </button>
        }
        bodyClassName="card__body"
      >
        <div className="toolbar">
          <input className="input lab-range" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="muted">~</span>
          <input className="input lab-range" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <select
            className="select"
            style={{ maxWidth: 90 }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as '' | MovementType)}
          >
            <option value="">전체</option>
            <option value="in">입고</option>
            <option value="out">반출</option>
          </select>
          <select
            className="select"
            style={{ maxWidth: 200 }}
            value={medFilter}
            onChange={(e) => setMedFilter(e.target.value)}
          >
            <option value="">전체 약품</option>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <span className="muted small">{filteredMoves.length}건</span>
        </div>

        {movements.loading ? (
          <Spinner />
        ) : filteredMoves.length === 0 ? (
          <div className="empty">
            <span className="ico">📒</span>해당 조건의 입출고 기록이 없어요.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>구분</th>
                  <th>약품</th>
                  <th className="num">수량</th>
                  <th>사유</th>
                  <th>임직원</th>
                  <th>처리자</th>
                </tr>
              </thead>
              <tbody>
                {filteredMoves.map((m) => (
                  <tr key={m.id}>
                    <td className="muted small">{formatDateTime(m.at)}</td>
                    <td>
                      <span className={`badge badge--${m.type === 'in' ? 'success' : 'muted'}`}>
                        {MOVEMENT_TYPE_LABEL[m.type]}
                      </span>
                    </td>
                    <td>{m.medicineName}</td>
                    <td className="num" style={{ color: m.type === 'in' ? 'var(--success)' : 'var(--text)' }}>
                      {m.type === 'in' ? '+' : '−'}
                      {m.quantity}
                      {m.unit}
                    </td>
                    <td className="small">{m.reason ?? '-'}</td>
                    <td className="small">{nameOf(m.employeeId)}</td>
                    <td className="small muted">{m.managedBy ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="muted small" style={{ marginTop: 8 }}>
          ※ 반출은 「상담일지」에서 상비약 수령 시 자동으로 기록돼요. 약품을 삭제해도 대장 기록은 남아요.
        </div>
      </Card>

      {modal.open && (
        <MedicineModal
          editing={modal.editing}
          categories={categories}
          onClose={() => setModal({ open: false, editing: null })}
          onSaved={() => {
            setModal({ open: false, editing: null });
            reloadAll();
          }}
        />
      )}
      {restockFor && (
        <RestockModal
          medicine={restockFor}
          onClose={() => setRestockFor(null)}
          onSaved={() => {
            setRestockFor(null);
            reloadAll();
          }}
        />
      )}
    </div>
  );
}

function RestockModal({
  medicine,
  onClose,
  onSaved,
}: {
  medicine: Medicine;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { symptom } = useServices();
  const [qty, setQty] = useState('10');
  const [reason, setReason] = useState('정기 구매');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const n = Number(qty);
    if (Number.isNaN(n) || n <= 0) {
      setError('입고 수량을 1 이상 입력하세요.');
      return;
    }
    try {
      await symptom.restockMedicine(medicine.id, n, reason);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal
      title={`입고 — ${medicine.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn btn--primary" onClick={submit}>
            입고
          </button>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}
      <div className="alert alert--info">
        현재 재고 {medicine.stock}
        {medicine.unit} · 입고 일시는 저장 시각으로 자동으로 기록돼요.
      </div>
      <div className="form-row">
        <div className="field">
          <label>입고 수량 ({medicine.unit})</label>
          <input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>사유</label>
          <input className="input" list="restock-reasons" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 정기 구매, 긴급 보충" />
          <datalist id="restock-reasons">
            <option value="정기 구매" />
            <option value="긴급 보충" />
            <option value="기부·후원" />
            <option value="재고 실사 보정" />
          </datalist>
        </div>
      </div>
    </Modal>
  );
}

function MedicineModal({
  editing,
  categories,
  onClose,
  onSaved,
}: {
  editing: Medicine | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { symptom } = useServices();
  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [unit, setUnit] = useState(editing?.unit ?? '정');
  const [stock, setStock] = useState(editing ? String(editing.stock) : '0');
  const [threshold, setThreshold] = useState(editing ? String(editing.lowStockThreshold) : '5');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError('약품명을 입력하세요.');
      return;
    }
    const input = {
      name,
      category: category || '기타',
      unit: unit || '개',
      stock: Number(stock) || 0,
      lowStockThreshold: Number(threshold) || 0,
    };
    try {
      if (editing) await symptom.updateMedicine(editing.id, input);
      else await symptom.addMedicine(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal
      title={editing ? '상비약 수정' : '상비약 등록'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn btn--primary" onClick={submit}>
            저장
          </button>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}
      <div className="field">
        <label>약품명 *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 타이레놀정 500mg" />
      </div>
      <div className="form-row">
        <div className="field">
          <label>분류</label>
          <input className="input" list="med-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: 진통·해열제" />
          <datalist id="med-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>단위</label>
          <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="정 / 포 / 개 / 매" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>{editing ? '현재 재고' : '초기 재고'}</label>
          <input className="input" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
        <div className="field">
          <label>적정 보유량 (이 값 이하면 부족)</label>
          <input className="input" type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
      </div>
      {editing && (
        <div className="muted small">※ 재고를 직접 수정하면 입출고 대장에 '재고 조정'으로 기록돼요.</div>
      )}
    </Modal>
  );
}
