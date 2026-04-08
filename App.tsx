
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
    // 1. Try dedicated app user cache first (most reliable source of truth for role)
    const cachedUser = localStorage.getItem('app_user_cache');
    if (cachedUser) {
      const parsed = JSON.parse(cachedUser);
      // Basic validation to ensure it looks like a user object
      if (parsed && parsed.id && parsed.role) {
        return parsed;
      }
    }

    // 2. Try mock session
    const mock = localStorage.getItem('mock_session');
    if (mock) return JSON.parse(mock);

    // 3. Try to find Supabase auth token (fallback)
    const tokenKey = Object.keys(localStorage).find(k => k.endsWith('-auth-token'));
    if (tokenKey) {
      const tokenData = JSON.parse(localStorage.getItem(tokenKey) || '{}');
      if (tokenData && tokenData.user) {
        const u = tokenData.user;
        // Ensure role is normalized to Uppercase to prevent mismatch redirects
        const rawRole = u.user_metadata?.role || u.user_metadata?.name || '';
        const normalizedRole = rawRole.toUpperCase() as Role;

        return {
          id: u.id,
          email: u.email,
          full_name: u.user_metadata?.full_name || u.user_metadata?.name || 'User',
          role: Object.values(Role).includes(normalizedRole) ? normalizedRole : Role.OBSERVER,
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
  const [user, setUser] = useState<User | null>(initialUser);
  
  // Set current user in db service on mount/initialUser change
  useEffect(() => {
    if (initialUser) {
      db.setCurrentUser(initialUser);
    }
  }, []); // Only on mount to stabilize

  const [loading, setLoading] = useState(true); // Start loading by default
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Use a Ref to track loading state in event listeners without stale closures
  const loadingRef = React.useRef(loading);
  const isRestoringSessionRef = React.useRef(isRestoringSession);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    isRestoringSessionRef.current = isRestoringSession;
  }, [isRestoringSession]);

  // Use a Ref to track user state in event listeners without stale closures
  const userRef = React.useRef<User | null>(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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

  // Cache user to localStorage whenever it changes to ensure persistence across reloads
  useEffect(() => {
    if (user) {
      localStorage.setItem('app_user_cache', JSON.stringify(user));
    }
    // NOTE: We do NOT implicitly clear the cache here when user is null.
    // Clearing is handled explicitly by handleLogout, clearInvalidToken, or session validation failures.
    // This prevents accidental clearing during transient loading states or network glitches.
  }, [user]);

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
    localStorage.removeItem('app_user_cache');
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
        console.warn('⚠️ Session Restore: Supabase session invalid or expired.', authError?.message || 'No user');

        // If we had a cached user but the server rejects the token, we must clear it.
        // This handles cases where the token expired while the user was away.
        if (localStorage.getItem('app_user_cache') || user) {
          console.log('⚠️ Session Restore: Clearing invalid cached session.');
          clearInvalidToken();
        }
        return;
      }

      console.log('🔄 Session Restore: Supabase user found, fetching profile by email...', supabaseUser.email);

      // Fetch user profile from database using email for 100% ID consistency
      // Requirement: Fetch public.users record ONCE using the logged-in user's email
      const profile = await db.users.getByEmail(supabaseUser.email!);

      if (profile) {
        console.log('✅ Session Restore: Profile loaded for:', profile.full_name, 'ID:', profile.id);
        setUser(profile);
        db.setCurrentUser(profile);
        await refreshData(profile);
      } else {
        console.warn('⚠️ Session Restore: Supabase user exists but no database profile found for email:', supabaseUser.email);
        // If we have a user but no profile, they might be partially registered
        // We shouldn't clear tokens here, just let it fall through to login
      }
    } catch (error: any) {
      console.error('❌ Session Restore: Error:', error);

      // Check for "row not found" error (PGRST116 or "0 rows")
      // This happens when Supabase Auth has a session, but the user was deleted from public.users table
      if (error.code === 'PGRST116' || error.details?.includes('0 rows') || error.message?.includes('0 rows')) {
        console.warn('⚠️ Session Restore: User profile missing from database. Configuring cleanup...');

        // Force cleanup of invalid session
        clearAllTokens();
        setUser(null);
        await supabase.auth.signOut();

        console.log('✅ Session Restore: Invalid session cleared.');
        // Do NOT blindly redirect to /login here as it can cause loops if we are already there
        // or if the auth listener picks it up. Let the UI react to user=null.
        return;
      }

      console.error('❌ Session Restore: Fatal error:', error);
    }
  };

  // Session restoration and Auth Listener
  useEffect(() => {
    console.log('App: Initializing auth system...');
    let mounted = true;

    const initAuth = async () => {
      if (!mounted) return;

      // Skip restoration on reset-password pages
      const isRecoveryFlow = location.pathname === '/set-password' ||
        window.location.hash.includes('type=recovery') ||
        window.location.search.includes('recovery');

      if (isRecoveryFlow) {
        console.log('App: Recovery flow detected, handling separately');
        try {
          // In recovery, we trust the URL token but still verify user
          const { data, error } = await supabase.auth.getUser();
          if (error) console.warn('App: Recovery user error:', error.message);

          if (data?.user) {
            // Just fetch profile, don't do full restoreSession loop which might be strict
            const profile = await db.users.getById(data.user.id);
            if (profile && mounted) {
              setUser(profile);
              db.setCurrentUser(profile);
            }
          }
        } catch (recoverErr) {
          console.error('App: Recovery flow failed:', recoverErr);
        } finally {
          if (mounted) {
            setLoading(false);
            setIsRestoringSession(false);
          }
        }
        return;
      }

      try {
        console.log('App: initAuth - fetching initial session...');
        // 1. Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('App: GetSession warning:', error.message);
        }

        if (session?.user) {
          console.log('App: Active session found, verifying profile...');
          // If we have a session, ensure we have the full profile
          // We call restoreSession even if user is set, to ensure data freshness on reload
          // Wrap in a timeout to prevent hanging the whole app
          await Promise.race([
            restoreSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Session restore timeout')), 5000))
          ]).catch(err => {
            console.error('App: restoreSession failed or timed out:', err);
          });
        } else {
          console.log('App: No active Supabase session found');
          // Attempt mock session fallback here
          const mockSession = localStorage.getItem('mock_session');
          if (mockSession) {
            await restoreSession().catch(err => console.error('App: mock session restore failed:', err));
          }
        }
      } catch (err) {
        console.error('App: Auth init exception:', err);
      } finally {
        if (mounted) {
          // Only release the block after we've tried everything
          setLoading(false);
          setIsRestoringSession(false);
          console.log('App: Auth initialization complete, blocking released');
        }
      }
    };


    // 2. Listen for changes (Important for token refreshes and multi-tab sync)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 Auth Change: ${event}`);

      // Skip processing onAuthStateChange events during initial restore to avoid redundant calls
      // The initAuth/restoreSession loop handles the first load.
      if (document.readyState !== 'complete' || (loadingRef.current && event === 'SIGNED_IN')) {
        console.log('App: Skipping auth event processing during initial load');
        return;
      }

      const currentUser = userRef.current; // Use Ref to get latest state

      // We only react to SIGNED_IN or TOKEN_REFRESHED if we are NOT already processing initAuth
      // or if the user state has drifted.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // If detailed profile is missing, fetch it
        if (session?.user) {
          // We check against current state. If `user` is null, we definitely need to restore.
          // If `user` exists, we might want to refresh if IDs don't match (account switch).
          // We avoid infinite loops by checking ID match if user exists.
          if (!currentUser || currentUser.id !== session.user.id) {
            console.log('App: Auth event requires profile sync...');
            await restoreSession();
          }
        }
      } else if (event === 'SIGNED_OUT') {
        // Only logout if we think we are logged in
        if (currentUser) {
          console.log('App: Signed out event received');
          handleLogout();
        }
      }
    });

    // Run initialization
    initAuth();

    // Safety fallback: ensure loading is released even if initAuth hangs indefinitely
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        console.warn('⚠️ App: Safety timeout triggered! Forcing loading state to false.');
        setLoading(false);
        setIsRestoringSession(false);
      }
    }, 7000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array as this is mount logic



  // Unified Data Refresh Effect: Ensures data is fetched whenever user is set (login, restore, refresh)
  useEffect(() => {
    if (user) {
      refreshData(user);
    }
    // We don't implicitly clear data on user null here to avoid flash before redirect
  }, [user]);

  // Track the ID of the last user we fetched data for to avoid redundant fetches
  const lastFetchedUserIdRef = React.useRef<string | null>(null);
  const isFetchingDataRef = React.useRef<boolean>(false);

  const refreshData = async (u: User = user!) => {
    if (!u) {
      console.log('⚠️ App.tsx: No user provided to refreshData');
      return;
    }

    // Skip if we are already fetching data for this user
    if (isFetchingDataRef.current && lastFetchedUserIdRef.current === u.id) {
      console.debug('App.tsx: Skipping refreshData, already in progress for this user');
      return;
    }

    console.log('🔄 App.tsx: refreshData called for user:', u?.full_name, 'role:', u?.role);
    isFetchingDataRef.current = true;
    lastFetchedUserIdRef.current = u.id;

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
        if (u.role === Role.CMO || u.role === Role.CEO || u.role === Role.OPS || u.role === Role.OBSERVER || u.role === Role.PARTNER_ASSOCIATE) {
          try {
            console.log('🔄 App.tsx: Refreshing all projects');
            const allProjectsData = await db.projects.getAll();
            setAllProjects(allProjectsData);
            console.log('✅ App.tsx: All projects refreshed:', allProjectsData.length);
          } catch (error) {
            console.error('❌ App.tsx: Failed to refresh all projects:', error);
          }
        }

        // Role-specific script project fetching
        if (u.role === Role.CINE) {
          try {
            console.log('🔄 App.tsx: Refreshing script projects for Cine');
            const scriptProjects = await db.projects.getScriptProjects();
            setCineScriptProjects(scriptProjects);
            console.log('✅ App.tsx: Cine script projects refreshed:', scriptProjects.length);
          } catch (error) {
            console.error('❌ App.tsx: Failed to refresh script projects for Cine:', error);
          }
        } else if (u.role === Role.EDITOR) {
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
    } finally {
      isFetchingDataRef.current = false;
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
      
      // We don't await refreshData here because the useEffect on [user] 
      // will trigger it automatically upon state update. This avoids blocking 
      // the UI transition and prevents login timeouts.

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
      localStorage.removeItem('app_user_cache'); // Clear app user cache
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
      await (db as any).createDirectCreativeProject(title, channel, dueDate);
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

  // Global Loading State
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-black"></div>
          <p className="font-bold text-slate-600 animate-pulse">Loading Application...</p>
        </div>
      </div>
    );
  }

  // Main rendering logic
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
