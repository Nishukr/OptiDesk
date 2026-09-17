// src/App.jsx — routes
//
// Two guards, because there are two sign-ins:
//   <CustomerRoute> → Clerk session   → "/" and /tickets/:id
//   <ProtectedRoute> → custom JWT     → everything under /admin
// The URL split mirrors the API's (/api/admin/* is JWT, the rest is Clerk), which
// is what lets the axios interceptor pick a credential from the path alone.
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import CustomerRoute from './components/CustomerRoute';
import { CustomerSignIn, CustomerSignUp, CustomerAuthUnavailable } from './pages/CustomerAuth';
import AdminLogin from './pages/AdminLogin';
import AdminRegister from './pages/AdminRegister';
import VerifyNotice from './pages/VerifyNotice';
import VerifyEmail from './pages/VerifyEmail';
import Tickets from './pages/Tickets';
import TicketChat from './pages/TicketChat';
import AdminDashboard from './pages/AdminDashboard';
import AdminTicketDetail from './pages/AdminTicketDetail';
import AdminCustomers from './pages/AdminCustomers';
import AdminCustomerDetail from './pages/AdminCustomerDetail';
import { clerkEnabled } from './clerk';

// Everything under /admin is staff-only; the server enforces this too.
const Staff = ({ children }) => (
  <ProtectedRoute roles={['agent', 'admin']}>{children}</ProtectedRoute>
);

// Clerk's widgets throw without a <ClerkProvider>, and the provider is only
// mounted when the publishable key is present. Resolved once, at module scope.
const SignInPage = clerkEnabled ? CustomerSignIn : CustomerAuthUnavailable;
const SignUpPage = clerkEnabled ? CustomerSignUp : CustomerAuthUnavailable;

// The auth screens carry their own OptiDesk branding panel, so the app navbar
// would only repeat it. Prefix-matched, not exact: Clerk owns sub-paths of /login
// and /signup (SSO callback, 2FA, password reset) and they are all bare too.
const BARE_PREFIXES = [
  '/login',
  '/signup',
  '/admin/login',
  '/admin/register',
  '/verify',
  '/verify-email',
  '/verify-notice',
];

export default function App() {
  const { pathname } = useLocation();
  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    <>
      {!bare && <Navbar />}
      <Routes>
        {/* Customers — Clerk. The splat is required: routing="path" makes Clerk
            navigate to /login/factor-one, /login/sso-callback and similar. */}
        <Route path="/login/*" element={<SignInPage />} />
        <Route path="/signup/*" element={<SignUpPage />} />

        {/* Staff — custom JWT. Unchanged mechanism, new addresses. */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/register" element={<AdminRegister />} />
        <Route path="/verify-notice" element={<VerifyNotice />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify" element={<VerifyEmail />} />{/* older emails */}

        <Route path="/" element={<CustomerRoute><Tickets /></CustomerRoute>} />
        <Route path="/tickets/:id" element={<CustomerRoute><TicketChat /></CustomerRoute>} />

        <Route path="/admin" element={<Staff><AdminDashboard /></Staff>} />
        <Route path="/admin/tickets/:id" element={<Staff><AdminTicketDetail /></Staff>} />
        <Route path="/admin/customers" element={<Staff><AdminCustomers /></Staff>} />
        <Route path="/admin/customers/:id" element={<Staff><AdminCustomerDetail /></Staff>} />

        {/* /register was the old shared sign-up; keep the address working. */}
        <Route path="/register" element={<Navigate to="/signup" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
