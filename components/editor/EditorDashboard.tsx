import React, { useEffect, useState } from 'react';
import { Project, Role, WorkflowStage, TaskStatus } from '../../types';
import { formatDistanceToNow } from 'date-fns';
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
    onRefresh: () => void;
    onLogout: () => void;
}

const EditorDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, onRefresh, onLogout }) => {
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

    // Use inboxProjects for dashboard view (role-based filtering)
    // Use historyProjects for MyWork view (participation-based filtering)
    const projects = activeView === 'mywork' ? (historyProjects || []) : (inboxProjects || []);

    // ✅ FIXED: Remove mock data and use real projects filtered by stage
    const allProjects = (inboxProjects || []).filter(p => p.current_stage === WorkflowStage.VIDEO_EDITING);
    const activeProjects = allProjects.filter(p => p.status !== TaskStatus.DONE);

    return (
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => { }}
            activeView={activeView}
            onChangeView={handleViewChange}
        >
            {selectedProject ? (
                <EditorProjectDetail
                    project={selectedProject}
                    onBack={() => setSelectedProject(null)}
                    onUpdate={() => {
                        setSelectedProject(null);
                        onRefresh();
                    }}
                />
            ) : activeView === 'mywork' ? (
                <EditorMyWork user={user} projects={historyProjects} onSelectProject={setSelectedProject} />
            ) : activeView === 'calendar' ? (
                <EditorCalendar projects={inboxProjects} />
            ) : (
                <div className="space-y-8 animate-fade-in">
                    {/* Dashboard Content */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                                Edit Suite
                            </h1>
                            <p className="font-bold text-lg text-slate-500">Welcome back, {user.full_name}</p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-[#F59E0B] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {activeProjects.filter(p => !p.delivery_date).length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Needs Delivery Date</div>
                        </div>
                        <div className="bg-[#3B82F6] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {activeProjects.filter(p => p.delivery_date && !p.edited_video_link).length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">In Progress</div>
                        </div>
                        <div className="bg-[#10B981] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {activeProjects.filter(p => p.edited_video_link).length}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Completed Edits</div>
                        </div>
                    </div>

                    {/* Quick Overview */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
                            Quick Overview
                        </h2>
                        <p className="text-slate-600">
                            You have {activeProjects.length} {activeProjects.length === 1 ? 'project' : 'projects'} in editing.
                            Click <button onClick={() => setActiveView('mywork')} className="text-blue-600 font-bold underline">My Work</button> to manage them.
                        </p>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default EditorDashboard;