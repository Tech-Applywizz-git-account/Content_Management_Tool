import React, { useEffect, useState } from 'react';
import { Project, Role, WorkflowStage, TaskStatus } from '../../types';
import { Palette, Video, FileImage } from 'lucide-react';
import DesignerMyWork from './DesignerMyWork';
import DesignerCalendar from './DesignerCalendar';
import DesignerProjectDetail from './DesignerProjectDetail';
import Layout from '../Layout';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    user: { full_name: string; role: Role };
    inboxProjects: Project[];
    historyProjects: Project[];
    onRefresh: () => void;
    onLogout: () => void;
}

const DesignerDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, onRefresh, onLogout }) => {
    const viewStorageKey = `activeView:${user.role}`;
    const getStoredView = () => {
        if (typeof window === 'undefined') return 'dashboard';
        return localStorage.getItem(viewStorageKey) || 'dashboard';
    };
    const [activeView, setActiveView] = useState<string>(getStoredView);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleInternalRefresh = async () => {
        await onRefresh(); // MUST refetch from Supabase
        setRefreshKey(prev => prev + 1); // force UI re-render
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

    // Counts derived directly from projects table (source of truth)
    const [needsDeliveryCount, setNeedsDeliveryCount] = useState<number>(0);
    const [inProgressCount, setInProgressCount] = useState<number>(0);
    const [deliveredCount, setDeliveredCount] = useState<number>(0);
    const [activeProjectsCount, setActiveProjectsCount] = useState<number>(0);

    useEffect(() => {
        const loadCounts = async () => {
            try {
                const { data: projects, error } = await supabase
                    .from('projects')
                    .select('*')
                    .in('current_stage', [WorkflowStage.THUMBNAIL_DESIGN, WorkflowStage.CREATIVE_DESIGN]);

                if (error) throw error;

                const list = projects || [];
                const active = list.filter((p: any) => p.status !== TaskStatus.DONE);

                setActiveProjectsCount(active.length);

                setNeedsDeliveryCount(active.filter((p: any) => !p.delivery_date).length);

                const inProgress = active.filter((p: any) => {
                    if (p.content_type === 'CREATIVE_ONLY') return p.delivery_date && !p.creative_link;
                    return p.delivery_date && !p.thumbnail_link;
                }).length;
                setInProgressCount(inProgress);

                setDeliveredCount(active.filter((p: any) => !!p.creative_link || !!p.thumbnail_link).length);
            } catch (err) {
                console.error('Failed to load designer counts:', err);
            }
        };

        loadCounts();

        const subscription = supabase
            .channel('public:projects:designer_counts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                loadCounts();
            })
            .subscribe();

        return () => {
            try {
                supabase.removeChannel(subscription);
            } catch (e) {
                // ignore
            }
        };
    }, []);

    return (
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => { }}
            activeView={activeView}
            onChangeView={handleViewChange}
        >
            {selectedProject ? (
                <DesignerProjectDetail
                    project={selectedProject}
                    onBack={() => setSelectedProject(null)}
                    onUpdate={() => {
                        setSelectedProject(null);
                        onRefresh();
                    }}
                />
            ) : activeView === 'mywork' ? (
                <DesignerMyWork user={user} projects={historyProjects} onSelectProject={setSelectedProject} />
            ) : activeView === 'calendar' ? (
                <DesignerCalendar projects={inboxProjects} />
            ) : (
                <div key={refreshKey} className="space-y-8 animate-fade-in">
                    {/* Dashboard Content */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                                Creative Studio
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-[#F59E0B] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                        {needsDeliveryCount}
                                    </div>
                            <div className="text-sm font-bold uppercase text-white/80">Needs Delivery Date</div>
                        </div>
                        <div className="bg-[#3B82F6] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {inProgressCount}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">In Progress</div>
                        </div>
                        <div className="bg-[#10B981] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {deliveredCount}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Delivered Creatives</div>
                        </div>
                    </div>

                    {/* Quick Overview */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
                            Quick Overview
                        </h2>
                        <p className="text-slate-600">
                            You have {activeProjectsCount} {activeProjectsCount === 1 ? 'project' : 'projects'} in design.
                            Click <button onClick={() => setActiveView('mywork')} className="text-blue-600 font-bold underline">My Work</button> to manage them.
                        </p>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default DesignerDashboard;