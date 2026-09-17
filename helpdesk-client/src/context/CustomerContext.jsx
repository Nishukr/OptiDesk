// src/context/CustomerContext.jsx — the signed-in customer's LOCAL record.
//
// Clerk knows who the customer is; it does not know their Mongo _id, and the _id
// is what ownership is expressed in everywhere else in this app (Ticket.user is an
// ObjectId ref). Without this, a customer's own ticket page cannot answer "is this
// mine?" — which is the difference between seeing the Yes/No confirm buttons and
// seeing the staff read-only panel.
//
// So: one GET /api/me per session, cached here. The server creates the local row
// on first request if the webhook has not delivered user.created yet, so this
// doubles as the just-in-time provisioning call.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import api from '../api/axios';
import { clerkEnabled } from '../clerk';

const EMPTY = { profile: null, loading: false, ready: true, error: '', refresh: () => {} };

const CustomerContext = createContext(EMPTY);

/** `{ profile, loading, ready, error, refresh }`. `profile.id` is the Mongo _id. */
export const useCustomer = () => useContext(CustomerContext);

function ClerkCustomerProvider({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  // Starts true so no consumer can read `profile === null` as "not the owner"
  // during the first paint. Only `ready` says the answer is trustworthy.
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/me');
      setProfile(data);
    } catch (err) {
      setProfile(null);
      setError(err.response?.data?.error || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return; // Clerk has not decided yet; keep loading
    if (!isSignedIn) {
      setProfile(null);
      setError('');
      setLoading(false);
      return;
    }
    load();
  }, [isLoaded, isSignedIn, load]);

  const value = { profile, loading, ready: isLoaded && !loading, error, refresh: load };
  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

// No publishable key → no customer can be signed in, so there is nothing to fetch.
// This variant exists so the Clerk hooks above are never called on a page that has
// no ClerkProvider above it, which would throw.
function DisabledCustomerProvider({ children }) {
  return <CustomerContext.Provider value={EMPTY}>{children}</CustomerContext.Provider>;
}

// Chosen once, at module scope: the set of hooks React sees must not change
// between renders.
export const CustomerProvider = clerkEnabled ? ClerkCustomerProvider : DisabledCustomerProvider;
