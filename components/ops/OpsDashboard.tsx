import React, { useEffect, useState } from 'react';
import { Project, Role, WorkflowStage, TaskStatus } from '../../types';
import { Calendar, Upload, Link as LinkIcon } from 'lucide-react';
import OpsMyWork from './OpsMyWork';
import OpsCalendar from './OpsCalendar';
import OpsProjectDetail from './OpsProjectDetail';
import OpsProjectDetailDetailed from './OpsProjectDetailDetailed';
import OpsCeoApproved from './OpsCeoApproved';
import OpsFilteredProjects from './OpsFilteredProjects';
import Layout from '../Layout';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    user: { full_name: string; role: Role };
    inboxProjects: Project[];
    historyProjects: Project[];
    onRefresh: () => void;
    onLogout: () => void;
    allProjects?: Project[];
    activeViewOverride?: string;
}

import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

const OpsDashboard: React.FC<Props> = ({ user, inboxProjects = [], historyProjects = [], onRefresh, onLogout, allProjects, activeViewOverride }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Determine activeView from URL path
    const getActiveViewFromPath = () => {
        const path = location.pathname;
        if (path.endsWith('/calendar')) return 'calendar';
        if (path.endsWith('/mywork')) return 'mywork';
        if (path.endsWith('/ceoapproved')) return 'ceoapproved';
        if (path.endsWith('/ready-to-schedule')) return 'ready-to-schedule';
        if (path.endsWith('/scheduled-projects')) return 'scheduled-projects';
        if (path.endsWith('/posted-this-week')) return 'posted-this-week';
        return 'dashboard';
    };

    const [searchParams, setSearchParams] = useSearchParams();
    const filterCategory = searchParams.get('category') || 'pending';
    const setFilterCategory = (category: string) => {
        setSearchParams(prev => {
            if (category === 'pending') {
                prev.delete('category');
            } else {
                prev.set('category', category);
            }
            return prev;
        }, { replace: true });
    };

    const activeView = activeViewOverride || getActiveViewFromPath();
    const [selectedProject, setSelectedProject] = useState<{ project: Project, source: 'ceoapproved' | 'mywork' | null } | null>(null);


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
    };

    const handleViewChange = (view: string) => {
        setSelectedProject(null);
        const rolePath = user.role.toLowerCase();
        if (view === 'dashboard') {
            // Clear category filter when going to dashboard
            setSearchParams(prev => {
                prev.delete('category');
                return prev;
            }, { replace: true });
            navigate(`/${rolePath}`);
        } else {
            // Navigate to specific view without fallback to mywork
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

    // Categorize projects with proper filtering
    const readyToSchedule = (inboxProjects || []).filter(p =>
        // Strict filter for ready to schedule projects
        p.assigned_to_role === 'OPS' &&
        p.current_stage === WorkflowStage.OPS_SCHEDULING &&
        p.status !== 'COMPLETED' &&
        p.status !== 'REJECTED' &&
        !p.post_scheduled_date
    );

    const scheduled = (inboxProjects || []).filter(p =>
        // Have a post_scheduled_date but not yet posted
        p.post_scheduled_date &&
        !p.data?.live_url &&
        p.status !== TaskStatus.DONE
    );

    const postedThisWeek = (inboxProjects || []).filter(p => {
        // Completed projects posted this week
        if (!(p.status === TaskStatus.DONE || p.data?.live_url || p.current_stage === WorkflowStage.POSTED)) return false;
        const postedDate = p.post_scheduled_date ? new Date(p.post_scheduled_date) : new Date(p.updated_at || p.created_at);
        const weekAgo = new Date(Date.now() - 7 * 86400000);
        return postedDate >= weekAgo;
    });

    // CEO-approved projects (ALL projects after script approval) - use allProjects to include production stages
    const ceoApproved = (allProjects || inboxProjects || []).filter(p =>
        p.ceo_approved_at &&
        !(p.status === TaskStatus.DONE || p.data?.live_url || p.current_stage === WorkflowStage.POSTED)
    );

    // My Work (Parallel visibility for OPS during final review stages)
    const pendingMyWork = (allProjects || inboxProjects || []).filter(p => {
        const parallelVisibilityStages = [
            WorkflowStage.POST_WRITER_REVIEW,
            WorkflowStage.FINAL_REVIEW_CMO,
            WorkflowStage.FINAL_REVIEW_CEO,
            WorkflowStage.OPS_SCHEDULING
        ];
        return parallelVisibilityStages.includes(p.current_stage) &&
               !(p.status === TaskStatus.DONE || p.data?.live_url || p.current_stage === WorkflowStage.POSTED);
    });


    return (
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => { }}
            activeView={activeView}
            onChangeView={handleViewChange}
        >
            {activeView === 'mywork' ? (
                <OpsMyWork user={user} projects={allProjects || []} onSelectProject={(params) => navigate(`/ops/project/${params.project.id}`)} filterCategory={filterCategory} />
            ) : activeView === 'calendar' ? (
                <OpsCalendar projects={allProjects || inboxProjects || []} />
            ) : activeView === 'ceoapproved' ? (
                <OpsCeoApproved projects={allProjects || inboxProjects || []} onSelectProject={(params) => navigate(`/ops/project/${params.project.id}`)} />
            ) : activeView === 'ready-to-schedule' ? (
                <OpsFilteredProjects
                    user={user}
                    projects={inboxProjects || []}
                    viewMode="ready-to-schedule"
                    onSelectProject={(params) => navigate(`/ops/project/${params.project.id}`)}
                    onBack={() => handleViewChange('dashboard')}
                />
            ) : activeView === 'scheduled-projects' ? (
                <OpsFilteredProjects
                    user={user}
                    projects={inboxProjects || []}
                    viewMode="scheduled-projects"
                    onSelectProject={(params) => navigate(`/ops/project/${params.project.id}`)}
                    onBack={() => handleViewChange('dashboard')}
                />
            ) : activeView === 'posted-this-week' ? (
                <OpsFilteredProjects
                    user={user}
                    projects={inboxProjects || []}
                    viewMode="posted-this-week"
                    onSelectProject={(params) => navigate(`/ops/project/${params.project.id}`)}
                    onBack={() => handleViewChange('dashboard')}
                />
            ) : (
                <div className="space-y-8 animate-fade-in">
                    {/* Dashboard Content */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                                Operations Center
                            </h1>
                            <p className="font-bold text-lg text-slate-500">Welcome back, {user.full_name}</p>
                        </div>

                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        <div
                            className="bg-[#8B5CF6] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                                handleViewChange('ceoapproved');
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
                                handleViewChange('ready-to-schedule');
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
                                handleViewChange('scheduled-projects');
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
                                handleViewChange('posted-this-week');
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
                                setFilterCategory('pending');
                                handleViewChange('mywork');
                            }}
                        >
                            <div className="text-4xl font-black text-white mb-1">
                                {pendingMyWork.length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Production Queue</div>
                        </div>
                    </div>

                    {/* Quick Overview */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
                            Quick Overview
                        </h2>
                        <p className="text-slate-600">
                            You have {pendingMyWork.length} total projects in your production queue.
                            <br />
                            <span className="text-xs font-bold text-slate-400 uppercase mt-2 block">
                                ({ceoApproved.length} CEO Approved + {pendingMyWork.length - ceoApproved.length} in final review)
                            </span>
                        </p>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default OpsDashboard;