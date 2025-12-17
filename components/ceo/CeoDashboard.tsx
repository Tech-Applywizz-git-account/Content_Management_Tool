import React, { useState, useEffect } from 'react';
import { Project, Role, TaskStatus, STAGE_LABELS, WorkflowStage } from '../../types';
import { CheckCircle, Clock } from 'lucide-react';
import Layout from '../Layout';
import CeoReviewScreen from './CeoReviewScreen';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';
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
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [filteredHistoryProjects, setFilteredHistoryProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<'REVIEW' | 'HISTORY'>('REVIEW');
const [selectedHistory, setSelectedHistory] = useState<any>(null);
const historyMapRef = React.useRef<Map<string, any>>(new Map());
const [activeView, setActiveView] = useState<'dashboard' | 'calendar'>('dashboard');


  // Popup state
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [stageName, setStageName] = useState('');

  // Load counts from the workflow_history table (count by user actions)
  useEffect(() => {
    const loadCounts = async () => {
      try {
        // Approved: count workflow_history records where actor_id = user.id and action = APPROVED
        const { count: approvedCountResult, error: approvedErr } = await supabase
          .from('workflow_history')
          .select('*', { head: true, count: 'exact' })
          .eq('actor_id', user.id)
          .eq('action', 'APPROVED');

        if (approvedErr) throw approvedErr;

        // Rejected: count only full rejections where project was sent back to SCRIPT stage
        const { count: rejectedCountResult, error: rejectedErr } = await supabase
          .from('workflow_history')
          .select('*', { head: true, count: 'exact' })
          .eq('actor_id', user.id)
          .eq('action', 'REJECTED')
          .eq('stage', WorkflowStage.SCRIPT);

        if (rejectedErr) throw rejectedErr;

        console.log('CEO Dashboard - Approved by user:', approvedCountResult, 'Rejected by user:', rejectedCountResult);
        setApprovedCount(approvedCountResult || 0);
        setRejectedCount(rejectedCountResult || 0);
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

    loadCounts();

    // Real-time subscription: reload counts when `projects` table changes
    const subscription = supabase
      .channel('public:projects:ceo_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        console.debug('CEO Dashboard realtime event:', payload);
        loadCounts();
      })
      .subscribe();

    console.debug('CEO Dashboard realtime subscription created');

    return () => {
      // cleanup subscription
      try {
        supabase.removeChannel(subscription);
        console.debug('CEO Dashboard realtime subscription removed');
      } catch (e) {
        console.warn('Failed to remove CEO realtime subscription', e);
      }
    };
  }, []);

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




  // Use inboxProjects for dashboard view (role-based filtering)
  // Use filtered historyProjects for History view (approved-by-user filtering)
  const projects = activeTab === 'HISTORY' ? filteredHistoryProjects : (inboxProjects || []);
  
  // Logic: 
  // Pending = Projects specifically assigned to CEO (Waiting for Approval)
  // History = Projects CEO has previously acted on (in history) OR current projects not assigned to them but relevant
  const pendingApprovals = (inboxProjects || []).filter(p =>
  p.assigned_to_role === Role.CEO &&
  p.status === TaskStatus.WAITING_APPROVAL &&
  (
    p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2 ||
    p.current_stage === WorkflowStage.FINAL_REVIEW_CEO
  )
);



  // For history, we show all projects from historyProjects
  const historyProjectsFiltered = filteredHistoryProjects.sort(
  (a, b) =>
    new Date(b.created_at).getTime() -
    new Date(a.created_at).getTime()
);




  // Stats Calculations
  const pendingCount = pendingApprovals.length;
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
          await onRefresh();
        } catch (e) {
          console.error('Failed to refresh after back:', e);
        }
      }}
      onComplete={async () => {
        setSelectedProject(null);
        setViewMode('REVIEW');
        try {
          await onRefresh();
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
  const writerName =
    selectedProject.writer_name ||
    selectedProject.data?.writer_name ||
    'Unknown Writer';

  return (
    <Layout user={user as any} onLogout={onLogout} onOpenCreate={() => {}}>
      <div className="p-8 space-y-6">
        <button
          onClick={() => {
            setSelectedProject(null);
            setSelectedHistory(null);
          }}
          className="font-bold underline"
        >
          ← Back to History
        </button>

        <h1 className="text-3xl font-black uppercase">
          {selectedProject.title}
        </h1>

        {/* SCRIPT CONTENT */}
        <div className="border-2 border-black p-4 bg-slate-100">
          <h3 className="font-black uppercase mb-2">Script Content</h3>
          <pre className="whitespace-pre-wrap text-sm">
            {selectedProject.data?.script_content || 'No script'}
          </pre>
        </div>

        {/* CEO COMMENT */}
        {selectedHistory?.comment && (
          <div className="border-2 border-black p-4 bg-yellow-50">
            <h3 className="font-black uppercase mb-2">CEO Comment</h3>
            <p>{selectedHistory.comment}</p>
          </div>
        )}

        {/* STATUS */}
        <div className="border-2 border-black p-4 flex justify-between">
          <div>
            <p><strong>Writer:</strong> {writerName}</p>
            <p><strong>Reviewed By:</strong> {selectedHistory?.actor_name}</p>
          </div>
          <div className="text-right">
            <p className="font-black text-green-600">
              {selectedHistory?.action}
            </p>
            <p className="text-sm text-slate-500">
              {selectedHistory?.timestamp
                ? `${Math.floor(
                    (Date.now() - new Date(selectedHistory.timestamp).getTime()) /
                      3600000
                  )} hours ago`
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
            await onRefresh();
          } catch (e) {
            console.error('Failed to refresh after back (secondary):', e);
          }
        }}
        onComplete={async () => {
          setSelectedProject(null);
          try {
            await onRefresh();
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
      onOpenCreate={() => {}}
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
        onOpenCreate={() => {}}
        activeView={activeView}
        onChangeView={setActiveView}
    >
      <div className="space-y-10 animate-fade-in">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">Approvals</h1>
                <p className="font-bold text-lg text-slate-500">Welcome back, {user.full_name}</p>
            </div>
            
            {/* CEO has no create button - Role is purely approval */}
            <div className="hidden md:block">
                 <div className="bg-black text-white px-6 py-2 font-black uppercase border-2 border-black transform -rotate-2 shadow-[4px_4px_0px_0px_rgba(217,70,239,1)]">
                     Quality Gate Mode
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
                    <h3 className="font-black uppercase text-xl text-black tracking-tight group-hover:underline decoration-2 underline-offset-4">Pending<br/>Approvals</h3>
                    <Clock className="w-8 h-8 text-black" />
                </div>
                <div className="text-7xl font-black mb-4 text-black">{pendingCount}</div>
                <div className="font-bold text-sm uppercase tracking-widest text-black opacity-80">Requires Action</div>
            </div>

            {/* Blue Card - APPROVED TOTAL */}
            <div 
                onClick={() => setActiveTab('HISTORY')}
                className="bg-[#0085FF] p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer group"
            >
                <div className="flex justify-between items-start mb-6">
                    <h3 className="font-black uppercase text-xl text-white tracking-tight group-hover:underline decoration-2 underline-offset-4">Content<br/>Approved</h3>
                    <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <div className="text-7xl font-black mb-4 text-white">{approvedCount}</div>
                <div className="font-bold text-sm uppercase tracking-widest text-white opacity-80">All Time</div>
            </div>

            {/* Magenta Card - REJECTION RATE (Mockup) */}
            <div 
                onClick={() => setActiveTab('HISTORY')}
                className="bg-[#D946EF] p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer group"
            >
                <div className="flex justify-between items-start mb-6">
                    <h3 className="font-black uppercase text-xl text-white tracking-tight group-hover:underline decoration-2 underline-offset-4">Reworks</h3>
                    <div className="font-black text-2xl text-white border-2 border-white rounded-full w-8 h-8 flex items-center justify-center">!</div>
                </div>
                <div className="text-7xl font-black mb-4 text-white">{rejectedCount}</div>
                <div className="font-bold text-sm uppercase tracking-widest text-white opacity-80">Quality Control</div>
            </div>
        </div>

        {/* List Section */}
        <div className="pt-8">
            <div className="flex items-center space-x-6 mb-8 border-b-2 border-black">
                <button 
                    onClick={() => setActiveTab('PENDING')}
                    className={`text-2xl font-black uppercase pb-2 px-2 transition-all ${activeTab === 'PENDING' ? 'text-[#D946EF] border-b-4 border-[#D946EF] translate-y-[2px]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Inbox ({pendingCount})
                </button>
                <button 
                    onClick={() => setActiveTab('HISTORY')}
                    className={`text-2xl font-black uppercase pb-2 px-2 transition-all ${activeTab === 'HISTORY' ? 'text-black border-b-4 border-black translate-y-[2px]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    History
                </button>
            </div>
            
            {(activeTab === 'PENDING' ? pendingApprovals : historyProjectsFiltered).length > 0 ? (
                 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {(activeTab === 'PENDING' ? pendingApprovals : historyProjectsFiltered).map(project => (
                    <div 
                        key={project.id}
                        onClick={() => {
  if (activeTab === 'HISTORY') {
    setViewMode('HISTORY');
    setSelectedProject(project);
    setSelectedHistory(historyMapRef.current.get(project.id));
  } else {
    setViewMode('REVIEW');
    setSelectedProject(project);
  }
}}

                        className={`bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 cursor-pointer hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 transition-all group relative overflow-hidden ${project.status === TaskStatus.REJECTED ? 'bg-red-50' : ''}`}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${
                                project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' : 
                                project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' : 
                                'bg-[#D946EF] text-white'
                            }`}>
                                {project.channel}
                            </span>
                            {(
  project.current_stage === WorkflowStage.SCRIPT_REVIEW_L2 ||
  project.current_stage === WorkflowStage.FINAL_REVIEW_CEO
) && (

                                <span className="absolute top-0 right-0 bg-[#4ADE80] text-black text-[10px] font-black uppercase px-3 py-1 border-l-2 border-b-2 border-black animate-pulse">
                                    Action Required
                                </span>
                            )}
                             {project.status === TaskStatus.REJECTED && (
                                <span className="absolute top-0 right-0 bg-[#FF4F4F] text-white text-[10px] font-black uppercase px-3 py-1 border-l-2 border-b-2 border-black">
                                    Rework
                                </span>
                            )}
                        </div>
                        
                        <h3 className="text-2xl font-black text-slate-900 mb-2 leading-tight uppercase truncate">
                            {project.title}
                        </h3>
                        
                        <div className="space-y-2 mt-8 border-t-2 border-slate-100 pt-4">
                            <div className="flex justify-between text-sm">
                                <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Current Stage</span>
                                <span className="font-bold text-slate-900 uppercase text-xs">{STAGE_LABELS[project.current_stage]}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Submitted</span>
                                <span className="font-bold text-slate-900 uppercase text-xs">{format(new Date(project.created_at), 'MMM dd')}</span>
                            </div>
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