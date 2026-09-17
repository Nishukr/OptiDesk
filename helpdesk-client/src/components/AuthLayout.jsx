// src/components/AuthLayout.jsx — shared split-screen frame for Login / Register.
// The left panel is pure branding; the right panel holds whatever form is passed in.
import { Link } from 'react-router-dom';

const POINTS = [
  'AI answers grounded in your own knowledge base',
  'Automatic category, priority and sentiment triage',
  'Live ticket board so nothing gets missed',
];

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <Link to="/" className="brand">
          <span className="brand-mark lg" aria-hidden="true">⚡</span>
          OptiDesk
        </Link>

        <div>
          <h1>Support that solves itself.</h1>
          <p className="lede">
            OptiDesk triages every incoming ticket and answers the easy ones instantly, so your team
            only handles what really needs a human.
          </p>
        </div>

        <ul className="auth-points">
          {POINTS.map((p) => (
            <li key={p}>
              <span className="tick" aria-hidden="true">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}
