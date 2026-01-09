import React, { useEffect, useState } from 'react';
import { Project, Role, TaskStatus, STAGE_LABELS, WorkflowStage } from '../../types';
import { format } from 'date-fns';
import { Clock, Plus } from 'lucide-react';
import CmoReviewScreen from './CmoReviewScreen';
import CmoMyWork from './CmoMyWork';
import Layout from '../Layout';
import { supabase } from '../../src/integrations/supabase/client';
import CmoHistoryDetail from './CmoHistoryDetail';
import CmoCalendar from './CmoCalendar';
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
  const [viewMode, setViewMode] = useState<'REVIEW' | 'HISTORY'>('REVIEW');
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const historyMapRef = React.useRef<Map<string, any>>(new Map());
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
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
  const isReworkProject = (p: Project) =>
    p.history?.some(h =>
      h.action === 'REJECTED' ||
      h.action?.startsWith('REWORK_')
    );
  const isHighPriority = (p: Project) =>
    p.priority?.toUpperCase?.() === 'HIGH';
  const priorityCardClass = (p: Project) =>
    isHighPriority(p)
      ? 'ring-4 ring-red-500 ring-offset-2 shadow-red-300/50'
      : '';


  // Categorize Projects for CMO Dashboard
  // Column 1: Pending Approval Projects (Projects in CMO review stages with WAITING_APPROVAL status)

  const pendingApprovalProjects = dashboardProjects.filter(
    p =>
      (
        (p.assigned_to_role === Role.CMO &&
          (
            p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 ||
            p.current_stage === WorkflowStage.FINAL_REVIEW_CMO
          )) ||
        // Also show idea projects that originated as ideas
        (p.data?.source === 'IDEA_PROJECT' && p.current_stage === WorkflowStage.FINAL_REVIEW_CMO)
      ) &&
      p.status !== TaskStatus.DONE
  );


  // Column 2: Projects Pending at CEO (Projects that CMO has approved and sent to CEO)
  const pendingAtCEO = dashboardProjects.filter(
    p =>
      p.assigned_to_role === Role.CEO &&
      p.status === TaskStatus.WAITING_APPROVAL
  );

  // Column 3: Projects in Production (Projects that have moved past CEO approval)
  const inProduction = dashboardProjects.filter(
    p =>
      (p.current_stage === WorkflowStage.CINEMATOGRAPHY ||
        p.current_stage === WorkflowStage.VIDEO_EDITING ||
        p.current_stage === WorkflowStage.THUMBNAIL_DESIGN ||
        p.current_stage === WorkflowStage.CREATIVE_DESIGN ||
        p.current_stage === WorkflowStage.FINAL_REVIEW_CMO ||
        p.current_stage === WorkflowStage.FINAL_REVIEW_CEO ||
        p.current_stage === WorkflowStage.OPS_SCHEDULING) &&
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

              <div className="flex space-x-2">
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
                    console.log('🖱️ CMO Dashboard: Refresh button clicked');
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
                          <div className="text-xs font-bold uppercase text-slate-700 mb-1">
                            By: {p.writer_name || p.data?.writer_name || p.created_by_name || 'Unknown Writer'}
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
                          {history?.action === 'REJECTED' && p.rejected_reason && (
                            <div className="text-xs text-red-700 mt-1 truncate" title={p.rejected_reason}>
                              Reason: {p.rejected_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Column 1: Pending Approval Projects */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#FF8C00] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-black uppercase tracking-wide">Pending Approval</h3>
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
                              IDEA
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
                              }`}
                          >
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
                        <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-4 border-t-2 border-slate-100 pt-3">
                          <span className="mr-2">By:</span> {p.writer_name || p.data?.writer_name || p.created_by_name || 'Unknown Writer'}
                        </div>
                        <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-2 border-t-2 border-slate-100 pt-2">
                          <Clock className="w-3 h-3 mr-1" />
                          {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                        </div>
                      </div>
                    ))}
                    {pendingApprovalProjects.length === 0 && <div className="p-8"></div>}
                  </div>
                </div>

                {/* Column 2: Projects Pending at CEO */}
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
                      >
                        <div className="flex flex-wrap gap-2 mb-4">
                          {p.data?.source === 'IDEA_PROJECT' && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                              IDEA
                            </span>
                          )}
                          <span className="text-xs font-black uppercase tracking-wider text-slate-400">{p.channel}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.priority === 'HIGH'
                              ? 'bg-red-500 text-white'
                              : p.priority === 'NORMAL'
                                ? 'bg-yellow-500 text-black'
                                : 'bg-green-500 text-white'
                              }`}
                          >
                            {p.priority}
                          </span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 border border-blue-200 text-[10px] font-bold uppercase">
                            With CEO
                          </span>
                        </div>
                        <h4 className="font-black text-lg text-slate-900 mb-4 uppercase">{p.title}</h4>
                        <div className="w-full bg-slate-100 h-2 border border-black overflow-hidden">
                          <div className="bg-[#0085FF] h-full w-2/3 animate-pulse"></div>
                        </div>
                      </div>
                    ))}
                    {pendingAtCEO.length === 0 && <div className="p-8"></div>}
                  </div>
                </div>

                {/* Column 3: Projects in Production */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#4ADE80] text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-black uppercase tracking-wide">Production</h3>
                    <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{inProduction.length}</span>
                  </div>
                  <div className="space-y-4">
                    {inProduction.map(p => (
                      <div
                        key={p.id}
                        className="bg-slate-50 p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <div className="flex flex-wrap gap-2 mb-4">
                          {p.data?.source === 'IDEA_PROJECT' && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                              IDEA
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
                              }`}
                          >
                            {p.priority}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border-2 border-black ${p.history && p.history.some(h => h.action === 'REJECTED' || h.action === 'REWORK_VIDEO_SUBMITTED' || h.action === 'REWORK_EDIT_SUBMITTED' || h.action === 'REWORK_DESIGN_SUBMITTED') ? 'bg-orange-100 text-orange-800' : p.assigned_to_role === Role.CINE ? 'bg-purple-100 text-purple-800' :
                            p.assigned_to_role === Role.EDITOR ? 'bg-yellow-100 text-yellow-800' :
                              p.assigned_to_role === Role.DESIGNER ? 'bg-pink-100 text-pink-800' :
                                'bg-slate-100 text-slate-700'
                            }`}>
                            {p.history && p.history.some(h => h.action === 'REJECTED' || h.action === 'REWORK_VIDEO_SUBMITTED' || h.action === 'REWORK_EDIT_SUBMITTED' || h.action === 'REWORK_DESIGN_SUBMITTED') ? 'Rework' : p.assigned_to_role === Role.CINE ? 'WITH CINE' :
                              p.assigned_to_role === Role.EDITOR ? 'WITH EDITOR' :
                                p.assigned_to_role === Role.DESIGNER ? 'CREATIVE DESIGN' :
                                  STAGE_LABELS[p.current_stage]}
                          </span>
                        </div>
                        <h4 className="font-black text-lg text-slate-900 mb-2 uppercase">{p.title}</h4>
                        <div className="w-full bg-slate-200 h-2 border border-black overflow-hidden mt-4">
                          <div className="bg-[#4ADE80] h-full w-3/4"></div>
                        </div>
                      </div>
                    ))}
                    {inProduction.length === 0 && <div className="p-8"></div>}
                  </div>
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