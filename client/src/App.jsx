import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Items from './pages/Items.jsx';
import ItemDetail from './pages/ItemDetail.jsx';
import Availability from './pages/Availability.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import MyReservations from './pages/MyReservations.jsx';
import Staff from './pages/Staff.jsx';
import Settings from './pages/Settings.jsx';

function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">🛠️ Equipment<br /><small>Computing Department</small></div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/items">Equipment</NavLink>
          <NavLink to="/availability">Availability planner</NavLink>
          <NavLink to="/calendar">Calendar</NavLink>
          <NavLink to="/my-reservations">My reservations</NavLink>
          <NavLink to="/staff">Staff</NavLink>
          {isAdmin && <NavLink to="/settings">Locations &amp; courses</NavLink>}
        </nav>
        <div className="user-box">
          <div><strong>{user.full_name}</strong></div>
          <div className="muted">{user.role === 'admin' ? 'Administrator' : 'Staff'} · {user.employment_type === 'full_time' ? 'Full-time' : 'Part-time'}</div>
          <button className="btn small ghost" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/items" element={<Items />} />
        <Route path="/items/:id" element={<ItemDetail />} />
        <Route path="/availability" element={<Availability />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/my-reservations" element={<MyReservations />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
