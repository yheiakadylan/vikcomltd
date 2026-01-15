import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';

import NotFound from './pages/NotFound';
import { Spin, App as AntdApp } from 'antd';
import { UploadProvider } from './contexts/UploadContext';
import { LanguageProvider } from './contexts/LanguageContext';
import UploadWidget from './components/common/UploadWidget';

// Component bảo vệ Route
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, appUser, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center"><Spin size="large" tip="Đang tải..." /></div>;

  // 1. Chưa login -> Đá về Login
  if (!user) return <Navigate to="/login" replace />;

  // 2. Login rồi nhưng không đúng quyền
  if (allowedRoles && (!appUser || !allowedRoles.includes(appUser.role))) {
    // Smart Redirect Strategy based on Role
    // If user is IDEA role -> Send to Idea board
    if (appUser?.role === 'IDEA') {
      return <Navigate to="/board/idea" replace />;
    }
    // If user is CS role -> Send to Fulfill board
    if (appUser?.role === 'CS') {
      return <Navigate to="/board/fulfill" replace />;
    }

    // Default Fallback (DS/Admin or others) -> Fulfill
    return <Navigate to="/board/fulfill" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />


        <Route path="/" element={<Navigate to="/board/fulfill" replace />} />

        {/* Fulfill Board - ADMIN, CS, DS */}
        <Route path="/board/fulfill" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'CS', 'DS']}>
            <Dashboard mode="fulfill" />
          </ProtectedRoute>
        } />
        <Route path="/board/fulfill/:status" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'CS', 'DS']}>
            <Dashboard mode="fulfill" />
          </ProtectedRoute>
        } />

        {/* Ideas Board - ADMIN, DS, IDEA */}
        {/* Note: Collection name is 'ideas', but route is singular 'idea' per request */}
        <Route path="/board/idea" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'DS', 'IDEA']}>
            <Dashboard mode="idea" />
          </ProtectedRoute>
        } />
        <Route path="/board/idea/:status" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'DS', 'IDEA']}>
            <Dashboard mode="idea" />
          </ProtectedRoute>
        } />

        {/* Legacy Support */}
        <Route path="/:status" element={<Navigate to="/board/fulfill" replace />} />

        {/* Route chỉ cho Admin và CS */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'CS']}>
            <Admin />
          </ProtectedRoute>
        } />

        {/* 404 Page */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <UploadProvider>
          <AntdApp>
            <Router>
              <AppRoutes />
              <UploadWidget />
            </Router>
          </AntdApp>
        </UploadProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;