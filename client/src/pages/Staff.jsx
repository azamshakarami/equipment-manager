import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useLoad, Modal, EmpBadge, ErrorBox } from '../components/common.jsx';

const EMPTY = { full_name: '', email: '', phone: '', employment_type: 'full_time', role: 'staff', is_active: true, password: '' };

export default function Staff() {
  const { isAdmin, user } = useAuth();
  const [staff, reload] = useLoad(() => api('/staff'));
  const [typeFilter, setTypeFilter] = useState('');
  const [editing, setEditing] = useState(null);

  const remove = async (s) => {
    if (!confirm(`Delete ${s.full_name}? Their reservations will be removed. (Tip: you can deactivate instead.)`)) return;
    try { await api(`/staff/${s.id}`, { method: 'DELETE' }); reload(); } catch (e) { alert(e.message); }
  };

  const list = (staff || []).filter((s) => !typeFilter || s.employment_type === typeFilter);

  return (
    <div>
      <div className="page-head">
        <h2>Staff</h2>
        <div className="actions">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Full-time &amp; part-time</option>
            <option value="full_time">Full-time only</option>
            <option value="part_time">Part-time only</option>
          </select>
          {isAdmin && <button className="btn primary" onClick={() => setEditing({ ...EMPTY })}>+ Add staff</button>}
        </div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Employment</th><th>Role</th><th>Items ordered</th><th>Active bookings</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className={s.is_active ? '' : 'inactive'}>
                <td><strong>{s.full_name}</strong>{!s.is_active && <span className="badge grey">inactive</span>}</td>
                <td>{s.email}</td>
                <td>{s.phone || '—'}</td>
                <td><EmpBadge type={s.employment_type} /></td>
                <td>{s.role === 'admin' ? <span className="badge amber">Admin</span> : 'Staff'}</td>
                <td>{s.items_ordered}</td>
                <td>{s.active_reservations}</td>
                {isAdmin && (
                  <td className="actions">
                    <button className="btn small" onClick={() => setEditing({ ...s, is_active: !!s.is_active, password: '' })}>Edit</button>
                    {s.id !== user.id && <button className="btn small danger" onClick={() => remove(s)}>Delete</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal title={editing.id ? `Edit ${editing.full_name}` : 'Add staff member'} onClose={() => setEditing(null)}>
          <StaffForm initial={editing} onDone={() => { setEditing(null); reload(); }} />
        </Modal>
      )}
    </div>
  );
}

function StaffForm({ initial, onDone }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) await api(`/staff/${form.id}`, { method: 'PUT', body: form });
      else await api('/staff', { method: 'POST', body: form });
      onDone();
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>Full name *<input required value={form.full_name} onChange={set('full_name')} /></label>
      <div className="row">
        <label>Email *<input type="email" required value={form.email} onChange={set('email')} /></label>
        <label>Phone<input value={form.phone || ''} onChange={set('phone')} /></label>
      </div>
      <div className="row">
        <label>Employment
          <select value={form.employment_type} onChange={set('employment_type')}>
            <option value="full_time">Full-time</option><option value="part_time">Part-time</option>
          </select>
        </label>
        <label>System role
          <select value={form.role} onChange={set('role')}>
            <option value="staff">Staff</option><option value="admin">Admin</option>
          </select>
        </label>
      </div>
      <label>{form.id ? 'New password (leave blank to keep current)' : 'Password *'}
        <input type="password" minLength={6} required={!form.id} value={form.password} onChange={set('password')} autoComplete="new-password" />
      </label>
      <label className="check"><input type="checkbox" checked={form.is_active} onChange={set('is_active')} /> Account active (can log in)</label>
      <ErrorBox error={error} />
      <button className="btn primary">{form.id ? 'Save changes' : 'Add staff member'}</button>
    </form>
  );
}
