import React, { useEffect, useState } from 'react';
import { Project, Role, TaskStatus, STAGE_LABELS, WorkflowStage } from '../../types';
import { Plus, Lightbulb, Clock, PlayCircle } from 'lucide-react';
import CreateScript from './CreateScript';
import CreateIdeaProject from './CreateIdeaProject';
import WriterProjectDetail from './WriterProjectDetail';
import WriterMyWork from './WriterMyWork';
import WriterCalendar from './WriterCalendar';
import WriterVideoApproval from './WriterVideoApproval';
import { format } from 'date-fns';
import Layout from '../Layout';
import Popup from '../Popup';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    user: { full_name: string; role: Role };
    inboxProjects: Project[];
    historyProjects: Project[];
    onRefresh: () => Promise<void>;
    onLogout: () => void;
}

const WriterDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, onRefresh, onLogout }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [isCreatingIdea, setIsCreatingIdea] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [viewingProject, setViewingProject] = useState<Project | null>(null);
    const [reworkProject, setReworkProject] = useState<Project | null>(null);
    const [createScriptMode, setCreateScriptMode] = useState<'SCRIPT_FROM_APPROVED_IDEA' | undefined>(undefined);
    const [refreshKey, setRefreshKey] = useState(0);
    const viewStorageKey = `activeView:${user.role}`;
    const getStoredView = () => {
        if (typeof window === 'undefined') return 'dashboard';
        return localStorage.getItem(viewStorageKey) || 'dashboard';
    };
    const [activeView, setActiveView] = useState<string>(getStoredView);
    const [scriptFromIdea, setScriptFromIdea] = useState<Project | null>(null);
    const [videoApprovalView, setVideoApprovalView] = useState(false); // New state for video approval view
    const [inReviewFilter, setInReviewFilter] = useState<'all' | 'ideas' | 'scripts'>('all'); // Filter for In Review column


    const handleInternalRefresh = async () => {
        await onRefresh(); // MUST refetch from Supabase
        setRefreshKey(prev => prev + 1); // force UI re-render
    };
    const isWriterProject = (p: Project) => {
        return (
            // project explicitly assigned to this writer

            // OR project created by this writer
            p.created_by === user.id ||
            p.created_by_user_id === user.id ||

            // OR project currently with writer (important for rework)
            p.assigned_to_role === Role.WRITER
        );
    };


    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [stageName, setStageName] = useState('');

    const handleViewChange = (view: string) => {
        setActiveView(view);
        if (typeof window !== 'undefined') {
            localStorage.setItem(viewStorageKey, view);
        }
    };

    useEffect(() => {
        setActiveView(getStoredView());
    }, [viewStorageKey]);

    // Realtime: refresh writer data when projects table changes
    useEffect(() => {
        const subscription = supabase
            .channel('public:projects:writer_refresh')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                try { onRefresh(); } catch (e) { console.error('Failed to refresh writer data', e); }
            })
            .subscribe();

        return () => { try { supabase.removeChannel(subscription); } catch (e) { } };
    }, [onRefresh]);
    console.table(
        inboxProjects?.map(p => ({
            title: p.title,
            stage: p.current_stage,
            status: p.status,
            created_by: p.created_by
        }))
    );
    // Use inboxProjects for dashboard view (role-based filtering)
    // Use historyProjects for MyWork view (participation-based filtering)
    const projects = activeView === 'mywork' ? (historyProjects || []) : (inboxProjects || []);
    // For Writer dashboard, we want to show ALL projects created by the writer
    // regardless of current stage, not just inbox projects
    const allWriterProjects = [...new Set([...(inboxProjects || []), ...(historyProjects || [])].map(p => p.id))]
        .map(id => [...(inboxProjects || []), ...(historyProjects || [])].find(p => p.id === id)!);

    const dashboardProjects = activeView === 'mywork' ? (historyProjects || []) : allWriterProjects;

    // Categorize Projects - mutually exclusive categorization
    const allInReview = dashboardProjects.filter(p =>
        (p.created_by === user.id || p.created_by_user_id === user.id) &&
        (
            // Include script projects in review stages
            [
                WorkflowStage.SCRIPT_REVIEW_L1,
                WorkflowStage.SCRIPT_REVIEW_L2
            ].includes(p.current_stage) ||
            // Include final review stages for CMO and CEO
            [
                WorkflowStage.FINAL_REVIEW_CMO,
                WorkflowStage.FINAL_REVIEW_CEO
            ].includes(p.current_stage)
        )
    );
    
    const inReviewIdeas = allInReview.filter(p => p.data?.source === 'IDEA_PROJECT');
    const inReviewScripts = allInReview.filter(p => !p.data?.source || p.data?.source !== 'IDEA_PROJECT');
    
    const inReview = inReviewFilter === 'ideas' ? inReviewIdeas : 
                     inReviewFilter === 'scripts' ? inReviewScripts : 
                     allInReview;

    const inProduction = dashboardProjects.filter(p =>
        (p.created_by === user.id || p.created_by_user_id === user.id) &&
        [
            WorkflowStage.CINEMATOGRAPHY,
            WorkflowStage.VIDEO_EDITING,
            WorkflowStage.THUMBNAIL_DESIGN,
            WorkflowStage.CREATIVE_DESIGN
        ].includes(p.current_stage)
    );

