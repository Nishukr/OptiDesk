// src/App.jsx — routes
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Tickets from './pages/Tickets';
import TicketChat from './pages/TicketChat';
import AdminDashboard from './pages/AdminDashboard';
import AdminTicketDetail from './pages/AdminTicketDetail';
import AdminCustomers from './pages/AdminCustomers';
import AdminCustomerDetail from './pages/AdminCustomerDetail';

// Everything under /admin is staff-only; the server enforces this too.
const Staff = ({ children }) => (
  <ProtectedRoute roles={['agent', 'admin']}>{children}</ProtectedRoute>
);

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
        <Route path="/tickets/:id" element={<ProtectedRoute><TicketChat /></ProtectedRoute>} />

        <Route path="/admin" element={<Staff><AdminDashboard /></Staff>} />
        <Route path="/admin/tickets/:id" element={<Staff><AdminTicketDetail /></Staff>} />
        <Route path="/admin/customers" element={<Staff><AdminCustomers /></Staff>} />
        <Route path="/admin/customers/:id" element={<Staff><AdminCustomerDetail /></Staff>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
