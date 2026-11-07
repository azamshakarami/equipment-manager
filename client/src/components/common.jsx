import { useCallback, useEffect, useState } from 'react';

export const STATUS = {
  available: { label: 'Available', cls: 'green' },
  in_use: { label: 'In use', cls: 'red' },
  maintenance: { label: 'Maintenance', cls: 'amber' },
  retired: { label: 'Retired', cls: 'grey' },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, cls: 'grey' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export const EmpBadge = ({ type }) => (
  <span className={`badge ${type === 'full_time' ? 'blue' : 'purple'}`}>{type === 'full_time' ? 'Full-time' : 'Part-time'}</span>
);

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const ErrorBox = ({ error }) => (error ? <div className="alert error">{error}</div> : null);

/** Load data from an async function; returns [data, reload, error, loading]. */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => {
    setLoading(true);
    return fn().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, deps);
  useEffect(() => { load(); }, [load]);
  return [data, load, error, loading];
}
