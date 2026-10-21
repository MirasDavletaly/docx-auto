/**
 * Маршруты.
 *
 * Каждый раздел грузится лениво: разделов будет одиннадцать, и загружать их
 * все при входе — значит заставлять кадровика ждать код юридического отдела,
 * который он не откроет (CLAUDE.md, п. 6).
 */
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/app/layout/AppLayout';
import { RequireCompany, RequireSession } from '@/app/guards/RequireSession';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const ChooseCompanyPage = lazy(() => import('@/features/auth/ChooseCompanyPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const CatalogPage = lazy(() => import('@/features/catalog/CatalogPage'));
const DocumentFormPage = lazy(() => import('@/features/document-form/DocumentFormPage'));
const DocumentPage = lazy(() => import('@/features/documents/DocumentPage'));
const DocumentListPage = lazy(() => import('@/features/documents/DocumentListPage'));
const ArchivePage = lazy(() => import('@/features/archive/ArchivePage'));
const CompanyPage = lazy(() => import('@/features/company/CompanyPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));
const TemplateEditorPage = lazy(() => import('@/features/templates/TemplateEditorPage'));
const NotFoundPage = lazy(() => import('@/features/errors/NotFoundPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/choose-company"
          element={
            <RequireSession>
              <ChooseCompanyPage />
            </RequireSession>
          }
        />

        <Route
          element={
            <RequireSession>
              <RequireCompany>
                <AppLayout />
              </RequireCompany>
            </RequireSession>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/create" element={<CatalogPage />} />
          <Route path="/create/:templateId" element={<DocumentFormPage />} />
          <Route path="/documents" element={<DocumentListPage />} />
          <Route path="/documents/:documentId" element={<DocumentPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/company" element={<CompanyPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/templates/new" element={<TemplateEditorPage />} />
          <Route path="/templates/:templateId" element={<TemplateEditorPage />} />
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
