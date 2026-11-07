import { useState } from 'react';
import { addDays, parseISO, toISO, todayISO, overlaps } from '../dates.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4d7c0f'];
export const colorFor = (id) => COLORS[id % COLORS.length];

/**
 * Month grid showing events ({id, start_date, end_date, label, colorKey}).
 * If onSelectRange is given, clicking two days selects a date range.
 * If showFree is set, days without any event are shaded green ("free").
 */
export default function MonthCalendar({ events = [], onSelectRange, selection, showFree, onEventClick }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [pendingStart, setPendingStart] = useState(null);
  const today = todayISO();

  const first = toISO(month);
  const offset = (month.getDay() + 6) % 7; // Monday-first
  const gridStart = addDays(first, -offset);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const click = (day) => {
    if (!onSelectRange || day < today) return;
    if (!pendingStart) { setPendingStart(day); onSelectRange(day, day); }
    else {
      const [s, e] = day < pendingStart ? [day, pendingStart] : [pendingStart, day];
      onSelectRange(s, e);
      setPendingStart(null);
    }
  };

  const shift = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="btn small ghost" onClick={() => shift(-1)}>‹</button>
        <strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button className="btn small ghost" onClick={() => shift(1)}>›</button>
        <button className="btn small ghost" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</button>
      </div>
      {onSelectRange && (
        <p className="muted small-text">
          {pendingStart ? 'Now click the end date.' : 'Click a start date, then an end date to select a reservation period.'}
        </p>
      )}
      <div className="cal-grid">
        {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
        {days.map((day) => {
          const dayEvents = events.filter((e) => overlaps(e.start_date, e.end_date, day, day));
          const inMonth = parseISO(day).getMonth() === month.getMonth();
          const selected = selection?.start && selection?.end && day >= selection.start && day <= selection.end;
          const cls = [
            'cal-day',
            !inMonth && 'out',
            day === today && 'today',
            day < today && 'past',
            selected && 'selected',
            showFree && day >= today && (dayEvents.length ? 'busy' : 'free'),
            onSelectRange && day >= today && 'clickable',
          ].filter(Boolean).join(' ');
          return (
            <div key={day} className={cls} onClick={() => click(day)}>
              <div className="cal-num">{parseISO(day).getDate()}</div>
              {dayEvents.slice(0, 3).map((e) => (
                <div key={e.id} className="cal-event" title={e.title || e.label}
                  style={{ background: colorFor(e.colorKey ?? e.id) }}
                  onClick={(ev) => { if (onEventClick) { ev.stopPropagation(); onEventClick(e); } }}>
                  {e.label}
                </div>
              ))}
              {dayEvents.length > 3 && <div className="muted small-text">+{dayEvents.length - 3} more</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
