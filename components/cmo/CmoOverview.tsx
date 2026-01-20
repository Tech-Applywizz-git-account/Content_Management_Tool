import React, { useState, useEffect } from 'react';
import { Project, Role, TaskStatus, WorkflowStage, User } from '../../types';
import { supabase } from '../../src/integrations/supabase/client';
import { db } from '../../services/supabaseDb';
import CmoTimelineView from './CmoTimelineView';

interface Props {
  user: any; // Pass user object if needed
}

const CmoOverview: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'IDEA' | 'SCRIPT'>('IDEA');
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'DETAILS'>('OVERVIEW');
  const [userDetails, setUserDetails] = useState<Record<string, User>>({});

  useEffect(() => {
    const fetchAllProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        setAllProjects(data || []);
        
        // Fetch user details for assigned editors
        const editorProjects = data?.filter(p => p.assigned_to_role === Role.EDITOR && p.assigned_to_user_id) || [];
        const userIds: string[] = [...new Set(editorProjects.map(p => p.assigned_to_user_id).filter(Boolean))] as string[];
        
        const userDetailsMap: Record<string, User> = {};
        for (const userId of userIds) {
          if (userId) {
            try {
              const user = await db.users.getById(userId) as User;
              userDetailsMap[userId as string] = user;
            } catch (err) {
              console.error(`Error fetching user ${userId}:`, err);
            }
          }
        }
        
        setUserDetails(userDetailsMap);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllProjects();
  }, []);
  
  // Filter projects by type
  const ideaProjects = allProjects.filter(p => p.data?.source === 'IDEA_PROJECT');
  const scriptProjects = allProjects.filter(p => p.data?.source !== 'IDEA_PROJECT' || p.data?.script_content);
  
  // Count projects by status
  const pendingAtCEO = allProjects.filter(p => 
    p.assigned_to_role === Role.CEO && 
    p.status === TaskStatus.WAITING_APPROVAL
  ).length;
  
  const withCine = allProjects.filter(p => 
    p.assigned_to_role === Role.CINE && 
    p.status !== TaskStatus.DONE
  ).length;
  
  const withEditor = allProjects.filter(p => 
    p.assigned_to_role === Role.EDITOR && 
    p.status !== TaskStatus.DONE
  ).length;
  
  // Count approved by current user
  const approvedByYou = allProjects.filter(p => 
    p.history?.some(h => 
      h.actor_id === user?.id && 
      h.action === 'APPROVED'
    )
  ).length;
  
  // Get projects based on active tab
  const projectsToShow = activeTab === 'IDEA' ? ideaProjects : scriptProjects;

  const renderProjectDetails = (project: Project) => (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => setViewMode('OVERVIEW')}
        className="flex items-center text-sm font-black text-slate-700 hover:text-slate-900 py-2 px-4 bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
      >
        ← Back to Overview
      </button>
      
      <div className="space-y-6">
        {/* Basic Info Section */}
        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-2xl font-black uppercase mb-4">Project Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Title</h3>
              <p className="font-medium bg-slate-50 p-2">{project.title}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Channel</h3>
              <p className="font-medium bg-slate-50 p-2">{project.channel}</p>
            </div>
            <div>
              <div>
  <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Writer</h3>
  <p className="font-medium bg-slate-50 p-2">
    {project.writer_name || '—'}
  </p>
</div>
<div>
  <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Editor</h3>
  <p className="font-medium bg-slate-50 p-2">
    {project.assigned_to_role === Role.EDITOR && project.assigned_to_user_id 
      ? userDetails[project.assigned_to_user_id]?.full_name || 'Loading...' 
      : '—'}
  </p>
