import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad, Modal } from '../components/common.jsx';
import ReserveForm from '../components/ReserveForm.jsx';
import { daysBetween, fmt, todayISO } from '../dates.js';

export default function MyReservations() {
  const [status, setStatus] = useState('active');
  const [rows, reload] = useLoad(() => api(`/reservations?mine=1&status=${status}`), [status]);
  const [editing, setEditing] = useState(null);
  const today = todayISO();

  const act = async (r, action) => {
    if (!confirm(action === 'cancel' ? 'Cancel this reservation?' : 'Return this item today?')) return;
    try { await api(`/reservations/${r.id}/${action}`, { method: 'POST' }); reload(); } catch (e) { alert(e.message); }
  };
  const edit = async (r) => {
    const item = await api(`/items/${r.item_id}`);
    setEditing({ r, item, start: r.start_date, end: r.end_date });
  };

  return (
    <div>
      <div className="page-head">
        <h2>My reservations</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option><option value="returned">Returned</option>
          <option value="cancelled">Cancelled</option><option value="all">All</option>
        </select>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Stored at</th><th>Period</th><th>Course unit</th><th>Purpose</th><th>State</th><th></th></tr></thead>
          <tbody>
            {(rows || []).map((r) => {
              const state = r.status !== 'active' ? r.status : r.start_date > today ? `starts in ${daysBetween(today, r.start_date)} d`
                : r.end_date < today ? 'ended' : `in use · ${daysBetween(today, r.end_date)} d left`;
              const active = r.status === 'active' && r.end_date >= today;
              return (
                <tr key={r.id}>
                  <td><Link to={`/items/${r.item_id}`}>{r.item_name}</Link></td>
                  <td>{r.location_name || '—'}</td>
                  <td>{fmt(r.start_date)} – {fmt(r.end_date)}</td>
                  <td>{r.course_code ? <span className="chip" title={r.course_name}>{r.course_code}</span> : '—'}</td>
                  <td>{r.purpose || '—'}</td>
                  <td>{state}</td>
                  <td className="actions">
                    {active && <button className="btn small" onClick={() => edit(r)}>Change dates</button>}
                    {active && r.start_date <= today && <button className="btn small" onClick={() => act(r, 'return')}>Return</button>}
                    {active && r.start_date > today && <button className="btn small danger" onClick={() => act(r, 'cancel')}>Cancel</button>}
                  </td>
                </tr>
              );
            })}
            {rows && !rows.length && <tr><td colSpan={7} className="muted">No reservations. <Link to="/availability">Find equipment →</Link></td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal title={`Change reservation – ${editing.item.name}`} onClose={() => setEditing(null)}>
          <ReserveForm item={editing.item} existing={editing.r} start={editing.start} end={editing.end}
            onRangeChange={(start, end) => setEditing({ ...editing, start, end })}
            onDone={() => { setEditing(null); reload(); }} />
        </Modal>
      )}
    </div>
  );
}
