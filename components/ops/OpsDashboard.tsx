import React, { useEffect, useState } from 'react';
import { Project, Role, WorkflowStage, TaskStatus } from '../../types';
import { Calendar, Upload, Link as LinkIcon } from 'lucide-react';
import OpsMyWork from './OpsMyWork';
import OpsCalendar from './OpsCalendar';
import OpsProjectDetail from './OpsProjectDetail';
import OpsProjectDetailDetailed from './OpsProjectDetailDetailed';
import OpsCeoApproved from './OpsCeoApproved';
import Layout from '../Layout';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    user: { full_name: string; role: Role };
    inboxProjects: Project[];
    historyProjects: Project[];
    onRefresh: () => void;
    onLogout: () => void;
}

import { useNavigate, useLocation } from 'react-router-dom';

const OpsDashboard: React.FC<Props> = ({ user, inboxProjects = [], historyProjects = [], onRefresh, onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Determine activeView from URL path
    const getActiveViewFromPath = () => {
        const path = location.pathname;
        if (path.endsWith('/calendar')) return 'calendar';
        if (path.endsWith('/mywork')) return 'mywork';
        if (path.endsWith('/ceoapproved')) return 'ceoapproved';
        return 'dashboard';
    };

    const activeView = getActiveViewFromPath();
    const [selectedProject, setSelectedProject] = useState<{ project: Project, source: 'ceoapproved' | 'mywork' | null } | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [filterCategory, setFilterCategory] = useState<string>('all'); // 'all', 'ceoapproved', 'readytoschedule', 'scheduled', 'postedthisweek'

    // SYNC STATE WITH URL ON REFRESH/NAVIGATE
    useEffect(() => {
        const path = location.pathname;
        const subPaths = path.split('/').filter(p => p !== '');

        // Pattern: /ops/project/:id
        const projectIdx = subPaths.findIndex(p => p === 'project');
        if (projectIdx !== -1 && subPaths[projectIdx + 1]) {
            const id = subPaths[projectIdx + 1];
            const p = [...inboxProjects, ...historyProjects].find(item => item.id === id);
            if (p) {
                // Determine source for ops detail view
                const isCeoApproved = p.current_stage !== WorkflowStage.OPS_SCHEDULING && p.current_stage !== WorkflowStage.POSTED;
                setSelectedProject({ project: p, source: isCeoApproved ? 'ceoapproved' : 'mywork' });
            }
        } else if (inboxProjects.length > 0 || historyProjects.length > 0) {
            setSelectedProject(null);
        }
    }, [location.pathname, inboxProjects, historyProjects]);

    // Debug: Log the stages of inbox projects
    useEffect(() => {
        console.log('Ops Dashboard - inboxProjects stages:', (inboxProjects || []).map(p => ({
            id: p.id,
            title: p.title,
            current_stage: p.current_stage,
            assigned_to_role: p.assigned_to_role
        })));
    }, [inboxProjects]);

    const handleInternalRefresh = async () => {
        await onRefresh(); // MUST refetch from Supabase
        setRefreshKey(prev => prev + 1); // force UI re-render
    };

    const handleViewChange = (view: string) => {
        setSelectedProject(null);
        const rolePath = user.role.toLowerCase();
        if (view === 'dashboard') {
            navigate(`/${rolePath}`);
        } else {
            navigate(`/${rolePath}/${view}`);
        }
    };

    // Realtime: refresh ops inbox when projects change
    useEffect(() => {
        const subscription = supabase
            .channel('public:projects:ops_refresh')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                try { onRefresh(); } catch (e) { console.error('Failed to refresh ops data', e); }
            })
            .subscribe();

        return () => { try { supabase.removeChannel(subscription); } catch (e) { } };
    }, [onRefresh]);

    // Use inboxProjects for dashboard view (role-based filtering)
    // Use historyProjects for MyWork view (participation-based filtering)
    const projects = activeView === 'mywork' ? (historyProjects || []) : (inboxProjects || []);

    // Categorize projects
    const readyToSchedule = (inboxProjects || []).filter(p =>
        p.current_stage === WorkflowStage.OPS_SCHEDULING &&
        !p.post_scheduled_date
    );

    const scheduled = (inboxProjects || []).filter(p =>
        p.current_stage === WorkflowStage.OPS_SCHEDULING &&
        p.post_scheduled_date &&
        !p.data?.live_url
    );

    const postedThisWeek = (inboxProjects || []).filter(p => {
        if (p.current_stage !== WorkflowStage.POSTED) return false;
        const postedDate = p.post_scheduled_date ? new Date(p.post_scheduled_date) : null;
        if (!postedDate) return false;
        const weekAgo = new Date(Date.now() - 7 * 86400000);
        return postedDate >= weekAgo;
    });

    // CEO-approved projects (projects that have moved forward after CEO approval)
    const ceoApproved = (inboxProjects || []).filter(p =>
        p.current_stage === WorkflowStage.CINEMATOGRAPHY ||
        p.current_stage === WorkflowStage.VIDEO_EDITING ||
        p.current_stage === WorkflowStage.FINAL_REVIEW_CMO ||
        p.current_stage === WorkflowStage.FINAL_REVIEW_CEO ||
        p.current_stage === WorkflowStage.OPS_SCHEDULING ||
        p.current_stage === WorkflowStage.POSTED
    );


    return (
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => { }}
            activeView={activeView}
            onChangeView={handleViewChange}
        >
            {selectedProject ? (
                selectedProject.source === 'ceoapproved' ? (
                    <OpsProjectDetailDetailed
                        project={selectedProject.project}
                        onBack={() => navigate('/ops')}
                        onUpdate={() => {
                            navigate('/ops');
                            onRefresh();
                        }}
                    />
                ) : (
                    <OpsProjectDetail
                        project={selectedProject.project}
                        onBack={() => navigate('/ops')}
                        onUpdate={() => {
                            navigate('/ops');
                            onRefresh();
                        }}
                    />
                )
            ) : activeView === 'mywork' ? (
                <OpsMyWork user={user} projects={historyProjects || []} onSelectProject={(params) => navigate(`/ops/project/${params.project.id}`)} filterCategory={filterCategory} />
            ) : activeView === 'calendar' ? (
                <OpsCalendar projects={inboxProjects || []} />
            ) : activeView === 'ceoapproved' ? (
                <OpsCeoApproved projects={inboxProjects || []} onSelectProject={(params) => navigate(`/ops/project/${params.project.id}`)} />
            ) : (
                <div key={refreshKey} className="space-y-8 animate-fade-in">
                    {/* Dashboard Content */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                                Operations Center
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        <div
                            className="bg-[#8B5CF6] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                                handleViewChange('ceoapproved'); // Navigate to dedicated CEO approved view
                            }}
                        >
                            <div className="text-4xl font-black text-white mb-1">
                                {ceoApproved.length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">CEO Approved</div>
                        </div>
                        <div
                            className="bg-[#F59E0B] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                                setFilterCategory('readytoschedule');
                                handleViewChange('mywork');
                            }}
                        >
                            <div className="text-4xl font-black text-white mb-1">
                                {readyToSchedule.length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Ready to Schedule</div>
                        </div>
                        <div
                            className="bg-[#3B82F6] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                                setFilterCategory('scheduled');
                                handleViewChange('mywork');
                            }}
                        >
                            <div className="text-4xl font-black text-white mb-1">
                                {scheduled.length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Scheduled</div>
                        </div>
                        <div
                            className="bg-[#10B981] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                                setFilterCategory('postedthisweek');
                                handleViewChange('mywork');
                            }}
                        >
                            <div className="text-4xl font-black text-white mb-1">
                                {postedThisWeek.length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Posted This Week</div>
                        </div>
                        <div
                            className="bg-[#6B7280] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                                setFilterCategory('all');
                                handleViewChange('mywork');
                            }}
                        >
                            <div className="text-4xl font-black text-white mb-1">
                                {(inboxProjects || []).length - ceoApproved.length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Total Managed</div>
                        </div>
                    </div>

                    {/* Quick Overview */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
                            Quick Overview
                        </h2>
                        <p className="text-slate-600">
                            You have {ceoApproved.length} CEO-approved {ceoApproved.length === 1 ? 'project' : 'projects'}, {readyToSchedule.length} ready to schedule, and {scheduled.length} scheduled for publishing. Total managed: {(inboxProjects || []).length - ceoApproved.length}.
                            Click <button onClick={() => handleViewChange('mywork')} className="text-blue-600 font-bold underline">My Work</button> to manage them.
                        </p>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default OpsDashboard;