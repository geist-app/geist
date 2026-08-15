import { useState, useEffect, FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import PasswordInput from '../components/PasswordInput';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Same validation as registration.
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      // Send the user to the login page after a short confirmation.
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      setError(axiosError.response?.data?.error || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-form-container">
      <style>{`
        .auth-form-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .auth-form-card {
          width: 100%;
          max-width: 400px;
          background: var(--surface);
          border-radius: 1rem;
          box-shadow: var(--shadow-lg);
          padding: 2rem;
        }
        .auth-form-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .auth-form-logo {
          width: 64px;
          height: 64px;
          margin-bottom: 0.5rem;
        }
        .auth-form-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text);
        }
        .auth-form-subtitle {
          color: var(--text-muted);
          margin-top: 0.25rem;
        }
        .auth-form-footer {
          text-align: center;
          margin-top: 1.5rem;
          color: var(--text-muted);
        }
        .auth-form-footer a {
          font-weight: 500;
        }
        .auth-theme-toggle {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.5rem;
          cursor: pointer;
          font-size: 1.25rem;
          line-height: 1;
          transition: all 0.2s;
        }
        .auth-theme-toggle:hover {
          border-color: var(--primary);
        }
      `}</style>

      <button
        className="auth-theme-toggle"
        onClick={toggleTheme}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <div className="auth-form-card">
        <div className="auth-form-header">
          <img src="/icon.svg" alt="Geist" className="auth-form-logo" />
          <h1 className="auth-form-title">Geist</h1>
          <p className="auth-form-subtitle">Set a new password</p>
        </div>

        {!token ? (
          <>
            <div className="alert alert-error">
              This reset link is invalid or incomplete.
            </div>
            <div className="auth-form-footer">
              <Link to="/login">Back to sign in</Link>
            </div>
          </>
        ) : success ? (
          <>
            <div className="alert alert-success">
              Your password has been reset. Redirecting to sign in…
            </div>
            <div className="auth-form-footer">
              <Link to="/login">Go to sign in</Link>
            </div>
          </>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={isLoading}
              >
                {isLoading ? <span className="spinner" /> : 'Reset Password'}
              </button>
            </form>

            <div className="auth-form-footer">
              <Link to="/login">Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
