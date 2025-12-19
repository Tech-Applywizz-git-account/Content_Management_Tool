import React, { useEffect, useState } from 'react';
import { Project, Role, WorkflowStage, TaskStatus } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { Calendar as CalendarIcon, Upload, Video } from 'lucide-react';
import CineMyWork from './CineMyWork';
import CineCalendar from './CineCalendar';
import CineProjectDetail from './CineProjectDetail';
import Layout from '../Layout';
import Popup from '../Popup';
import { supabase } from '../../src/integrations/supabase/client';

interface Props {
    user: { full_name: string; role: Role };
    inboxProjects: Project[];
    historyProjects: Project[];
    onRefresh: () => void;
    onLogout: () => void;
}

const CineDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, onRefresh, onLogout }) => {
    const viewStorageKey = `activeView:${user.role}`;
    const getStoredView = () => {
        if (typeof window === 'undefined') return 'dashboard';
        return localStorage.getItem(viewStorageKey) || 'dashboard';
    };
    const [activeView, setActiveView] = useState<string>(getStoredView);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [shootDate, setShootDate] = useState<string>('');
    const [videoLink, setVideoLink] = useState<string>('');
    const [refreshKey, setRefreshKey] = useState(0);

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

    // Use inboxProjects for dashboard view (role-based filtering)
    // Use historyProjects for MyWork view (participation-based filtering)
    const projects = activeView === 'mywork' ? (historyProjects || []) : (inboxProjects || []);

    // Counts derived directly from projects table (source of truth)
    const [needsScheduleCount, setNeedsScheduleCount] = useState<number>(0);
    const [scheduledShootsCount, setScheduledShootsCount] = useState<number>(0);
    const [footageUploadedCount, setFootageUploadedCount] = useState<number>(0);
    const [activeProjectsCount, setActiveProjectsCount] = useState<number>(0);

    useEffect(() => {
        const loadCounts = async () => {
            try {
                const { data: projects, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('current_stage', WorkflowStage.CINEMATOGRAPHY);

                if (error) throw error;

                const list = projects || [];

                const active = list.filter((p: any) => p.status !== TaskStatus.DONE);

                setActiveProjectsCount(active.length);
                setNeedsScheduleCount(active.filter((p: any) => !p.shoot_date).length);
                setScheduledShootsCount(active.filter((p: any) => p.shoot_date && !p.video_link).length);

                // Footage uploaded: consider multiple possible fields
                setFootageUploadedCount(
                    active.filter((p: any) => !!p.video_link || !!p.video_url || (p.data && p.data.raw_footage_link) ).length
                );
            } catch (err) {
                console.error('Failed to load cinematography counts:', err);
            }
        };

        loadCounts();

        const subscription = supabase
            .channel('public:projects:cine_counts')
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
    }, [inboxProjects, historyProjects]);

    return (
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => { }}
            activeView={activeView}
            onChangeView={handleViewChange}
        >
            {selectedProject ? (
                <CineProjectDetail
                    project={selectedProject}
                    onBack={() => setSelectedProject(null)}
                    onUpdate={() => {
                        setSelectedProject(null);
                        onRefresh();
                    }}
                />
            ) : activeView === 'mywork' ? (
                <CineMyWork user={user} projects={historyProjects} onSelectProject={setSelectedProject} />
            ) : activeView === 'calendar' ? (
                <CineCalendar projects={inboxProjects} />
            ) : (
                <div key={refreshKey} className="space-y-8 animate-fade-in">
                    {/* Dashboard Content */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                                Cinematography
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
                                    {needsScheduleCount}
                                </div>
                            <div className="text-sm font-bold uppercase text-white/80">Needs Schedule</div>
                        </div>
                        <div className="bg-[#3B82F6] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {scheduledShootsCount}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Scheduled Shoots</div>
                        </div>
                        <div className="bg-[#10B981] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <div className="text-4xl font-black text-white mb-1">
                                {footageUploadedCount}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Footage Uploaded</div>
                        </div>
                    </div>

                    {/* Quick Overview */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
                            Quick Overview
                        </h2>
                        <p className="text-slate-600">
                            You have {activeProjectsCount} {activeProjectsCount === 1 ? 'project' : 'projects'} in production.
                            Click <button onClick={() => setActiveView('mywork')} className="text-blue-600 font-bold underline">My Work</button> to manage them.
                        </p>
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

export default CineDashboard;