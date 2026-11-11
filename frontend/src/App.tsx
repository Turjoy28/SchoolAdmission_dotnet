import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStudentId } from './hooks/useStudentId';
import { Navbar } from './components/Navbar';
import { StudentIdBar } from './components/StudentIdBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ClassListPage } from './pages/ClassListPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { HoldPage } from './pages/HoldPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';

// Standard QueryClient with safe defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  const studentHook = useStudentId();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Sticky Unified Top Header */}
        <header className="app-header">
          <div className="header-inner">
            <Navbar />
            <StudentIdBar studentHook={studentHook} />
          </div>
        </header>

        {/* Main Application Content */}
        <main>
          <ErrorBoundary>
            <Routes>
              <Route
                path="/"
                element={<ClassListPage savedStudentId={studentHook.savedId} />}
              />
              <Route path="/admin" element={<CreateClassPage />} />
              <Route
                path="/holds/:holdId"
                element={<HoldPage savedStudentId={studentHook.savedId} />}
              />
              <Route
                path="/my-applications"
                element={<MyApplicationsPage savedStudentId={studentHook.savedId} />}
              />
              {/* Catch-all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
