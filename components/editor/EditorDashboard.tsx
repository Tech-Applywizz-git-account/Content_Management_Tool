import React, { useEffect, useState, useMemo } from 'react';
import { Project, Role, WorkflowStage, TaskStatus } from '../../types';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Upload, Video, Film } from 'lucide-react';
import EditorMyWork from './EditorMyWork';
import EditorCalendar from './EditorCalendar';
import EditorProjectDetail from './EditorProjectDetail';
import Layout from '../Layout';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    user: { full_name: string; role: Role };
    inboxProjects: Project[];
    historyProjects: Project[];
    scriptProjects?: Project[];
    onRefresh: () => void;
    onLogout: () => void;
}

import { useNavigate, useLocation } from 'react-router-dom';

const EditorDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, scriptProjects, onRefresh, onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Determine activeView from URL path
    const getActiveViewFromPath = () => {
        const path = location.pathname;
        if (path.endsWith('/calendar')) return 'calendar';
        if (path.endsWith('/mywork')) return 'mywork';
        return 'dashboard';
    };

    const activeView = getActiveViewFromPath();
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [activeFilter, setActiveFilter] = useState<'NEEDS_DELIVERY' | 'IN_PROGRESS' | 'COMPLETED' | 'SCRIPTS' | 'CINE' | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // SYNC STATE WITH URL ON REFRESH/NAVIGATE
    useEffect(() => {
        const path = location.pathname;
        const subPaths = path.split('/').filter(p => p !== '');

        // Pattern: /editor/project/:id
        const projectIdx = subPaths.findIndex(p => p === 'project');
        if (projectIdx !== -1 && subPaths[projectIdx + 1]) {
            const id = subPaths[projectIdx + 1];
            const p = [...inboxProjects, ...historyProjects].find(item => item.id === id);
            if (p) setSelectedProject(p);
        } else if (inboxProjects.length > 0 || historyProjects.length > 0) {
            setSelectedProject(null);
        }
    }, [location.pathname, inboxProjects, historyProjects]);

    const handleInternalRefresh = async () => {
        await onRefresh(); // MUST refetch from Supabase
        setRefreshKey(prev => prev + 1); // force UI re-render
    };

    // Handle top-level view changes (Dashboard / My Work / Calendar)
    const handleViewChange = (view: string, preserveFilter = false) => {
        setSelectedProject(null);
        const rolePath = user.role.toLowerCase();

        // ✅ IMPORTANT:
        // If user manually clicks "My Work",
        // clear any dashboard-based filters
        if (view === 'mywork' && !preserveFilter) {
            setActiveFilter(null);
        }

        if (view === 'dashboard') {
            navigate(`/${rolePath}`);
        } else {
            navigate(`/${rolePath}/${view}`);
        }
    };

    // Mount-only effect
    useEffect(() => {
        // Safety: never restore dashboard filters on reload
        setActiveFilter(null);
    }, []);



    // Realtime: refresh inbox when projects table changes
    useEffect(() => {
        const subscription = supabase
            .channel('public:projects:editor_refresh')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                try {
                    onRefresh();
                } catch (e) {
                    console.error('Failed to refresh editor inbox on realtime event', e);
                }
            })
            .subscribe();

        return () => {
            try { supabase.removeChannel(subscription); } catch (e) { }
        };
    }, [onRefresh]);
    /**
 * Projects shown in MyWork:
 * - If user came from dashboard cards → filtered
 * - If user clicked My Work manually → ALL projects
 */
    const filteredProjects = useMemo(() => {
        // SCRIPTS filter shows ALL script projects (Supabase-wide)
        if (activeFilter === 'SCRIPTS') {
            return scriptProjects || [];
        }

        if (activeFilter === 'CINE') {
            return (scriptProjects || []).filter(p => p.current_stage === WorkflowStage.CINEMATOGRAPHY);
        }

        // No filter → show ALL editor projects
        if (!activeFilter) {
            return historyProjects || [];
        }

        // Filtered views (from dashboard cards)
        switch (activeFilter) {
            case 'NEEDS_DELIVERY':
                return (historyProjects || []).filter(p => !p.delivery_date && p.status !== TaskStatus.DONE);
            case 'IN_PROGRESS':
                return (historyProjects || []).filter(
                    p => p.delivery_date && !p.edited_video_link && p.status !== TaskStatus.DONE
                );
            case 'COMPLETED':
                return (historyProjects || []).filter(p => !!p.edited_video_link);
            default:
                return historyProjects || [];
        }
    }, [activeFilter, historyProjects, scriptProjects]);


    // ✅ FIXED: Remove mock data and use real projects filtered by stage
    const allProjects = (inboxProjects || []).filter(p => p.current_stage === WorkflowStage.VIDEO_EDITING);
    const activeProjects = allProjects.filter(p => p.status !== TaskStatus.DONE);

    // Add state for counts
    const [needsDeliveryCount, setNeedsDeliveryCount] = useState(0);
    const [inProgressCount, setInProgressCount] = useState(0);
    const [completedEditsCount, setCompletedEditsCount] = useState(0);
    const [scriptsCount, setScriptsCount] = useState(0);
    const [cineProjectsCount, setCineProjectsCount] = useState(0);

    // Calculate counts when historyProjects or scriptProjects change
    useEffect(() => {
        // Calculate counts based on historyProjects and scriptProjects
        setNeedsDeliveryCount((historyProjects || []).filter(p => !p.delivery_date).length);
        setInProgressCount((historyProjects || []).filter(p => p.delivery_date && !p.edited_video_link).length);
        setCompletedEditsCount((historyProjects || []).filter(p => !!p.edited_video_link).length);
        
        // Count script projects from props
        setScriptsCount((scriptProjects || []).length);
        
        // Count CINE projects from props
        setCineProjectsCount((scriptProjects || []).filter(p => p.current_stage === WorkflowStage.CINEMATOGRAPHY).length);
    }, [historyProjects, scriptProjects]);

