import React from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { User, Role, Project } from './types';
import ProtectedRoute from './components/ProtectedRoute';

// Admin Imports
import AdminLayout, { AdminView } from './components/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import UserManagement from './components/admin/UserManagement';
import AddUser from './components/admin/AddUser';
import RolesMatrix from './components/admin/RolesMatrix';
import AuditLogs from './components/admin/AuditLogs';

// Dashboards
import CeoDashboard from './components/ceo/CeoDashboard';
import CmoDashboard from './components/cmo/CmoDashboard';
import CmoReviewPage from './components/cmo/CmoReviewPage';
import WriterDashboard from './components/writer/WriterDashboard';
import CineDashboard from './components/cine/CineDashboard';
import EditorDashboard from './components/editor/EditorDashboard';
import EditorProjectDetailPage from './components/editor/EditorProjectDetailPage';
import SubEditorDashboard from './components/subeditor/SubEditorDashboard';
import SubEditorProjectDetailPage from './components/subeditor/SubEditorProjectDetailPage';
import DesignerDashboard from './components/designer/DesignerDashboard';
import DesignerProjectDetailPage from './components/designer/DesignerProjectDetailPage';
import OpsDashboard from './components/ops/OpsDashboard';
import OpsProjectDetailPage from './components/ops/OpsProjectDetailPage';
import OpsCeoApprovedViewWrapper from './components/ops/OpsCeoApprovedViewWrapper';
import ObserverDashboard from './components/observer/ObserverDashboard';
import WriterProjectDetailPage from './components/writer/WriterProjectDetailPage';
import CmoProjectDetailPage from './components/cmo/CmoProjectDetailPage';
import CmoHistoryDetail from './components/cmo/CmoHistoryDetail';

import CeoProjectDetailPage from './components/ceo/CeoProjectDetailPage';
import CineProjectDetailPage from './components/cine/CineProjectDetailPage';
import Auth from './components/Auth';
import SetPassword from './components/SetPassword';

interface AppRoutesProps {
    user: User | null;
    isRestoringSession: boolean;
    projects: { inbox: Project[]; history: Project[] };
    adminState: {
        users: User[];
        logs: any[];
    };
    cmoAllProjects: Project[];
    cineScriptProjects: Project[];
    editorScriptProjects: Project[];
    designerScriptProjects: Project[];
    subEditorScriptProjects: Project[];
    onLogin: (user: User) => void;
    onLogout: () => void;
    refreshData: (user: User) => Promise<void>;
}

