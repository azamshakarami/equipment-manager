import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../components/common.jsx';
import MonthCalendar from '../components/MonthCalendar.jsx';
import { fmt } from '../dates.js';

export default function CalendarPage() {
  const nav = useNavigate();
  const [itemId, setItemId] = useState('');
  const [items] = useLoad(() => api('/items'));
  const [reservations] = useLoad(() => api(`/reservations${itemId ? `?item_id=${itemId}` : ''}`), [itemId]);

  const events = (reservations || []).map((r) => ({
    id: r.id, item_id: r.item_id, colorKey: r.item_id, start_date: r.start_date, end_date: r.end_date,
    label: itemId ? r.staff_name : r.item_name,
    title: `${r.item_name} — ${r.staff_name}${r.course_code ? ` (${r.course_code})` : ''}: ${fmt(r.start_date)} – ${fmt(r.end_date)}`,
  }));

  return (
    <div>
      <div className="page-head">
        <h2>Reservation calendar</h2>
        <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">All equipment</option>
          {(items || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div className="card">
        <MonthCalendar events={events} showFree={!!itemId} onEventClick={(e) => nav(`/items/${e.item_id}`)} />
      </div>
    </div>
  );
}
