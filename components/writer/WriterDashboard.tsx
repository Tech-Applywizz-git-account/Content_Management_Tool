import React, { useEffect, useState } from 'react';
import { Project, Role, TaskStatus, STAGE_LABELS, WorkflowStage } from '../../types';
import { Plus, Clock } from 'lucide-react';
import CreateScript from './CreateScript';
import WriterProjectDetail from './WriterProjectDetail';
import WriterMyWork from './WriterMyWork';
import WriterCalendar from './WriterCalendar';
import { formatDistanceToNow } from 'date-fns';
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
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [viewingProject, setViewingProject] = useState<Project | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const dashboardProjects = historyProjects || [];
    const viewStorageKey = `activeView:${user.role}`;
    const getStoredView = () => {
        if (typeof window === 'undefined') return 'dashboard';
        return localStorage.getItem(viewStorageKey) || 'dashboard';
    };
    const [activeView, setActiveView] = useState<string>(getStoredView);

    const handleInternalRefresh = async () => {
        await onRefresh(); // MUST refetch from Supabase
        setRefreshKey(prev => prev + 1); // force UI re-render
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

        return () => { try { supabase.removeChannel(subscription); } catch (e) {} };
    }, [onRefresh]);

    // Use inboxProjects for dashboard view (role-based filtering)
    // Use historyProjects for MyWork view (participation-based filtering)
    const projects = activeView === 'mywork' ? (historyProjects || []) : (inboxProjects || []);

    // Categorize Projects - mutually exclusive categorization
    const inReview = dashboardProjects.filter(
  p =>
    p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 ||
    p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2
);

const inProduction = dashboardProjects.filter(
  p =>
    p.current_stage === WorkflowStage.CINEMATOGRAPHY ||
    p.current_stage === WorkflowStage.VIDEO_EDITING ||
    p.current_stage === WorkflowStage.THUMBNAIL_DESIGN ||
    p.current_stage === WorkflowStage.CREATIVE_DESIGN ||
    p.current_stage === WorkflowStage.FINAL_REVIEW_CMO ||
    p.current_stage === WorkflowStage.FINAL_REVIEW_CEO ||
    p.current_stage === WorkflowStage.OPS_SCHEDULING
);

const drafts = dashboardProjects.filter(
  p =>
    !inReview.some(reviewP => reviewP.id === p.id) &&
    !inProduction.some(productionP => productionP.id === p.id) &&
    (p.current_stage === WorkflowStage.SCRIPT ||
     p.current_stage === WorkflowStage.REWORK ||
     (p.status === TaskStatus.REWORK && p.current_stage !== WorkflowStage.SCRIPT_REVIEW_L1 && p.current_stage !== WorkflowStage.SCRIPT_REVIEW_L2))
);

const rejectedProjects = dashboardProjects.filter(
  p =>
    !inReview.some(reviewP => reviewP.id === p.id) &&
    !inProduction.some(productionP => productionP.id === p.id) &&
    (p.status === TaskStatus.REJECTED && p.current_stage !== WorkflowStage.SCRIPT_REVIEW_L1 && p.current_stage !== WorkflowStage.SCRIPT_REVIEW_L2)
);
    

    const handleEdit = (project: Project) => {
  setEditingProject(project);
  setIsCreating(true);
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
        setIsCreating(false);
        setEditingProject(null);
        // Don't show any popup when just closing
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

    const handleCloseDetail = async() => {
        setViewingProject(null);
        await onRefresh();
    };

    if (viewingProject) {
        return <WriterProjectDetail project={viewingProject} onBack={handleCloseDetail} />;
    }

    if (isCreating) {
        return <CreateScript project={editingProject || undefined} onClose={handleCloseWithoutAction} onSuccess={handleCloseCreate} />;
    }

    return (
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => setIsCreating(true)}
            activeView={activeView}
            onChangeView={handleViewChange}
        >
            {activeView === 'mywork' && <WriterMyWork user={user} projects={historyProjects} />}
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
                    </div>

                    {/* Kanban Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

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
                                    <div key={p.id} className={`bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${(p.status === TaskStatus.REWORK || p.status === TaskStatus.REJECTED) ? 'cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]' : ''} transition-all ${p.status === TaskStatus.REWORK ? 'bg-red-50' : p.status === TaskStatus.REJECTED ? 'bg-gray-100' : ''} ${p.priority === 'HIGH' ? 'ring-4 ring-red-500 ring-offset-2' : ''}`} onClick={() => p.status === TaskStatus.REWORK ? handleEdit(p) : p.status === TaskStatus.REJECTED ? handleViewProject(p) : {}}>
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
                                                        : p.priority === 'MEDIUM'
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
                                        <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-4 border-t-2 border-slate-100 pt-3">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {formatDistanceToNow(new Date(p.created_at))} ago
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
                                                        : p.priority === 'MEDIUM'
                                                            ? 'bg-yellow-500 text-black'
                                                            : 'bg-green-500 text-white'
                                                }`}
                                            >
                                                {p.priority}{p.priority === 'HIGH' && ' ★'}
                                            </span>
                                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 border border-blue-200 text-[10px] font-bold uppercase">
                                                {p.assigned_to_role === Role.CMO ? 'With CMO' : 'With CEO'}
                                            </span>
                                        </div>
                                        <h4 className="font-black text-lg text-slate-900 mb-4 uppercase">{p.title}</h4>
                                        <div className="w-full bg-slate-100 h-2 border border-black overflow-hidden">
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
                                                        : p.priority === 'MEDIUM'
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
                                        <div className="w-full bg-slate-200 h-2 border border-black overflow-hidden mt-4">
                                            <div className="bg-[#4ADE80] h-full w-3/4"></div>
                                        </div>
                                    </div>
                                ))}
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