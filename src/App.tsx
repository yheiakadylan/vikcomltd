import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import AuthCallback from './pages/AuthCallback';
import { Spin, App as AntdApp } from 'antd';

// Component bảo vệ Route
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, appUser, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center"><Spin size="large" tip="Đang tải..." /></div>;

  // 1. Chưa login -> Đá về Login
  if (!user) return <Navigate to="/login" replace />;

  // 2. Login rồi nhưng không đúng quyền -> Đá về Dashboard (hoặc trang 403)
  if (allowedRoles && (!appUser || !allowedRoles.includes(appUser.role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/dropbox/callback" element={<AuthCallback />} />

        {/* Route cho mọi người (CS/DS/Admin) */}
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/:status" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* Route chỉ cho Admin và CS */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'CS']}>
            <Admin />
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AntdApp>
        <Router>
          <AppRoutes />
        </Router>
      </AntdApp>
    </AuthProvider>
  );
}

export default App;