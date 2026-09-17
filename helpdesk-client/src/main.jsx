// src/main.jsx
//
// Provider order is load-bearing:
//   BrowserRouter    — ClerkGate needs useNavigate for Clerk's multi-step flows
//     ClerkGate      — <ClerkProvider> + the Clerk→axios token bridge (customers)
//       AuthProvider — the staff JWT context, untouched by Clerk (admins/agents)
//         CustomerProvider — GET /api/me, so the UI knows the customer's Mongo _id
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ClerkGate from './components/ClerkGate.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CustomerProvider } from './context/CustomerContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ClerkGate>
        <AuthProvider>
          <CustomerProvider>
            <App />
          </CustomerProvider>
        </AuthProvider>
      </ClerkGate>
    </BrowserRouter>
  </React.StrictMode>
);
