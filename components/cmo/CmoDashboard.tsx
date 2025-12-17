import React, { useEffect, useState } from 'react';
import { Project, Role, TaskStatus, STAGE_LABELS, WorkflowStage } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { RotateCcw, FileText, CheckCircle } from 'lucide-react';
import CmoReviewScreen from './CmoReviewScreen';
import CmoMyWork from './CmoMyWork';
import Layout from '../Layout';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import CmoHistoryDetail from './CmoHistoryDetail';
import CmoCalendar from './CmoCalendar';
import Popup from '../Popup';


interface Props {
    user: { full_name: string; role: Role };
    inboxProjects: Project[];
    historyProjects: Project[];
    onRefresh: () => void;
    onLogout: () => void;
}

const STORAGE_KEY_PREFIX = 'cmo_dashboard_view_';

const CmoDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, onRefresh, onLogout }) => {
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING');
    const viewStorageKey = `activeView:${user.role}`;
    const dashboardProjects = inboxProjects || [];
    const [viewMode, setViewMode] = useState<'REVIEW' | 'HISTORY'>('REVIEW');
const [selectedHistory, setSelectedHistory] = useState<any>(null);
const historyMapRef = React.useRef<Map<string, any>>(new Map());
const [passedToCEOCount, setPassedToCEOCount] = useState(0);

const cmoPendingProjects = dashboardProjects.filter(
  p =>
    p.assigned_to_role === Role.CMO &&
    p.status !== TaskStatus.DONE
);

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');

    const getStoredView = () => {
        if (typeof window === 'undefined') return 'dashboard';
        return localStorage.getItem(viewStorageKey) || 'dashboard';
    };
    const [activeView, setActiveView] = useState<string>(getStoredView);
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING_L1' | 'WITH_CEO' | 'REWORKS' | null>(null);
    const [approvedCount, setApprovedCount] = useState(0);
    const [rejectedCount, setRejectedCount] = useState(0);
    const [filteredHistoryProjects, setFilteredHistoryProjects] = useState<Project[]>([]);
useEffect(() => {
  const channel = supabase
    .channel('public:projects:cmo_refresh')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'projects' },
      () => {
        console.log('🔄 CMO dashboard internal refresh triggered');
        onRefresh(); // 🔥 THIS IS THE KEY
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [onRefresh]);

    // Load counts from the projects table (derive counts from current project state)
    useEffect(() => {
        const loadCounts = async () => {
            try {
                // Approved: projects marked DONE or APPROVED
                const { count: approvedCountResult, error: approvedErr } = await supabase
                    .from('projects')
                    .select('*', { head: true, count: 'exact' })
                    .in('status', [TaskStatus.DONE, 'APPROVED']);

                if (approvedErr) throw approvedErr;
                // Passed to CEO (source of truth)



                // Rejected: projects with REJECTED status
                const { count: rejectedCountResult, error: rejectedErr } = await supabase
                    .from('projects')
                    .select('*', { head: true, count: 'exact' })
                    .eq('status', TaskStatus.REJECTED);

                if (rejectedErr) throw rejectedErr;

                setApprovedCount(approvedCountResult || 0);
                setRejectedCount(rejectedCountResult || 0);
            } catch (error) {
                console.error('Failed to load counts from projects:', error);
            }
        };

        loadCounts();

        const subscription = supabase
            .channel('public:projects:cmo_counts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
                console.debug('CMO Dashboard realtime event received:', payload);
                try {
                    loadCounts();
                } catch (e) {
                    console.error('Error in realtime loadCounts handler:', e);
                }
            })
            .subscribe();

        console.debug('CMO Dashboard realtime subscription created:', subscription);

        return () => {
            try {
                supabase.removeChannel(subscription);
                console.debug('CMO Dashboard realtime subscription removed');
            } catch (e) {
                console.warn('Failed to remove CMO realtime subscription', e);
            }
        };
    }, [user.id]);

    // Load filtered history projects
    useEffect(() => {
  const loadFilteredHistoryProjects = async () => {
    if (tab !== 'ALL') {
      setFilteredHistoryProjects([]);
      return;
    }

    try {
      // 1️⃣ Get workflow history for this user (approved OR rejected)
    const { data: historyEntries, error } = await supabase
  .from('workflow_history')
  .select(`
    project_id,
    action,
    timestamp,
    comment,
    actor_name
  `)
  .eq('actor_id', user.id)
  .in('action', ['APPROVED', 'REJECTED']);

    

      if (error) throw error;

      if (!historyEntries || historyEntries.length === 0) {
        setFilteredHistoryProjects([]);
        return;
      }
const map = new Map<string, any>();

historyEntries.forEach(entry => {
  map.set(entry.project_id, entry);
});

historyMapRef.current = map;


      // 2️⃣ Unique project IDs
      const projectIds = [...new Set(historyEntries.map(h => h.project_id))];

      // 3️⃣ Fetch projects by those IDs
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);

      if (projectError) throw projectError;

      setFilteredHistoryProjects(
        (projects || []).sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )
      );
    } catch (error) {
      console.error('Failed to load history projects:', error);
      setFilteredHistoryProjects([]);
    }
  };

  loadFilteredHistoryProjects();
}, [tab, user.id]);
const handleProjectClick = (project: Project) => {
  if (tab === 'ALL') {
    setViewMode('HISTORY');
    setSelectedProject(project);
    setSelectedHistory(historyMapRef.current.get(project.id));
  } else {
    setViewMode('REVIEW');
    setSelectedProject(project);
  }
};


    const handleViewChange = (view: string) => {
        setActiveView(view);
        if (typeof window !== 'undefined') {
            localStorage.setItem(viewStorageKey, view);
        }
    };

    useEffect(() => {
        setActiveView(getStoredView());
    }, [viewStorageKey]);

    // Use inboxProjects for dashboard view (role-based filtering)
    // Use historyProjects for MyWork view (participation-based filtering)
    const projects = activeView === 'mywork' ? (historyProjects || []) : (inboxProjects || []);
    
    console.log('CMO Dashboard - activeView:', activeView);
    console.log('CMO Dashboard - inboxProjects:', inboxProjects);

    // Filter Logic:
    // Pending L1 Reviews - Projects assigned to CMO for L1 review
    // Pending Script Review (L1)