</div>

              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Priority</h3>
              <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                ? 'bg-red-500 text-white'
                : project.priority === 'NORMAL'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-green-500 text-white'
                }`}>
                {project.priority}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h3>
              <p className="font-medium bg-slate-50 p-2">{project.status}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h3>
              <p className="font-medium bg-slate-50 p-2">{project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Assigned To</h3>
              <p className="font-medium bg-slate-50 p-2">{project.assigned_to_role || 'Unassigned'}</p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Created At</h3>
              <p className="font-medium bg-slate-50 p-2">{new Date(project.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        {/* Script Content Section */}
        {(project.data?.script_content || project.data?.idea_description) && (
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-lg font-black uppercase mb-4">
              {project.data?.source === 'IDEA_PROJECT' ? 'Idea Description' : 'Script Content'}
            </h3>
            <div className="max-h-60 overflow-y-auto border-2 border-gray-200 p-4 bg-gray-50">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {project.data?.script_content || project.data?.idea_description || 'No content available'}
              </pre>
            </div>
          </div>
        )}
        
        {/* Workflow Status Section */}
        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-lg font-black uppercase mb-4">Workflow Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h4>
              <p className="font-medium bg-slate-50 p-2">{project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h4>
              <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${project.status === 'DONE'
                ? 'bg-green-500 text-white'
                : project.status === 'WAITING_APPROVAL'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-blue-500 text-white'
                }`}>
                {project.status}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Rework Indicator</h4>
              <p className="font-medium bg-slate-50 p-2">
                {project.history?.some(h => h.action === 'REJECTED' || h.action.startsWith('REWORK')) ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Project Type</h4>
              <span className="inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                {project.data?.source === 'IDEA_PROJECT' ? (project.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA') : 'SCRIPT'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Timeline View Section */}
        <CmoTimelineView project={project} />
        
        {/* History / Audit Section */}
        {project.history && project.history.length > 0 && (
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-lg font-black uppercase mb-4">Workflow History</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto p-3 bg-gray-50">
              {project.history.map((historyItem, index) => (
                <div key={index} className="p-3 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${historyItem.action === 'APPROVED'
                        ? 'bg-green-500 text-white'
                        : historyItem.action === 'REJECTED'
                          ? 'bg-red-500 text-white'
                          : 'bg-blue-500 text-white'
                        }`}>
                        {historyItem.action}
                      </span>
                      <p className="text-sm mt-1">{historyItem.comment || 'No comment'}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-bold">{historyItem.actor_name}</p>
                      <p>{new Date(historyItem.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
  
  if (viewMode === 'DETAILS' && selectedProject) {
    return renderProjectDetails(selectedProject);
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-black uppercase">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
          <p className="text-xs font-bold uppercase mb-2">Approved by you</p>
          <p className="text-3xl font-black text-center py-4 bg-green-100 text-green-800">{approvedByYou}</p>
        </div>

        <div className="p-6 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
          <p className="text-xs font-bold uppercase mb-2">Pending at CEO</p>
          <p className="text-3xl font-black text-center py-4 bg-blue-100 text-blue-800">{pendingAtCEO}</p>
        </div>

        <div className="p-6 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
          <p className="text-xs font-bold uppercase mb-2">With Cine</p>
          <p className="text-3xl font-black text-center py-4 bg-purple-100 text-purple-800">{withCine}</p>
        </div>

        <div className="p-6 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
          <p className="text-xs font-bold uppercase mb-2">With Editor</p>
          <p className="text-3xl font-black text-center py-4 bg-yellow-100 text-yellow-800">{withEditor}</p>
        </div>
      </div>
      
      {/* Tabs for Idea and Script projects */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('IDEA')}
          className={`px-4 py-2 font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
            activeTab === 'IDEA'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-slate-900 hover:bg-slate-100'
          }`}
        >
          Idea ({ideaProjects.length})
        </button>
        <button
          onClick={() => setActiveTab('SCRIPT')}
          className={`px-4 py-2 font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
            activeTab === 'SCRIPT'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-900 hover:bg-slate-100'
          }`}
        >
          Script ({scriptProjects.length})
        </button>
      </div>
      
      {/* Projects list */}
      <div className="space-y-6">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading projects...</div>
        ) : projectsToShow.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No {activeTab.toLowerCase()} projects found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projectsToShow.map((project) => (
              <div 
                key={project.id} 
                className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col"
              >
                <div className="p-6 flex-grow">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.data?.source === 'IDEA_PROJECT' && (
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-purple-100 text-purple-900">
                        {project.data?.script_content ? 'IDEA-TO-SCRIPT' : 'IDEA'}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${project.channel === 'YOUTUBE' ? 'bg-[#FF4F4F] text-white' :
                      project.channel === 'LINKEDIN' ? 'bg-[#0085FF] text-white' :
                        'bg-[#D946EF] text-white'
                      }`}>
                      {project.channel}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${project.priority === 'HIGH'
                        ? 'bg-red-500 text-white'
                        : project.priority === 'NORMAL'
                          ? 'bg-yellow-500 text-black'
                          : 'bg-green-500 text-white'
                        }`}>
                      {project.priority}
                    </span>
                    <span
                      className={`px-2 py-0.5 border-2 border-black text-[10px] font-black uppercase ${project.current_stage ? 'bg-slate-100 text-slate-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'No Stage'}
                    </span>
                    <span
                      className={`px-2 py-0.5 border-2 border-black text-[10px] font-black uppercase ${project.assigned_to_role ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {project.assigned_to_role || 'Unassigned'}
                    </span>
                  </div>
                  <h4 className="font-black text-lg text-slate-900 mb-2 uppercase leading-tight">{project.title}</h4>
                  <div className="flex flex-col border-t-2 border-slate-100 pt-3">
                    <div className="flex items-center text-xs font-bold text-slate-500 uppercase">
                      By: {project.data?.writer_name || project.created_by_name || 'Unknown Writer'}
                    </div>
                    <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                      Created: {new Date(project.created_at).toLocaleDateString()}
                    </div>
                    {project.assigned_to_role === Role.EDITOR && project.assigned_to_user_id && (
                      <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                        Editor: {userDetails[project.assigned_to_user_id]?.full_name || 'Loading...'}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Enhanced action buttons */}
                <div className="px-6 pb-6 flex space-x-3">
                  {project.data?.idea_description && (
                    <button
                      className="flex-1 bg-purple-600 text-white py-2 px-4 font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-purple-700 hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProject({
                          ...project,
                          data: {
                            ...project.data,
                            script_content: undefined // Force idea view
                          }
                        });
                        setViewMode('DETAILS');
                      }}
                    >
                      View Idea
                    </button>
                  )}
                  
                  {project.data?.script_content && (
                    <button
                      className="flex-1 bg-blue-600 text-white py-2 px-4 font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-700 hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProject(project);
                        setViewMode('DETAILS');
                      }}
                    >
                      View Script
                    </button>
                  )}
                  
                  {!project.data?.idea_description && !project.data?.script_content && (
                    <button
                      className="flex-1 bg-gray-600 text-white py-2 px-4 font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-700 hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                      onClick={() => {
                        setSelectedProject(project);
                        setViewMode('DETAILS');
                      }}
                    >
                      View Details
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CmoOverview;
