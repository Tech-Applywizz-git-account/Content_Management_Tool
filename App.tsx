
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from './services/supabaseDb';
import { supabase } from './src/integrations/supabase/client';
import { User, Project, Channel, Role } from './types';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CreateProjectModal from './components/CreateProjectModal';

// Admin Imports
import AdminLayout, { AdminView } from './components/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import UserManagement from './components/admin/UserManagement';
import AddUser from './components/admin/AddUser';
import RolesMatrix from './components/admin/RolesMatrix';
import AuditLogs from './components/admin/AuditLogs';
import SetPassword from './components/SetPassword';

// CEO Imports
import CeoDashboard from './components/ceo/CeoDashboard';

// CMO Imports
import CmoDashboard from './components/cmo/CmoDashboard';

// Writer Imports
import WriterDashboard from './components/writer/WriterDashboard';

// Cinematographer Imports
import CineDashboard from './components/cine/CineDashboard';

// Editor Imports
import EditorDashboard from './components/editor/EditorDashboard';

// Designer Imports
import DesignerDashboard from './components/designer/DesignerDashboard';

// Ops Imports
import OpsDashboard from './components/ops/OpsDashboard';

// Observer Imports
import ObserverDashboard from './components/observer/ObserverDashboard';

// Extend Project interface to include both inbox and history data
interface DashboardData {
  inbox: Project[];
  history: Project[];
}