return (
    <Layout
        user={user as any}
        onLogout={onLogout}
        onOpenCreate={() => { }}
        activeView={activeView}
        onChangeView={handleViewChange}
    >
        {selectedProject ? (
            // Navigate to the route-based project detail page instead of rendering inline
            (() => {
                navigate(`/editor/project/${selectedProject.id}`);
                return null;
            })()
        ) : activeView === 'mywork' ? (
            <EditorMyWork user={user} projects={activeFilter ? filteredProjects : historyProjects}
                onSelectProject={(project) => {
                    // Navigate to the route-based project detail page with context
                    const fromView = activeFilter === 'CINE' ? 'SCRIPTS' : 'MYWORK';
                    navigate(`/editor/project/${project.id}?from=${fromView}`);
                }} scriptProjects={scriptProjects} activeFilter={activeFilter} />
        ) : activeView === 'calendar' ? (
            <EditorCalendar projects={inboxProjects} />
        ) : (
            <div key={refreshKey} className="space-y-8 animate-fade-in">
                {/* Dashboard Content */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                            Edit Suite
                        </h1>
                        <p className="font-bold text-lg text-slate-500">Welcome back, {user.full_name}</p>
                    </div>
                    <button
                        onClick={handleInternalRefresh}
                        className="px-6 py-3 border-2 border-black font-black uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white text-black hover:bg-slate-50"
                    >
                        🔄 Refresh
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {/* NEEDS DELIVERY DATE */}
                    <div
                        onClick={() => {
                            setActiveFilter('NEEDS_DELIVERY');
                            handleViewChange('mywork', true);
                        }}
                        className="bg-[#F59E0B] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        <div className="text-4xl font-black text-white mb-1">
                            {needsDeliveryCount}
                        </div>
                        <div className="text-sm font-bold uppercase text-white/80">Needs Delivery Date</div>
                    </div>

                    {/* IN PROGRESS */}
                    <div
                        onClick={() => {
                            setActiveFilter('IN_PROGRESS');
                            handleViewChange('mywork', true);
                        }}
                        className="bg-[#3B82F6] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        <div className="text-4xl font-black text-white mb-1">
                            {inProgressCount}
                        </div>
                        <div className="text-sm font-bold uppercase text-white/80">In Progress</div>
                    </div>

                    {/* COMPLETED EDITS */}
                    <div
                        onClick={() => {
                            setActiveFilter('COMPLETED');
                            handleViewChange('mywork', true);
                        }}
                        className="bg-[#10B981] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        <div className="text-4xl font-black text-white mb-1">
                            {completedEditsCount}
                        </div>
                        <div className="text-sm font-bold uppercase text-white/80">Completed Edits</div>
                    </div>

                    {/* SCRIPTS */}
                    <div
                        onClick={() => {
                            setActiveFilter('SCRIPTS');
                            handleViewChange('mywork', true);
                        }}
                        className="bg-[#8B5CF6] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        <div className="text-4xl font-black text-white mb-1">
                            {scriptsCount}
                        </div>
                        <div className="text-sm font-bold uppercase text-white/80">Scripts</div>
                    </div>

                    {/* CINE PROJECTS */}
                    <div
                        onClick={() => {
                            setActiveFilter('CINE');
                            handleViewChange('mywork', true);
                        }}
                        className="bg-[#EF4444] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        <div className="text-4xl font-black text-white mb-1">
                            {cineProjectsCount}
                        </div>
                        <div className="text-sm font-bold uppercase text-white/80">Cine Projects</div>
                    </div>
                </div>

                {/* Quick Overview */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
                        Quick Overview
                    </h2>
                    <p className="text-slate-600">
                        You have {activeProjects.length} {activeProjects.length === 1 ? 'project' : 'projects'} in editing.
                        Click <button onClick={() => handleViewChange('mywork')} className="text-blue-600 font-bold underline">My Work</button> to manage them.
                    </p>
                </div>
            </div>
        )}
    </Layout>
);
};

export default EditorDashboard;