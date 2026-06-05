import type { ReactNode } from 'react';

export function Card({
  title,
  actions,
  children,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card__header">
          <div className="card__title">{title}</div>
          {actions}
        </header>
      )}
      <div className={bodyClassName ?? 'card__body'}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'danger' | 'warning' | 'success' | 'info';
}) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon = '📭', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="ico">{icon}</span>
      {children}
    </div>
  );
}

export function Spinner({ label = '불러오는 중…' }: { label?: string }) {
  return <div className="empty">{label}</div>;
}

export function ErrorAlert({ message }: { message: string }) {
  return <div className="alert alert--danger">⚠️ {message}</div>;
}

export function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress" title={`${p}%`}>
      <div className="progress__bar" style={{ width: `${p}%` }} />
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <div className="card__title">{title}</div>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
