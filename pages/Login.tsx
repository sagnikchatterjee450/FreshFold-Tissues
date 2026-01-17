import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const uid = userid.trim();
    const pwd = password;
    if (uid === 'freshfoldadmin' && pwd === 'Freshfold2026') {
      localStorage.setItem('craftline_auth', '1');
      onLogin();
      navigate('/', { replace: true });
    } else {
      setError('Invalid credentials. Use userid: freshfoldadmin and password: Freshfold2026');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold mb-4">Sign in</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">User ID</label>
            <input
              value={userid}
              onChange={(e) => setUserid(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              placeholder="Enter userid"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              placeholder="Enter password"
            />
          </div>

          <div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-md">Sign in</button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default Login;
