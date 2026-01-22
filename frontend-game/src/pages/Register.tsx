import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLine, setShowLine] = useState(false);
  const [showBox, setShowBox] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Sequence: line → box → content
    const timer1 = setTimeout(() => setShowLine(true), 100);
    const timer2 = setTimeout(() => setShowBox(true), 600);
    const timer3 = setTimeout(() => setShowContent(true), 1100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await register({ username, email, password });
      navigate('/loading');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0, 163, 255, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0, 163, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-cyber-500/30 to-transparent animate-scan" />
      </div>

      {/* Register container */}
      <div className="relative w-full max-w-sm">
        {/* Logo/Title */}
        <div className={`text-center mb-8 transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
          <div className="inline-block">
            <h1 className="text-2xl font-bold text-cyber-500 text-glow tracking-wider mb-1">
              HACKER<span className="text-cyber-300">GAME</span>
            </h1>
            <div className="h-px bg-gradient-to-r from-transparent via-cyber-500/50 to-transparent" />
          </div>
        </div>

        {/* Register box - with drawing animation */}
        <div className="relative">
          {/* Top line - draws first */}
          <div className={`absolute top-0 left-0 h-px bg-cyber-500/50 ${showLine ? 'animate-draw-line' : 'w-0 opacity-0'}`} />

          {/* Vertical lines - draw second */}
          <div className={`absolute top-0 left-0 w-px bg-cyber-500/30 ${showBox ? 'animate-draw-vertical' : 'h-0 opacity-0'}`}
            style={{ animationDelay: '0s' }} />
          <div className={`absolute top-0 right-0 w-px bg-cyber-500/30 ${showBox ? 'animate-draw-vertical' : 'h-0 opacity-0'}`}
            style={{ animationDelay: '0.1s' }} />

          {/* Bottom line - draws last */}
          <div className={`absolute bottom-0 left-0 h-px bg-cyber-500/50 ${showBox ? 'animate-draw-line' : 'w-0 opacity-0'}`}
            style={{ animationDelay: '0.2s' }} />

          {/* Corner brackets */}
          <div className={`corner-brackets bg-dark-900/80 backdrop-blur-sm transition-opacity duration-300 ${showBox ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`p-6 transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-cyber-500 animate-pulse-slow" />
                  <span className="text-xs text-cyber-500 tracking-wider">NEW USER REGISTRATION</span>
                </div>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyber-500 animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyber-500/50 animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyber-500/30 animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error message */}
                {error && (
                  <div className="border border-red-500/30 bg-red-500/5 text-red-400 text-xs p-2.5 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {/* Username field */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 tracking-wide">
                    USERNAME
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-dark-800/50 border border-cyber-500/30 focus:border-cyber-500
                        text-sm text-gray-100 px-3 py-2 outline-none transition-all duration-300
                        hover:border-cyber-500/50 focus:shadow-neon-sm"
                      placeholder="h4ck3r"
                      required
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 bg-cyber-500 rounded-full animate-pulse" />
                  </div>
                </div>

                {/* Email field */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 tracking-wide">
                    EMAIL
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-dark-800/50 border border-cyber-500/30 focus:border-cyber-500
                        text-sm text-gray-100 px-3 py-2 outline-none transition-all duration-300
                        hover:border-cyber-500/50 focus:shadow-neon-sm"
                      placeholder="hacker@example.com"
                      required
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 bg-cyber-500 rounded-full animate-pulse" />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 tracking-wide">
                    PASSWORD
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-dark-800/50 border border-cyber-500/30 focus:border-cyber-500
                        text-sm text-gray-100 px-3 py-2 outline-none transition-all duration-300
                        hover:border-cyber-500/50 focus:shadow-neon-sm"
                      placeholder="••••••••"
                      required
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 bg-cyber-500 rounded-full animate-pulse" />
                  </div>
                </div>

                {/* Confirm Password field */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 tracking-wide">
                    CONFIRM PASSWORD
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-dark-800/50 border border-cyber-500/30 focus:border-cyber-500
                        text-sm text-gray-100 px-3 py-2 outline-none transition-all duration-300
                        hover:border-cyber-500/50 focus:shadow-neon-sm"
                      placeholder="••••••••"
                      required
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 bg-cyber-500 rounded-full animate-pulse" />
                  </div>
                </div>

                {/* Register button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-cyber-500/10 border border-cyber-500 text-cyber-500
                    py-2.5 text-sm tracking-wider font-medium
                    hover:bg-cyber-500/20 hover:shadow-neon transition-all duration-300
                    disabled:opacity-50 disabled:cursor-not-allowed
                    relative overflow-hidden group"
                >
                  <span className="relative z-10">
                    {isLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber-500/10 to-transparent
                    -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </button>
              </form>

              {/* Login link */}
              <div className="mt-4 text-center">
                <Link
                  to="/login"
                  className="text-xs text-gray-400 hover:text-cyber-500 transition-colors duration-300"
                >
                  ALREADY REGISTERED? <span className="text-cyber-500">LOGIN</span>
                </Link>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-cyber-500/20">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>SYS.V1.0.0</span>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                    <span>SECURE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom decorative element */}
        <div className={`mt-4 flex justify-center transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex gap-2">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-cyber-500/50" />
            <div className="w-1 h-px bg-cyber-500" />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-cyber-500/50" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