const pendingL1 = dashboardProjects.filter(
  p =>
    p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 &&
    p.status !== TaskStatus.DONE
);

// Final Reviews (after design, before CEO)


// Passed to CEO
const passedToCEO = dashboardProjects.filter(
  p =>
    p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2 &&
    p.status !== TaskStatus.DONE
);

// Reworks requested by CMO
const cmoReworks = dashboardProjects.filter(
  p => p.status === TaskStatus.REJECTED
);


    // All CMO-related projects for the "PENDING" tab
const pendingApprovals = cmoPendingProjects;


   const allProjects = React.useMemo(() => {
  const map = new Map<string, Project>();

  [...(inboxProjects || []), ...(historyProjects || [])].forEach(p => {
    map.set(p.id, p);
  });

  return Array.from(map.values());
}, [inboxProjects, historyProjects]);
const passedToCEOProjects = allProjects.filter(
  p =>
    p.assigned_to_role === Role.CEO &&
    p.status !== TaskStatus.DONE
);
useEffect(() => {
  setPassedToCEOCount(passedToCEOProjects.length);
}, [passedToCEOProjects]);



    // Determine which projects to display based on active filter
    const getDisplayedProjects = () => {
        if (tab === 'ALL') {
            // For the History tab, show only approved projects by this user
            return filteredHistoryProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        
        switch (activeFilter) {
            case 'PENDING_L1':
                return pendingL1;
            case 'WITH_CEO':
  return allProjects.filter(
    p => p.assigned_to_role === Role.CEO && p.status !== TaskStatus.DONE
  );
            case 'REWORKS':
  return allProjects.filter(p => p.status === TaskStatus.REJECTED);

            default:
                return pendingApprovals;
        }
    };

    const displayedProjects = getDisplayedProjects();

    const handleReview = (project: Project) => {
        setSelectedProject(project);
    };

    const handleBack = () => {
        setSelectedProject(null);
        onRefresh();
    };

    const handleStatCardClick = (filter: 'PENDING_L1' | 'WITH_CEO' | 'REWORKS') => {
        if (activeFilter === filter) {
            setActiveFilter(null); // Deselect if already selected
        } else {
            setActiveFilter(filter);
        }
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
    />
  );
}


    return (
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => { }} // CMO cannot create
            activeView={activeView}
            onChangeView={handleViewChange}
        >
            {activeView === 'mywork' ? (
      <CmoMyWork user={user} projects={historyProjects} onReview={handleReview} />
    ) : activeView === 'calendar' ? (
      <CmoCalendar projects={inboxProjects} />
    ) : (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">CMO Console</h1>
                            <p className="font-bold text-lg text-slate-500">Welcome back, {user.full_name}</p>
                        </div>
      

                        <div className="flex space-x-2">
                            <button
                                onClick={() => { setTab('PENDING'); setActiveFilter(null); }}
                                className={`px-6 py-3 border-2 border-black font-black uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${tab === 'PENDING' ? 'bg-[#0085FF] text-white hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-slate-50'}`}
                            >
                                Pending ({cmoPendingProjects.length})

                            </button>
                            <button
                                onClick={() => { setTab('ALL'); setActiveFilter(null); }}
                                className={`px-6 py-3 border-2 border-black font-black uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${tab === 'ALL' ? 'bg-black text-white hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-slate-50'}`}
                            >
                                History
                            </button>
                        </div>
                    </div>

                    {/* Stats Strip */}
                    {tab === 'PENDING' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Yellow Card - SCRIPT REVIEW L1 */}
                            <div 
                                onClick={() => handleStatCardClick('PENDING_L1')}
                                className={`bg-[#FFB800] p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer group ${activeFilter === 'PENDING_L1' ? 'ring-4 ring-blue-500' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-black uppercase text-lg text-slate-900 tracking-tight group-hover:underline decoration-2 underline-offset-4">Script<br/>Review</h3>
                                    <FileText className="w-6 h-6 text-slate-900" />
                                </div>
                                <div className="text-5xl font-black mb-2 text-slate-900">{pendingL1.length}</div>
                                <div className="font-bold text-xs uppercase tracking-widest text-slate-900 opacity-80">Pending Approval</div>
                            </div>

                            {/* Purple Card - FINAL REVIEWS */}
                         

                            {/* Blue Card - WITH CEO */}
                            <div
                                onClick={() => handleStatCardClick('WITH_CEO')}
                                className={`cursor-pointer transition-all hover:scale-105 bg-[#D946EF] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${activeFilter === 'WITH_CEO' ? 'ring-4 ring-black' : ''}`}
                            >
                                <div className="text-4xl font-black text-white mb-1">  {passedToCEOCount}</div>
                                <div className="text-sm font-bold uppercase text-white/80">Passed to CEO</div>
                            </div>

                            {/* White Card - REWORKS */}
                            <div
                                onClick={() => handleStatCardClick('REWORKS')}
                                className={`cursor-pointer transition-all hover:scale-105 bg-white border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${activeFilter === 'REWORKS' ? 'ring-4 ring-black' : ''}`}
                            >
                                <div className="text-4xl font-black text-black mb-1">{cmoReworks.length}</div>
                                <div className="text-sm font-bold uppercase text-slate-500">Reworks Requested</div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-xs font-black text-slate-400 uppercase tracking-wider">
                            <div className="col-span-5">Title</div>
                            <div className="col-span-2">Channel</div>
                            <div className="col-span-2">Stage</div>
                            <div className="col-span-2">Submitted</div>
                            <div className="col-span-1 text-right">Action</div>
                        </div>

                        <div className="space-y-4">
                            {displayedProjects.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => handleProjectClick(p)}
                                    className={`bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all group cursor-pointer ${p.status === TaskStatus.REJECTED ? 'bg-red-50' : ''}`}
                                >
                                    {/* Desktop Row */}
                                    <div className="hidden md:grid grid-cols-12 gap-4 items-center px-6 py-6">
                                        <div className="col-span-5">
                                            <div className="font-black text-lg text-slate-900 uppercase truncate">{p.title}</div>
                                        </div>
                                        <div className="col-span-2">
                                            <span className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${p.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                                    p.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                                        'bg-[#D946EF] text-white'
                                                }`}>
                                                {p.channel}
                                            </span>
                                        </div>
                                        <div className="col-span-2 text-xs font-bold uppercase text-slate-500">{STAGE_LABELS[p.current_stage]}</div>
                                        <div className="col-span-2 text-xs font-bold uppercase text-slate-400">{formatDistanceToNow(new Date(p.created_at))} ago</div>
                                        <div className="col-span-1 text-right">
                                            {p.assigned_to_role === Role.CMO ? (
                                                <span className="inline-block bg-[#0085FF] text-white rounded-full p-1 border-2 border-black">
                                                    <RotateCcw className="w-4 h-4" /> {/* Icon indicating review need */}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-300 uppercase">View</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Mobile Card */}
                                    <div className="md:hidden p-6 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <span className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${p.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                                    p.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                                        'bg-[#D946EF] text-white'
                                                }`}>
                                                {p.channel}
                                            </span>
                                            <span className="text-xs font-bold text-slate-400">{formatDistanceToNow(new Date(p.created_at))} ago</span>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 uppercase">{p.title}</h3>
                                        <div className="flex justify-between items-end border-t-2 border-slate-100 pt-4 mt-2">
                                            <div className="text-xs font-bold uppercase text-slate-500">{STAGE_LABELS[p.current_stage]}</div>
                                            {p.assigned_to_role === Role.CMO && (
                                                <button className="bg-[#0085FF] text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Review</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {displayedProjects.length === 0 && (
                                <div className="border-2 border-dashed border-black p-12 text-center bg-slate-50">
                                    <h3 className="text-xl font-black uppercase text-slate-400">All caught up</h3>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
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

export default CmoDashboard;