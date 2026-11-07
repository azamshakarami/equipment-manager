import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useLoad, ErrorBox } from '../components/common.jsx';

/** Admin management of storage locations and course units. */
export default function Settings() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" />;
  return (
    <div>
      <h2>Locations &amp; course units</h2>
      <div className="grid2">
        <Crud title="Storage locations" path="/locations"
          fields={[['name', 'Name *'], ['building', 'Building'], ['room', 'Room'], ['description', 'Notes']]} />
        <Crud title="Course units" path="/course-units" fields={[['code', 'Code *'], ['name', 'Name *']]} />
      </div>
    </div>
  );
}

function Crud({ title, path, fields }) {
  const blank = Object.fromEntries(fields.map(([k]) => [k, '']));
  const [rows, reload] = useLoad(() => api(path));
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    try {
      if (form.id) await api(`${path}/${form.id}`, { method: 'PUT', body: form });
      else await api(path, { method: 'POST', body: form });
      setForm(blank); setError(''); reload();
    } catch (err) { setError(err.message); }
  };
  const remove = async (r) => {
    if (!confirm(`Delete "${r.name || r.code}"? (${r.item_count} item(s) linked)`)) return;
    try { await api(`${path}/${r.id}`, { method: 'DELETE' }); reload(); } catch (err) { alert(err.message); }
  };

  return (
    <section className="card">
      <h3>{title}</h3>
      <table>
        <thead><tr>{fields.map(([k, l]) => <th key={k}>{l.replace(' *', '')}</th>)}<th>Items</th><th></th></tr></thead>
        <tbody>
          {(rows || []).map((r) => (
            <tr key={r.id}>
              {fields.map(([k]) => <td key={k}>{r[k] || '—'}</td>)}
              <td>{r.item_count}</td>
              <td className="actions">
                <button className="btn small" onClick={() => setForm(Object.fromEntries([['id', r.id], ...fields.map(([k]) => [k, r[k] || ''])]))}>Edit</button>
                <button className="btn small danger" onClick={() => remove(r)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="form inline-form" onSubmit={save}>
        <h4>{form.id ? 'Edit' : 'Add new'}</h4>
        {fields.map(([k, l]) => (
          <label key={k}>{l}<input value={form[k]} required={l.endsWith('*')} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
        ))}
        <ErrorBox error={error} />
        <div className="actions">
          <button className="btn primary">{form.id ? 'Save' : 'Add'}</button>
          {form.id && <button type="button" className="btn ghost" onClick={() => setForm(blank)}>Cancel</button>}
        </div>
      </form>
    </section>
  );
}
