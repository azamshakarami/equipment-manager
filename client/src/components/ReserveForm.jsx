import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { addDays, daysBetween, fmt, overlaps, todayISO } from '../dates.js';
import { ErrorBox } from './common.jsx';

/**
 * Reservation form. `item` should include `reservations` (for a live clash check)
 * and `course_units` (to suggest course units the item is used for).
 */
export default function ReserveForm({ item, start, end, onRangeChange, onDone, existing }) {
  const { isAdmin, user } = useAuth();
  const [courseUnits, setCourseUnits] = useState([]);
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({
    course_unit_id: existing?.course_unit_id || item.course_units?.[0]?.id || '',
    purpose: existing?.purpose || '',
    staff_id: existing?.staff_id || user.id,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/course-units').then(setCourseUnits).catch(() => {});
    if (isAdmin && !existing) api('/staff').then((s) => setStaff(s.filter((x) => x.is_active))).catch(() => {});
  }, [isAdmin, existing]);

  const clashes = (item.reservations || []).filter(
    (r) => r.status === 'active' && r.id !== existing?.id && start && end && overlaps(r.start_date, r.end_date, start, end));
  const blocked = item.item_condition !== 'working';

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { item_id: item.id, start_date: start, end_date: end, ...form };
      if (existing) await api(`/reservations/${existing.id}`, { method: 'PUT', body });
      else await api('/reservations', { method: 'POST', body });
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const minStart = existing && existing.start_date < todayISO() ? existing.start_date : todayISO();

  return (
    <form onSubmit={submit} className="form">
      {blocked && <div className="alert warn">This item is marked “{item.item_condition}” and cannot be reserved.</div>}
      <div className="row">
        <label>Start date
          <input type="date" required value={start || ''} min={minStart}
            disabled={existing && existing.start_date < todayISO()}
            onChange={(e) => onRangeChange(e.target.value, end && end < e.target.value ? e.target.value : end)} />
        </label>
        <label>End date
          <input type="date" required value={end || ''} min={start || todayISO()} onChange={(e) => onRangeChange(start, e.target.value)} />
        </label>
      </div>
      <div className="quick-range">
        Quick period:
        {[[7, '1 week'], [30, '1 month'], [90, '3 months'], [120, 'Semester (~4 mo)']].map(([n, l]) => (
          <button type="button" key={n} className="btn small ghost" onClick={() => onRangeChange(start || todayISO(), addDays(start || todayISO(), n - 1))}>{l}</button>
        ))}
      </div>
      {start && end && (
        <div className={`alert ${clashes.length ? 'error' : 'ok'}`}>
          {clashes.length
            ? <>Not available — clashes with: {clashes.map((c) => `${fmt(c.start_date)} – ${fmt(c.end_date)} (${c.staff_name})`).join('; ')}</>
            : <>✓ Available for {daysBetween(start, end) + 1} day(s): {fmt(start)} – {fmt(end)}</>}
        </div>
      )}
      {isAdmin && !existing && (
        <label>Reserve for staff member
          <select value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.employment_type === 'full_time' ? 'FT' : 'PT'})</option>)}
          </select>
        </label>
      )}
      <label>Course unit
        <select value={form.course_unit_id} onChange={(e) => setForm({ ...form, course_unit_id: e.target.value })}>
          <option value="">— none / research —</option>
          {courseUnits.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
        </select>
      </label>
      <label>Purpose / notes
        <input value={form.purpose} maxLength={255} placeholder="e.g. Weekly lab sessions"
          onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
      </label>
      <ErrorBox error={error} />
      <button className="btn primary" disabled={saving || blocked || !start || !end || clashes.length > 0}>
        {saving ? 'Saving…' : existing ? 'Save changes' : 'Reserve'}
      </button>
    </form>
  );
}
