import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user, computer, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-blue-500">Hacker Terminal</h1>
              <p className="text-sm text-gray-400">Welcome, {user?.username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Info Card */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-blue-400">User Information</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Username:</span>
                <span className="font-mono">{user?.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email:</span>
                <span className="font-mono text-sm">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">User ID:</span>
                <span className="font-mono">{user?.id}</span>
              </div>
            </div>
          </div>

          {/* Computer Info Card */}
          {computer && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-green-400">Your Computer</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Name:</span>
                  <span className="font-mono">{computer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">IP Address:</span>
                  <span className="font-mono text-green-400">{computer.ip}</span>
                </div>
                {computer.credentials && (
                  <>
                    <div className="border-t border-gray-700 my-3 pt-3">
                      <p className="text-xs text-gray-500 mb-2">System Credentials</p>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Username:</span>
                      <span className="font-mono text-sm">{computer.credentials.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Password:</span>
                      <span className="font-mono text-sm text-yellow-400">
                        {computer.credentials.password}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Terminal Placeholder */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-blue-400">Terminal</h2>
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
          </div>

          <div className="bg-black rounded p-4 font-mono text-sm">
            <div className="text-green-400">
              <p>Welcome to Hacker Game Terminal v1.0.0</p>
              <p className="mt-2">Connected to: {computer?.ip || 'localhost'}</p>
              <p className="mt-4 text-gray-500">
                Terminal functionality coming soon...
              </p>
              <p className="mt-2">
                <span className="text-blue-400">{user?.username}@{computer?.name || 'system'}</span>
                <span className="text-white">:~$ </span>
                <span className="animate-pulse">_</span>
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            <strong>Next Steps:</strong> The terminal is under development. Soon you'll be able to run commands,
            hack servers, and explore the network. Stay tuned!
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