const AppRoutes: React.FC<AppRoutesProps> = ({
    user,
    isRestoringSession,
    projects,
    adminState,
    cmoAllProjects,
    cineScriptProjects,
    editorScriptProjects,
    designerScriptProjects,
    subEditorScriptProjects,
    onLogin,
    onLogout,
    refreshData
}) => {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={
                user ? <Navigate to={`/${user.role === Role.SUB_EDITOR ? 'sub_editor' : user.role.toLowerCase()}`} replace /> : <Auth onLogin={onLogin} isRestoringSession={isRestoringSession} />
            } />
            <Route path="/set-password" element={<SetPassword />} />

            {/* Admin Routes */}
            <Route path="/admin/*" element={
                <ProtectedRoute user={user} isRestoringSession={isRestoringSession} allowedRoles={[Role.ADMIN]}>
                    <AdminLayout
                        user={user!}
                        onLogout={onLogout}
                    >
                        <Routes>
                            <Route index element={<AdminDashboard users={adminState.users} logs={adminState.logs} />} />
                            <Route path="users" element={<UserManagement users={adminState.users} logs={adminState.logs} onRefresh={() => refreshData(user!)} />} />
                            <Route path="users/add" element={<AddUser onUserAdded={() => refreshData(user!)} />} />
                            <Route path="roles" element={<RolesMatrix />} />
                            <Route path="logs" element={<AuditLogs logs={adminState.logs} />} />
                            <Route path="settings" element={
                                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                                    <h3 className="text-lg font-medium text-slate-600">Settings Module</h3>
                                    <p>Coming in v1.2</p>
                                </div>
                            } />
                        </Routes>
                    </AdminLayout>
                </ProtectedRoute>
            } />

            {/* Role-based Routes */}
            <Route path="/writer/*" element={
                <ProtectedRoute user={user} isRestoringSession={isRestoringSession} allowedRoles={[Role.WRITER]}>
                    <Routes>
                        <Route path="project/:projectId" element={<WriterProjectDetailPage user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history]} />} />
                        <Route path="edit/:projectId" element={<WriterDashboard user={user!} inboxProjects={projects.inbox} historyProjects={projects.history} onRefresh={() => refreshData(user!)} onLogout={onLogout} />} />
                        <Route path="*" element={<WriterDashboard user={user!} inboxProjects={projects.inbox} historyProjects={projects.history} scriptProjects={subEditorScriptProjects} onRefresh={() => refreshData(user!)} onLogout={onLogout} />} />
                    </Routes>
                </ProtectedRoute>
            } />

            <Route path="/cmo/*" element={
                <ProtectedRoute user={user} isRestoringSession={isRestoringSession} allowedRoles={[Role.CMO]}>
                    <Routes>
                        <Route path="project/:projectId" element={<CmoProjectDetailPage user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history, ...cmoAllProjects]} />} />
                        <Route path="review/:projectId" element={<CmoReviewPage user={user!} onLogout={onLogout} refreshData={refreshData} />} />
                        <Route path="history_detail/:projectId" element={
                          <CmoHistoryDetailWithParams currentUser={user!} onBack={() => window.history.back()} />
                        } />
                        <Route path="*" element={<CmoDashboard user={user!} inboxProjects={projects.inbox} historyProjects={projects.history} allProjects={cmoAllProjects} onRefresh={() => refreshData(user!)} onLogout={onLogout} />} />
                    </Routes>
                </ProtectedRoute>
            } />

            <Route path="/ceo/*" element={
                <ProtectedRoute user={user} isRestoringSession={isRestoringSession} allowedRoles={[Role.CEO]}>
                    <Routes>
                        <Route path="review/:projectId" element={<CeoProjectDetailPage user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history, ...cmoAllProjects]} />} />
                        <Route path="history/:projectId" element={<CeoProjectDetailPage user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history, ...cmoAllProjects]} />} />
                        <Route path="*" element={<CeoDashboard user={user!} inboxProjects={projects.inbox} historyProjects={projects.history} allProjects={cmoAllProjects} onRefresh={() => refreshData(user!)} onLogout={onLogout} />} />
                    </Routes>
                </ProtectedRoute>
            } />

            <Route path="/cine/*" element={
                <ProtectedRoute user={user} isRestoringSession={isRestoringSession} allowedRoles={[Role.CINE]}>
                    <Routes>
                        <Route path="project/:projectId" element={<CineProjectDetailPage user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history]} />} />
                        <Route path="*" element={<CineDashboard user={user!} inboxProjects={projects.inbox} historyProjects={projects.history} scriptProjects={cineScriptProjects} onRefresh={() => refreshData(user!)} onLogout={onLogout} />} />
                    </Routes>
                </ProtectedRoute>
            } />

            <Route path="/editor/*" element={
                <ProtectedRoute user={user} isRestoringSession={isRestoringSession} allowedRoles={[Role.EDITOR]}>
                    <Routes>
                        <Route path="project/:projectId" element={<EditorProjectDetailPage user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history]} />} />
                        <Route path="*" element={<EditorDashboard user={user!} inboxProjects={projects.inbox} historyProjects={projects.history} scriptProjects={editorScriptProjects} onRefresh={() => refreshData(user!)} onLogout={onLogout} />} />
                    </Routes>
                </ProtectedRoute>
            } />

            <Route path="/sub_editor/*" element={
                <ProtectedRoute user={user} isRestoringSession={isRestoringSession} allowedRoles={[Role.SUB_EDITOR]}>
                    <Routes>
                        <Route path="project/:projectId" element={<SubEditorProjectDetailPage user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history]} />} />
                        <Route path="*" element={<SubEditorDashboard user={user!} inboxProjects={projects.inbox} historyProjects={projects.history} scriptProjects={subEditorScriptProjects} onRefresh={() => refreshData(user!)} onLogout={onLogout} />} />
                    </Routes>
                </ProtectedRoute>
            } />

            <Route path="/designer/*" element={
                <ProtectedRoute user={user} isRestoringSession={isRestoringSession} allowedRoles={[Role.DESIGNER]}>
                    <Routes>
                        <Route path="project/:projectId" element={<DesignerProjectDetailPage user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history]} />} />
                        <Route path="*" element={<DesignerDashboard user={user!} inboxProjects={projects.inbox} historyProjects={projects.history} scriptProjects={designerScriptProjects} onRefresh={() => refreshData(user!)} onLogout={onLogout} />} />
                    </Routes>
                </ProtectedRoute>
            } />

            <Route path="/ops/*" element={
                <ProtectedRoute user={user} isRestoringSession={isRestoringSession} allowedRoles={[Role.OPS]}>
                    <Routes>
                        <Route path="project/:projectId" element={<OpsProjectDetailPage user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history, ...cmoAllProjects]} />} />

                        <Route path="ceo-approved-view/:projectId" element={<OpsCeoApprovedViewWrapper user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history, ...cmoAllProjects]} />} />
                        <Route path="ceoapproved" element={<OpsDashboard user={user!} inboxProjects={projects.inbox} historyProjects={projects.history} allProjects={cmoAllProjects} onRefresh={() => refreshData(user!)} onLogout={onLogout} activeViewOverride="ceoapproved" />} />
                        <Route path="review/:projectId" element={<CmoProjectDetailPage user={user!} onLogout={onLogout} projects={[...projects.inbox, ...projects.history, ...cmoAllProjects]} />} />
                        <Route path="*" element={<OpsDashboard user={user!} inboxProjects={projects.inbox} historyProjects={projects.history} allProjects={cmoAllProjects} onRefresh={() => refreshData(user!)} onLogout={onLogout} />} />
                    </Routes>
                </ProtectedRoute>
            } />

            <Route path="/observer/*" element={
                <ProtectedRoute user={user} isRestoringSession={isRestoringSession} allowedRoles={[Role.OBSERVER]}>
                    <ObserverDashboard user={user!} onLogout={onLogout} />
                </ProtectedRoute>
            } />

            {/* Default Redirects */}
            <Route path="/" element={
                user ? <Navigate to={`/${user.role === Role.SUB_EDITOR ? 'sub_editor' : user.role.toLowerCase()}`} replace /> : <Navigate to="/login" replace />
            } />

            {/* Catch-all - show a basic 404 instead of forced redirect */}
            <Route path="*" element={
                <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
                    <h1 className="text-4xl font-black uppercase text-slate-900">404 - Page Not Found</h1>
                    <p className="text-slate-600 font-bold">The page you are looking for does not exist.</p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="bg-[#D946EF] border-2 border-black px-6 py-3 text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        Go Home
                    </button>
                </div>
            } />
        </Routes>
    );
};

// Wrapper component to pass URL parameters to CmoHistoryDetail
const CmoHistoryDetailWithParams: React.FC<any> = (props) => {
  const [searchParams] = useSearchParams();
  const historyFilter = searchParams.get('filter') || 'ALL';
  
  // Pass activeTab as 'WRITERS' when historyFilter is 'WRITER' or writer ID
  const activeTab = historyFilter === 'WRITER' || 
                   (historyFilter && !['ALL', 'CMO', 'CEO', 'CINE', 'EDITOR', 'DESIGNER', 'OPS', 'POSTED'].includes(historyFilter)) 
                   ? 'WRITERS' 
                   : undefined;
  
  return <CmoHistoryDetail {...props} activeTab={activeTab} />;
};

export default AppRoutes;
