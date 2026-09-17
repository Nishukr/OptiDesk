// src/components/PasswordField.jsx — password input with a show/hide toggle
import { useState } from 'react';

export default function PasswordField({ id, value, onChange, autoComplete, minLength, placeholder }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="pw-wrap">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        required
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-label={shown ? 'Hide password' : 'Show password'}
      >
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
