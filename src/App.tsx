/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import AdminLogin from './pages/AdminLogin';
import AdminSettings from './pages/AdminSettings';
import { useState, useEffect } from 'react';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAdmin(true);
    }
  }, []);

  const handleLogin = () => setIsAdmin(true);
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAdmin(false);
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout isAdmin={isAdmin} onLogout={handleLogout} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="map" element={<MapPage />} />
          <Route path="admin" element={isAdmin ? <AdminSettings /> : <AdminLogin onLogin={handleLogin} />} />
        </Route>
      </Routes>
    </Router>
  );
}
