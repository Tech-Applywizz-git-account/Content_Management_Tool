import React, { useState, useEffect } from 'react';
import { Project, Role, TaskStatus, WorkflowStage, User } from '../../types';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../src/integrations/supabase/client';
import { db } from '../../services/supabaseDb';
import CmoTimelineView from './CmoTimelineView';

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

import { useSearchParams } from 'react-router-dom';

const CmoOverview: React.FC<Props> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('type') as 'IDEA' | 'SCRIPT') || 'IDEA';
  const setActiveTab = (tab: 'IDEA' | 'SCRIPT') => {
    setSearchParams(prev => {
      prev.set('type', tab);
      return prev;
    }, { replace: true });
  };

  const scriptFilter = (searchParams.get('overview_filter') as any) || 'ALL';
  const setScriptFilter = (filter: string) => {
    setSearchParams(prev => {
      prev.set('overview_filter', filter);
      return prev;
    }, { replace: true });
  };
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'DETAILS'>('OVERVIEW');
  const [userDetails, setUserDetails] = useState<Record<string, User>>({});
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

  // Scroll restoration logic
  useEffect(() => {
    if (viewMode === 'OVERVIEW' && !loading) {
      const savedScrollPos = sessionStorage.getItem('cmo_overview_scroll_pos');
      if (savedScrollPos) {
        // Small delay to ensure content is rendered
        const timeoutId = setTimeout(() => {
          window.scrollTo({
            top: parseInt(savedScrollPos, 10),
            behavior: 'instant'
          });
        }, 50);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [viewMode, loading]);

  const handleViewDetails = (project: Project) => {
    sessionStorage.setItem('cmo_overview_scroll_pos', window.scrollY.toString());
    setSelectedProject(project);
    setViewMode('DETAILS');
    window.scrollTo(0, 0);
  };

  const handleBackToOverview = () => {
    setViewMode('OVERVIEW');
  };

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

  // Filter script projects with role-based filtering
  const allScriptProjects = allProjects.filter(p => p.data?.source !== 'IDEA_PROJECT' || p.data?.script_content);

  const scriptProjects = scriptFilter === 'ALL'
    ? allScriptProjects
    : allScriptProjects.filter(p => {
      switch (scriptFilter) {
        case 'WRITER':
          return p.assigned_to_role === Role.WRITER ||
            p.current_stage === WorkflowStage.SCRIPT ||
            p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 ||
            p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2 ||
            p.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL;
        case 'CMO':
          return p.assigned_to_role === Role.CMO ||
            p.current_stage === WorkflowStage.FINAL_REVIEW_CMO ||
            p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1;
        case 'CEO':
          return p.assigned_to_role === Role.CEO ||
            p.current_stage === WorkflowStage.FINAL_REVIEW_CEO ||
            p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2;
        case 'CINE':
          return p.assigned_to_role === Role.CINE ||
            p.current_stage === WorkflowStage.CINEMATOGRAPHY;
        case 'EDITOR':
          return p.assigned_to_role === Role.EDITOR ||
            p.current_stage === WorkflowStage.VIDEO_EDITING ||
            p.current_stage === WorkflowStage.SUB_EDITOR_ASSIGNMENT ||
            p.current_stage === WorkflowStage.SUB_EDITOR_PROCESSING;
        case 'DESIGNER':
          return p.assigned_to_role === Role.DESIGNER ||
            p.current_stage === WorkflowStage.THUMBNAIL_DESIGN ||
            p.current_stage === WorkflowStage.CREATIVE_DESIGN;
        case 'OPS':
          return p.assigned_to_role === Role.OPS ||
            p.current_stage === WorkflowStage.OPS_SCHEDULING;
        case 'POSTED':
          return p.current_stage === WorkflowStage.POSTED ||
            (p.status === 'DONE' && p.data?.live_url && p.data.live_url.trim() !== '');
        default:
          return true;
      }
    });



  // Count approved by current user
  const approvedByYou = allProjects.filter(p =>
    p.history?.some(h =>
      h.actor_id === user?.id &&
      h.action === 'APPROVED'
    )
  ).length;

  // Get projects based on active tab
  const projectsToShow = activeTab === 'IDEA'
    ? ideaProjects
    : scriptProjects;

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
          stage
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
        if (['POST_WRITER_REVIEW'].includes(item.stage)) {
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
        onClick={handleBackToOverview}
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

        {/* Comments and Feedback Section - Same as CMO Project Details */}
        <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-xl font-black uppercase mb-6 border-b-2 border-black pb-3 text-slate-900">
            Project Comments & Feedback
          </h3>

          {/* Display current project dates and script reference link if they exist */}
          {(selectedProject?.shoot_date || selectedProject?.delivery_date || selectedProject?.post_scheduled_date || selectedProject?.data?.script_reference_link) && (
            <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!['JOBBOARD', 'LEAD_MAGNET'].includes(selectedProject.content_type) && selectedProject?.shoot_date && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">📅 Shoot Date:</span>
                    <span className="font-bold text-green-600">{formatDateDDMMYYYY(selectedProject.shoot_date)}</span>
                  </div>
                )}
                {selectedProject?.delivery_date && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">📦 Delivery Date:</span>
                    <span className="font-bold text-blue-600">{formatDateDDMMYYYY(selectedProject.delivery_date)}</span>
                  </div>
                )}
                {selectedProject?.post_scheduled_date && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">🗓️ Post Date:</span>
                    <span className="font-bold text-purple-600">{formatDateDDMMYYYY(selectedProject.post_scheduled_date)}</span>
                  </div>
                )}
                {selectedProject?.data?.script_reference_link && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">🔗 Script Link:</span>
                    <a href={selectedProject.data.script_reference_link} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 underline">
                      View Script
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fetch and display comments similar to CMO Project Details */}
          {comments.length > 0 ? (
            <div className="space-y-6 bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {comments.map((comment, index) => {
                // Determine the description based on stage and action
                let description = `${comment.action} in ${comment.stage}`;

                switch (comment.stage) {
                  case 'SCRIPT':
                    if (comment.action === 'SUBMITTED') {
                      description = 'Project submitted by writer';
                    }
                    break;
                  case 'SCRIPT_REVIEW_L1':
                    if (comment.action === 'APPROVED') {
                      description = 'Project approved by CMO';
                    } else if (comment.action === 'REWORK') {
                      description = 'CMO requested rework';
                    }
                    break;
                  case 'FINAL_REVIEW_CMO':
                    if (comment.action === 'APPROVED') {
                      description = 'Project approved by CMO';
                    } else if (comment.action === 'REWORK') {
                      description = 'CMO requested rework';
                    }
                    break;
                  case 'FINAL_REVIEW_CEO':
                    if (comment.action === 'APPROVED') {
                      description = 'Project approved by CEO';
                    } else if (comment.action === 'REWORK') {
                      description = 'CEO requested rework';
                    }
                    break;
                  case 'MULTI_WRITER_APPROVAL':
                    if (comment.action === 'APPROVED') {
                      description = 'Writer approved the final video';
                    } else if (comment.action === 'SUBMITTED') {
                      description = 'All writers have approved - Project advanced to CMO for final review';
                    }
                    break;
                  case 'CINEMATOGRAPHY':
                    if (comment.action === 'SUBMITTED') {
                      description = 'Raw video uploaded by cinematographer';
                    }
                    break;
                  case 'VIDEO_EDITING':
                    if (comment.action === 'SUBMITTED') {
                      description = 'Edited video uploaded by editor';
                    }
                    break;
                  case 'SUB_EDITOR_PROCESSING':
                    if (comment.action === 'SUBMITTED') {
                      description = 'Edited video uploaded by sub-editor';
                    } else if (comment.action === 'APPROVED') {
                      description = 'Sub-editor completed processing';
                    }
                    break;
                  case 'THUMBNAIL_DESIGN':
                    if (comment.action === 'SUBMITTED') {
                      description = 'Assets uploaded by designer';
                    }
                    break;
                  default:
                    // Handle special actions that might not have a specific stage mapping
                    if (comment.action === 'SET_SHOOT_DATE') {
                      description = 'Shoot date set';
                    } else if (comment.action === 'SET_DELIVERY_DATE') {
                      description = 'Delivery date set';
                    } else if (comment.action === 'REWORK_VIDEO_SUBMITTED') {
                      description = 'Rework video uploaded';
                    } else if (comment.action === 'SUB_EDITOR_ASSIGNED') {
                      description = 'Project assigned to sub-editor';
                    } else {
                      description = `${comment.action} in ${comment.stage}`;
                    }
                }

                return (
                  <div key={`${comment.stage}-${comment.action}-${comment.timestamp}-${comment.actor_id || comment.actor_name}`} className={`border-l-4 pl-4 py-2 ${comment.action === 'APPROVED' ? 'border-green-500' : comment.action === 'REWORK' ? 'border-yellow-500' : 'border-red-500'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-900">{comment.actor_name}</p>
                        <p className="text-sm text-slate-600">{format(new Date(comment.timestamp), 'MMM dd, yyyy h:mm a')}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-bold uppercase ${comment.action === 'APPROVED' ? 'bg-green-100 text-green-800' : comment.action === 'REWORK' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {comment.action}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-700">{comment.comment || description}</p>
                    {/* Display shoot date and delivery date based on action type */}
                    {comment.action === 'SET_SHOOT_DATE' && (
                      <div className="mt-2 text-sm text-slate-600 font-bold">
                        📅 Shoot Date: <span className="text-green-600">{comment.comment || selectedProject?.shoot_date}</span>
                      </div>
                    )}
                    {comment.action === 'SET_DELIVERY_DATE' && (
                      <div className="mt-2 text-sm text-slate-600 font-bold">
                        📅 Delivery Date: <span className="text-blue-600">{comment.comment || selectedProject?.delivery_date}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 italic font-medium">Comments and feedback will appear here as they are added</p>
              <p className="text-sm text-gray-400 mt-1">No comments or feedback recorded yet</p>
            </div>
          )}
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

      {/* Main Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
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
          Script ({allScriptProjects.length})
        </button>
      </div>

      {/* Role-based filter for Script tab */}
      {activeTab === 'SCRIPT' && (
        <div className="flex flex-wrap gap-2 py-4 border-b border-gray-200">
          <span className="text-sm font-bold text-slate-700 uppercase mr-2 pt-2">Filter by role:</span>
          {[
            { key: 'ALL', label: 'All', color: 'bg-gray-500' },
            { key: 'WRITER', label: 'Writer', color: 'bg-blue-500' },
            { key: 'CMO', label: 'CMO', color: 'bg-orange-500' },
            { key: 'CEO', label: 'CEO', color: 'bg-red-600' },
            { key: 'CINE', label: 'Cine', color: 'bg-yellow-500' },
            { key: 'EDITOR', label: 'Editor', color: 'bg-purple-500' },
            { key: 'DESIGNER', label: 'Designer', color: 'bg-pink-500' },
            { key: 'OPS', label: 'Ops', color: 'bg-green-600' },
            { key: 'POSTED', label: 'Posted', color: 'bg-emerald-500' }
          ].map(filter => (
            <button
              key={filter.key}
              onClick={() => setScriptFilter(filter.key as any)}
              className={`px-3 py-1 text-xs font-black uppercase border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${scriptFilter === filter.key
                ? `${filter.color} text-white`
                : 'bg-white text-slate-900 hover:bg-slate-100'
                }`}
            >
              {filter.label} ({
                filter.key === 'ALL' ? allScriptProjects.length :
                  allScriptProjects.filter(p => {
                    switch (filter.key) {
                      case 'WRITER':
                        return p.assigned_to_role === Role.WRITER ||
                          p.current_stage === WorkflowStage.SCRIPT ||
                          p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1 ||
                          p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2 ||
                          p.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL;
                      case 'CMO':
                        return p.assigned_to_role === Role.CMO ||
                          p.current_stage === WorkflowStage.FINAL_REVIEW_CMO ||
                          p.current_stage === WorkflowStage.SCRIPT_REVIEW_L1;
                      case 'CEO':
                        return p.assigned_to_role === Role.CEO ||
                          p.current_stage === WorkflowStage.FINAL_REVIEW_CEO ||
                          p.current_stage === WorkflowStage.SCRIPT_REVIEW_L2;
                      case 'CINE':
                        return p.assigned_to_role === Role.CINE ||
                          p.current_stage === WorkflowStage.CINEMATOGRAPHY;
                      case 'EDITOR':
                        return p.assigned_to_role === Role.EDITOR ||
                          p.current_stage === WorkflowStage.VIDEO_EDITING ||
                          p.current_stage === WorkflowStage.SUB_EDITOR_ASSIGNMENT ||
                          p.current_stage === WorkflowStage.SUB_EDITOR_PROCESSING;
                      case 'DESIGNER':
                        return p.assigned_to_role === Role.DESIGNER ||
                          p.current_stage === WorkflowStage.THUMBNAIL_DESIGN ||
                          p.current_stage === WorkflowStage.CREATIVE_DESIGN;
                      case 'OPS':
                        return p.assigned_to_role === Role.OPS ||
                          p.current_stage === WorkflowStage.OPS_SCHEDULING;
                      case 'POSTED':
                        return p.current_stage === WorkflowStage.POSTED ||
                          (p.status === 'DONE' && p.data?.live_url && p.data.live_url.trim() !== '');
                      default:
                        return true;
                    }
                  }).length
              })
            </button>
          ))}
        </div>
      )}

      {/* Projects list */}
      <div className="space-y-6">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading projects...</div>
        ) : projectsToShow.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No {activeTab.toLowerCase()} projects found
            {activeTab === 'SCRIPT' && scriptFilter !== 'ALL' && ` for ${scriptFilter.toLowerCase()} role`}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projectsToShow.map((project) => (
              <div
                key={project.id}
                onClick={() => handleViewDetails(project)}
                className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col cursor-pointer hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
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
                        project.channel === 'INSTAGRAM' ? 'bg-[#D946EF] text-white' :
                          project.channel === 'JOBBOARD' ? 'bg-[#00A36C] text-white' :
                            project.channel === 'LEAD_MAGNET' ? 'bg-[#6366F1] text-white' :
                              'bg-black text-white'
                      }`}>
                      {project.channel} | {project.content_type ? project.content_type.replace(/_/g, ' ') : (project.data?.source === 'IDEA_PROJECT' ? 'Idea' : 'Script')}
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
                    {/* Show POSTED status only for script projects */}
                    {activeTab !== 'IDEA' && project.status === 'DONE' && (
                      <span
                        className="px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black bg-green-500 text-white"
                      >
                        POSTED
                      </span>
                    )}
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
                        handleViewDetails({
                          ...project,
                          data: {
                            ...project.data,
                            script_content: undefined // Force idea view
                          }
                        });
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
                        handleViewDetails(project);
                      }}
                    >
                      View Script
                    </button>
                  )}

                  {!project.data?.idea_description && !project.data?.script_content && (
                    <button
                      className="flex-1 bg-gray-600 text-white py-2 px-4 font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-700 hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                      onClick={() => {
                        handleViewDetails(project);
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