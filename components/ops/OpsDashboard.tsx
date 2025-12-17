import React, { useEffect, useState } from 'react';
import { Project, Role, WorkflowStage, TaskStatus } from '../../types';
import { Calendar, Upload, Link as LinkIcon } from 'lucide-react';
import OpsMyWork from './OpsMyWork';
import OpsCalendar from './OpsCalendar';
import OpsProjectDetail from './OpsProjectDetail';
import Layout from '../Layout';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    user: { full_name: string; role: Role };
    inboxProjects: Project[];
    historyProjects: Project[];
    onRefresh: () => void;
    onLogout: () => void;
}

const OpsDashboard: React.FC<Props> = ({ user, inboxProjects = [], historyProjects = [], onRefresh, onLogout }) => {
    const viewStorageKey = `activeView:${user.role}`;
    const getStoredView = () => {
        if (typeof window === 'undefined') return 'dashboard';
        return localStorage.getItem(viewStorageKey) || 'dashboard';
    };
    const [activeView, setActiveView] = useState<string>(getStoredView);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    const handleViewChange = (view: string) => {
        setActiveView(view);
        if (typeof window !== 'undefined') {
            localStorage.setItem(viewStorageKey, view);
        }
    };

    useEffect(() => {
        setActiveView(getStoredView());
    }, [viewStorageKey]);

    // Realtime: refresh ops inbox when projects change
    useEffect(() => {
        const subscription = supabase
            .channel('public:projects:ops_refresh')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                try { onRefresh(); } catch (e) { console.error('Failed to refresh ops data', e); }
            })
            .subscribe();

        return () => { try { supabase.removeChannel(subscription); } catch (e) {} };
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

    return (
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => { }}
            activeView={activeView}
            onChangeView={handleViewChange}
        >
            {selectedProject ? (
                <OpsProjectDetail
                    project={selectedProject}
                    onBack={() => setSelectedProject(null)}
                    onUpdate={() => {
                        setSelectedProject(null);
                        onRefresh();
                    }}
                />
            ) : activeView === 'mywork' ? (
                <OpsMyWork user={user} projects={historyProjects || []} onSelectProject={setSelectedProject} />
            ) : activeView === 'calendar' ? (
                <OpsCalendar projects={inboxProjects || []} />
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-[#F59E0B] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {readyToSchedule.length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Ready to Schedule</div>
                        </div>
                        <div className="bg-[#3B82F6] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {scheduled.length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Scheduled</div>
                        </div>
                        <div className="bg-[#10B981] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {postedThisWeek.length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Posted This Week</div>
                        </div>
                        <div className="bg-[#8B5CF6] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {(inboxProjects || []).length}
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
                            You have {readyToSchedule.length} {readyToSchedule.length === 1 ? 'project' : 'projects'} ready to schedule and {scheduled.length} scheduled for publishing.
                            Click <button onClick={() => setActiveView('mywork')} className="text-blue-600 font-bold underline">My Work</button> to manage them.
                        </p>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default OpsDashboard;