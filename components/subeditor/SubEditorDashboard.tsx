import React, { useState, useEffect } from 'react';
import { Project, Role, TaskStatus, WorkflowStage } from '../../types';
import { db } from '../../services/supabaseDb';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Upload, Video, FileText, Clock } from 'lucide-react';
import SubEditorProjectDetail from './SubEditorProjectDetail';
import SubEditorMyWork from './SubEditorMyWork';
import SubEditorCalendar from './SubEditorCalendar';
import Layout from '../Layout';

interface Props {
  user: any;
  inboxProjects: Project[];
  historyProjects: Project[];
  onRefresh: () => void;
  onLogout: () => void;
}

const SubEditorDashboard: React.FC<Props> = ({ user, inboxProjects, historyProjects, onRefresh, onLogout }) => {
  const viewStorageKey = `activeView:${user.role}`;
  const getStoredView = () => {
    if (typeof window === 'undefined') return 'dashboard';
    return localStorage.getItem(viewStorageKey) || 'dashboard';
  };
  
  const [activeView, setActiveView] = useState<string>(getStoredView());
  const [activeTab, setActiveTab] = useState<'ALL'>('ALL');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeFilter, setActiveFilter] = useState<'NEEDS_DELIVERY' | 'IN_PROGRESS' | 'COMPLETED' | null>(null);

  const handleViewChange = (view: string) => {
    setActiveView(view);
    if (view === 'mywork') {
      setActiveFilter(null);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(viewStorageKey, view);
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        // Get projects assigned to this sub-editor
        const allProjects = await db.getProjects(user);
        
        // Filter for projects assigned to this specific sub-editor
        const subEditorProjects = allProjects.filter(p => 
          p.assigned_to_role === Role.SUB_EDITOR &&
          p.assigned_to_user_id === user.id
        );

        setProjects(subEditorProjects);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user]);

  // Show all projects (no tab-based filtering)
  const filteredProjects = projects;

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

  const renderProjectCard = (project: Project) => {
    const isDelivered = !!project.edited_video_link;
    
    return (
      <div
        key={project.id}
        onClick={() => {
          setSelectedProject(project);
        }}
        className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer group"
      >
        <div className="p-6 space-y-4">
          {/* Channel and Priority Badges */}
          <div className="flex justify-between items-start">
            <span
              className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE'
                ? 'bg-[#FF4F4F] text-white'
                : project.channel === 'LINKEDIN'
                  ? 'bg-[#0085FF] text-white'
                  : 'bg-[#D946EF] text-white'
              }`}
            >
              {project.channel}
            </span>
            <span
              className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                ? 'bg-red-500 text-white'
                : project.priority === 'NORMAL'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-green-500 text-white'
              }`}
            >
              {project.priority}
            </span>
            {isDelivered ? (
              <span className="px-2 py-1 bg-green-100 text-green-800 border-2 border-green-600 text-[10px] font-black uppercase">
                ✓ Delivered
              </span>
            ) : project.delivery_date ? (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 border-2 border-blue-600 text-[10px] font-black uppercase">
                In Progress
              </span>
            ) : (
              <span className="px-2 py-1 bg-orange-100 text-orange-800 border-2 border-orange-600 text-[10px] font-black uppercase">
                Needs Delivery
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-black text-slate-900 uppercase leading-tight">{project.title}</h3>

          {/* Status */}
          <div className="space-y-2 text-sm">
            {project.video_link && (
              <div className="bg-blue-50 border-2 border-blue-400 p-2">
                <p className="text-[10px] font-bold text-blue-800">
                  <Video className="w-3 h-3 inline mr-1" />
                  Raw Video Ready
                </p>
              </div>
            )}
            {project.delivery_date && (
              <div className="flex justify-between">
                <span className="font-bold text-slate-400 uppercase text-xs">Delivery</span>
                <span className="font-bold text-slate-900">{project.delivery_date}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-bold text-slate-400 uppercase text-xs">Due</span>
              <span className="font-bold text-slate-900">
                {format(new Date(project.due_date), 'MMM dd, yyyy h:mm a')}
              </span>
            </div>
          </div>

          {/* Action Hint */}
          <div className="border-t-2 border-slate-100 pt-3">
            <button className="w-full bg-[#FF4F4F] text-white px-4 py-2 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
              {!project.delivery_date ? 'Set Delivery Date' : project.edited_video_link ? 'View Details' : 'Upload Edited Video'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (selectedProject) {
    return (
      <SubEditorProjectDetail
        project={selectedProject}
        userRole={Role.SUB_EDITOR}
        onBack={() => setSelectedProject(null)}
        onUpdate={() => {
          setSelectedProject(null);
          onRefresh();
        }}
        onLogout={onLogout}
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
      {activeView === 'mywork' ? (
        <SubEditorMyWork 
          user={user}
          projects={historyProjects || []}
          onSelectProject={setSelectedProject}
          activeFilter={activeFilter}
        />
      ) : activeView === 'calendar' ? (
        <SubEditorCalendar user={user} />
      ) : (
        <div className="space-y-8">
          {/* Dashboard Content */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-2 drop-shadow-sm">
                Sub-Editor Suite
              </h1>
              <p className="font-bold text-lg text-slate-500">Welcome back, {user.full_name}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* NEEDS DELIVERY DATE */}
            <div
              onClick={() => {
                setActiveFilter(null);
                setActiveView('mywork');
              }}
              className="bg-[#F59E0B] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              <div className="text-4xl font-black text-white mb-1">
                {projects.filter(p => !p.delivery_date).length}
              </div>
              <div className="text-sm font-bold uppercase text-white/80">Needs Delivery Date</div>
            </div>

            {/* IN PROGRESS */}
            <div
              onClick={() => {
                setActiveFilter(null);
                setActiveView('mywork');
              }}
              className="bg-[#3B82F6] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              <div className="text-4xl font-black text-white mb-1">
                {projects.filter(p => p.delivery_date && !p.edited_video_link).length}
              </div>
              <div className="text-sm font-bold uppercase text-white/80">In Progress</div>
            </div>

            {/* COMPLETED FOOTAGE */}
            <div
              onClick={() => {
                setActiveFilter(null);
                setActiveView('mywork');
              }}
              className="bg-[#10B981] border-2 border-black p-6 cursor-pointer shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              <div className="text-4xl font-black text-white mb-1">
                {projects.filter(p => !!p.edited_video_link).length}
              </div>
              <div className="text-sm font-bold uppercase text-white/80">Completed Footage</div>
            </div>
          </div>

          {/* Quick Overview */}
          <div className="space-y-4">
            <h2 className="text-2xl font-black uppercase text-slate-900 border-b-4 border-black inline-block pb-1">
              Quick Overview
            </h2>
            <p className="text-slate-600">
              You have {projects.length} {projects.length === 1 ? 'project' : 'projects'} assigned. Click <button onClick={() => setActiveView('mywork')} className="text-blue-600 font-bold underline">My Work</button> to manage them.
            </p>
          </div>

          {/* Projects Grid */}
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading projects...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No projects found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map(renderProjectCard)}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

export default SubEditorDashboard;