import React, { useState, useEffect } from 'react';
import { Project, Role, TaskStatus, WorkflowStage } from '../../types';
import { db } from '../../services/supabaseDb';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Upload, Video, FileText, Clock } from 'lucide-react';
import SubEditorProjectDetail from './SubEditorProjectDetail';

interface Props {
  user: any;
  onBack: () => void;
  onLogout: () => void;
}

const SubEditorDashboard: React.FC<Props> = ({ user, onBack, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'>('ASSIGNED');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'DASHBOARD' | 'DETAILS'>('DASHBOARD');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        // Get projects assigned to this sub-editor
        const allProjects = await db.getProjects(user);
        
        // Filter for sub-editor specific projects
        const subEditorProjects = allProjects.filter(p => 
          p.assigned_to_role === Role.SUB_EDITOR ||
          p.current_stage === WorkflowStage.SUB_EDITOR_ASSIGNMENT ||
          p.current_stage === WorkflowStage.SUB_EDITOR_PROCESSING
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

  // Filter projects based on active tab
  const filteredProjects = projects.filter(project => {
    switch (activeTab) {
      case 'ASSIGNED':
        return project.current_stage === WorkflowStage.SUB_EDITOR_ASSIGNMENT && 
               project.status === TaskStatus.WAITING_APPROVAL;
      case 'IN_PROGRESS':
        return project.current_stage === WorkflowStage.SUB_EDITOR_PROCESSING && 
               project.status === TaskStatus.IN_PROGRESS;
      case 'COMPLETED':
        return project.status === TaskStatus.DONE;
      default:
        return true;
    }
  });

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

  const renderProjectCard = (project: Project) => (
    <div 
      key={project.id} 
      className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col cursor-pointer hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
      onClick={() => {
        setSelectedProject(project);
        setViewMode('DETAILS');
      }}
    >
      <div className="p-4 flex-grow">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`px-2 py-1 text-xs font-black uppercase border-2 border-black ${getStatusColor(project.status)}`}>
            {project.status}
          </span>
          <span className={`px-2 py-1 text-xs font-black uppercase border-2 border-black ${getStageColor(project.current_stage!)}`}>
            {project.current_stage?.replace(/_/g, ' ') || 'Unknown Stage'}
          </span>
          <span className={`px-2 py-1 text-xs font-black uppercase border-2 border-black ${
            project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
            project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
            'bg-[#D946EF] text-white'
          }`}>
            {project.channel}
          </span>
          <span
            className={`px-2 py-1 text-xs font-black uppercase border-2 border-black ${
              project.priority === 'HIGH' ? 'bg-red-500 text-white' :
              project.priority === 'NORMAL' ? 'bg-yellow-500 text-black' :
              'bg-green-500 text-white'
            }`}
          >
            {project.priority}
          </span>
        </div>
        <h4 className="font-black text-base text-slate-900 mb-2 uppercase leading-tight">{project.title}</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center text-slate-500 uppercase">
            <span className="font-bold">By:</span> {project.data?.writer_name || project.created_by_name || 'Unknown Writer'}
          </div>
          <div className="flex items-center text-slate-500 uppercase">
            <Clock className="w-3 h-3 mr-1" />
            <span className="font-bold">Due:</span> {format(new Date(project.due_date), 'MMM dd, yyyy')}
          </div>
          {project.delivery_date && (
            <div className="flex items-center text-slate-500 uppercase">
              <Calendar className="w-3 h-3 mr-1" />
              <span className="font-bold">Delivery:</span> {format(new Date(project.delivery_date), 'MMM dd, yyyy')}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pb-4">
        <button className="w-full bg-[#0085FF] text-white py-2 px-4 font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all">
          View Details
        </button>
      </div>
    </div>
  );

  if (viewMode === 'DETAILS' && selectedProject) {
    return (
      <SubEditorProjectDetail
        project={selectedProject}
        userRole={Role.SUB_EDITOR}
        onBack={() => setViewMode('DASHBOARD')}
        onUpdate={() => {
          // Refresh projects when updated
          const fetchProjects = async () => {
            try {
              setLoading(true);
              const allProjects = await db.getProjects(user);
              
              const subEditorProjects = allProjects.filter(p => 
                p.assigned_to_role === Role.SUB_EDITOR ||
                p.current_stage === WorkflowStage.SUB_EDITOR_ASSIGNMENT ||
                p.current_stage === WorkflowStage.SUB_EDITOR_PROCESSING
              );

              setProjects(subEditorProjects);
            } catch (error) {
              console.error('Error fetching projects:', error);
            } finally {
              setLoading(false);
            }
          };
          
          fetchProjects();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b-2 border-black sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black uppercase text-slate-900">Sub-Editor Dashboard</h1>
            <p className="text-sm text-slate-500">Manage video editing projects assigned to you</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-500 text-white font-black uppercase border-2 border-black hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 border-2 border-black">
                <FileText className="w-6 h-6 text-blue-800" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase text-slate-500">Assigned Projects</p>
                <p className="text-2xl font-black">
                  {projects.filter(p => p.current_stage === WorkflowStage.SUB_EDITOR_ASSIGNMENT).length}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 border-2 border-black">
                <Video className="w-6 h-6 text-purple-800" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase text-slate-500">In Progress</p>
                <p className="text-2xl font-black">
                  {projects.filter(p => p.current_stage === WorkflowStage.SUB_EDITOR_PROCESSING).length}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 border-2 border-black">
                <Upload className="w-6 h-6 text-green-800" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase text-slate-500">Completed</p>
                <p className="text-2xl font-black">
                  {projects.filter(p => p.status === TaskStatus.DONE).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('ASSIGNED')}
            className={`px-6 py-3 font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
              activeTab === 'ASSIGNED'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-900 hover:bg-slate-100'
            }`}
          >
            Assigned ({projects.filter(p => p.current_stage === WorkflowStage.SUB_EDITOR_ASSIGNMENT).length})
          </button>
          <button
            onClick={() => setActiveTab('IN_PROGRESS')}
            className={`px-6 py-3 font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
              activeTab === 'IN_PROGRESS'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-slate-900 hover:bg-slate-100'
            }`}
          >
            In Progress ({projects.filter(p => p.current_stage === WorkflowStage.SUB_EDITOR_PROCESSING).length})
          </button>
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-6 py-3 font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
              activeTab === 'COMPLETED'
                ? 'bg-green-600 text-white'
                : 'bg-white text-slate-900 hover:bg-slate-100'
            }`}
          >
            Completed ({projects.filter(p => p.status === TaskStatus.DONE).length})
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No {activeTab.toLowerCase()} projects found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(renderProjectCard)}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubEditorDashboard;