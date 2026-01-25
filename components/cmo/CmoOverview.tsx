import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, Role, TaskStatus, WorkflowStage, User } from '../../types';
import { format } from 'date-fns';
import { supabase } from '../../src/integrations/supabase/client';
import { db } from '../../services/supabaseDb';
import Timeline from '../Timeline';

// Helper function to format date to DD-MM-YYYY
const formatDateDDMMYYYY = (dateString: string | undefined): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is zero-indexed
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original if parsing fails
  }
};

interface Props {
  user: any; // Pass user object if needed
}

const CmoOverview: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'IDEA' | 'SCRIPT'>('IDEA');
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'DETAILS'>('OVERVIEW');
  const [userDetails, setUserDetails] = useState<Record<string, User>>({});
  const [activeStatusFilter, setActiveStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'DONE'>('ALL');

  interface WorkflowHistoryEntry {
    action: string;
    comment: string;
    actor_name: string;
    actor_id?: string;
    timestamp: string;
    stage: string;
    idx?: number;
    id?: string;
  }

  const [comments, setComments] = useState<WorkflowHistoryEntry[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchAllProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        setAllProjects(data || []);

        // Fetch user details for assigned editors, sub-editors, and designers
        const assignedProjects = data?.filter(p => p.assigned_to_user_id &&
          (p.assigned_to_role === Role.EDITOR || p.assigned_to_role === Role.SUB_EDITOR || p.assigned_to_role === Role.DESIGNER)
        ) || [];
        const userIds: string[] = [...new Set(assignedProjects.map(p => p.assigned_to_user_id).filter(Boolean))] as string[];

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

  // Count approved by current user
  const approvedByYou = allProjects.filter(p =>
    p.history?.some(h =>
      h.actor_id === user?.id &&
      h.action === 'APPROVED'
    )
  ).length;

  // Get projects based on active tab and status filter
  const projectsToShow = (activeTab === 'IDEA' ? ideaProjects : scriptProjects).filter(p => {
    if (activeStatusFilter === 'ALL') return true;
    return p.status === activeStatusFilter;
  });

  // Effect to fetch comments when selectedProject changes
  useEffect(() => {
    const fetchComments = async () => {
      if (!selectedProject?.id) return;

      const { data: allHistoryData, error: historyError } = await supabase
        .from('workflow_history')
        .select(`
          action,
          comment,
          actor_name,
          actor_id,
          timestamp,
          stage,
          actor_role
        `)
        .eq('project_id', selectedProject.id)
        .order('timestamp', { ascending: false });

      if (historyError) {
        console.error('Error fetching workflow history:', historyError);
        setComments([]);
        return;
      }

      // Filter to include all relevant workflow stages for comprehensive history
      const commentsData = allHistoryData.filter(item => {
        // Always include APPROVED, REWORK, and REJECTED actions
        if (['APPROVED', 'REWORK', 'REJECTED'].includes(item.action)) {
          return true;
        }

        // Include SUBMITTED actions for SCRIPT stage (writer submissions)
        if (item.stage === 'SCRIPT' && item.action === 'SUBMITTED') {
          return true;
        }

        // Include SUBMITTED actions for SCRIPT_REVIEW_L1 stage (writer submissions for CMO review)
        if (item.stage === 'SCRIPT_REVIEW_L1' && item.action === 'SUBMITTED') {
          return true;
        }

        // Include SUBMITTED actions for REWORK stage (writer rework submissions)
        if (item.stage === 'REWORK' && item.action === 'SUBMITTED') {
          return true;
        }

        // Include SUBMITTED actions for other stages where writers might submit content
        if (['WRITER_VIDEO_APPROVAL', 'POST_WRITER_REVIEW'].includes(item.stage) && item.action === 'SUBMITTED') {
          return true;
        }

        // Include APPROVED and SUBMITTED actions for MULTI_WRITER_APPROVAL stage (writer approvals)
        if (item.stage === 'MULTI_WRITER_APPROVAL' && ['APPROVED', 'SUBMITTED'].includes(item.action)) {
          return true;
        }

        // Include SET_SHOOT_DATE and SET_DELIVERY_DATE actions
        if (item.action === 'SET_SHOOT_DATE' || item.action === 'SET_DELIVERY_DATE') {
          return true;
        }

        // Include SUBMITTED actions for CINEMATOGRAPHY, VIDEO_EDITING, SUB_EDITOR_PROCESSING, THUMBNAIL_DESIGN
        // This ensures we see when content was uploaded in these stages
        if (['CINEMATOGRAPHY', 'VIDEO_EDITING', 'SUB_EDITOR_PROCESSING', 'THUMBNAIL_DESIGN'].includes(item.stage) && item.action === 'SUBMITTED') {
          return true;
        }

        // Include APPROVED actions for CINEMATOGRAPHY, VIDEO_EDITING, SUB_EDITOR_PROCESSING, THUMBNAIL_DESIGN, and SUB_EDITOR_ASSIGNMENT stages
        if (['CINEMATOGRAPHY', 'VIDEO_EDITING', 'SUB_EDITOR_PROCESSING', 'THUMBNAIL_DESIGN', 'SUB_EDITOR_ASSIGNMENT'].includes(item.stage) && item.action === 'APPROVED') {
          return true;
        }

        // Include all actions for FINAL_REVIEW_CMO and FINAL_REVIEW_CEO stages
        if (['FINAL_REVIEW_CMO', 'FINAL_REVIEW_CEO'].includes(item.stage)) {
          return true;
        }

        // Include SUB_EDITOR_ASSIGNED actions
        if (item.action === 'SUB_EDITOR_ASSIGNED') {
          return true;
        }

        // Include REWORK_VIDEO_SUBMITTED actions
        if (item.action === 'REWORK_VIDEO_SUBMITTED') {
          return true;
        }

        // Include SUBMITTED actions for SCRIPT stage (writer submissions)
        if (item.stage === 'SCRIPT' && item.action === 'SUBMITTED') {
          return true;
        }

        // Include all OPS_SCHEDULING actions
        if (item.stage === 'OPS_SCHEDULING') {
          return true;
        }

        // Include SUBMITTED actions for SCRIPT_REVIEW_L1 stage (writer submissions for CMO review)
        if (item.stage === 'SCRIPT_REVIEW_L1' && item.action === 'SUBMITTED') {
          return true;
        }

        // Include SUBMITTED actions for SCRIPT_REVIEW_L2 stage (writer submissions for CEO review)
        if (item.stage === 'SCRIPT_REVIEW_L2' && item.action === 'SUBMITTED') {
          return true;
        }

        // Include all actions for other CEO-related stages
        if (['FINAL_REVIEW_CEO_POST_APPROVAL', 'POST_WRITER_REVIEW'].includes(item.stage)) {
          return true;
        }

        // For other stages, only include specific approved-type actions
        return false;
      });

      // Filter out 'CREATED' actions and remove duplicates
      const filteredComments = commentsData?.filter(comment => comment.action !== 'CREATED') || [];

      // Deduplicate events based on a unique combination of action, actor, comment, and timestamp
      const uniqueEventsMap = new Map();

      filteredComments.forEach(comment => {
        // Create a unique key for each event based on action, actor, comment and timestamp
        const uniqueKey = `${comment.action}-${comment.actor_id || comment.actor_name}-${comment.comment || ''}-${comment.timestamp}`;

        // Only add the first occurrence of each unique event
        if (!uniqueEventsMap.has(uniqueKey)) {
          uniqueEventsMap.set(uniqueKey, comment);
        }
      });

      // Convert map values back to array
      // Sort by timestamp (most recent first)
      let uniqueComments = (Array.from(uniqueEventsMap.values()) as WorkflowHistoryEntry[])
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Fetch user details to get proper names instead of emails
      if (uniqueComments.length > 0) {
        const userIds = uniqueComments
          .map(comment => comment.actor_id)
          .filter(id => id) as string[];

        if (userIds.length > 0) {
          const uniqueUserIds = [...new Set(userIds)];

          // Fetch user details for all unique user IDs
          const userPromises = uniqueUserIds.map(async (userId) => {
            try {
              const user = await db.users.getById(userId);
              return { id: userId, ...user };
            } catch (error) {
              console.error(`Error fetching user ${userId}:`, error);
              return null;
            }
          });

          const userData = await Promise.all(userPromises);
          const userMapTemp: Record<string, any> = {};

          userData.forEach(user => {
            if (user) {
              userMapTemp[user.id] = user;
            }
          });

          setUserMap(userMapTemp);

          // Update the comments with proper names
          uniqueComments = uniqueComments.map(comment => {
            if (comment.actor_id && userMapTemp[comment.actor_id]) {
              return {
                ...comment,
                actor_name: userMapTemp[comment.actor_id].full_name || userMapTemp[comment.actor_id].email || comment.actor_name
              };
            }
            return comment;
          });
        }
      }

      setComments(uniqueComments);
    };

    fetchComments();
  }, [selectedProject?.id]);

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
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Writer</h3>
              <p className="font-medium bg-slate-50 p-2">
                {project.writer_name || '—'}
              </p>
            </div>
            {(project.assigned_to_role === Role.EDITOR || project.assigned_to_role === Role.SUB_EDITOR) && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Editor</h3>
                <p className="font-medium bg-slate-50 p-2">
                  {project.editor_name || project.sub_editor_name || project.data?.editor_name || project.data?.sub_editor_name || '—'}
                </p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h3>
              <p className="font-medium bg-slate-50 p-2">{project.status}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h3>
              <p className="font-medium bg-slate-50 p-2">{project.current_stage ? project.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
            </div>
            <div>
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
              {project.data?.script_content || project.data?.idea_description ? (
                <div
                  className="whitespace-pre-wrap font-sans text-sm"
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      let content = project.data?.script_content || project.data?.idea_description || 'No content available';
                      if (content !== 'No content available') {
                        // Decode HTML entities to properly display the content
                        content = content
                          .replace(/&lt;/g, '<')
                          .replace(/&gt;/g, '>')
                          .replace(/&amp;/g, '&')
                          .replace(/&quot;/g, '"')
                          .replace(/&#39;/g, "'")
                          .replace(/&nbsp;/g, ' ');
                      }
                      return content;
                    })()
                  }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  No content available
                </pre>
              )}
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

        {/* Timeline Component */}
        <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Timeline project={{ ...selectedProject, history: comments }} />
        </div>
      </div>
    </div>
  );

  if (viewMode === 'DETAILS' && selectedProject) {
    return renderProjectDetails(selectedProject);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-black uppercase">Overview</h1>

      {/* Tabs for Idea and Script projects */}
      <div className="flex flex-col space-y-4 border-b border-gray-200 pb-4">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('IDEA')}
            className={`px-4 py-2 font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${activeTab === 'IDEA'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-slate-900 hover:bg-slate-100'
              }`}
          >
            Idea ({ideaProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('SCRIPT')}
            className={`px-4 py-2 font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${activeTab === 'SCRIPT'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-900 hover:bg-slate-100'
              }`}
          >
            Script ({scriptProjects.length})
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold uppercase text-slate-500 mr-2">Status:</span>
          {['ALL', 'IN_PROGRESS', 'WAITING_APPROVAL', 'DONE'].map((status) => (
            <button
              key={status}
              onClick={() => setActiveStatusFilter(status as any)}
              className={`px-3 py-1 text-xs font-black uppercase border-2 border-black transition-all ${activeStatusFilter === status
                ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(100,100,100,1)]'
                : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Projects list */}
      <div className="space-y-6">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading projects...</div>
        ) : projectsToShow.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No {activeTab.toLowerCase()} projects found matching current filter</div>
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
                      {project.assigned_to_role === 'SUB_EDITOR' ? 'EDITOR' : (project.assigned_to_role || 'Unassigned')}
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

                    {/* Show live URL for completed projects */}
                    {project.status === 'DONE' && project.data?.live_url && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-green-800 uppercase">Live URL</span>
                          <a
                            href={project.data.live_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-blue-600 hover:underline truncate max-w-[100px]"
                            title={project.data.live_url}
                          >
                            View Live
                          </a>
                        </div>
                        <div className="text-xs text-slate-600 truncate" title={project.data.live_url}>
                          {project.data.live_url}
                        </div>
                      </div>
                    )}
                    {/* Show actual editor who uploaded content first, then fall back to assigned user */}
                    {(project.assigned_to_role === Role.EDITOR || project.assigned_to_role === Role.SUB_EDITOR) && (project.editor_name || project.sub_editor_name || project.data?.editor_name || project.data?.sub_editor_name) && (
                      <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                        Editor: {project.editor_name || project.sub_editor_name || project.data.editor_name || project.data.sub_editor_name}
                      </div>
                    )}
                    {/* Show only if there is an actual editor name, don't fall back to assigned user */}
                    {(project.assigned_to_role === Role.EDITOR || project.assigned_to_role === Role.SUB_EDITOR) && !(project.editor_name || project.sub_editor_name || project.data?.editor_name || project.data?.sub_editor_name) && (
                      <div className="flex items-center text-xs font-bold text-slate-500 uppercase mt-1">
                        Editor: —
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
                        navigate(`/cmo/review/${project.id}`);
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
                        navigate(`/cmo/review/${project.id}`);
                      }}
                    >
                      View Script
                    </button>
                  )}

                  {!project.data?.idea_description && !project.data?.script_content && (
                    <button
                      className="flex-1 bg-gray-600 text-white py-2 px-4 font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-700 hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                      onClick={() => {
                        navigate(`/cmo/review/${project.id}`);
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
