import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api.js';
import { useLoad, Modal, StatusBadge } from '../components/common.jsx';
import ReserveForm from '../components/ReserveForm.jsx';
import { addDays, daysBetween, fmt, overlaps, parseISO, todayISO } from '../dates.js';

/**
 * Timeline (Gantt-style) view: rows = items, columns = days.
 * Shows in advance which items are free for a chosen period, and lets staff book directly.
 */
export default function Availability() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(addDays(todayISO(), 41));
  const [category, setCategory] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);
  const [booking, setBooking] = useState(null);

  const valid = from && to && to >= from;
  const [items, reloadItems] = useLoad(() => (valid ? api(`/items${qs({ from, to, category })}`) : Promise.resolve([])), [from, to, category]);
  const [reservations, reloadRes] = useLoad(() => (valid ? api(`/reservations${qs({ from, to })}`) : Promise.resolve([])), [from, to]);
  const [categories] = useLoad(() => api('/items/categories'));

  const span = valid ? Math.min(daysBetween(from, to) + 1, 366) : 0;
  const days = Array.from({ length: span }, (_, i) => addDays(from, i));
  const shown = (items || []).filter((i) => i.item_condition !== 'retired' && (!onlyFree || i.available_in_range));

  const openBooking = async (itemId) => {
    const full = await api(`/items/${itemId}`);
    setBooking({ item: full, start: from < todayISO() ? todayISO() : from, end: to });
  };

  return (
    <div>
      <h2>Availability planner</h2>
      <p className="muted">Pick a period to see which equipment is free in advance. Green rows are free for the whole period.</p>
      <div className="filters card">
        <span className="range">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          to <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></span>
        <span className="quick-range">
          {[[14, '2 weeks'], [42, '6 weeks'], [91, '3 months'], [182, '6 months']].map(([n, l]) => (
            <button key={n} className="btn small ghost" onClick={() => setTo(addDays(from, n - 1))}>{l}</button>
          ))}
        </span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {(categories || []).map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> only items free for the whole period</label>
      </div>

      {!valid && <div className="alert error">Choose a valid period.</div>}
      {valid && (
        <div className="card timeline-wrap">
          <div className="timeline" style={{ gridTemplateColumns: `260px repeat(${days.length}, 24px)` }}>
            <div className="tl-corner">Item</div>
            {days.map((d) => {
              const dt = parseISO(d);
              const weekend = dt.getDay() === 0 || dt.getDay() === 6;
              return (
                <div key={d} className={`tl-day ${weekend ? 'weekend' : ''} ${dt.getDate() === 1 ? 'month-start' : ''}`} title={fmt(d)}>
                  {dt.getDate() === 1 || d === from ? <span className="tl-month">{dt.toLocaleDateString(undefined, { month: 'short' })}</span> : null}
                  {dt.getDate()}
                </div>
              );
            })}
            {shown.map((item) => {
              const itemRes = (reservations || []).filter((r) => r.item_id === item.id);
              const free = item.available_in_range;
              return (
                <Fragment key={item.id}>
                  <div className={`tl-item ${free ? 'free' : ''}`}>
                    <div>
                      <Link to={`/items/${item.id}`}>{item.name}</Link>
                      <div className="muted small-text">{item.category} · {item.location_name || 'no location'} {item.item_condition !== 'working' && <StatusBadge status={item.item_condition} />}</div>
                    </div>
                    {free && <button className="btn small primary" onClick={() => openBooking(item.id)}>Book</button>}
                  </div>
                  {days.map((d) => {
                    const r = itemRes.find((x) => overlaps(x.start_date, x.end_date, d, d));
                    const cls = item.item_condition !== 'working' ? 'blocked' : r ? 'booked' : 'open';
                    return (
                      <div key={d} className={`tl-cell ${cls}`}
                        title={r ? `${r.staff_name}${r.course_code ? ` · ${r.course_code}` : ''}: ${fmt(r.start_date)} – ${fmt(r.end_date)}` : `${fmt(d)}: free`}>
                        {r && r.start_date === d ? '▌' : ''}
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
          {!shown.length && <p className="muted">No items to show.</p>}
          <div className="legend"><span className="sw free" /> free <span className="sw busy" /> reserved (hover for who) <span className="sw blocked" /> maintenance</div>
        </div>
      )}

      {booking && (
        <Modal title={`Reserve ${booking.item.name}`} onClose={() => setBooking(null)}>
          <ReserveForm item={booking.item} start={booking.start} end={booking.end}
            onRangeChange={(start, end) => setBooking({ ...booking, start, end })}
            onDone={() => { setBooking(null); reloadItems(); reloadRes(); }} />
        </Modal>
      )}
    </div>
  );
}
