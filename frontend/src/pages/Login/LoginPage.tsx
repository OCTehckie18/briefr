import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAPI } from '../../api/auth';
import { useAuth } from '../../store/AuthContext';
import { Loader2 } from 'lucide-react';

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
      setError(err.response?.data?.detail || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050510] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-600/[0.08] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-cyan-500/[0.06] rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[400px] p-8 rounded-2xl space-y-8 bg-white/[0.03] border border-white/[0.06] backdrop-blur-md shadow-2xl shadow-black/50 relative z-10">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/25">
            B
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Log in to Briefr</h1>
            <p className="text-sm text-slate-400 mt-1.5">Enter your details to access your dashboard</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required
              className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.03] border border-white/[0.06] text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.05] transition-all placeholder:text-slate-600"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
              className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.03] border border-white/[0.06] text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.05] transition-all placeholder:text-slate-600"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
