import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { loginAPI } from '../../api/auth';
import { useAuth } from '../../store/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await loginAPI({ email, password });
      login(res.data.user, res.data.access_token, res.data.refresh_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080b12] p-4 sm:p-6">
      <div className="grid w-full max-w-[1200px] overflow-hidden rounded-xl border border-slate-800 bg-[#0d111a] shadow-2xl shadow-black/30 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-[560px] flex-col justify-between border-b border-slate-800 bg-[#111827] p-10 sm:p-14 lg:border-b-0 lg:border-r">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500 text-xl font-semibold text-slate-950">
              B
            </div>

            <h1 className="mt-7 text-[38px] font-semibold tracking-tight text-white">
              Turn meetings into clear action items.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-400">
              Briefr helps your team capture transcript insights, assign work, and move projects forward.
            </p>
          </div>

          <div className="mt-10 space-y-3 text-base text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">• Capture transcript summaries fast</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">• Review AI-extracted tasks</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">• Track work in Kanban and calendar view</div>
          </div>
        </div>

        <div className="flex items-center justify-center p-10 sm:p-14">
          <div className="w-full max-w-lg">
            <h2 className="text-[32px] font-semibold tracking-tight text-white">Sign in</h2>
            <p className="mt-3 text-base text-slate-400">Use your workspace credentials to continue</p>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="ui-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                  className="ui-input"
                />
              </div>

              <div>
                <label className="ui-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="ui-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 text-sm font-semibold text-white transition hover:from-indigo-400 hover:to-cyan-400 disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
