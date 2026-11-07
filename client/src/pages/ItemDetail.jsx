import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useLoad, StatusBadge, EmpBadge, Modal } from '../components/common.jsx';
import MonthCalendar from '../components/MonthCalendar.jsx';
import ReserveForm from '../components/ReserveForm.jsx';
import ItemForm from '../components/ItemForm.jsx';
import { fmt, todayISO } from '../dates.js';

export default function ItemDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, isAdmin } = useAuth();
  const [item, reload, error] = useLoad(() => api(`/items/${id}`), [id]);
  const [range, setRange] = useState({ start: '', end: '' });
  const [editing, setEditing] = useState(false);
  const [showPast, setShowPast] = useState(false);

  if (error) return <div className="alert error">{error}</div>;
  if (!item) return <p>Loading…</p>;

  const active = item.reservations.filter((r) => r.status === 'active');
  const events = active.map((r) => ({
    id: r.id, colorKey: r.staff_id, start_date: r.start_date, end_date: r.end_date,
    label: r.staff_name, title: `${r.staff_name}${r.course_code ? ` · ${r.course_code}` : ''}: ${fmt(r.start_date)} – ${fmt(r.end_date)}`,
  }));
  const listed = item.reservations.filter((r) => showPast || (r.status === 'active' && r.end_date >= todayISO()));

  const act = async (r, action) => {
    const msg = action === 'cancel' ? 'Cancel this reservation?' : 'Mark the item as returned today?';
    if (!confirm(msg)) return;
    try { await api(`/reservations/${r.id}/${action}`, { method: 'POST' }); reload(); } catch (e) { alert(e.message); }
  };

  const remove = async () => {
    if (!confirm(`Delete "${item.name}" and all its reservations?`)) return;
    await api(`/items/${item.id}`, { method: 'DELETE' });
    nav('/items');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <Link to="/items" className="muted">← Equipment</Link>
          <h2>{item.name} <StatusBadge status={item.status} /></h2>
        </div>
        {isAdmin && (
          <div className="actions">
            <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn danger" onClick={remove}>Delete</button>
          </div>
        )}
      </div>

      <div className="grid2">
        <section className="card">
          <h3>Details</h3>
          <dl className="details">
            <dt>Category</dt><dd>{item.category}</dd>
            <dt>Model</dt><dd>{item.model || '—'}</dd>
            <dt>Serial no.</dt><dd>{item.serial_number || '—'}</dd>
            <dt>Stored at</dt><dd>{item.location_name ? `${item.location_name}${item.building ? ` · ${item.building}` : ''}${item.room ? ` · Room ${item.room}` : ''}` : '—'}</dd>
            <dt>Ordered by</dt><dd>{item.ordered_by_name ? <>{item.ordered_by_name} <EmpBadge type={item.ordered_by_type} /></> : '—'}</dd>
            <dt>Order date</dt><dd>{fmt(item.order_date)}</dd>
            <dt>Supplier</dt><dd>{item.supplier || '—'}{item.cost != null && ` · ${Number(item.cost).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`}</dd>
            <dt>Course units</dt><dd>{item.course_units.length ? item.course_units.map((c) => <div key={c.id}><span className="chip">{c.code}</span> {c.name}</div>) : '—'}</dd>
            <dt>Right now</dt>
            <dd>{item.status === 'in_use' ? <>In use by <strong>{item.current_user_name}</strong> until {fmt(item.current_until)}</>
              : item.status === 'available' ? <>Available{item.next_start ? ` (next booking starts ${fmt(item.next_start)})` : ' — no upcoming bookings'}</>
              : `Not bookable (${item.item_condition})`}</dd>
          </dl>
          {item.description && <p>{item.description}</p>}
        </section>
        <section className="card">
          <h3>Reserve this item</h3>
          <ReserveForm item={item} start={range.start} end={range.end}
            onRangeChange={(start, end) => setRange({ start, end })}
            onDone={() => { setRange({ start: '', end: '' }); reload(); }} />
        </section>
      </div>

      <section className="card">
        <h3>Availability calendar</h3>
        <div className="legend"><span className="sw free" /> free <span className="sw busy" /> booked <span className="sw sel" /> your selection</div>
        <MonthCalendar events={events} showFree selection={range} onSelectRange={(start, end) => setRange({ start, end })} />
      </section>

      <section className="card">
        <div className="page-head">
          <h3>Reservations</h3>
          <label className="check"><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> show past / cancelled</label>
        </div>
        <table>
          <thead><tr><th>Staff</th><th>Period</th><th>Course unit</th><th>Purpose</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {listed.map((r) => {
              const canEdit = r.status === 'active' && (r.staff_id === user.id || isAdmin);
              const started = r.start_date <= todayISO();
              return (
                <tr key={r.id}>
                  <td>{r.staff_name} <EmpBadge type={r.employment_type} /></td>
                  <td>{fmt(r.start_date)} – {fmt(r.end_date)}</td>
                  <td>{r.course_code ? <span title={r.course_name} className="chip">{r.course_code}</span> : '—'}</td>
                  <td>{r.purpose || '—'}</td>
                  <td>{r.status}</td>
                  <td className="actions">
                    {canEdit && started && <button className="btn small" onClick={() => act(r, 'return')}>Return</button>}
                    {canEdit && !started && <button className="btn small danger" onClick={() => act(r, 'cancel')}>Cancel</button>}
                  </td>
                </tr>
              );
            })}
            {!listed.length && <tr><td colSpan={6} className="muted">No reservations.</td></tr>}
          </tbody>
        </table>
      </section>

      {editing && (
        <Modal title={`Edit ${item.name}`} onClose={() => setEditing(false)} wide>
          <ItemForm item={item} onDone={() => { setEditing(false); reload(); }} />
        </Modal>
      )}
    </div>
  );
}
