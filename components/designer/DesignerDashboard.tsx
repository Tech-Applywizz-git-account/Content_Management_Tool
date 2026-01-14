import React, { useEffect, useState, useMemo } from 'react';
import { Project, Role, WorkflowStage, TaskStatus } from '../../types';
import { Palette, Video, FileImage } from 'lucide-react';
import DesignerMyWork from './DesignerMyWork';
import DesignerCalendar from './DesignerCalendar';
import DesignerProjectDetail from './DesignerProjectDetail';
import CreateDesignerProject from './CreateDesignerProject';
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

const DesignerDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, scriptProjects, onRefresh, onLogout }) => {
    const viewStorageKey = `activeView:${user.role}`;
    const getStoredView = () => {
        if (typeof window === 'undefined') return 'dashboard';
        return localStorage.getItem(viewStorageKey) || 'dashboard';
    };
    const [activeView, setActiveView] = useState<string>(getStoredView);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [activeFilter, setActiveFilter] = useState<'NEEDS_DELIVERY' | 'IN_PROGRESS' | 'DELIVERED' | 'SCRIPTS' | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleInternalRefresh = async () => {
        await onRefresh(); // MUST refetch from Supabase
        setRefreshKey(prev => prev + 1); // force UI re-render
    };

    // Handle top-level view changes (Dashboard / My Work / Calendar)
const handleViewChange = (view: string) => {
  setActiveView(view);

  // ✅ IMPORTANT:
  // If user manually clicks "My Work",
  // clear any dashboard-based filters
  if (view === 'mywork') {
    setActiveFilter(null);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(viewStorageKey, view);
  }
};

// Restore last active view on load
useEffect(() => {
  const storedView = getStoredView();
  setActiveView(storedView);

  // Safety: never restore dashboard filters on reload
  setActiveFilter(null);
}, [viewStorageKey]);



    /**
 * Projects shown in MyWork:
 * - If user came from dashboard cards → filtered
 * - If user clicked My Work manually → ALL projects
 */
const filteredProjects = useMemo(() => {
  // No filter → show ALL designer projects
  if (!activeFilter) {
    return historyProjects || [];
  }

  // Filtered views (from dashboard cards)
  switch (activeFilter) {
    case 'SCRIPTS':
      // For SCRIPTS filter, return all projects that have script_content or are from IDEA_PROJECT
      return (historyProjects || []).filter(project => 
        project.data?.script_content || project.data?.source === 'IDEA_PROJECT'
      );
    case 'NEEDS_DELIVERY':
      return (historyProjects || []).filter(p => !p.delivery_date);
    case 'IN_PROGRESS':
      return (historyProjects || []).filter(p => {
        if (p.content_type === 'CREATIVE_ONLY') return p.delivery_date && !p.creative_link;
        return p.delivery_date && !p.thumbnail_link;
      });
    case 'DELIVERED':
      return (historyProjects || []).filter(p => p.creative_link || p.thumbnail_link);
    default:
      return historyProjects || [];
  }
}, [activeFilter, historyProjects]);

    // Counts derived directly from projects table (source of truth)
    const [needsDeliveryCount, setNeedsDeliveryCount] = useState<number>(0);
    const [inProgressCount, setInProgressCount] = useState<number>(0);
    const [deliveredCount, setDeliveredCount] = useState<number>(0);
    const [scriptsCount, setScriptsCount] = useState<number>(0);
    const [activeProjectsCount, setActiveProjectsCount] = useState<number>(0);

    useEffect(() => {
        // Use the inboxProjects passed from App.tsx instead of making a separate query
        // Filter to only show projects at THUMBNAIL_DESIGN or CREATIVE_DESIGN stages
        const designerProjects = (inboxProjects || []).filter(p => 
            p.current_stage === WorkflowStage.THUMBNAIL_DESIGN || 
            p.current_stage === WorkflowStage.CREATIVE_DESIGN
        );
        const active = designerProjects.filter(p => p.status !== TaskStatus.DONE);

        setActiveProjectsCount(active.length);
        
        // Count all script projects passed from parent
        setScriptsCount((scriptProjects || []).length);
        
        // Calculate other counts based on historyProjects
        setNeedsDeliveryCount((historyProjects || []).filter(p => !p.delivery_date).length);
        setInProgressCount((historyProjects || []).filter(p => {
            if (p.content_type === 'CREATIVE_ONLY') return p.delivery_date && !p.creative_link;
            return p.delivery_date && !p.thumbnail_link;
        }).length);
        setDeliveredCount((historyProjects || []).filter(p => p.creative_link || p.thumbnail_link).length);
    }, [inboxProjects, historyProjects, scriptProjects]);

    return (
        <Layout
            user={user as any}
            onLogout={onLogout}
            onOpenCreate={() => { }}
            activeView={activeView}
            onChangeView={handleViewChange}
        >
        {/* Add button to create direct creative projects */}
        {activeView === 'dashboard' && (
            <div className="mb-6 flex justify-end">
                <button
                    onClick={() => setActiveView('create-designer-project')}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-black text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                    + Create Designer Project
                </button>
            </div>
        )}
            {selectedProject ? (
                <DesignerProjectDetail
                    project={selectedProject}
                    userRole={user.role}
                    onBack={() => setSelectedProject(null)}
                    onUpdate={() => {
                        setSelectedProject(null);
                        onRefresh();
                    }}
                />
            ) : activeView === 'create-designer-project' ? (
                <CreateDesignerProject
                    onClose={() => setActiveView('dashboard')}
                    onSuccess={() => {
                        setActiveView('dashboard');
                        onRefresh();
                    }}
                />
            ) : activeView === 'mywork' ? (
                <DesignerMyWork user={user} projects={activeFilter ? filteredProjects : historyProjects} onSelectProject={setSelectedProject} scriptProjects={scriptProjects} activeFilter={activeFilter} />
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div
                            onClick={() => {
                                setActiveFilter('NEEDS_DELIVERY');
                                setActiveView('mywork');
                            }}
                            className="bg-[#F59E0B] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            <div className="text-4xl font-black text-white mb-1">
                                {needsDeliveryCount}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Needs Delivery Date</div>
                        </div>
                        <div
                            onClick={() => {
                                setActiveFilter('IN_PROGRESS');
                                setActiveView('mywork');
                            }}
                            className="bg-[#3B82F6] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            <div className="text-4xl font-black text-white mb-1">
                                {inProgressCount}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">In Progress</div>
                        </div>
                        <div
                            onClick={() => {
                                setActiveFilter('DELIVERED');
                                setActiveView('mywork');
                            }}
                            className="bg-[#10B981] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            <div className="text-4xl font-black text-white mb-1">
                                {deliveredCount}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Delivered Creatives</div>
                        </div>
                        <div
                            onClick={() => {
                                setActiveFilter('SCRIPTS');
                                setActiveView('mywork');
                            }}
                            className="bg-[#8B5CF6] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            <div className="text-4xl font-black text-white mb-1">
                                {scriptsCount}
                            </div>
                            <div className="text-sm font-bold uppercase text-white/80">Scripts</div>
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