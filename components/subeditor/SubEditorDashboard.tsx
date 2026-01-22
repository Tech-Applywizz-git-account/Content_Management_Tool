import React, { useState, useEffect, useMemo } from 'react';
import { Project, Role, TaskStatus, WorkflowStage } from '../../types';
import { db } from '../../services/supabaseDb';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Upload, Video, Film, FileText, Clock } from 'lucide-react';
import SubEditorProjectDetail from './SubEditorProjectDetail';
import SubEditorMyWork from './SubEditorMyWork';
import SubEditorCalendar from './SubEditorCalendar';
import Layout from '../Layout';

interface Props {
  user: any;
  inboxProjects: Project[];
  historyProjects: Project[];
  scriptProjects?: Project[];
  onRefresh: () => void;
  onLogout: () => void;
}

const SubEditorDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, scriptProjects, onRefresh, onLogout }) => {
  const viewStorageKey = `activeView:${user.role}`;
  const getStoredView = () => {
    if (typeof window === 'undefined') return 'dashboard';
    return localStorage.getItem(viewStorageKey) || 'dashboard';
  };
  
  const [activeView, setActiveView] = useState<string>(getStoredView());
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectSource, setProjectSource] = useState<'MYWORK' | 'SCRIPTS' | null>(null);
  const [activeFilter, setActiveFilter] = useState<'NEEDS_DELIVERY' | 'IN_PROGRESS' | 'COMPLETED' | 'SCRIPTS' | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);



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

  // Handle top-level view changes (Dashboard / My Work / Calendar)
  const handleInternalRefresh = async () => {
    await onRefresh(); // MUST refetch from Supabase
    setRefreshKey(prev => prev + 1); // force UI re-render
  };

  // Restore last active view on load
  useEffect(() => {
    const storedView = getStoredView();
    setActiveView(storedView);

    // Safety: never restore dashboard filters on reload
    setActiveFilter(null);
  }, [viewStorageKey]);

  // Update projects state with inboxProjects that are assigned to this specific sub-editor
  useEffect(() => {
    const subEditorProjects = (inboxProjects || []).filter(p => 
      p.assigned_to_role === Role.SUB_EDITOR &&
      p.assigned_to_user_id === user.id
    );
    setProjects(subEditorProjects);
  }, [inboxProjects, user]);

  /**
 * Projects shown in MyWork:
 * - If user came from dashboard cards → filtered inbox projects
 * - If user clicked My Work manually → ALL projects the user has worked on (historyProjects)
 */
const filteredProjects = useMemo(() => {
  // No filter → show ALL sub-editor projects the user has worked on (history)
  if (!activeFilter) {
    return historyProjects || [];
  }

  // Filtered views (from dashboard cards)
  switch (activeFilter) {
    case 'NEEDS_DELIVERY':
      return (historyProjects || []).filter(p => !p.delivery_date);
    case 'IN_PROGRESS':
      return (historyProjects || []).filter(
        p => p.delivery_date && !p.edited_video_link
      );
    case 'COMPLETED':
      return (historyProjects || []).filter(p => !!p.edited_video_link);
    case 'SCRIPTS':
      // For SCRIPTS filter, return all projects that have script_content or are from IDEA_PROJECT
      return (historyProjects || []).filter(project => 
        project.data?.script_content || project.data?.source === 'IDEA_PROJECT'
      );
    default:
      return historyProjects || [];
  }
}, [activeFilter, historyProjects]);

  // Add state for counts
  const [needsDeliveryCount, setNeedsDeliveryCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [completedEditsCount, setCompletedEditsCount] = useState(0);
  const [scriptsCount, setScriptsCount] = useState(0);

  // Calculate counts when historyProjects change
  useEffect(() => {
    setNeedsDeliveryCount((historyProjects || []).filter(p => !p.delivery_date).length);
    setInProgressCount((historyProjects || []).filter(p => p.delivery_date && !p.edited_video_link).length);
    setCompletedEditsCount((historyProjects || []).filter(p => !!p.edited_video_link).length);
    
    // Count script projects
    setScriptsCount((historyProjects || []).filter(project => 
      project.data?.script_content || project.data?.source === 'IDEA_PROJECT'
    ).length);
  }, [historyProjects]);

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'DONE': return 'bg-green-500 text-white';
      case 'WAITING_APPROVAL': return 'bg-yellow-500 text-black';
      case 'IN_PROGRESS': return 'bg-blue-500 text-white';
      case 'REJECTED': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStageColor = (stage: WorkflowStage) => {
    switch (stage) {
      case WorkflowStage.SUB_EDITOR_ASSIGNMENT:
        return 'bg-purple-100 text-purple-800';
      case WorkflowStage.SUB_EDITOR_PROCESSING:
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  if (selectedProject) {
    return (
      <SubEditorProjectDetail
        project={selectedProject}
        userRole={Role.SUB_EDITOR}
        fromView={projectSource}
        onBack={() => {
          setSelectedProject(null);
          if (projectSource === 'SCRIPTS') {
            setActiveFilter('SCRIPTS');
            setActiveView('mywork');
          } else {
            setProjectSource(null);
          }
        }}
        onUpdate={() => {
          setSelectedProject(null);
          if (projectSource === 'SCRIPTS') {
            setActiveFilter('SCRIPTS');
            setActiveView('mywork');
          } else {
            setProjectSource(null);
          }
          onRefresh();
        }}
        onLogout={onLogout}
        onNavigateToView={handleViewChange}
        activeView={activeView}
      />
    );
  }

  return (
    <Layout
      user={user}
      onLogout={onLogout}
      onOpenCreate={() => {}}
      activeView={activeView}
      onChangeView={handleViewChange}
    >
      {selectedProject ? (
        <SubEditorProjectDetail
          project={selectedProject}
          userRole={Role.SUB_EDITOR}
          fromView={projectSource}
          onBack={() => {
            setSelectedProject(null);
            if (projectSource === 'SCRIPTS') {
              setActiveFilter('SCRIPTS');
              setActiveView('mywork');
            } else {
              setProjectSource(null);
            }
          }}
          onUpdate={() => {
            setSelectedProject(null);
            if (projectSource === 'SCRIPTS') {
              setActiveFilter('SCRIPTS');
              setActiveView('mywork');
            } else {
              setProjectSource(null);
            }
            onRefresh();
          }}
          onLogout={onLogout}
          onNavigateToView={handleViewChange}
          activeView={activeView}
        />
      ) : activeView === 'mywork' ? (
        <SubEditorMyWork 
          user={user}
          projects={activeFilter ? filteredProjects : historyProjects}
          onSelectProject={(project) => {
            setSelectedProject(project);
            setProjectSource(activeFilter === 'SCRIPTS' ? 'SCRIPTS' : 'MYWORK');
          }}
          activeFilter={activeFilter}
          scriptProjects={scriptProjects}
        />
      ) : activeView === 'calendar' ? (
        <SubEditorCalendar projects={historyProjects} user={user} />
      ) : (
        <div key={refreshKey} className="space-y-8 animate-fade-in">
          {/* Dashboard Content */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                Sub-Editor Suite
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
            {/* NEEDS DELIVERY DATE */}
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

            {/* IN PROGRESS */}
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

            {/* COMPLETED EDITS */}
            <div
              onClick={() => {
                setActiveFilter('COMPLETED');
                setActiveView('mywork');
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
              You have {(historyProjects || []).length} {(historyProjects || []).length === 1 ? 'project' : 'projects'} in sub-editing.
              Click <button onClick={() => setActiveView('mywork')} className="text-blue-600 font-bold underline">My Work</button> to manage them.
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SubEditorDashboard;