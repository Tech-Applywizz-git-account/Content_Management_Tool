
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from './services/supabaseDb';
import { supabase } from './src/integrations/supabase/client';
import { User, Project, Channel, Role } from './types';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CreateProjectModal from './components/CreateProjectModal';
import AppRoutes from './AppRoutes';

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

// Sub-Editor Imports
import SubEditorDashboard from './components/subeditor/SubEditorDashboard';

// Designer Imports
import DesignerDashboard from './components/designer/DesignerDashboard';

// Ops Imports
import OpsDashboard from './components/ops/OpsDashboard';

// Observer Imports
import ObserverDashboard from './components/observer/ObserverDashboard';

// Sync user recovery from localStorage to prevent flash-loading-spinner on refresh
const getUserSync = (): User | null => {
  try {
    const mock = localStorage.getItem('mock_session');
    if (mock) return JSON.parse(mock);

    // Try to find Supabase auth token
    const tokenKey = Object.keys(localStorage).find(k => k.endsWith('-auth-token'));
    if (tokenKey) {
      const tokenData = JSON.parse(localStorage.getItem(tokenKey) || '{}');
      if (tokenData && tokenData.user) {
        const u = tokenData.user;
        return {
          id: u.id,
          email: u.email,
          full_name: u.user_metadata?.full_name || u.user_metadata?.name || 'User',
          role: (u.user_metadata?.role as Role) || Role.OBSERVER,
          status: 'ACTIVE',
        } as User;
      }
    }
  } catch (e) {
    console.debug('Sync user recovery skipped:', e);
  }
  return null;
};

// Extend Project interface to include both inbox and history data
interface DashboardData {
  inbox: Project[];
  history: Project[];
}

