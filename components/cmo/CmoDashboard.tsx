import React, { useEffect, useState } from 'react';
import { Project, Role, TaskStatus, STAGE_LABELS, WorkflowStage } from '../../types';
import { format } from 'date-fns';
import { Clock, Plus } from 'lucide-react';
import CmoReviewScreen from './CmoReviewScreen';
import CmoMyWork from './CmoMyWork';
import CmoProjectDetails from './CmoProjectDetails';
import Layout from '../Layout';
import { supabase } from '../../src/integrations/supabase/client';
import CmoHistoryDetail from './CmoHistoryDetail';
import CmoCalendar from './CmoCalendar';
import CmoOverview from './CmoOverview';
import Popup from '../Popup';
import CreateScript from '../writer/CreateScript';
import { db } from '../../services/supabaseDb';
import { getWorkflowState } from '../../services/workflowUtils';


interface Props {
  user: { full_name: string; role: Role };
  inboxProjects: Project[];
  historyProjects: Project[];
  onRefresh: () => void;
  onLogout: () => void;
  // Add allProjects prop
  allProjects?: Project[];
}

const STORAGE_KEY_PREFIX = 'cmo_dashboard_view_';

const CmoDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, onRefresh, onLogout, allProjects }) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const viewStorageKey = `activeView:${user.role}`;
  // Use allProjects for dashboard view, fallback to inboxProjects
  const dashboardProjects = allProjects || inboxProjects || [];
  const [viewMode, setViewMode] = useState<'REVIEW' | 'HISTORY' | 'PROJECT_DETAILS'>('REVIEW');
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const historyMapRef = React.useRef<Map<string, any>>(new Map());
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'SHOOT' | 'EDITOR'>('PENDING');
  const [filteredHistoryProjects, setFilteredHistoryProjects] = useState<Project[]>([]);
  const [isCreatingScript, setIsCreatingScript] = useState(false);
  // State for counts
  const [approvedCount, setApprovedCount] = useState(0);

  const handleInternalRefresh = async () => {
    console.log('🔄 CMO Dashboard: Refresh button clicked');
    console.log('🔄 CMO Dashboard: Calling onRefresh() to fetch data from Supabase');
    await onRefresh(); // MUST refetch from Supabase
    console.log('✅ CMO Dashboard: Data fetch completed');

    console.log('🔄 CMO Dashboard: Reloading counts');
    await loadCounts(); // Also reload counts
    console.log('✅ CMO Dashboard: Counts reloaded');

    console.log('🔄 CMO Dashboard: Updating refresh key to force UI re-render');
    setRefreshKey(prev => prev + 1); // force UI re-render
    console.log('✅ CMO Dashboard: Refresh completed');
  };

  // Popup state
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  const getStoredView = () => {
    if (typeof window === 'undefined') return 'dashboard';
    return localStorage.getItem(viewStorageKey) || 'dashboard';
  };
  const [activeView, setActiveView] = useState<string>(getStoredView());
  // Realtime: refresh CMO data when projects table changes
  useEffect(() => {
    const subscription = supabase
      .channel('public:projects:cmo_refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        try { onRefresh(); } catch (e) { console.error('Failed to refresh CMO data', e); }
      })
      .subscribe();

    return () => { try { supabase.removeChannel(subscription); } catch (e) { } };
  }, [onRefresh]);
  const handleViewChange = (view: string) => {
    setActiveView(view);
    if (typeof window !== 'undefined') {
      localStorage.setItem(viewStorageKey, view);
    }
  };

  useEffect(() => {
    setActiveView(getStoredView());
  }, [viewStorageKey]);

  // Load filtered history projects
  useEffect(() => {
    const loadHistory = async () => {
      if (activeTab !== 'HISTORY') return;

      const { data, error } = await supabase
        .from('workflow_history')
        .select(`
                    project_id,
                    action,
                    comment,
                    actor_name,
                    actor_id,
                    timestamp
                `)
        .eq('actor_id', user.id)
        .in('action', ['APPROVED', 'REJECTED']);

      if (error || !data) {
        setFilteredHistoryProjects([]);
        return;
      }

      // Map history by project_id
      const map = new Map<string, any>();
      data.forEach(h => map.set(h.project_id, h));
      historyMapRef.current = map;

      const projectIds = [...new Set(data.map(h => h.project_id))];

      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);

      setFilteredHistoryProjects(projects || []);
    };

    loadHistory();
  }, [activeTab, user.id]);

  // Load counts from the workflow_history table (count by user actions)
  const loadCounts = async () => {
    console.log('🔄 CMO Dashboard: Loading counts from workflow_history');
    try {
      // Approved: count workflow_history records where actor_id = user.id and action = APPROVED
      console.log('🔄 CMO Dashboard: Fetching approved count for user:', user.id);
      const { count: approvedCountResult, error: approvedErr } = await supabase
        .from('workflow_history')
        .select('*', { head: true, count: 'exact' })
        .eq('actor_id', user.id)
        .eq('action', 'APPROVED');

      if (approvedErr) throw approvedErr;

      console.log('✅ CMO Dashboard: Approved count loaded:', approvedCountResult);
      setApprovedCount(approvedCountResult || 0);
    } catch (err) {
      console.error('❌ CMO Dashboard: Failed to load counts from projects:', err);
    }
  };

  useEffect(() => {
    loadCounts();
  }, [user.id]);

  // Use inboxProjects for dashboard view (role-based filtering)
  // Use historyProjects for MyWork view (participation-based filtering)
  // Use filtered history projects for History tab
  const projects = activeView === 'mywork' ? (historyProjects || []) :
    activeTab === 'HISTORY' ? filteredHistoryProjects :
      (inboxProjects || []);

  console.log('CMO Dashboard - activeView:', activeView);
  console.log('CMO Dashboard - inboxProjects:', inboxProjects);
  const isReworkProject = (p: Project) => {
    // Check if this project has rework history caused by CMO
    if (!p.history) return false;
    
    // Find rework/reject actions in the project history
    // To determine if CMO initiated rework, we check if the action was taken when the project was assigned to CMO
    return p.history.some(h => {
      const isReworkAction = h.action === 'REJECTED' || h.action === 'REWORK' || h.action?.startsWith('REWORK_');
      
      // For rework projects, we need to check the from_stage to see if CMO was reviewing
      // CMO reviews at SCRIPT_REVIEW_L1 and FINAL_REVIEW_CMO stages
      return isReworkAction && 
             (h.from_stage === WorkflowStage.SCRIPT_REVIEW_L1 || 
              h.from_stage === WorkflowStage.FINAL_REVIEW_CMO);
    });
  };
  const isHighPriority = (p: Project) =>
    p.priority?.toUpperCase?.() === 'HIGH';
  const priorityCardClass = (p: Project) =>
    isHighPriority(p)
      ? 'ring-4 ring-red-500 ring-offset-2 shadow-red-300/50'
      : '';


  // Categorize Projects for CMO Dashboard
  // Column 1: Pending Approval Projects (Projects in CMO review stages with WAITING_APPROVAL status)

  // Scripts pending approval at CMO (only script projects, not idea projects)
  const pendingApprovalProjects = dashboardProjects.filter(
    p =>
      (
        p.assigned_to_role === Role.CMO ||  // Traditional assignment
        (p.visible_to_roles && p.visible_to_roles.includes('CMO'))  // Parallel visibility
      ) &&
      p.data?.source !== 'IDEA_PROJECT' &&
      p.status !== TaskStatus.DONE &&
      // Include script review stages and new multi-writer approval stage
      (p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 ||
       p.current_stage === WorkflowStage.FINAL_REVIEW_CMO ||
       p.current_stage === WorkflowStage.POST_WRITER_REVIEW)
  );


  // Column 2: Projects Pending at CEO (Projects that CMO has approved and sent to CEO)
  const pendingAtCEO = dashboardProjects.filter(
    p =>
      p.assigned_to_role === Role.CEO &&
      p.status === TaskStatus.WAITING_APPROVAL
  );



  // Column 3: Projects for Shoot (Projects assigned to Cine role)
  const inShoot = dashboardProjects.filter(
    p =>
      p.assigned_to_role === Role.CINE &&
      p.status !== TaskStatus.DONE
  );

  // Column 3: Projects for Editor (Projects assigned to Editor role)
  const inEditor = dashboardProjects.filter(
    p =>
      p.assigned_to_role === Role.EDITOR &&
      p.status !== TaskStatus.DONE
  );

  // Column 3: Ideas pending at CMO (Projects that originated as ideas and are assigned to CMO)
  const ideasPendingAtCMO = dashboardProjects.filter(
    p =>
      p.data?.source === 'IDEA_PROJECT' &&
      p.assigned_to_role === Role.CMO &&
      p.status !== TaskStatus.DONE
  );



  const handleReview = (project: Project) => {
    setViewMode('REVIEW');
    setSelectedProject(project);
  };

  const handleBack = () => {
    setSelectedProject(null);
    setViewMode('REVIEW');
    onRefresh();
  };

  if (selectedProject && viewMode === 'REVIEW') {
    return (
      <CmoReviewScreen
        project={selectedProject}
        onBack={handleBack}
        onComplete={handleBack}
      />
    );
  }

  if (selectedProject && viewMode === 'PROJECT_DETAILS') {
    return (
      <CmoProjectDetails
        project={selectedProject}
        onBack={handleBack}
      />
    );
  }

  if (selectedProject && viewMode === 'HISTORY') {
    return (
      <CmoHistoryDetail
        project={selectedProject}
        history={selectedHistory}
        onBack={handleBack}
        currentUser={user}
        onEdit={() => {
          // Set view mode to REVIEW to show the review screen
          setViewMode('REVIEW');
        }}
      />
    );
  }


  return (
    <>
      <Layout
        user={user as any}
        onLogout={onLogout}
        onOpenCreate={() => { }}
        activeView={activeView}
        onChangeView={handleViewChange}
      >
        {activeView === 'mywork' ? (
  <CmoMyWork
    user={user}
    projects={historyProjects}
    onReview={handleReview}
  />
) : activeView === 'overview' ? (
  <CmoOverview user={user} />
) : activeView === 'calendar' ? (
  <CmoCalendar projects={inboxProjects} />
        ) : (
          <div key={refreshKey} className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2">
                  CMO Console
                </h1>
                <p className="font-bold text-base sm:text-lg text-slate-500">
                  Welcome back, {user.full_name}
                </p>
              </div>

              <div className="flex space-x-2 flex-wrap gap-2">
                <button
                  onClick={() => setIsCreatingScript(true)}
                  className="px-6 py-4 bg-[#D946EF] text-white border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>New Script</span>
                </button>

                <button
                  onClick={() => setActiveTab('PENDING')}
                  className={`px-6 py-4 font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
              ${activeTab === 'PENDING'
                      ? 'bg-[#D946EF] text-white'
                      : 'bg-white text-slate-900 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}
                >
                  Pending
                </button>

                <button
                  onClick={() => setActiveTab('HISTORY')}
                  className={`px-6 py-4 font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
              ${activeTab === 'HISTORY'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-900 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}
                >
                  History
                </button>

                <button
                  onClick={() => {
                    console.log('MouseClicked: CMO Dashboard: Refresh button clicked');
                    handleInternalRefresh();
                  }}
                  className="bg-[#D946EF] text-white border-2 border-black px-6 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            {/* Content */}
            {activeTab === 'HISTORY' ? (
              <div className="space-y-6">
                {/* Column Headers */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-100 border-2 border-black font-black text-slate-700 uppercase text-xs">
                  <div className="col-span-4">Title</div>
                  <div className="col-span-2">Channel</div>
                  <div className="col-span-2">Stage</div>
                  <div className="col-span-2">Submitted</div>
                  <div className="col-span-2">Action</div>
                </div>

                <div className="space-y-4">
                  {projects.map(p => {
                    const history = historyMapRef.current.get(p.id);

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setViewMode('HISTORY');
                          setSelectedProject(p);
                          setSelectedHistory(history);
                        }}
                        className="grid grid-cols-12 gap-4 items-center bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                      >
                        <div className="col-span-4 font-black uppercase text-lg">
                          {p.title}
                        </div>

                        <div className="col-span-2">
                          <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${p.channel === 'YOUTUBE'
                            ? 'bg-[#FF4F4F] text-white'
                            : p.channel === 'LINKEDIN'
                              ? 'bg-[#0085FF] text-white'
                              : 'bg-[#D946EF] text-white'
                            }`}>
                            {p.channel}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span
                            className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${p.priority === 'HIGH'
                              ? 'bg-red-500 text-white'
                              : p.priority === 'NORMAL'
                                ? 'bg-yellow-500 text-black'
                                : 'bg-green-500 text-white'
                              }`}
                          >
                            {p.priority}
                          </span>
                        </div>

                        <div className="col-span-2 text-xs font-black uppercase text-slate-500">
                          {STAGE_LABELS[p.current_stage]}
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs font-bold uppercase text-slate-700">
                            By: {p.data?.writer_name || p.created_by_name || 'Unknown Writer'}
                          </div>
                          <div className="text-xs font-bold text-slate-500 uppercase">
                            {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                          </div>
                        </div>

                        <div className="col-span-2">
                          <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${history?.action === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            {history?.action}
                          </span>
                          {history?.action === 'REJECTED' && history?.comment && (
                            <div className="text-xs text-red-700 mt-1 truncate" title={history.comment}>
                              Reason: {history.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                {/* Column 1: Scripts Pending Approval at CMO */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#FF8C00] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-black uppercase tracking-wide">Scripts Pending Approval</h3>
                    <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{pendingApprovalProjects.length}</span>
                  </div>
                  <div className="space-y-4">
                    {pendingApprovalProjects.map(p => (
                      <div key={p.id} className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all" onClick={() => {
                        setViewMode('REVIEW');
                        setSelectedProject(p);
                      }}>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {p.data?.source === 'IDEA_PROJECT' && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                              {p.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                            </span>
                          )}
                          {p.data?.source === 'DESIGNER_INITIATED' && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-pink-100 text-pink-900">
                              DESIGNER
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                            p.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                              'bg-[#D946EF] text-white'
                            }`}>
                            {p.channel}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.priority === 'HIGH'
                              ? 'bg-red-500 text-white'
                              : p.priority === 'NORMAL'
                                ? 'bg-yellow-500 text-black'
                                : 'bg-green-500 text-white'
                              }`}>
                            {p.priority}
                          </span>
                          <span
                            className={`px-2 py-0.5 border-2 border-black text-[10px] font-black uppercase ${isReworkProject(p)
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-slate-100 text-slate-800'
                              }`}>
                            {isReworkProject(p) ? 'REWORK' : STAGE_LABELS[p.current_stage]}
                          </span>


                        </div>
                        <h4 className="font-black text-xl text-slate-900 mb-2 uppercase leading-tight">{p.title}</h4>
                        <div className="flex flex-col mt-4 border-t-2 border-slate-100 pt-3">
                          <div className="flex items-center text-xs font-bold text-slate-500 uppercase">
                            <Clock className="w-3 h-3 mr-1" />
                            By: {p.data?.writer_name || p.created_by_name || 'Unknown Writer'}
                          </div>
                          <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                            {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                          </div>
                        </div>
                      </div>
                    ))}
                    {pendingApprovalProjects.length === 0 && <div className="p-8 text-center text-gray-500">No projects pending approval</div>}
                  </div>
                </div>

                {/* Column 2: Idea Pending Approval */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#4ADE80] text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-black uppercase tracking-wide">Idea Pending Approval</h3>
                    <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{ideasPendingAtCMO.length}</span>
                  </div>
                  <div className="space-y-4">
                    {ideasPendingAtCMO.map(p => (
                      <div
                        key={p.id}
                        className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                        onClick={() => {
                          setViewMode('REVIEW');
                          setSelectedProject(p);
                        }}
                      >
                        <div className="flex flex-wrap gap-2 mb-4">
                          {p.data?.source === 'IDEA_PROJECT' && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                              {p.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                            p.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                              'bg-[#D946EF] text-white'
                            }`}>
                            {p.channel}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.priority === 'HIGH'
                              ? 'bg-red-500 text-white'
                              : p.priority === 'NORMAL'
                                ? 'bg-yellow-500 text-black'
                                : 'bg-green-500 text-white'
                              }`}>
                            {p.priority}
                          </span>
                          <span className="bg-green-100 text-green-800 px-2 py-0.5 border border-green-200 text-[10px] font-bold uppercase">
                            PENDING AT CMO
                          </span>
                        </div>
                        <h4 className="font-black text-lg text-slate-900 mb-2 uppercase">{p.title}</h4>
                        <div className="flex flex-col mt-4 border-t-2 border-slate-100 pt-3">
                          <div className="flex items-center text-xs font-bold text-slate-500 uppercase">
                            <Clock className="w-3 h-3 mr-1" />
                            By: {p.data?.writer_name || p.created_by_name || 'Unknown Writer'}
                          </div>
                          <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                            {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                          </div>
                        </div>
                      </div>
                    ))}
                    {ideasPendingAtCMO.length === 0 && <div className="p-8 text-center text-gray-500">No idea projects pending approval</div>}
                  </div>
                </div>

                {/* Column 3: Projects Pending at CEO */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#0085FF] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-black uppercase tracking-wide">In Review (Pending at CEO)</h3>
                    <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{pendingAtCEO.length}</span>
                  </div>
                  <div className="space-y-4">
                    {pendingAtCEO.map(p => (
                      <div
                        key={p.id}
                        className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                        onClick={() => {
                          setViewMode('REVIEW');
                          setSelectedProject(p);
                        }}
                      >
                        <div className="flex flex-wrap gap-2 mb-4">
                          {p.data?.source === 'IDEA_PROJECT' && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                              {p.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                            </span>
                          )}
                          <span className="text-xs font-black uppercase tracking-wider text-slate-400">{p.channel}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.priority === 'HIGH'
                              ? 'bg-red-500 text-white'
                              : p.priority === 'NORMAL'
                                ? 'bg-yellow-500 text-black'
                                : 'bg-green-500 text-white'
                              }`}>
                            {p.priority}
                          </span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 border border-blue-200 text-[10px] font-bold uppercase">
                            With CEO
                          </span>
                        </div>
                        <h4 className="font-black text-lg text-slate-900 mb-2 uppercase">{p.title}</h4>
                        <div className="flex flex-col mt-4 border-t-2 border-slate-100 pt-3">
                          <div className="flex items-center text-xs font-bold text-slate-500 uppercase">
                            <Clock className="w-3 h-3 mr-1" />
                            By: {p.data?.writer_name || p.created_by_name || 'Unknown Writer'}
                          </div>
                          <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                            {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                          </div>
                        </div>
                      </div>
                    ))}
                    {pendingAtCEO.length === 0 && <div className="p-8 text-center text-gray-500">No projects pending at CEO</div>}
                  </div>
                </div>

                {/* Column 4: Shoot and Editor Tabs */}
                <div className="space-y-4">
                  {/* Tabs for Shoot and Editor */}
                  <div className="flex border-b border-gray-200">
                    <button 
                      className={`px-4 py-2 font-black text-sm uppercase border-b-2 ${activeTab === 'SHOOT' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500'}`}
                      onClick={() => setActiveTab('SHOOT')}
                    >
                      Shoot ({inShoot.length})
                    </button>
                    <button 
                      className={`px-4 py-2 font-black text-sm uppercase border-b-2 ${activeTab === 'EDITOR' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-500'}`}
                      onClick={() => setActiveTab('EDITOR')}
                    >
                      Editor ({inEditor.length})
                    </button>
                  </div>
                  
                  {/* Content based on active tab */}
                  {activeTab === 'SHOOT' ? (
                    <>
                      <div className="flex items-center justify-between p-4 bg-[#A78BFA] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="font-black uppercase tracking-wide">Shoot (With Cine)</h3>
                        <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{inShoot.length}</span>
                      </div>
                      <div className="space-y-4">
                        {inShoot.map(p => (
                          <div
                            key={p.id}
                            className="bg-slate-50 p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            onClick={() => {
                              setViewMode('REVIEW');
                              setSelectedProject(p);
                            }}
                          >
                            <div className="flex flex-wrap gap-2 mb-4">
                              {p.data?.source === 'IDEA_PROJECT' && (
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                  {p.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                p.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                  'bg-[#D946EF] text-white'
                                }`}>
                                {p.channel}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.priority === 'HIGH'
                                  ? 'bg-red-500 text-white'
                                  : p.priority === 'NORMAL'
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-green-500 text-white'
                                  }`}>
                                {p.priority}
                              </span>
                              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 border border-purple-200 text-[10px] font-bold uppercase">
                                WITH CINE
                              </span>
                            </div>
                            <h4 className="font-black text-lg text-slate-900 mb-2 uppercase">{p.title}</h4>
                            <div className="flex flex-col mt-4 border-t-2 border-slate-100 pt-3">
                              <div className="flex items-center text-xs font-bold text-slate-500 uppercase">
                                <Clock className="w-3 h-3 mr-1" />
                                By: {p.data?.writer_name || p.created_by_name || 'Unknown Writer'}
                              </div>
                              <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                                {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                              </div>
                            </div>
                          </div>
                        ))}
                        {inShoot.length === 0 && <div className="p-8 text-center text-gray-500">No projects with Cine</div>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-4 bg-[#FBBF24] text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="font-black uppercase tracking-wide">Editor</h3>
                        <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{inEditor.length}</span>
                      </div>
                      <div className="space-y-4">
                        {inEditor.map(p => (
                          <div
                            key={p.id}
                            className="bg-slate-50 p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            onClick={() => {
                              setViewMode('REVIEW');
                              setSelectedProject(p);
                            }}
                          >
                            <div className="flex flex-wrap gap-2 mb-4">
                              {p.data?.source === 'IDEA_PROJECT' && (
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                  {p.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                p.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                  'bg-[#D946EF] text-white'
                                }`}>
                                {p.channel}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.priority === 'HIGH'
                                  ? 'bg-red-500 text-white'
                                  : p.priority === 'NORMAL'
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-green-500 text-white'
                                  }`}>
                                {p.priority}
                              </span>
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 border border-yellow-200 text-[10px] font-bold uppercase">
                                WITH EDITOR
                              </span>
                            </div>
                            <h4 className="font-black text-lg text-slate-900 mb-2 uppercase">{p.title}</h4>
                            <div className="flex flex-col mt-4 border-t-2 border-slate-100 pt-3">
                              <div className="flex items-center text-xs font-bold text-slate-500 uppercase">
                                <Clock className="w-3 h-3 mr-1" />
                                By: {p.data?.writer_name || p.created_by_name || 'Unknown Writer'}
                              </div>
                              <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                                {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                              </div>
                            </div>
                          </div>
                        ))}
                        {inEditor.length === 0 && <div className="p-8 text-center text-gray-500">No projects with Editor</div>}
                      </div>
                    </>
                  )}
                </div>



              </div>
            )}
          </div>
        )}

        {isCreatingScript && (
          <CreateScript
            creatorRole={Role.CMO}
            onClose={() => setIsCreatingScript(false)}
            onSuccess={async () => {
              setIsCreatingScript(false);
              await handleInternalRefresh();
            }}
          />
        )}

        {showPopup && (
          <Popup
            message={popupMessage}
            stageName={stageName}
            onClose={() => setShowPopup(false)}
          />
        )}
      </Layout>
    </>
  );
};

export default CmoDashboard;