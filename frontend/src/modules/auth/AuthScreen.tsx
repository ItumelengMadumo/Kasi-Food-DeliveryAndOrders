import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../state/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { Role } from '../../types';
import {
  confirmRegistration,
  normalizePhoneNumber,
  registerWithCognito,
  resendRegistrationCode,
  signInWithCognito,
} from '../../services/cognitoAuth';

type AuthMode = 'login' | 'register' | 'confirm';

export function AuthScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setUser, isAuthenticated, user } = useAuthStore();
  const requestedMode = searchParams.get('mode');
  const initialMode: AuthMode =
    requestedMode === 'register' || requestedMode === 'login'
      ? requestedMode
      : 'login';

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');

  useEffect(() => {
    if (requestedMode === 'register' || requestedMode === 'login') {
      setMode(requestedMode);
    }
  }, [requestedMode]);

  const destinationByRole: Record<Role, string> = {
    CUSTOMER: '/',
    VENDOR: '/vendor/dashboard',
    ADMIN: '/admin',
  };

  if (isAuthenticated && user) {
    const returnPath = destinationByRole[user.role] || '/';

    return (
      <div className="max-w-sm mx-auto px-4 py-10 text-center">
        <div className="text-6xl mb-4">👤</div>
        <h2 className="text-xl font-bold mb-2">Hi, {user.name || user.phone}</h2>
        <p className="text-stone-500 text-sm mb-2">Role: {user.role}</p>
        <p className="text-stone-400 text-xs mb-6">Phone: {user.phone}</p>
        <div className="space-y-3">
          {user.role === 'VENDOR' && (
            <Button className="w-full" onClick={() => navigate('/vendor/dashboard')}>
              Go to My Shop
            </Button>
          )}
          {user.role === 'ADMIN' && (
            <Button className="w-full" onClick={() => navigate('/admin')}>
              Admin Dashboard
            </Button>
          )}
          <Button variant="secondary" className="w-full" onClick={() => navigate(returnPath)}>
            {user.role === 'VENDOR' ? 'Open Vendor Dashboard' : 'Continue'}
          </Button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const assignedRole: Role =
        (import.meta.env.VITE_DEFAULT_SIGNIN_ROLE?.toUpperCase() as Role) || 'VENDOR';
      const nextPath = destinationByRole[assignedRole];

      if (mode === 'confirm') {
        await confirmRegistration(phone, confirmationCode);
        const authenticatedUser = await signInWithCognito(phone, password);
        setUser({ ...authenticatedUser, role: assignedRole });
        navigate(nextPath);
        return;
      }

      if (mode === 'login') {
        const authenticatedUser = await signInWithCognito(phone, password);
        setUser(authenticatedUser);
        navigate(destinationByRole[authenticatedUser.role]);
        return;
      }

      const normalizedPhone = normalizePhoneNumber(phone);
      const result = await registerWithCognito({
        name,
        phone: normalizedPhone,
        email,
        password,
      });

      if (result.isSignUpComplete) {
        const authenticatedUser = await signInWithCognito(normalizedPhone, password);
        setUser({ ...authenticatedUser, role: assignedRole });
        navigate(nextPath);
        return;
      }

      setPhone(normalizedPhone);
      setMode('confirm');
      setInfo(`Verification code sent to ${normalizedPhone}. Enter it below to finish setup.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍔</div>
          <h1 className="text-2xl font-bold text-stone-900">Kasi Eats</h1>
          <p className="text-stone-500 text-sm mt-1">
            Vendor access for orders, menus, and business settings
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-stone-100 rounded-xl p-1 mb-6">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError('');
                setInfo('');
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  if (m === 'login') next.delete('mode');
                  else next.set('mode', m);
                  next.set('role', 'vendor');
                  return next;
                });
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors capitalize ${
                mode === m ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'
              }`}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-stone-200 p-6 space-y-4 shadow-sm">
          {mode === 'register' && (
            <Input
              label="Full Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Thandi Dlamini"
              required
            />
          )}

          <Input
            label="Phone Number *"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +27 71 234 5678"
            hint="Cognito phone_number expects international format."
            required
            disabled={mode === 'confirm'}
          />

          {mode === 'register' && (
            <Input
              label="Email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. thandi@example.com"
            />
          )}

          <Input
            label="Password *"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={mode === 'confirm'}
          />

          {mode === 'confirm' && (
            <Input
              label="Verification Code *"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              placeholder="Enter the code from SMS or email"
              required
            />
          )}

          {info && <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">{info}</p>}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {mode === 'login'
              ? 'Sign In to Vendor Dashboard'
              : mode === 'register'
              ? 'Create Vendor Account'
              : 'Verify and Continue'}
          </Button>

          {mode === 'confirm' && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={async () => {
                setError('');
                setInfo('');
                setLoading(true);
                try {
                  await resendRegistrationCode(phone);
                  setInfo(`A new verification code was sent to ${phone}.`);
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : 'Could not resend code';
                  setError(msg);
                } finally {
                  setLoading(false);
                }
              }}
            >
              Resend Verification Code
            </Button>
          )}
        </form>

        {/* Vendor apply */}
        <p className="text-center text-sm text-stone-500 mt-6">
          Are you a vendor?{' '}
          <button
            onClick={() => navigate('/vendor/apply')}
            className="text-kasi-orange font-semibold hover:underline"
          >
            Apply to join
          </button>
        </p>
      </div>
    </div>
  );
}