const drafts = dashboardProjects.filter(p =>
  (
    p.created_by_user_id === user.id ||
    p.writer_id === user.id
  ) &&
  (
    p.status === TaskStatus.TODO ||
    p.status === TaskStatus.IN_PROGRESS ||
    p.status === TaskStatus.REWORK
  )
);


    const rejectedProjects = dashboardProjects.filter(p =>
        (p.created_by === user.id || p.created_by_user_id === user.id) &&
        p.status === TaskStatus.REJECTED &&
        ![
            WorkflowStage.SCRIPT_REVIEW_L1,
            WorkflowStage.SCRIPT_REVIEW_L2
        ].includes(p.current_stage)
    );
    
    // Projects that need video approval by the writer - visible to all writers
    const videoApprovalProjects = dashboardProjects.filter(p =>
        (p.current_stage === WorkflowStage.WRITER_VIDEO_APPROVAL || p.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL) &&
        p.assigned_to_role === Role.WRITER
    );
   const convertedIdeaIds = new Set(
  dashboardProjects
    .filter(p => p.data?.parent_idea_id)
    .map(p => p.data.parent_idea_id)
);

const approvedIdeas = dashboardProjects.filter(p =>
  p.data?.source === 'IDEA_PROJECT' &&
  p.current_stage === WorkflowStage.SCRIPT &&
  p.assigned_to_role === Role.WRITER &&
  p.status === TaskStatus.WAITING_APPROVAL &&
  p.history?.some(
    h =>
      h.stage === WorkflowStage.FINAL_REVIEW_CEO &&
      h.action === 'APPROVED'
  ) &&
  // ✅ IMPORTANT: hide ideas that already became scripts
  !convertedIdeaIds.has(p.id) &&
  // ✅ IMPORTANT: only show ideas created by the current writer
  (p.created_by === user.id || p.created_by_user_id === user.id)
);
const handleEdit = (project: Project) => {
  const parsedData =
    typeof project.data === 'string'
      ? JSON.parse(project.data)
      : project.data;

  const isIdeaProject = parsedData?.source === 'IDEA_PROJECT';
  const isRework = project.status === 'REWORK';

  // ✅ IDEA + REWORK → editable idea form
  // Only for projects that are truly ideas (no script content)
  if (isIdeaProject && isRework && !parsedData?.script_content) {
    setEditingProject(project);
    setIsCreatingIdea(true);
    return;
  }

  // ✅ IDEA + APPROVED BY CEO (needs to be converted to script) → editable script form
  if (isIdeaProject && project.current_stage === 'SCRIPT' && project.assigned_to_role === 'WRITER') {
    setScriptFromIdea(project); // Open the script editor for approved idea
    return;
  }

  // ❌ IDEA + REJECTED → read-only (do nothing)
  if (isIdeaProject && project.status === 'REJECTED') {
    return;
  }

  // ✅ IDEA (not rework or rejected) → editable idea form
  if (isIdeaProject && !isRework && project.status !== 'REJECTED') {
    setEditingProject(project);
    setIsCreatingIdea(true);
    return;
  }

  // ✅ SCRIPT + REWORK → editable script form
  if (!isIdeaProject && isRework) {
    setEditingProject(project);
    setIsCreating(true);
    return;
  }
};




    const handleCloseCreate = async (action: 'draft_saved' | 'submitted' = 'submitted') => {
        await onRefresh();
        setIsCreating(false);
        setEditingProject(null);

        if (action === 'draft_saved') {
            // Show popup for draft saved
            setPopupMessage('Draft has been saved successfully.');
            setStageName('Draft Saved');
            setShowPopup(true);
        } else if (action === 'submitted') {
            // Show popup after successful submission
            // After writer submits, project moves to CMO L1 Review stage
            const stageLabel = STAGE_LABELS[WorkflowStage.SCRIPT_REVIEW_L1] || 'CMO L1 Review';
            setPopupMessage(`Writer has submitted the script and is waiting for ${stageLabel}.`);
            setStageName(stageLabel);
            setShowPopup(true);
        }
        // If action is undefined (close without action), don't show popup
    };

    const handleCloseWithoutAction = async () => {
        await onRefresh();

        // Close all create/edit states
        setIsCreating(false);
        setEditingProject(null);
        setScriptFromIdea(null);

        // ✅ FORCE DASHBOARD VIEW
        setActiveView('dashboard');
        localStorage.setItem(viewStorageKey, 'dashboard');
    };

    const handleCloseIdeaCreation = async () => {
        await onRefresh();
        setIsCreatingIdea(false);
        // Show popup after successful idea submission
        setPopupMessage('Idea has been submitted and is waiting for CMO review.');
        setStageName('Final Review (CMO)');
        setShowPopup(true);
    };

    // Helper function to get updated projects
    const getUpdatedProjects = async () => {
        // In a real implementation, this would fetch updated projects
        // For now, we'll just return the existing historyProjects
        return historyProjects;
    };


    const handleViewProject = (project: Project) => {
        setViewingProject(project);
    };

    const handleCloseDetail = async () => {
        setViewingProject(null);
        await onRefresh();
    };
    // ✅ FULL PAGE: Convert Approved Idea → Script
    if (scriptFromIdea) {
        return (
            <CreateScript
                project={scriptFromIdea}
                mode="SCRIPT_FROM_APPROVED_IDEA"
                onClose={handleCloseWithoutAction}
                onSuccess={handleCloseCreate}
            />
        );
    }


    if (viewingProject) {
        return <WriterProjectDetail project={viewingProject} onBack={handleCloseDetail} />;
    }

    if (isCreating) {
        return <CreateScript project={editingProject || undefined} onClose={handleCloseWithoutAction} onSuccess={handleCloseCreate} />;
    }

    if (isCreatingIdea) {
        return <CreateIdeaProject project={editingProject || undefined} onClose={() => setIsCreatingIdea(false)} onSuccess={handleCloseIdeaCreation} />;
    }

    // Handle rework projects with review comments and previous script
    if (reworkProject) {
        return <CreateScript project={reworkProject} onClose={() => setReworkProject(null)} onSuccess={handleCloseCreate} />;
    }
    
    // Video Approval View
    if (videoApprovalView) {
        return <WriterVideoApproval projects={videoApprovalProjects} onBack={() => setVideoApprovalView(false)} refreshProjects={handleInternalRefresh} />;
    }

    return (
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => setIsCreating(true)}
            activeView={activeView}
            onChangeView={handleViewChange}
        >
            {activeView === 'mywork' && (
  <WriterMyWork user={user} projects={allWriterProjects} />
)}
            {activeView === 'calendar' && <WriterCalendar projects={inboxProjects} />}
            {activeView === 'dashboard' && (
                <div key={refreshKey} className="space-y-8 animate-fade-in">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">Writer Studio</h1>
                            <p className="font-bold text-base sm:text-lg text-slate-500">Welcome back, {user.full_name}</p>
                        </div>
                        <button
                            onClick={handleInternalRefresh}
                            className="w-full sm:w-auto bg-[#D946EF] text-white border-2 border-black px-6 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center space-x-2"
                        >
                            🔄 Refresh
                        </button>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="w-full sm:w-auto bg-[#D946EF] text-white border-2 border-black px-6 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center space-x-2"
                        >
                            <Plus className="w-6 h-6 border-2 border-white rounded-full" />
                            <span>New Script</span>
                        </button>
                        <button
                            onClick={() => setIsCreatingIdea(true)}
                            className="w-full sm:w-auto bg-[#8B5CF6] text-white border-2 border-black px-6 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center space-x-2"
                        >
                            <Lightbulb className="w-6 h-6 border-2 border-white rounded-full" />
                            <span>New Idea</span>
                        </button>
                        <button
                            onClick={() => setVideoApprovalView(true)}
                            className="w-full sm:w-auto bg-[#F59E0B] text-white border-2 border-black px-6 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center space-x-2 relative"
                        >
                            <PlayCircle className="w-6 h-6 border-2 border-white rounded-full" />
                            <span>Video Approval</span>
                            {videoApprovalProjects.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
                                    {videoApprovalProjects.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Kanban Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                        {/* Column 1: Drafts & Rework */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-900 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <h3 className="font-black uppercase tracking-wide">Drafts / Rework</h3>
                                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{Array.from(new Set([...drafts, ...rejectedProjects].map(p => p.id))).length}</span>
                            </div>
                            <div className="space-y-4">
                                {Array.from(new Set([...drafts, ...rejectedProjects].map(p => p.id))).map(id => {
                                    const p = [...drafts, ...rejectedProjects].find(proj => proj.id === id);
                                    return p;
                                }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(p => (
                                    <div key={p.id} className={`bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${(p.status === TaskStatus.REWORK || p.status === TaskStatus.REJECTED) ? 'cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]' : 'cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'} transition-all ${p.status === TaskStatus.REWORK ? 'bg-red-50' : p.status === TaskStatus.REJECTED ? 'bg-gray-100' : ''} ${p.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`} onClick={() => handleEdit(p)}>
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                                p.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                                    'bg-[#D946EF] text-white'
                                                }`}>
                                                {p.channel}
                                            </span>
                                            {/* Show IDEA badge for idea projects */}
                                            {p.data?.source === 'IDEA_PROJECT' && (
                                                <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                                    {p.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                                                </span>
                                            )}
                                            <span
                                                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.priority === 'HIGH'
                                                    ? 'bg-red-600 text-white font-black'
                                                    : p.priority === 'NORMAL'
                                                        ? 'bg-yellow-500 text-black'
                                                        : 'bg-green-500 text-white'
                                                    }`}
                                            >
                                                {p.priority}{p.priority === 'HIGH' && ' ★'}
                                            </span>
                                            {p.status === TaskStatus.REJECTED && (
                                                <span className="bg-[#FF4F4F] text-white px-2 py-0.5 border-2 border-black text-[10px] font-black uppercase">Rejected</span>
                                            )}
                                            {p.status === TaskStatus.REWORK && (
                                                <span className="bg-[#FF4F4F] text-white px-2 py-0.5 border-2 border-black text-[10px] font-black uppercase">Rework</span>
                                            )}
                                        </div>
                                        <h4 className="font-black text-xl text-slate-900 mb-2 uppercase leading-tight">{p.title}</h4>

                                        <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-2 border-t-2 border-slate-100 pt-2">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                                        </div>
                                    </div>
                                ))}
                                {Array.from(new Set([...drafts, ...rejectedProjects].map(p => p.id))).length === 0 && <div className="p-8 text-center font-bold text-slate-400 border-2 border-dashed border-slate-300 uppercase text-sm">No active drafts</div>}
                            </div>
                        </div>

                        {/* Column 2: In Review (CMO/CEO) */}
                        <div className="space-y-4">
                            {/* Header with title and count */}
                            <div className="p-4 bg-[#0085FF] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black uppercase tracking-wide">In Review</h3>
                                    <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{
                                      inReviewFilter === 'ideas' ? inReviewIdeas.length :
                                      inReviewFilter === 'scripts' ? inReviewScripts.length :
                                      allInReview.length
                                    }</span>
                                </div>
                            </div>
                            {/* Tabs for Ideas and Scripts - outside the main box */}
                            <div className="flex border-b border-gray-300 bg-white border-2 border-t-0 border-black">
                                <button 
                                    className={`px-4 py-2 font-black text-sm uppercase border-b-2 ${inReviewFilter === 'all' ? 'border-[#0085FF] text-[#0085FF]' : 'border-transparent text-gray-500'}`}
                                    onClick={() => setInReviewFilter('all')}
                                >
                                    All ({allInReview.length})
                                </button>
                                <button 
                                    className={`px-4 py-2 font-black text-sm uppercase border-b-2 ${inReviewFilter === 'ideas' ? 'border-[#0085FF] text-[#0085FF]' : 'border-transparent text-gray-500'}`}
                                    onClick={() => setInReviewFilter('ideas')}
                                >
                                    Ideas ({inReviewIdeas.length})
                                </button>
                                <button 
                                    className={`px-4 py-2 font-black text-sm uppercase border-b-2 ${inReviewFilter === 'scripts' ? 'border-[#0085FF] text-[#0085FF]' : 'border-transparent text-gray-500'}`}
                                    onClick={() => setInReviewFilter('scripts')}
                                >
                                    Scripts ({inReviewScripts.length})
                                </button>
                            </div>
                            <div className="space-y-4">
                                {(inReviewFilter === 'ideas' ? inReviewIdeas : 
                                  inReviewFilter === 'scripts' ? inReviewScripts : 
                                  allInReview).map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => handleViewProject(p)}
                                        className={`bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all ${p.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-400">{p.channel}</span>
                                            {/* Show IDEA badge for idea projects */}
                                            {p.data?.source === 'IDEA_PROJECT' && (
                                                <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                                    {p.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                                                </span>
                                            )}
                                            <span
                                                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.priority === 'HIGH'
                                                    ? 'bg-red-600 text-white font-black'
                                                    : p.priority === 'NORMAL'
                                                        ? 'bg-yellow-500 text-black'
                                                        : 'bg-green-500 text-white'
                                                    }`}
                                            >
                                                {p.priority}{p.priority === 'HIGH' && ' ★'}
                                            </span>
                                            {/* Show Approved badge for idea projects that were returned to writer after CEO approval */}
                                            {p.data?.source === 'IDEA_PROJECT' && p.current_stage === WorkflowStage.SCRIPT && p.assigned_to_role === Role.WRITER && p.status === TaskStatus.WAITING_APPROVAL && (
                                                <span className="bg-green-100 text-green-800 px-2 py-0.5 border-2 border-green-300 text-[10px] font-black uppercase">
                                                    Approved
                                                </span>
                                            )}
                                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 border border-blue-200 text-[10px] font-bold uppercase">
                                                {p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 ? 'Script Review (CMO)' :
                                                 p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2 ? 'Script Review (CEO)' :
                                                 p.current_stage === WorkflowStage.FINAL_REVIEW_CMO ? 'Final Review (CMO)' :
                                                 p.current_stage === WorkflowStage.FINAL_REVIEW_CEO ? 'Final Review (CEO)' :
                                                 p.assigned_to_role === Role.CMO ? 'With CMO' : 'With CEO'}
                                            </span>
                                        </div>
                                        <h4 className="font-black text-lg text-slate-900 mb-2 uppercase">{p.title}</h4>

                                        <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-2 border-t-2 border-slate-100 pt-2">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                                        </div>

                                        <div className="w-full bg-slate-100 h-2 border border-black overflow-hidden mt-2">
                                            <div className="bg-[#0085FF] h-full w-2/3 animate-pulse"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column 3: In Production (Cine, Editor, Designer) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-[#4ADE80] text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <h3 className="font-black uppercase tracking-wide">Production (Cine/Ed/Des)</h3>
                                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{inProduction.length}</span>
                            </div>
                            <div className="space-y-4">
                                {inProduction.map(p => (
                                    <div key={p.id} className={`bg-slate-50 p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${p.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                                                p.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                                                    'bg-[#D946EF] text-white'
                                                }`}>
                                                {p.channel}
                                            </span>
                                            {/* Show IDEA badge for idea projects */}
                                            {p.data?.source === 'IDEA_PROJECT' && (
                                                <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                                                    {p.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                                                </span>
                                            )}
                                            <span
                                                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${p.priority === 'HIGH'
                                                    ? 'bg-red-600 text-white font-black'
                                                    : p.priority === 'NORMAL'
                                                        ? 'bg-yellow-500 text-black'
                                                        : 'bg-green-500 text-white'
                                                    }`}
                                            >
                                                {p.priority}{p.priority === 'HIGH' && ' ★'}
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border-2 border-black ${p.assigned_to_role === Role.CINE ? 'bg-purple-100 text-purple-800' :
                                                p.assigned_to_role === Role.EDITOR ? 'bg-yellow-100 text-yellow-800' :
                                                    p.assigned_to_role === Role.DESIGNER ? 'bg-pink-100 text-pink-800' :
                                                        'bg-slate-100 text-slate-700'
                                                }`}>
                                                {p.assigned_to_role === Role.CINE ? 'WITH CINE' :
                                                    p.assigned_to_role === Role.EDITOR ? 'WITH EDITOR' :
                                                        p.assigned_to_role === Role.DESIGNER ? 'CREATIVE DESIGN' :
                                                            STAGE_LABELS[p.current_stage]}
                                            </span>
                                        </div>
                                        <h4 className="font-black text-lg text-slate-900 mb-2 uppercase">{p.title}</h4>

                                        <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-2 border-t-2 border-slate-100 pt-2">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                                        </div>

                                        <div className="w-full bg-slate-200 h-2 border border-black overflow-hidden mt-2">
                                            <div className="bg-[#4ADE80] h-full w-3/4"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column 4: CEO Approved Ideas */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-green-700 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <h3 className="font-black uppercase tracking-wide">
                                    CEO Approved Ideas
                                </h3>
                                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">
                                    {approvedIdeas.length}
                                </span>
                            </div>

                            <div className="space-y-4">
                                {approvedIdeas.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            setScriptFromIdea(p);
                                        }}
                                        className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="bg-green-100 text-green-800 px-2 py-0.5 border-2 border-green-300 text-[10px] font-black uppercase">
                                                Approved
                                            </span>
                                            <span className="text-[10px] font-bold uppercase bg-slate-100 px-2 py-0.5 border-2 border-black">
                                                Idea → Script
                                            </span>
                                        </div>

                                        <h4 className="font-black text-lg uppercase mb-2">
                                            {p.title}
                                        </h4>

                                        <p className="text-sm text-slate-600">
                                            Approved by CEO. Click to convert into a full script.
                                        </p>

                                        <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-2 border-t-2 border-slate-100 pt-2">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                                        </div>
                                    </div>
                                ))}

                                {approvedIdeas.length === 0 && (
                                    <div className="p-8 text-center font-bold text-slate-400 border-2 border-dashed border-slate-300 uppercase text-sm">
                                        No approved ideas yet
                                    </div>
                                )}
                            </div>
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

export default WriterDashboard;