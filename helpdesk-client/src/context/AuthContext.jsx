// src/context/AuthContext.jsx — holds the signed-in STAFF user + auth actions.
//
// Agents and admins only. Customers are signed in by Clerk and their local record
// comes from CustomerContext; nothing here reads or writes a Clerk session, and
// the token below is the custom JWT from POST /api/auth/login.
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

// POST /auth/login answers { id, ... } while GET /auth/me answers a Mongoose
// document, i.e. { _id, ... }. Anything comparing the signed-in user against a
// record's owner needs one shape, or the check silently fails after a reload.
const normalize = (u) => (u ? { ...u, id: String(u.id || u._id) } : null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // on first load, if we have a token, fetch the current user
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(normalize(res.data)))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    const me = normalize(res.data.user);
    setUser(me);
    return me;
  };

  // Staff only — the server refuses role "customer" here and points at Clerk, so
  // `role` is effectively always "admin" and needs the code it checks against
  // ADMIN_SIGNUP_CODE.
  //
  // We deliberately do NOT log in afterwards: the new account is unverified, so
  // /auth/login would answer 403 anyway. The caller gets { needsVerification,
  // emailSent } and sends the person to the "check your inbox" screen.
  const register = async (name, email, password, role = 'admin', adminCode) => {
    const res = await api.post('/auth/register', { name, email, password, role, adminCode });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
