import React, { useEffect, useState } from 'react';
import { Project, Role, TaskStatus, STAGE_LABELS, WorkflowStage } from '../../types';
import { Plus, Lightbulb, Clock } from 'lucide-react';
import CreateScript from './CreateScript';
import CreateIdeaProject from './CreateIdeaProject';
import WriterProjectDetail from './WriterProjectDetail';
import WriterMyWork from './WriterMyWork';
import WriterCalendar from './WriterCalendar';
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
    const [refreshKey, setRefreshKey] = useState(0);
    const viewStorageKey = `activeView:${user.role}`;
    const getStoredView = () => {
        if (typeof window === 'undefined') return 'dashboard';
        return localStorage.getItem(viewStorageKey) || 'dashboard';
    };
    const [activeView, setActiveView] = useState<string>(getStoredView);
    const [scriptFromIdea, setScriptFromIdea] = useState<Project | null>(null);


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
    const inReview = dashboardProjects.filter(p =>
        (p.created_by === user.id || p.created_by_user_id === user.id) &&
        [
            WorkflowStage.SCRIPT_REVIEW_L1,
            WorkflowStage.SCRIPT_REVIEW_L2
        ].includes(p.current_stage)
    );

    const inProduction = dashboardProjects.filter(p =>
        (p.created_by === user.id || p.created_by_user_id === user.id) &&
        [
            WorkflowStage.CINEMATOGRAPHY,
            WorkflowStage.VIDEO_EDITING,
            WorkflowStage.THUMBNAIL_DESIGN,
            WorkflowStage.CREATIVE_DESIGN,
            WorkflowStage.FINAL_REVIEW_CMO,
            WorkflowStage.FINAL_REVIEW_CEO,
            WorkflowStage.OPS_SCHEDULING
        ].includes(p.current_stage)
    );


   const drafts = dashboardProjects.filter(p =>
  // 1️⃣ Belongs to this writer
  (
    p.created_by === user.id ||
    p.created_by_user_id === user.id ||
    p.writer_id === user.id
  ) &&

  // 2️⃣ Not yet opened by CMO / CEO
  !(
    p.first_review_opened_at &&
    ['CMO', 'CEO'].includes(p.first_review_opened_by_role || '')
  ) &&

  // 3️⃣ Draft or Rework state
  (
    p.current_stage === WorkflowStage.SCRIPT ||
    p.current_stage === WorkflowStage.REWORK ||
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
    const approvedIdeas = dashboardProjects.filter(p =>
        p.data?.source === 'IDEA_PROJECT' &&
        p.current_stage === WorkflowStage.SCRIPT &&
        p.assigned_to_role === Role.WRITER &&
        p.status === TaskStatus.WAITING_APPROVAL &&
        p.history?.some(
            h =>
                h.stage === WorkflowStage.FINAL_REVIEW_CEO &&
                h.action === 'APPROVED'
        )
    );


    const handleEdit = (project: Project) => {
        // Check if this is an idea project (no script content)
        const parsedData = typeof project.data === 'string' ? JSON.parse(project.data) : project.data;
        const isIdeaProject = !parsedData?.script_content;
        
        if (isIdeaProject) {
            // Open CreateIdeaProject for editing idea projects
            setEditingProject(project);
            setIsCreatingIdea(true);
        } else {
            // Open CreateScript for editing script projects
            setEditingProject(project);
            setIsCreating(true);
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
                            <div className="flex items-center justify-between p-4 bg-[#0085FF] text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <h3 className="font-black uppercase tracking-wide">In Review</h3>
                                <span className="bg-white text-black px-2 py-0.5 font-bold text-xs border border-black">{inReview.length}</span>
                            </div>
                            <div className="space-y-4">
                                {inReview.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => handleViewProject(p)}
                                        className={`bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all ${p.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-400">{p.channel}</span>
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
                                                {p.assigned_to_role === Role.CMO ? 'With CMO' : 'With CEO'}
                                            </span>
                                        </div>
                                        <h4 className="font-black text-lg text-slate-900 mb-2 uppercase">{p.title}</h4>

                                        <div className="w-full bg-slate-100 h-2 border border-black overflow-hidden mt-2">
                                            <div className="bg-[#0085FF] h-full w-2/3 animate-pulse"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column 3: In Production */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-[#4ADE80] text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <h3 className="font-black uppercase tracking-wide">Production</h3>
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

                                        <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-4 border-t-2 border-slate-100 pt-3">
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