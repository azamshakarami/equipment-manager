import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorBox } from './common.jsx';

/** Admin form for creating / editing an item. */
export default function ItemForm({ item, onDone }) {
  const [lookups, setLookups] = useState({ staff: [], locations: [], courseUnits: [], categories: [] });
  const [form, setForm] = useState(() => ({
    name: '', category: 'Robot', model: '', serial_number: '', description: '', location_id: '',
    ordered_by: '', order_date: '', supplier: '', cost: '', item_condition: 'working',
    ...(item || {}),
    course_unit_ids: item?.course_units?.map((c) => c.id) || [],
  }));
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/staff'), api('/locations'), api('/course-units'), api('/items/categories')])
      .then(([staff, locations, courseUnits, categories]) => setLookups({ staff, locations, courseUnits, categories }))
      .catch((e) => setError(e.message));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleCu = (id) => setForm({
    ...form,
    course_unit_ids: form.course_unit_ids.includes(id) ? form.course_unit_ids.filter((x) => x !== id) : [...form.course_unit_ids, id],
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (item) await api(`/items/${item.id}`, { method: 'PUT', body: form });
      else await api('/items', { method: 'POST', body: form });
      onDone();
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="row">
        <label>Name *<input required value={form.name} onChange={set('name')} /></label>
        <label>Category
          <input list="cats" value={form.category} onChange={set('category')} />
          <datalist id="cats">{lookups.categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
      </div>
      <div className="row">
        <label>Model<input value={form.model || ''} onChange={set('model')} /></label>
        <label>Serial number<input value={form.serial_number || ''} onChange={set('serial_number')} /></label>
      </div>
      <label>Description<textarea rows={2} value={form.description || ''} onChange={set('description')} /></label>
      <div className="row">
        <label>Storage location
          <select value={form.location_id || ''} onChange={set('location_id')}>
            <option value="">— not set —</option>
            {lookups.locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.room ? ` (${l.room})` : ''}</option>)}
          </select>
        </label>
        <label>Condition
          <select value={form.item_condition} onChange={set('item_condition')}>
            <option value="working">Working</option>
            <option value="maintenance">Under maintenance</option>
            <option value="retired">Retired</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label>Ordered by
          <select value={form.ordered_by || ''} onChange={set('ordered_by')}>
            <option value="">— not set —</option>
            {lookups.staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.employment_type === 'full_time' ? 'Full-time' : 'Part-time'})</option>)}
          </select>
        </label>
        <label>Order date<input type="date" value={form.order_date || ''} onChange={set('order_date')} /></label>
      </div>
      <div className="row">
        <label>Supplier<input value={form.supplier || ''} onChange={set('supplier')} /></label>
        <label>Cost<input type="number" step="0.01" min="0" value={form.cost ?? ''} onChange={set('cost')} /></label>
      </div>
      <fieldset>
        <legend>Used for course units</legend>
        <div className="checks">
          {lookups.courseUnits.map((c) => (
            <label key={c.id} className="check">
              <input type="checkbox" checked={form.course_unit_ids.includes(c.id)} onChange={() => toggleCu(c.id)} />
              {c.code} – {c.name}
            </label>
          ))}
          {!lookups.courseUnits.length && <span className="muted">No course units yet — add them under “Locations &amp; courses”.</span>}
        </div>
      </fieldset>
      <ErrorBox error={error} />
      <button className="btn primary">{item ? 'Save changes' : 'Add item'}</button>
    </form>
  );
}
