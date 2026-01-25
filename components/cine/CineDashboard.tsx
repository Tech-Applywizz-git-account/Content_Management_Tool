import React, { useEffect, useState } from 'react';
import { Project, Role, WorkflowStage, TaskStatus } from '../../types';
import { format } from 'date-fns';
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
  scriptProjects?: Project[];
  onRefresh: () => void;
  onLogout: () => void;
}

const CineDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, scriptProjects, onRefresh, onLogout }) => {
  const viewStorageKey = `activeView:${user.role}`;
  const getStoredView = () => {
    if (typeof window === 'undefined') return 'dashboard';
    return localStorage.getItem(viewStorageKey) || 'dashboard';
  };
  const [activeView, setActiveView] = useState<string>(getStoredView);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectSource, setProjectSource] = useState<'MYWORK' | 'SCRIPTS' | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    'NEEDS_SCHEDULE' | 'SCHEDULED' | 'UPLOADED' | 'SCRIPTS' | null
  >(null);
  const [uploadedSubTab, setUploadedSubTab] = useState<'EDITOR' | 'POST' | 'POSTED' | null>(null);

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
  const filteredProjects = React.useMemo(() => {
    // No filter → show ALL cine projects
    if (!activeFilter) {
      return historyProjects || [];
    }

    // Filtered views (from dashboard cards)
    let baseFilteredProjects = (historyProjects || []).filter(project => {
      switch (activeFilter) {
        case 'NEEDS_SCHEDULE':
          return !project.shoot_date;

        case 'SCHEDULED':
          return project.shoot_date && !project.video_link;

        case 'UPLOADED':
          return (
            !!project.video_link ||
            !!project.video_url ||
            !!project.data?.raw_footage_link
          );

        case 'POSTED':
          // Show projects that are completed and have live URLs from Ops
          return (
            project.status === TaskStatus.DONE &&
            !!project.data?.live_url
          );

        default:
          return true;
      }
    });

    // Apply sub-tab filtering for UPLOADED
    if (activeFilter === 'UPLOADED' && uploadedSubTab) {
      baseFilteredProjects = baseFilteredProjects.filter(project => {
        if (uploadedSubTab === 'EDITOR') {
          // Show projects assigned to Editor or SubEditor roles
          return project.assigned_to_role === 'EDITOR' || project.assigned_to_role === 'SUB_EDITOR';
        } else if (uploadedSubTab === 'POST') {
          // Show projects NOT assigned to Editor roles
          return project.assigned_to_role !== 'EDITOR' && project.assigned_to_role !== 'SUB_EDITOR';
        } else if (uploadedSubTab === 'POSTED') {
          // Show projects that are completed and have live URLs (posted projects)
          return project.status === TaskStatus.DONE && !!project.data?.live_url;
        }
        return true;
      });
    }

    return baseFilteredProjects;
  }, [activeFilter, historyProjects, uploadedSubTab]);



  // Counts derived directly from projects table (source of truth)
  const [needsScheduleCount, setNeedsScheduleCount] = useState<number>(0);
  const [scheduledShootsCount, setScheduledShootsCount] = useState<number>(0);
  const [footageUploadedCount, setFootageUploadedCount] = useState<number>(0);
  const [activeProjectsCount, setActiveProjectsCount] = useState<number>(0);

  useEffect(() => {
    // Use the inboxProjects passed from App.tsx instead of making a separate query
    const activeProjects = (inboxProjects || []).filter(p => p.status !== TaskStatus.DONE);

    setActiveProjectsCount(activeProjects.length);
    setNeedsScheduleCount(activeProjects.filter(p => !p.shoot_date).length);
    setScheduledShootsCount(activeProjects.filter(p => p.shoot_date && !p.video_link).length);

    // Footage uploaded: consider multiple possible fields for active projects
    setFootageUploadedCount(
      activeProjects.filter(p => !!p.video_link || !!p.video_url || (p.data && p.data.raw_footage_link)).length
    );

    // Count all script projects passed from parent
    setScriptCount((scriptProjects || []).length);
  }, [inboxProjects, scriptProjects]);

  // Calculate counts based on historyProjects for consistency with the filtered view
  useEffect(() => {
    // Use historyProjects for "Footage Uploaded" count since that's what gets displayed when filtered
    const historyFootageUploadedCount = (historyProjects || []).filter(p =>
      !!p.video_link || !!p.video_url || (p.data && p.data.raw_footage_link)
    ).length;

    // Update footage uploaded count to match what will be shown when filter is applied
    setFootageUploadedCount(historyFootageUploadedCount);
  }, [historyProjects]);

  const [scriptCount, setScriptCount] = useState<number>(0);

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
          userRole={user.role}
          fromView={projectSource}
          activeFilter={activeFilter}
          uploadedSubTab={uploadedSubTab}
          onBack={() => {
            setSelectedProject(null);
            if (projectSource === 'SCRIPTS') {
              setActiveFilter('SCRIPTS');
              setActiveView('mywork');
            } else {
              setActiveFilter(null);
            }
            // Preserve the original filter and sub-tab when navigating back
            if (projectSource === 'MYWORK' && activeFilter) {
              // Maintain the active filter and sub-tab state
              setActiveFilter(activeFilter);
              setActiveView('mywork');
            } else if (projectSource === 'SCRIPTS') {
              setActiveFilter('SCRIPTS');
              setActiveView('mywork');
            } else {
              setActiveFilter(null);
            }
            setProjectSource(null);
          }}
          onUpdate={() => {
            setSelectedProject(null);
            if (projectSource === 'SCRIPTS') {
              setActiveFilter('SCRIPTS');
              setActiveView('mywork');
            } else if (projectSource === 'MYWORK' && activeFilter) {
              // Maintain the active filter and sub-tab state
              setActiveFilter(activeFilter);
              setActiveView('mywork');
            } else {
              setActiveFilter(null);
            }
            setProjectSource(null);
            onRefresh();
          }}
        />

      ) : activeView === 'mywork' ? (
        <CineMyWork
          user={user}
          projects={activeFilter ? filteredProjects : historyProjects}
          scriptProjects={scriptProjects}
          onSelectProject={(project) => {
            setSelectedProject(project);
            setProjectSource(activeFilter === 'SCRIPTS' ? 'SCRIPTS' : 'MYWORK');
          }}
          activeFilter={activeFilter}
          uploadedSubTab={uploadedSubTab}
          onSetUploadedSubTab={setUploadedSubTab}
        />

      ) : activeView === 'calendar' ? (
        <CineCalendar projects={[...inboxProjects, ...historyProjects]} />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* NEEDS SCHEDULE */}
            <div
              onClick={() => {
                setActiveFilter('NEEDS_SCHEDULE');
                setActiveView('mywork');
              }}
              className="bg-[#F59E0B] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              <div className="text-4xl font-black text-white mb-1">
                {needsScheduleCount}
              </div>
              <div className="text-sm font-bold uppercase text-white/80">
                Needs Schedule
              </div>
            </div>

            {/* SCHEDULED SHOOTS */}
            <div
              onClick={() => {
                setActiveFilter('SCHEDULED');
                setActiveView('mywork');
              }}
              className="bg-[#3B82F6] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              <div className="text-4xl font-black text-white mb-1">
                {scheduledShootsCount}
              </div>
              <div className="text-sm font-bold uppercase text-white/80">
                Scheduled Shoots
              </div>
            </div>

            {/* FOOTAGE UPLOADED */}
            <div
              onClick={() => {
                setActiveFilter('UPLOADED');
                setActiveView('mywork');
              }}
              className="bg-[#10B981] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              <div className="text-4xl font-black text-white mb-1">
                {footageUploadedCount}
              </div>
              <div className="text-sm font-bold uppercase text-white/80">
                Footage Uploaded
              </div>
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
                {scriptCount}
              </div>
              <div className="text-sm font-bold uppercase text-white/80">
                Scripts
              </div>
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