function App() {
  const location = useLocation();
  const initialUser = getUserSync();
  if (initialUser) {
    db.setCurrentUser(initialUser);
  }
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [projects, setProjects] = useState<DashboardData>({ inbox: [], history: [] });
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  // Admin State
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);

  // CMO State - State for CMO dashboard all projects
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  // Cine State - State for Cine dashboard script projects
  const [cineScriptProjects, setCineScriptProjects] = useState<Project[]>([]);

  // Editor State - State for Editor dashboard script projects
  const [editorScriptProjects, setEditorScriptProjects] = useState<Project[]>([]);

  // Designer State - State for Designer dashboard script projects
  const [designerScriptProjects, setDesignerScriptProjects] = useState<Project[]>([]);

  // Sub-Editor State - State for Sub-Editor dashboard script projects
  const [subEditorScriptProjects, setSubEditorScriptProjects] = useState<Project[]>([]);

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

  // Enhanced session restoration with proper Supabase support
  const restoreSession = async () => {
    try {
      console.log('🔄 Session Restore: Starting...');

      // 1. Try Mock Session first (legacy/test support)
      const mockSession = localStorage.getItem('mock_session');
      if (mockSession) {
        try {
          const mockUser = JSON.parse(mockSession);
          console.log('✅ Session Restore: Mock session restored for:', mockUser.full_name);
          setUser(mockUser);
          db.setCurrentUser(mockUser);
          await refreshData(mockUser);
          return;
        } catch (e) {
          console.error('❌ Session Restore: Invalid mock session data');
          localStorage.removeItem('mock_session');
        }
      }

      // 2. Try Supabase Session
      console.log('🔄 Session Restore: Checking Supabase session...');
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !supabaseUser) {
        console.log('✅ Session Restore: No Supabase session found or error');
        return;
      }

      console.log('🔄 Session Restore: Supabase user found, fetching profile...', supabaseUser.id);

      // Fetch user profile from database
      const profile = await db.users.getById(supabaseUser.id);

      if (profile) {
        console.log('✅ Session Restore: Profile loaded for:', profile.full_name);
        setUser(profile);
        db.setCurrentUser(profile);
        await refreshData(profile);
      } else {
        console.warn('⚠️ Session Restore: Supabase user exists but no database profile found');
        // If we have a user but no profile, they might be partially registered
        // We shouldn't clear tokens here, just let it fall through to login
      }
    } catch (error: any) {
      console.error('❌ Session Restore: Fatal error:', error);
      // In case of fatal error during restoration, we don't necessarily want to clear everything 
      // unless we're sure the session is invalid.
    }
  };

  // Session restoration on mount - Improved for reliable refresh handling
  useEffect(() => {
    console.log('App: Initializing auth...');
    let mounted = true;
    let fallbackTimer: ReturnType<typeof setTimeout>;

    const initializeAuth = async () => {
      console.log('App: initializeAuth called');
      if (!mounted) return;

      // Skip restoration on reset-password pages
      const isRecoveryFlow = location.pathname === '/set-password' ||
        window.location.hash.includes('type=recovery') ||
        window.location.search.includes('recovery');

      if (isRecoveryFlow) {
        console.log('App: Recovery flow detected, handling separately');
        try {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
            const profile = await db.users.getById(data.user.id);
            if (profile) {
              setUser(profile);
              db.setCurrentUser(profile);
            }
          }
        } catch (e) {
          console.error('Error in recovery session check:', e);
        }
        setLoading(false);
        setIsRestoringSession(false);
        return;
      }

      try {
        // 1. Check for fast local session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          console.log('App: Session found via getSession, restoring...');
          await restoreSession();
        } else {
          // 2. Check for mock session explicitly
          const mockSession = localStorage.getItem('mock_session');
          if (mockSession) {
            await restoreSession();
          } else {
            console.log('App: No local session found');
          }
        }
      } catch (error) {
        console.error('App: Auth initialization error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          setIsRestoringSession(false);
          console.log('App: Auth initialization complete');
        }
      }
    };

    // Safety timeout to ensure app always loads, but WITHOUT clearing tokens unless essential
    fallbackTimer = setTimeout(() => {
      if (!mounted) return;
      if (loading) {
        console.warn('App: Auth initialization timed out - forcing loading to false');
        setLoading(false);
        setIsRestoringSession(false);
      }
    }, 10000);

    initializeAuth();

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
    };
  }, []);



  // Effect to fetch all projects for management and overview roles
  useEffect(() => {
    // Fetch all projects for management and overview roles
    if (user?.role === Role.CMO || user?.role === Role.CEO || user?.role === Role.OPS || user?.role === Role.ADMIN || user?.role === Role.OBSERVER) {
      const fetchAllProjects = async () => {
        try {
          const projects = await db.projects.getAll();
          setAllProjects(projects);
        } catch (error) {
          console.error('Failed to fetch all projects for management role:', error);
        }
      };

      fetchAllProjects();
    }

    // Only fetch for Cine users
    if (user?.role === Role.CINE) {
      const fetchCineScriptProjects = async () => {
        try {
          const projects = await db.projects.getScriptProjects();
          setCineScriptProjects(projects);
        } catch (error) {
          console.error('Failed to fetch script projects for Cine:', error);
        }
      };

      fetchCineScriptProjects();
    }

    // Only fetch for Editor users
    if (user?.role === Role.EDITOR) {
      const fetchEditorScriptProjects = async () => {
        try {
          const projects = await db.projects.getScriptProjects();
          setEditorScriptProjects(projects);
        } catch (error) {
          console.error('Failed to fetch script projects for Editor:', error);
        }
      };

      fetchEditorScriptProjects();
    }

    // Only fetch for Designer users
    if (user?.role === Role.DESIGNER) {
      const fetchDesignerScriptProjects = async () => {
        try {
          const projects = await db.projects.getScriptProjects();
          setDesignerScriptProjects(projects);
        } catch (error) {
          console.error('Failed to fetch script projects for Designer:', error);
        }
      };

      fetchDesignerScriptProjects();
    }

    // Only fetch for Sub-Editor users
    if (user?.role === Role.SUB_EDITOR || user?.role === Role.WRITER) {
      const fetchSubEditorScriptProjects = async () => {
        try {
          const projects = await db.projects.getScriptProjects();
          setSubEditorScriptProjects(projects);
        } catch (error) {
          console.error('Failed to fetch script projects for role:', error);
        }
      };

      fetchSubEditorScriptProjects();
    }
  }, [user]);

  const refreshData = async (u: User = user!) => {
    console.log('🔄 App.tsx: refreshData called for user:', u?.full_name, 'role:', u?.role);
    if (!u) {
      console.log('⚠️ App.tsx: No user provided to refreshData');
      return;
    }

    try {
      if (u.role === Role.ADMIN) {
        console.log('🔄 App.tsx: Refreshing admin data');
        const users = await db.getUsers();
        console.log('✅ App.tsx: Users fetched:', users.length);
        setAdminUsers([...users]);
        const logs = await db.getSystemLogs();
        console.log('✅ App.tsx: Logs fetched:', logs.length);
        setAdminLogs([...logs]);
      } else {
        // For all role-based dashboards, fetch both inbox and MyWork data
        console.log('🔄 App.tsx: Refreshing role-based dashboard data for:', u.role);
        const inboxProjects = await db.getProjects(u);
        console.log('✅ App.tsx: Inbox projects fetched:', inboxProjects.length);
        const myWorkProjects = await db.getMyWork(u);
        console.log('✅ App.tsx: MyWork projects fetched:', myWorkProjects.length);

        // Set both datasets - dashboards will use appropriate one based on view
        console.log('🔄 App.tsx: Updating projects state');
        setProjects({ inbox: inboxProjects, history: myWorkProjects });
        console.log('✅ App.tsx: Projects state updated');

        // For management roles, also refresh all projects (for calendar)
        if (u.role === Role.CMO || u.role === Role.CEO || u.role === Role.OPS || u.role === Role.OBSERVER) {
          try {
            console.log('🔄 App.tsx: Refreshing all projects');
            const allProjectsData = await db.projects.getAll();
            setAllProjects(allProjectsData);
            console.log('✅ App.tsx: All projects refreshed:', allProjectsData.length);
          } catch (error) {
            console.error('❌ App.tsx: Failed to refresh all projects:', error);
          }
        }

        // For Editor, Designer, and Sub-Editor roles, also refresh script projects
        if (u.role === Role.EDITOR) {
          try {
            console.log('🔄 App.tsx: Refreshing script projects for Editor');
            const scriptProjects = await db.projects.getScriptProjects();
            setEditorScriptProjects(scriptProjects);
            console.log('✅ App.tsx: Editor script projects refreshed:', scriptProjects.length);
          } catch (error) {
            console.error('❌ App.tsx: Failed to refresh script projects for Editor:', error);
          }
        } else if (u.role === Role.DESIGNER) {
          try {
            console.log('🔄 App.tsx: Refreshing script projects for Designer');
            const scriptProjects = await db.projects.getScriptProjects();
            setDesignerScriptProjects(scriptProjects);
            console.log('✅ App.tsx: Designer script projects refreshed:', scriptProjects.length);
          } catch (error) {
            console.error('❌ App.tsx: Failed to refresh script projects for Designer:', error);
          }
        } else if (u.role === Role.SUB_EDITOR || u.role === Role.WRITER) {
          try {
            console.log('🔄 App.tsx: Refreshing script projects for role');
            const scriptProjects = await db.projects.getScriptProjects();
            setSubEditorScriptProjects(scriptProjects);
            console.log('✅ App.tsx: Script projects refreshed:', scriptProjects.length);
          } catch (error) {
            console.error('❌ App.tsx: Failed to refresh script projects:', error);
          }
        }
      }
      console.log('✅ App.tsx: refreshData completed successfully');
    } catch (error) {
      console.error('❌ App.tsx: Error refreshing data:', error);
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

  const navigate = useNavigate();

  // handleLogin now receives user directly from Auth.tsx - no redundant fetch
  const handleLogin = async (user: User) => {
    try {
      console.log('Login successful for:', user.full_name);
      setUser(user);
      db.setCurrentUser(user); // Set the current user in the database service
      await refreshData(user);

      // Redirect to role-based dashboard
      const rolePath = user.role === Role.SUB_EDITOR ? 'sub_editor' : user.role.toLowerCase();
      navigate(`/${rolePath}`);
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
      setProjects({ inbox: [], history: [] });
      setAdminUsers([]);
      setAdminLogs([]);
      localStorage.removeItem('admin_last_view');
      localStorage.removeItem('mock_session'); // Also clear mock session
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

      // Redirect to login
      navigate('/login');
    } catch (error) {
      console.error('❌ Logout: Error during logout:', error);
      // Even on error, force clear tokens
      console.log('🧹 Logout: Force clearing tokens due to error...');
      clearAllTokens();
      navigate('/login');
    }

    console.log('✅ Logout: Complete');
  };

  const handleCreateProject = async (title: string, channel: Channel, dueDate: string, isDirectCreative?: boolean) => {
    if (isDirectCreative) {
      // For direct creative uploads, create a project that starts at the final review stage
      await db.createDirectCreativeProject(title, channel, dueDate);
    } else {
      await db.createProject(title, channel, dueDate, 'VIDEO', 'NORMAL');
    }
    refreshData(user!);
  };

  const handleCreateIdeaProject = async (title: string, channel: Channel, contentType: 'VIDEO' | 'CREATIVE_ONLY', description: string) => {
    await db.createIdeaProject(title, channel, contentType, description);
    refreshData(user!);
  };

  // Scroll Restoration Component
  const ScrollRestorer = () => {
    const { pathname, search } = useLocation();

    useEffect(() => {
      const container = document.querySelector('main');
      if (!container) return;

      // Restore scroll
      const saved = sessionStorage.getItem(`scroll_${pathname}${search}`);
      if (saved) {
        // Use a small delay to ensure content is rendered
        const timer = setTimeout(() => {
          container.scrollTo(0, parseInt(saved, 10));
        }, 50);
        return () => clearTimeout(timer);
      } else {
        container.scrollTo(0, 0);
      }
    }, [pathname, search]);

    useEffect(() => {
      const container = document.querySelector('main');
      if (!container) return;

      const handleScroll = () => {
        sessionStorage.setItem(`scroll_${pathname}${search}`, container.scrollTop.toString());
      };

      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }, [pathname, search]);

    return null;
  };

  // Main rendering logic - no more loading spinner block
  return (
    <div className="app-container">
      <ScrollRestorer />
      <AppRoutes
        user={user}
        isRestoringSession={isRestoringSession}
        projects={projects}
        adminState={{
          users: adminUsers,
          logs: adminLogs
        }}
        cmoAllProjects={allProjects}
        cineScriptProjects={cineScriptProjects}
        editorScriptProjects={editorScriptProjects}
        designerScriptProjects={designerScriptProjects}
        subEditorScriptProjects={subEditorScriptProjects}
        onLogin={handleLogin}
        onLogout={handleLogout}
        refreshData={refreshData}
      />

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}

export default App;
