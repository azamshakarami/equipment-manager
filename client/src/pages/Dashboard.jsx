import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useLoad, StatusBadge } from '../components/common.jsx';
import { fmt, todayISO } from '../dates.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats] = useLoad(() => api('/dashboard'));
  const [items] = useLoad(() => api('/items'));
  const [mine] = useLoad(() => api('/reservations?mine=1'));

  const inUse = (items || []).filter((i) => i.status === 'in_use');
  const myUpcoming = (mine || []).filter((r) => r.end_date >= todayISO());

  return (
    <div>
      <h2>Welcome, {user.full_name}</h2>
      {stats && (
        <div className="stats">
          <Stat label="Total items" value={stats.total_items} />
          <Stat label="Available now" value={stats.available} cls="green" />
          <Stat label="In use now" value={stats.in_use} cls="red" />
          <Stat label="Maintenance" value={stats.maintenance} cls="amber" />
          <Stat label="Upcoming bookings" value={stats.upcoming} />
          <Stat label="Active staff" value={stats.staff} />
        </div>
      )}
      <div className="grid2">
        <section className="card">
          <h3>My current &amp; upcoming reservations</h3>
          {!myUpcoming.length && <p className="muted">You have no reservations. <Link to="/availability">Find available equipment →</Link></p>}
          <ul className="list">
            {myUpcoming.map((r) => (
              <li key={r.id}>
                <Link to={`/items/${r.item_id}`}>{r.item_name}</Link>
                <span className="muted"> · {fmt(r.start_date)} – {fmt(r.end_date)}{r.course_code ? ` · ${r.course_code}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h3>Equipment in use right now</h3>
          {!inUse.length && <p className="muted">Nothing is checked out today.</p>}
          <ul className="list">
            {inUse.map((i) => (
              <li key={i.id}>
                <Link to={`/items/${i.id}`}>{i.name}</Link> <StatusBadge status={i.status} />
                <div className="muted">{i.current_user_name} · until {fmt(i.current_until)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

const Stat = ({ label, value, cls = '' }) => (
  <div className={`stat card ${cls}`}><div className="stat-val">{value}</div><div className="muted">{label}</div></div>
);
