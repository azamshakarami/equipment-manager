import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useLoad, StatusBadge, Modal, EmpBadge } from '../components/common.jsx';
import ItemForm from '../components/ItemForm.jsx';
import { fmt } from '../dates.js';

export default function Items() {
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useState({ search: '', category: '', location_id: '', status: '', from: '', to: '' });
  const [items, reload, error] = useLoad(() => api(`/items${qs(filters)}`), [JSON.stringify(filters)]);
  const [categories] = useLoad(() => api('/items/categories'));
  const [locations] = useLoad(() => api('/locations'));
  const [editing, setEditing] = useState(null); // null | 'new' | item

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const ranged = filters.from && filters.to;

  const remove = async (item) => {
    if (!confirm(`Delete "${item.name}"? All its reservations will be deleted too.`)) return;
    try { await api(`/items/${item.id}`, { method: 'DELETE' }); reload(); } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="page-head">
        <h2>Equipment</h2>
        {isAdmin && <button className="btn primary" onClick={() => setEditing('new')}>+ Add item</button>}
      </div>
      <div className="filters card">
        <input placeholder="Search name, model, serial…" value={filters.search} onChange={set('search')} />
        <select value={filters.category} onChange={set('category')}>
          <option value="">All categories</option>
          {(categories || []).map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filters.location_id} onChange={set('location_id')}>
          <option value="">All locations</option>
          {(locations || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filters.status} onChange={set('status')}>
          <option value="">Any status today</option>
          <option value="available">Available</option>
          <option value="in_use">In use</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
        <span className="range">
          Free between <input type="date" value={filters.from} onChange={set('from')} />
          and <input type="date" value={filters.to} min={filters.from} onChange={set('to')} />
          {(filters.from || filters.to) && <button className="btn small ghost" onClick={() => setFilters({ ...filters, from: '', to: '' })}>clear</button>}
        </span>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item</th><th>Category</th><th>Stored at</th><th>Ordered by</th><th>Course units</th>
              <th>Status today</th>{ranged && <th>In chosen period</th>}{isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {(items || []).map((i) => (
              <tr key={i.id}>
                <td><Link to={`/items/${i.id}`}><strong>{i.name}</strong></Link><div className="muted">{i.model}{i.serial_number ? ` · SN ${i.serial_number}` : ''}</div></td>
                <td>{i.category}</td>
                <td>{i.location_name || '—'}<div className="muted">{[i.building, i.room].filter(Boolean).join(', ')}</div></td>
                <td>{i.ordered_by_name ? <>{i.ordered_by_name} <EmpBadge type={i.ordered_by_type} /></> : '—'}<div className="muted">{i.order_date && fmt(i.order_date)}</div></td>
                <td>{i.course_units.map((c) => <span key={c.id} className="chip" title={c.name}>{c.code}</span>)}</td>
                <td>
                  <StatusBadge status={i.status} />
                  {i.status === 'in_use' && <div className="muted">{i.current_user_name}<br />until {fmt(i.current_until)}</div>}
                  {i.status === 'available' && i.next_start && <div className="muted">next booking {fmt(i.next_start)}</div>}
                </td>
                {ranged && <td>{i.available_in_range ? <span className="badge green">Free</span> : <span className="badge red">Booked</span>}</td>}
                {isAdmin && (
                  <td className="actions">
                    <button className="btn small" onClick={() => setEditing(i)}>Edit</button>
                    <button className="btn small danger" onClick={() => remove(i)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {items && !items.length && <tr><td colSpan={8} className="muted">No items match.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal title={editing === 'new' ? 'Add item' : `Edit ${editing.name}`} onClose={() => setEditing(null)} wide>
          <ItemForm item={editing === 'new' ? null : editing} onDone={() => { setEditing(null); reload(); }} />
        </Modal>
      )}
    </div>
  );
}
