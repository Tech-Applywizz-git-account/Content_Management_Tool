import React, { useState, useEffect } from 'react';
import { Project, Role, TaskStatus, STAGE_LABELS, WorkflowStage } from '../../types';
import { CheckCircle, Clock } from 'lucide-react';
import Layout from '../Layout';
import CeoReviewScreen from './CeoReviewScreen';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { getWorkflowState } from '../../services/workflowUtils';
import { supabase } from '../../src/integrations/supabase/client';
import Popup from '../Popup';
import CeoCalendar from './CeoCalendar';

interface Props {
  user: { id: string; full_name: string; role: Role };
  inboxProjects: Project[];
  historyProjects: Project[];
  onRefresh: () => void;
  onLogout: () => void;
}

const CeoDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, onRefresh, onLogout }) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'REWORK'>('PENDING');

  const [refreshKey, setRefreshKey] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [ceoPendingCount, setCeoPendingCount] = useState(0);
  const [filteredHistoryProjects, setFilteredHistoryProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<'REVIEW' | 'HISTORY'>('REVIEW');
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  // State for project data in history view
  const [projectData, setProjectData] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const historyMapRef = React.useRef<Map<string, any>>(new Map());
  const [activeView, setActiveView] = useState<'dashboard' | 'calendar'>('dashboard');
  const [reworkProjects, setReworkProjects] = useState<Project[]>([]);


  const handleInternalRefresh = async () => {
    await onRefresh(); // MUST refetch from Supabase
    await loadCounts(); // Also reload counts
    setRefreshKey(prev => prev + 1); // force UI re-render
  };


  // Popup state
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  const isReworkProjectByCeo = (p: Project) => {
    // Check if this project has rework history caused by CEO
    if (!p.history) return false;
    
    // Find rework/reject actions in the project history
    // To determine if CEO initiated rework, we check if the action was taken when the project was assigned to CEO
    return p.history.some(h => {
      const isReworkAction = h.action === 'REJECTED' || h.action === 'REWORK' || h.action?.startsWith('REWORK_');
      
      // For rework projects, we need to check the from_stage to see if CEO was reviewing
      // CEO reviews at SCRIPT_REVIEW_L2 and FINAL_REVIEW_CEO stages
      return isReworkAction && 
             (h.from_stage === WorkflowStage.SCRIPT_REVIEW_L2 || 
              h.from_stage === WorkflowStage.FINAL_REVIEW_CEO);
    });
  };

  // Load counts from the workflow_history table and projects table (count by user actions)
  const loadCounts = async () => {
    try {
      // Approved: count workflow_history records where actor_id = user.id and action = APPROVED
      const { count: approvedCountResult, error: approvedErr } = await supabase
        .from('workflow_history')
        .select('*', { head: true, count: 'exact' })
        .eq('actor_id', user.id)
        .eq('action', 'APPROVED');

      if (approvedErr) throw approvedErr;

      // Rework: count projects that were sent for rework by the CEO user and are currently in REWORK status
      // First, find workflow_history entries where CEO performed REWORK/REJECTED action
      const { data: historyData, error: historyErr } = await supabase
        .from('workflow_history')
        .select('project_id')
        .eq('actor_id', user.id)
        .in('action', ['REWORK', 'REJECTED']);

      if (historyErr) throw historyErr;

      let reworkCountResult = 0;

      if (historyData && historyData.length > 0) {
        const projectIds = [...new Set(historyData.map(h => h.project_id))];

        // Then count projects that are currently in REWORK status
        const { count: projectCount, error: projectErr } = await supabase
          .from('projects')
          .select('*', { head: true, count: 'exact' })
          .in('id', projectIds)
          .eq('status', 'REWORK');

        if (projectErr) throw projectErr;
        reworkCountResult = projectCount || 0;
      } else {
        // If no history entries found, count is 0
        reworkCountResult = 0;
      }

      // Pending: count projects assigned to the user with WAITING_APPROVAL status
      const { count: pendingCountResult, error: pendingErr } = await supabase
        .from('projects')
        .select('*', { head: true, count: 'exact' })
        .eq('assigned_to_role', user.role)
        .eq('status', TaskStatus.WAITING_APPROVAL);

      if (pendingErr) throw pendingErr;

      console.log('CEO Dashboard - Approved by user:', approvedCountResult, 'Reworks by user:', reworkCountResult, 'Pending:', pendingCountResult);
      setApprovedCount(approvedCountResult || 0);
      setRejectedCount(reworkCountResult || 0); // Set rework count to rejectedCount state for the rework card
      setCeoPendingCount(pendingCountResult || 0); // New state for pending count
      // Debug: if rejected count is unexpected, fetch and log the rejected projects
      try {
        const { data: rejectedRows } = await supabase
          .from('projects')
          .select('id,title,current_stage,status')
          .eq('status', TaskStatus.REJECTED);

        console.log('CEO Dashboard - rejected projects list:', rejectedRows || []);
      } catch (logErr) {
        console.error('Failed to fetch rejected projects for debug:', logErr);
      }
    } catch (err) {
      console.error('Failed to load counts from projects:', err);
    }
  };

  useEffect(() => {
    loadCounts();

    // Real-time subscriptions: reload counts when `projects` or `workflow_history` table changes
    const projectsSubscription = supabase
      .channel('public:projects:ceo_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        console.debug('CEO Dashboard projects realtime event:', payload);
        loadCounts();
      })
      .subscribe();

    const historySubscription = supabase
      .channel('public:workflow_history:ceo_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_history' }, (payload) => {
        console.debug('CEO Dashboard workflow history realtime event:', payload);
        loadCounts();
      })
      .subscribe();

    // Listen for project deletions specifically
    const deletionSubscription = supabase
      .channel('public:projects:deletion_ceo_counts')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'projects' }, (payload) => {
        console.debug('CEO Dashboard project deletion event:', payload);
        loadCounts();
      })
      .subscribe();

    console.debug('CEO Dashboard realtime subscriptions created');

    return () => {
      // cleanup subscriptions
      try {
        supabase.removeChannel(projectsSubscription);
        supabase.removeChannel(historySubscription);
        supabase.removeChannel(deletionSubscription);
        console.debug('CEO Dashboard realtime subscriptions removed');
      } catch (e) {
        console.warn('Failed to remove CEO realtime subscriptions', e);
      }
    };
  }, [user.id]);

  // Load filtered history projects
  useEffect(() => {
    const loadHistory = async () => {
      if (activeTab !== 'HISTORY') return;

      const { data, error } = await supabase
        .from('workflow_history')
        .select(`
        id,
        project_id,
        action,
        comment,
        actor_name,
        actor_id,
        timestamp,
        stage
      `)
        .eq('actor_id', user.id)
        .eq('action', 'APPROVED')
        .order('timestamp', { ascending: false });

      if (error || !data) {
        setFilteredHistoryProjects([]);
        return;
      }

      // Get unique project IDs
      const projectIds = [...new Set(data.map(h => h.project_id))];

      // Fetch project details for all projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);

      if (projectsError) {
        console.error('Failed to fetch projects:', projectsError);
        setFilteredHistoryProjects([]);
        return;
      }

      // Create a map of project ID to project data
      const projectMap = new Map();
      projectsData.forEach(project => projectMap.set(project.id, project));

      // Store all history entries with project information
      const historyEntries = data.map(entry => {
        const project = projectMap.get(entry.project_id);
        return {
          ...entry,
          // Include project information
          title: project?.title || `Project ${entry.project_id}`,
          channel: project?.channel || 'UNKNOWN',
          priority: project?.priority || 'NORMAL', // Include priority
          current_stage: entry.stage,
          created_at: entry.timestamp,
          status: project?.status || 'UNKNOWN'
        };
      });

      // Map history by entry ID for detail view
      const map = new Map<string, any>();
      data.forEach(h => map.set(h.id, h));
      historyMapRef.current = map;

      setFilteredHistoryProjects(historyEntries);
    };

    loadHistory();
  }, [activeTab, user.id]);

  // Effect to fetch project data when viewing history detail
  React.useEffect(() => {
    // Reset state when not viewing history detail
    if (!selectedProject || viewMode !== 'HISTORY') {
      setProjectData(null);
      setLoadingProject(false); // Don't show loading when not viewing
      return;
    }

    // Check if selectedProject already has the necessary data
    if (selectedProject.data && selectedProject.title && selectedProject.channel) {
      // Project data is already available, no need to fetch
      setProjectData(selectedProject);
      setLoadingProject(false);
      return;
    }

    const fetchProject = async () => {
      setLoadingProject(true);

      try {
        if (!selectedProject.project_id) return;

        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', selectedProject.project_id)
          .single();

        if (error) throw error;

        setProjectData(data);
      } catch (err) {
        console.error('Failed to fetch project:', err);
        setProjectData(null);
      } finally {
        setLoadingProject(false);
      }
    };

    fetchProject();
  }, [selectedProject, viewMode]);




  // Use inboxProjects for dashboard view (role-based filtering)
  // Use filtered historyProjects for History view (approved-by-user filtering)
  const projects = activeTab === 'HISTORY' ? filteredHistoryProjects : (inboxProjects || []);

  // Logic: 
  // Pending = Projects in CEO review stages with WAITING_APPROVAL status
  // History = Projects CEO has previously acted on (in history) OR current projects not assigned to them but relevant
  const pendingApprovals = (inboxProjects || []).filter(p =>
    (p.status === TaskStatus.WAITING_APPROVAL || p.status === TaskStatus.REJECTED) &&
    (
      p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2 ||
      p.current_stage === WorkflowStage.FINAL_REVIEW_CEO ||
      // Also include idea projects that reached CEO stage
      (p.data?.source === 'IDEA_PROJECT' && p.current_stage === WorkflowStage.FINAL_REVIEW_CEO)
    )
  );

  // Get all projects that are currently in rework status and were sent back by the CEO
  useEffect(() => {
    if (activeTab !== 'REWORK') return;

    const loadReworkProjects = async () => {
      // 1️⃣ Find rework actions done by this CEO
      const { data: history, error } = await supabase
        .from('workflow_history')
        .select('project_id, timestamp')
        .eq('actor_id', user.id)
        .in('action', ['REWORK', 'REJECTED'])
        .order('timestamp', { ascending: false });

      if (error || !history?.length) {
        setReworkProjects([]);
        return;
      }

      // 2️⃣ Fetch projects for those actions
      const projectIds = [...new Set(history.map(h => h.project_id))];

      const { data: projects } = await supabase
        .from('projects')
        .select('*, workflow_history(*)')
        .in('id', projectIds)
        .eq('status', 'REWORK');

      setReworkProjects(projects || []);
    };

    loadReworkProjects();

    // Real-time subscription for rework projects
    const reworkSubscription = supabase
      .channel('public:workflow_history:rework_projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_history' }, (payload) => {
        // Only reload if the change is related to this CEO's rework actions
        if (payload.new?.actor_id === user.id && ['REWORK', 'REJECTED'].includes(payload.new?.action || payload.old?.action)) {
          loadReworkProjects();
        }
      })
      .subscribe();

    // Cleanup function
    return () => {
      try {
        supabase.removeChannel(reworkSubscription);
      } catch (e) {
        console.warn('Failed to remove rework projects subscription', e);
      }
    };
  }, [activeTab, user.id]);


  // Filter pending approvals for rework projects
  const filteredPendingApprovals = pendingApprovals.filter(p =>
    p.status === TaskStatus.REWORK ||
    p.history?.some(h => h.action === 'REWORK' || h.action === 'REWORK_VIDEO_SUBMITTED' || h.action === 'REWORK_EDIT_SUBMITTED' || h.action === 'REWORK_DESIGN_SUBMITTED')
  );



  // For history, we show all projects from historyProjects
  const historyProjectsFiltered = filteredHistoryProjects.sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );




  // Stats Calculations
  const inboxPendingCount = pendingApprovals.length;
  const filteredPendingCount = filteredPendingApprovals.length;
  const reworkProjectsCount = reworkProjects.length;
  // Approved and rejected counts are loaded from workflow history

  const handleReview = (project: Project) => {
    setSelectedProject(project);
  };

  const handleBack = () => {
    setSelectedProject(null);
    onRefresh();
  };

  // ✅ REVIEW MODE (ONLY from PENDING tab)
  if (selectedProject && viewMode === 'REVIEW') {
    return (
      <CeoReviewScreen
        project={selectedProject}
        onBack={async () => {
          setSelectedProject(null);
          setViewMode('REVIEW');
          try {
            await handleInternalRefresh();
          } catch (e) {
            console.error('Failed to refresh after back:', e);
          }
        }}
        onComplete={async () => {
          setSelectedProject(null);
          setViewMode('REVIEW');
          try {
            await handleInternalRefresh();
          } catch (e) {
            console.error('Failed to refresh after complete:', e);
          }
        }}
        user={user}
      />
    );
  }

  // ✅ HISTORY MODE (READ-ONLY)
  if (selectedProject && viewMode === 'HISTORY') {
    if (loadingProject) {
      return (
        <Layout user={user as any} onLogout={onLogout} onOpenCreate={() => { }}>
          <div className="p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4"></div>
              <p>Loading project details...</p>
            </div>
          </div>
        </Layout>
      );
    }

    if (!projectData) {
      return (
        <Layout user={user as any} onLogout={onLogout} onOpenCreate={() => { }}>
          <div className="p-8">
            <div className="bg-red-50 border-2 border-red-200 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-red-800 mb-2">Project Not Found</h2>
              <p className="text-red-600">Unable to load project details.</p>
            </div>
          </div>
        </Layout>
      );
    }

    const creatorName =
      projectData.data?.cmo_name ||
      projectData.data?.writer_name ||
      projectData.cmo_name ||
      projectData.writer_name ||
      'Unknown Creator';

    return (
      <Layout user={user as any} onLogout={onLogout} onOpenCreate={() => { }}>
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-center">
            <button
              onClick={() => {
                setSelectedProject(null);
                setSelectedHistory(null);
              }}
              className="font-bold underline"
            >
              ← Back to History
            </button>
            {/* Edit button - only show if current user is the actor */}
            {selectedHistory?.actor_id === user.id && (
              <button
                onClick={async () => {
                  // Switch to review mode to edit, but use the full project data
                  setViewMode('REVIEW');
                  // We need to make sure the selectedProject is the actual project, not the history entry
                  if (selectedProject.project_id && !selectedProject.data) {
                    // Fetch the full project data if not already available
                    const { data, error } = await supabase
                      .from('projects')
                      .select('*')
                      .eq('id', selectedProject.project_id)
                      .single();
                    
                    if (data) {
                      setSelectedProject(data);
                    }
                  }
                }}
                className="px-4 py-2 bg-[#0085FF] text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                Edit
              </button>
            )}
          </div>

          <h1 className="text-3xl font-black uppercase">
            {projectData.title} - Approved
          </h1>
          <p className="text-slate-600">
            Approved on {selectedHistory?.timestamp ? new Date(selectedHistory.timestamp).toLocaleString() : 'Unknown date'}
          </p>

          {/* SCRIPT CONTENT */}
          <div className="border-2 border-black p-4 bg-slate-100">
            <h3 className="font-black uppercase mb-2">Script Content</h3>
            {projectData.data?.script_content 
              ? <div className="whitespace-pre-wrap text-sm" dangerouslySetInnerHTML={{ __html: projectData.data.script_content }} />
              : <p>No script</p>
            }
          </div>

          {/* CEO COMMENT */}
          {selectedHistory?.comment && (
            <div className="border-2 border-black p-4 bg-yellow-50">
              <h3 className="font-black uppercase mb-2">CEO Comment</h3>
              <p>{selectedHistory.comment}</p>
            </div>
          )}

          {/* REJECTION REASON */}
          {selectedHistory?.action === 'REJECTED' && selectedHistory?.comment && (
            <div className="border-2 border-black p-4 bg-red-50">
              <h3 className="font-black uppercase mb-2 text-red-800">Rejection Reason</h3>
              <p className="text-red-700">{selectedHistory.comment}</p>
            </div>
          )}

          {/* ACTION DETAILS */}
          <div className="border-2 border-black p-4 flex justify-between">
            <div>
              <p><strong>Creator:</strong> {creatorName}</p>
              <p><strong>Approved By:</strong> {selectedHistory?.actor_name}</p>
              <p><strong>Stage:</strong> {STAGE_LABELS[selectedHistory?.stage] || selectedHistory?.stage}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-green-600">
                Approved
              </p>
              <p className="text-sm text-slate-500">
                {selectedHistory?.timestamp
                  ? new Date(selectedHistory.timestamp).toLocaleString()
                  : ''}
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }


  const handleTabChange = (tab: 'PENDING' | 'HISTORY') => {
    setActiveTab(tab);
  };
  if (selectedProject && viewMode === 'REVIEW') {
    return (
      <CeoReviewScreen
        project={selectedProject}
        onBack={async () => {
          setSelectedProject(null);
          try {
            await handleInternalRefresh();
          } catch (e) {
            console.error('Failed to refresh after back (secondary):', e);
          }
        }}
        onComplete={async () => {
          setSelectedProject(null);
          try {
            await handleInternalRefresh();
          } catch (e) {
            console.error('Failed to refresh after complete (secondary):', e);
          }
        }}
        user={user}
      />
    );
  }
  if (activeView === 'calendar') {
    return (
      <Layout
        user={user as any}
        onLogout={onLogout}
        onOpenCreate={() => { }}
        activeView={activeView}
        onChangeView={setActiveView}
      >
        <CeoCalendar
          projects={[
            ...(inboxProjects || []),
            ...(filteredHistoryProjects || [])
          ]}
        />
      </Layout>
    );
  }



  return (
    <Layout
      user={user as any}
      onLogout={onLogout}
      onOpenCreate={() => { }}
      activeView={activeView}
      onChangeView={setActiveView}
    >
      <div key={refreshKey} className="space-y-10 animate-fade-in">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">Approvals</h1>
            <p className="font-bold text-lg text-slate-500">Welcome back, {user.full_name}</p>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleInternalRefresh}
              className="px-6 py-3 border-2 border-black font-black uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white text-black hover:bg-slate-50"
            >
              🔄 Refresh
            </button>
            {/* CEO has no create button - Role is purely approval */}
            <div className="hidden md:block">
              <div className="bg-black text-white px-6 py-2 font-black uppercase border-2 border-black transform -rotate-2 shadow-[4px_4px_0px_0px_rgba(217,70,239,1)]">
                Quality Gate Mode
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards Grid - Purely Approval Focused */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Green Card - PENDING APPROVALS */}
          <div
            onClick={() => setActiveTab('PENDING')}
            className="bg-[#4ADE80] p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-black uppercase text-xl text-black tracking-tight group-hover:underline decoration-2 underline-offset-4">Pending<br />Approvals</h3>
              <Clock className="w-8 h-8 text-black" />
            </div>
            <div className="text-7xl font-black mb-4 text-black">{ceoPendingCount}</div>
            <div className="font-bold text-sm uppercase tracking-widest text-black opacity-80">Requires Action</div>
          </div>

          {/* Blue Card - APPROVED TOTAL */}
          <div
            onClick={() => setActiveTab('HISTORY')}
            className="bg-[#0085FF] p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-black uppercase text-xl text-white tracking-tight group-hover:underline decoration-2 underline-offset-4">Content<br />Approved</h3>
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div className="text-7xl font-black mb-4 text-white">{approvedCount}</div>
            <div className="font-bold text-sm uppercase tracking-widest text-white opacity-80">All Time</div>
          </div>

          {/* Magenta Card - REJECTION RATE (Mockup) */}
          <div
            onClick={() => setActiveTab('REWORK')}
            className="bg-[#D946EF] p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-black uppercase text-xl text-white tracking-tight group-hover:underline decoration-2 underline-offset-4">Reworks</h3>
              <div className="font-black text-2xl text-white border-2 border-white rounded-full w-8 h-8 flex items-center justify-center">!</div>
            </div>
            <div className="text-7xl font-black mb-4 text-white">{rejectedCount}</div>
            <div className="font-bold text-sm uppercase tracking-widest text-white opacity-80">Sent Back for Fixes</div>
          </div>
        </div>

        {/* List Section */}
        <div className="pt-8">
          <div className="flex items-center space-x-6 mb-8 border-b-2 border-black">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`text-2xl font-black uppercase pb-2 px-2 transition-all ${activeTab === 'PENDING' ? 'text-[#D946EF] border-b-4 border-[#D946EF] translate-y-[2px]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Inbox ({inboxPendingCount})
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`text-2xl font-black uppercase pb-2 px-2 transition-all ${activeTab === 'HISTORY' ? 'text-black border-b-4 border-black translate-y-[2px]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('REWORK')}
              className={`text-2xl font-black uppercase pb-2 px-2 transition-all ${activeTab === 'REWORK' ? 'text-[#D946EF] border-b-4 border-[#D946EF] translate-y-[2px]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Rework ({reworkProjectsCount})
            </button>
          </div>

          {(activeTab === 'PENDING' ? pendingApprovals : activeTab === 'REWORK' ? reworkProjects : historyProjectsFiltered).length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {(activeTab === 'PENDING' ? pendingApprovals : activeTab === 'REWORK' ? reworkProjects : historyProjectsFiltered).map(project => (
                <div
                  key={project.id}
                  onClick={async () => {
                    if (activeTab === 'HISTORY') {
                      setViewMode('HISTORY');
                                      
                      // For history entries, we need to get the full project data
                      // Check if project already has full data, otherwise fetch it
                      if (project.data && project.priority) {
                        // Project already has full data
                        setSelectedProject(project);
                      } else {
                        // Need to fetch full project data
                        const { data: fullProject, error } = await supabase
                          .from('projects')
                          .select('*')
                          .eq('id', project.project_id)
                          .single();
                                        
                        if (fullProject) {
                          setSelectedProject(fullProject);
                        } else {
                          // Fallback to the history entry if full data unavailable
                          setSelectedProject(project);
                        }
                      }
                                      
                      // For history entries, we stored them by history entry ID
                      setSelectedHistory(historyMapRef.current.get(project.id));
                    } else {
                      setViewMode('REVIEW');
                      setSelectedProject(project);
                    }
                  }}

                  className={`bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 cursor-pointer hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 transition-all group relative overflow-hidden ${project.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`}
                >
                  <div className="flex flex-wrap gap-2 items-start mb-6 pr-8">
                    {project.data?.source === 'IDEA_PROJECT' && (
                      <span className="px-3 py-1 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                        {project.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                      </span>
                    )}
                    {project.data?.source === 'DESIGNER_INITIATED' && (
                      <span className="px-3 py-1 text-xs font-black uppercase border-2 border-black bg-pink-100 text-pink-900">
                        DESIGNER
                      </span>
                    )}
                    {/* Show REWORK badge if project is in rework status initiated by CEO */}
                    {isReworkProjectByCeo(project) && (
                      <span className="px-3 py-1 text-xs font-black uppercase border-2 border-black bg-red-100 text-red-800">
                        REWORK
                      </span>
                    )}
                    <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                        project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                          'bg-[#D946EF] text-white'
                      }`}>
                      {project.channel}
                    </span>
                    <span
                      className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                        ? 'bg-red-600 text-white font-black'
                        : project.priority === 'NORMAL'
                          ? 'bg-yellow-500 text-black'
                          : 'bg-green-500 text-white'
                        }`}
                    >
                      {project.priority}{project.priority === 'HIGH' && ' ★'}
                    </span>
                    {activeTab === 'HISTORY' && (
                      <span className="absolute top-0 right-0 bg-[#4ADE80] text-black text-[10px] font-black uppercase px-3 py-1 border-l-2 border-b-2 border-black">
                        Approved
                      </span>
                    )}
                    {activeTab === 'PENDING' && (
                      <span className="absolute top-0 right-0 bg-[#4ADE80] text-black text-[10px] font-black uppercase px-3 py-1 border-l-2 border-b-2 border-black animate-pulse">
                        Action Required
                      </span>
                    )}
                  </div>

                  <h3 className="text-2xl font-black text-slate-900 mb-2 leading-tight uppercase truncate">
                    {project.title}
                  </h3>
                  <div className="space-y-2 mt-8 border-t-2 border-slate-100 pt-4">
                    {activeTab === 'HISTORY' ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Writer</span>
                          <span className="font-bold text-slate-900 uppercase text-xs">{project.data?.writer_name || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Action</span>
                          <span className={`font-bold text-slate-900 uppercase text-xs ${project.action === 'APPROVED' ? 'text-green-600' : 'text-red-600'}`}>
                            {project.action}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Stage</span>
                          <span className="font-bold text-slate-900 uppercase text-xs">
                            {project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'IDEA REVIEW' : project.data?.source === 'IDEA_PROJECT' && project.data?.script_content ? 'IDEA-TO-SCRIPT REVIEW' : STAGE_LABELS[project.current_stage] || project.current_stage}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Date</span>
                          <span className="font-bold text-slate-900 uppercase text-xs">{format(new Date(project.timestamp), 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Writer</span>
                          <span className="font-bold text-slate-900 uppercase text-xs">{project.data?.writer_name || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Current Stage</span>
                          <span className="font-bold text-slate-900 uppercase text-xs">
                            {project.data?.source === 'IDEA_PROJECT' && !project.data?.script_content ? 'IDEA REVIEW' : project.data?.source === 'IDEA_PROJECT' && project.data?.script_content ? 'IDEA-TO-SCRIPT REVIEW' : STAGE_LABELS[project.current_stage]}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Status</span>
                          <span className={`font-bold text-slate-900 uppercase text-xs ${project.status === 'REWORK' ? 'text-red-600' : ''}`}>
                            {project.status === 'REWORK' ? 'Rework Required' : project.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Submitted</span>
                          <span className="font-bold text-slate-900 uppercase text-xs">{format(new Date(project.created_at), 'MMM dd')}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-black p-16 text-center bg-[#F8FAFC]">
              <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase">
                {activeTab === 'PENDING' ? 'All caught up!' : 'No history found.'}
              </h3>
              <p className="text-slate-500 font-medium">
                {activeTab === 'PENDING' ? 'No items currently require your approval.' : 'Items you approve will appear here.'}
              </p>
            </div>
          )}
        </div>

      </div>
      {showPopup && (
        <Popup
          message={popupMessage}
          stageName={stageName}
          onClose={() => setShowPopup(false)}
        />
      )}
    </Layout>
  );
};

export default CeoDashboard;