function App() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [projects, setProjects] = useState<DashboardData>({ inbox: [], history: [] });
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  // Admin State
  const [adminView, setAdminView] = useState<AdminView>(() => {
    const saved = localStorage.getItem('admin_last_view') as AdminView;
    return saved || 'DASH';
  });
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);

  // CMO State - State for CMO dashboard all projects
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  // Function to check if token is expired
  const isTokenExpired = (tokenData: any): boolean => {
    try {
      if (tokenData.expires_at) {
        const now = Math.floor(Date.now() / 1000);
        return now > tokenData.expires_at;
      }
      return false;
    } catch (e) {
      console.error('Error checking token expiration:', e);
      return true; // Treat as expired if we can't check
    }
  };

  // Function to clear all stored auth tokens
  const clearAllTokens = () => {
    console.log('Clearing all auth tokens');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
  };

  // Function to clear invalid token and reset state
  const clearInvalidToken = () => {
    console.log('Clearing invalid/expired token');
    clearAllTokens();
    setUser(null);
    setLoading(false);
  };

  // Simplified session restoration with proper error handling
  const restoreSession = async () => {
    try {
      console.log('🔄 Session Restore: Starting (Mock Mode)...');

      // For mock mode, just check localStorage
      const mockSession = localStorage.getItem('mock_session');

      if (!mockSession) {
        console.log('✅ Session Restore: No saved session');
        return;
      }

      try {
        const user = JSON.parse(mockSession);
        console.log('✅ Session Restore: Session restored for:', user.full_name);
        setUser(user);
        db.setCurrentUser(user); // Set the current user in the database service
        await refreshData(user);
      } catch (error) {
        console.error('❌ Session Restore: Invalid session data, clearing');
        localStorage.removeItem('mock_session');
      }
    } catch (error: any) {
      console.error('❌ Session Restore: Fatal error:', error);
      localStorage.removeItem('mock_session');
    }
  };

  // Session restoration on mount - Simplified with guaranteed state update
  useEffect(() => {
    let mounted = true;
    let fallbackTimer: ReturnType<typeof setTimeout>;

    const initializeAuth = async () => {
      if (!mounted) return;

      // IMPORTANT: Skip session restoration on password reset/set-password pages
      // These pages use recovery tokens, not regular sessions
      // Check both pathname and hash-based recovery URLs
      const isRecoveryFlow = location.pathname === '/set-password' ||
        (location.hash && location.hash.includes('type=recovery'));

      if (isRecoveryFlow) {
        console.log('On password reset page, skipping session restoration to preserve recovery token');
        if (mounted) {
          setLoading(false);
          setIsRestoringSession(false);
        }
        return;
      }

      // Check if there are any stored tokens FIRST
      const hasStoredTokens = Object.keys(localStorage).some(key =>
        key.startsWith('sb-') && key.includes('-auth-token')
      );

      // If no tokens, skip loading and go straight to login
      if (!hasStoredTokens) {
        console.log('No stored tokens found, skipping session restoration');
        if (mounted) {
          setLoading(false);
          setIsRestoringSession(false);
        }
        return;
      }

      try {
        console.log('Starting session initialization...');
        await restoreSession();
      } catch (error) {
        console.error('Initialization error:', error);
        // Don't clear tokens here - restoreSession handles it internally
      } finally {
        // ALWAYS set these, even on error
        if (mounted) {
          setLoading(false);
          setIsRestoringSession(false);
          console.log('Session initialization complete');
        }
      }
    };

    // REMOVED: Global onAuthStateChange listener
    // It was causing race conditions with manual login flow
    // Auth state changes are now handled in SetPassword component only

    // Start initialization with a safety timeout so UI never hangs on "Loading session..."
    fallbackTimer = setTimeout(() => {
      if (!mounted) return;
      console.warn('Session initialization timed out; clearing tokens and returning to login.');
      clearAllTokens();
      setLoading(false);
      setIsRestoringSession(false);
    }, 8000);

    initializeAuth().finally(() => {
      clearTimeout(fallbackTimer);
    });

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Save admin view to localStorage when it changes
  useEffect(() => {
    if (user?.role === Role.ADMIN && adminView) {
      localStorage.setItem('admin_last_view', adminView);
    }
  }, [adminView, user]);

  // Block keyboard refresh shortcuts (F5, Ctrl+R) while allowing browser reload button with confirmation
  useEffect(() => {
    if (!user) return; // Only block when user is logged in

    const handleKeyDown = (e: KeyboardEvent) => {
      // F5 key
      if (e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        alert('⚠️ Keyboard refresh is disabled.\n\nPlease use the browser reload button or logout.');
        return false;
      }
      // Ctrl+Shift+R (Hard reload)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        e.stopPropagation();
        alert('❌ Hard reload is disabled.\n\nPlease logout if you need to refresh your session.');
        return false;
      }
      // Ctrl+R
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        e.stopPropagation();
        alert('⚠️ Keyboard refresh is disabled.\n\nPlease use the browser reload button or logout.');
        return false;
      }
    };

    // Handler for browser reload button
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers require returnValue to be set
      e.returnValue = 'Are you sure you want to reload? Your session will be preserved.';
      return e.returnValue;
    };

    // Add listeners
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  // Effect to fetch all projects for CMO dashboard
  useEffect(() => {
    // Only fetch for CMO users
    if (user?.role === Role.CMO) {
      const fetchAllProjects = async () => {
        try {
          const projects = await db.projects.getAll();
          setAllProjects(projects);
        } catch (error) {
          console.error('Failed to fetch all projects for CMO:', error);
        }
      };
      
      fetchAllProjects();
    }
  }, [user]);

  const refreshData = async (u: User = user!) => {
    if (!u) return;

    try {
      if (u.role === Role.ADMIN) {
        const users = await db.getUsers();
        setAdminUsers([...users]);
        const logs = await db.getSystemLogs();
        setAdminLogs([...logs]);
      } else {
        // For all role-based dashboards, fetch both inbox and MyWork data
        const inboxProjects = await db.getProjects(u);
        const myWorkProjects = await db.getMyWork(u);
        
        // Set both datasets - dashboards will use appropriate one based on view
        setProjects({ inbox: inboxProjects, history: myWorkProjects });
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  // App-level realtime subscription: refresh dashboard data when projects change
  React.useEffect(() => {
    if (!user) return;

    console.debug('App: creating app-level realtime subscription for projects');

    const subscription = supabase
      .channel('public:projects:app_refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload: any) => {
        console.debug('App-level realtime event received:', payload);
        try {
          refreshData(user);
        } catch (e) {
          console.error('App-level realtime handler error:', e);
        }
      })
      .subscribe();

    console.debug('App-level realtime subscription created:', subscription);

    return () => {
      try {
        supabase.removeChannel(subscription);
        console.debug('App: removed app-level realtime subscription');
      } catch (e) {
        console.warn('App: failed to remove subscription', e);
      }
    };
  }, [user]);

  // handleLogin now receives user directly from Auth.tsx - no redundant fetch
  const handleLogin = async (user: User) => {
    try {
      console.log('Login successful for:', user.full_name);
      setUser(user);
      db.setCurrentUser(user); // Set the current user in the database service
      await refreshData(user);
    } catch (error) {
      console.error('Login callback failed:', error);
      // Re-throw so Auth.tsx can show error and re-enable button
      throw error;
    }
  };

  const handleLogout = async () => {
    console.log('🚪 Logout: Starting logout process...');

    try {
      // Clear UI immediately for instant response
      setUser(null);
      setProjects([]);
      setAdminUsers([]);
      setAdminLogs([]);
      setAdminView('DASH');
      localStorage.removeItem('admin_last_view');
      console.log('✅ Logout: UI state cleared');

      // Ensure Supabase signout completes
      console.log('🔐 Logout: Signing out from Supabase...');
      await db.logout();
      console.log('✅ Logout: Supabase logout complete');

      // Force clear all auth tokens as failsafe
      console.log('🧹 Logout: Force clearing all tokens...');
      clearAllTokens();

      // Verify tokens are gone
      const remaining = Object.keys(localStorage).filter(k => k.startsWith('sb-'));
      if (remaining.length > 0) {
        console.warn(`⚠️  Logout: ${remaining.length} tokens still present, force removing:`, remaining);
        remaining.forEach(key => localStorage.removeItem(key));
      } else {
        console.log('✅ Logout: All tokens cleared successfully');
      }
    } catch (error) {
      console.error('❌ Logout: Error during logout:', error);
      // Even on error, force clear tokens
      console.log('🧹 Logout: Force clearing tokens due to error...');
      clearAllTokens();
    }

    console.log('✅ Logout: Complete');
  };

  const handleCreateProject = async (title: string, channel: Channel, dueDate: string) => {
    await db.createProject(title, channel, dueDate);
    refreshData(user!);
  };

  // Show loading state while initializing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading session...</p>
        </div>
      </div>
    );
  }

  // Handle Set Password Route (both path and hash-based)
  // Supabase password reset links use hash fragments like /#access_token=...&type=recovery
  const isPasswordResetFlow = location.pathname === '/set-password' ||
    (location.hash && location.hash.includes('type=recovery'));

  if (isPasswordResetFlow) {
    return <SetPassword />;
  }

  // Show login if no user
  if (!user) {
    return <Auth onLogin={handleLogin} isRestoringSession={isRestoringSession} />;
  }

  // --- ADMIN FLOW ---
  if (user?.role === Role.ADMIN) {
    return (
      <AdminLayout
        user={user}
        currentView={adminView}
        onNavigate={setAdminView}
        onLogout={handleLogout}
      >
        {adminView === 'DASH' && <AdminDashboard users={adminUsers} logs={adminLogs} onNavigate={setAdminView} />}
        {adminView === 'USERS' && <UserManagement users={adminUsers} logs={adminLogs} onRefresh={() => refreshData(user)} onNavigate={setAdminView} />}
        {adminView === 'USER_ADD' && <AddUser onBack={() => setAdminView('USERS')} onUserAdded={() => { refreshData(user); setAdminView('USERS'); }} />}
        {adminView === 'ROLES' && <RolesMatrix />}
        {adminView === 'LOGS' && <AuditLogs logs={adminLogs} />}
        {adminView === 'SETTINGS' && (
          <div className="flex flex-col items-center justify-center h-96 text-slate-400">
            <div className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-full flex items-center justify-center mb-4">
              <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse"></div>
            </div>
            <h3 className="text-lg font-medium text-slate-600">Settings Module</h3>
            <p>Coming in v1.2</p>
          </div>
        )}
      </AdminLayout>
    );
  }

  // --- CEO FLOW ---
  if (user?.role === Role.CEO) {
    return (
      <CeoDashboard
        user={user}
        inboxProjects={projects.inbox}
        historyProjects={projects.history}
        onRefresh={() => refreshData(user)}
        onLogout={handleLogout}
      />
    );
  }

  // --- CMO FLOW ---
  if (user?.role === Role.CMO) {
    return (
      <CmoDashboard
        user={user}
        inboxProjects={projects.inbox}
        historyProjects={projects.history}
        allProjects={allProjects}
        onRefresh={async () => {
          if (user) {
            await refreshData(user);
            // Also refresh all projects
            try {
              const allProj = await db.projects.getAll();
              setAllProjects(allProj);
            } catch (error) {
              console.error('Failed to refresh all projects for CMO:', error);
            }
          }
        }}
        onLogout={handleLogout}
      />
    );
  }

  // --- WRITER FLOW ---
  if (user?.role === Role.WRITER) {
    return (
      <WriterDashboard
        user={user}
        inboxProjects={projects.inbox}
        historyProjects={projects.history}
        onRefresh={() => refreshData(user)}
        onLogout={handleLogout}
      />
    );
  }

  // --- CINEMATOGRAPHER FLOW ---
  if (user?.role === Role.CINE) {
    return (
      <CineDashboard
        user={user}
        inboxProjects={projects.inbox}
        historyProjects={projects.history}
        onRefresh={() => refreshData(user)}
        onLogout={handleLogout}
      />
    );
  }

  // --- EDITOR FLOW ---
  if (user?.role === Role.EDITOR) {
    return (
      <EditorDashboard
        user={user}
        inboxProjects={projects.inbox}
        historyProjects={projects.history}
        onRefresh={() => refreshData(user)}
        onLogout={handleLogout}
      />
    );
  }

  // --- DESIGNER FLOW ---
  if (user?.role === Role.DESIGNER) {
    return (
      <DesignerDashboard
        user={user}
        inboxProjects={projects.inbox}
        historyProjects={projects.history}
        onRefresh={() => refreshData(user)}
        onLogout={handleLogout}
      />
    );
  }

  // --- OPS FLOW ---
  if (user?.role === Role.OPS) {
    return (
      <OpsDashboard
        user={user}
        inboxProjects={projects.inbox}
        historyProjects={projects.history}
        onRefresh={() => refreshData(user)}
        onLogout={handleLogout}
      />
    );
  }

  // --- OBSERVER FLOW ---
  if (user?.role === Role.OBSERVER) {
    return <ObserverDashboard user={user} onLogout={handleLogout} />;
  }

  // --- STANDARD WORKFLOW FLOW (fallback) ---
  return (
    <>
      <Layout
        user={user}
        onLogout={handleLogout}
        onOpenCreate={() => setCreateModalOpen(true)}
      >
        <Dashboard
          user={user}
          projects={projects}
          refreshData={() => refreshData(user)}
        />
      </Layout>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateProject}
      />


    </>
  );
}

export default App;
