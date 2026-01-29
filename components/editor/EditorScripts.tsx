import React, { useState, useEffect } from 'react';
import { Project, Role, WorkflowStage, STAGE_LABELS, TaskStatus } from '../../types';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Video, FileText, Calendar as CalendarIcon, Upload, Film, MessageSquare } from 'lucide-react';
import { decodeHtmlEntities } from '../../utils/htmlDecoder';
import { getWorkflowStateForRole, canUserEdit, getLatestReworkRejectComment } from '../../services/workflowUtils';

interface Props {
  project: Project;
  userRole: Role;
  onBack: () => void;
}

const EditorScripts: React.FC<Props> = ({ project: initialProject, userRole, onBack }) => {
  const processedProject = { ...initialProject };
  const [localProject, setLocalProject] = useState<Project>(processedProject);
  const [comments, setComments] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({});

  // Use the new workflow state logic with role context
  const workflowState = getWorkflowStateForRole(localProject, userRole);
  const isRework = workflowState.isTargetedRework || workflowState.isRework;
  const isRejected = workflowState.isRejected;

  // Determine if current user can edit based on role and workflow state
  const canEdit = canUserEdit(userRole, workflowState, localProject.assigned_to_role, localProject.current_stage);

  const [editedVideoLink, setEditedVideoLink] = useState(processedProject.edited_video_link || '');

  // Fetch comments and user details
  useEffect(() => {
    const fetchComments = async () => {
      try {
        // Fetch workflow history for this project
        const { data: commentsData, error } = await supabase
          .from('workflow_history')
          .select('*')
          .eq('project_id', localProject.id)
          .order('timestamp', { ascending: false });

        if (error) {
          console.error('Error fetching comments:', error);
          return;
        }

        // Filter comments based on the same logic as CMO Overview
        const filteredComments = commentsData?.filter(item => {
          // Include APPROVED actions for specific stages
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

          // Include all OPS_SCHEDULING actions
          if (item.stage === 'OPS_SCHEDULING') {
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
        }) || [];

        // Filter out 'CREATED' actions and remove duplicates
        const filteredCommentsWithoutCreated = filteredComments.filter(comment => comment.action !== 'CREATED');

        // Track if we've already added certain repeated events
        let multiWriterSubmittedAdded = false;
        let deliveryDateSetAdded = false;
        let shootDateSetAdded = false;

        // Create a map to track unique events by their meaningful content
        const uniqueEventsMap = new Map();

        filteredCommentsWithoutCreated.forEach(comment => {
          let uniqueKey;

          // Create a key based on the type of action and its content
          if (comment.action === 'SET_SHOOT_DATE') {
            if (shootDateSetAdded) {
              return; // Skip duplicate shoot date events
            }
            shootDateSetAdded = true;
            uniqueKey = 'SHOOT_DATE_SET';
          } else if (comment.action === 'SET_DELIVERY_DATE') {
            if (deliveryDateSetAdded) {
              return; // Skip duplicate delivery date events
            }
            deliveryDateSetAdded = true;
            uniqueKey = 'DELIVERY_DATE_SET';
          } else if (comment.action === 'SUBMITTED' && comment.comment) {
            if (comment.stage === 'MULTI_WRITER_APPROVAL') {
              // For MULTI_WRITER_APPROVAL SUBMITTED, check if it's the "All writers have approved" message
              if (comment.comment.includes('All writers have approved')) {
                if (multiWriterSubmittedAdded) {
                  return; // Skip duplicate "All writers have approved" events
                }
                multiWriterSubmittedAdded = true;
                uniqueKey = 'MULTI_WRITER_APPROVAL_SUBMITTED_ALL_WRITERS'; // Fixed key for this specific event
              } else {
                // For other MULTI_WRITER_APPROVAL submissions, use actor-specific key
                uniqueKey = `${comment.action}-${comment.stage}-${comment.actor_id || comment.actor_name}-${comment.timestamp}-${comment.comment || ''}`;
              }
            } else if (comment.comment.includes('Project assigned to sub-editor')) {
              uniqueKey = 'PROJECT_ASSIGNED_TO_SUBEDITOR';
            } else if (comment.comment.includes('Raw video uploaded')) {
              uniqueKey = 'RAW_VIDEO_UPLOADED';
            } else if (comment.comment.includes('Edited video uploaded')) {
              uniqueKey = 'EDITED_VIDEO_UPLOADED';
            } else if (comment.comment.includes('Assets uploaded')) {
              uniqueKey = 'ASSETS_UPLOADED';
            } else {
              // For other submitted actions, use action + stage + partial comment
              uniqueKey = `${comment.action}-${comment.stage}-${comment.comment.substring(0, 30)}`;
            }
          } else if (comment.action === 'APPROVED' && comment.comment) {
            if (comment.stage === 'MULTI_WRITER_APPROVAL') {
              // For MULTI_WRITER_APPROVAL, each approval should be unique (each writer approval)
              // Include the comment content to differentiate between similar events
              uniqueKey = `${comment.action}-${comment.stage}-${comment.actor_id || comment.actor_name}-${comment.timestamp}-${comment.comment || ''}`;
            } else if (comment.comment.includes('Project assigned to sub-editor')) {
              uniqueKey = 'PROJECT_ASSIGNED_TO_SUBEDITOR';
            } else {
              uniqueKey = `${comment.action}-${comment.stage}-${comment.comment.substring(0, 30)}`;
            }
          } else if (comment.action === 'SUB_EDITOR_ASSIGNED') {
            uniqueKey = 'SUB_EDITOR_ASSIGNED';
          } else if (comment.action === 'REWORK_VIDEO_SUBMITTED') {
            uniqueKey = 'REWORK_VIDEO_SUBMITTED';
          } else {
            // For other actions, combine action, stage, and a portion of comment if available
            uniqueKey = `${comment.action}-${comment.stage}-${comment.comment ? comment.comment.substring(0, 30) : ''}`;
          }

          // Only add the first occurrence of each unique event (latest due to reverse chronological order)
          if (!uniqueEventsMap.has(uniqueKey)) {
            uniqueEventsMap.set(uniqueKey, comment);
          }
        });

        // Convert map values back to array and sort by timestamp (most recent first)
        const uniqueComments = Array.from(uniqueEventsMap.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setComments(uniqueComments);

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
            const commentsWithNames = uniqueComments.map(comment => {
              if (comment.actor_id && userMapTemp[comment.actor_id]) {
                return {
                  ...comment,
                  actor_name: userMapTemp[comment.actor_id].full_name || userMapTemp[comment.actor_id].email || comment.actor_name
                };
              }
              return comment;
            });

            setComments(commentsWithNames);
          }
        }
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    };

    fetchComments();
  }, [localProject.id]);

  // Helper function to format dates in DD-MM-YYYY format
  const formatDateDDMMYYYY = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleSaveEditedVideo = async () => {
    if (!editedVideoLink) {
      alert('Please enter an edited video link');
      return;
    }

    try {
      // Get user session
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        alert('User not authenticated');
        return;
      }

      // Update the project with the edited video link
      await db.projects.update(localProject.id, {
        edited_video_link: editedVideoLink
      });

      // Update local state
      setLocalProject(prev => ({
        ...prev,
        edited_video_link: editedVideoLink
      }));

      alert('Edited video link updated successfully!');
    } catch (error) {
      console.error('Failed to update edited video link:', error);
      alert('Failed to update edited video link. Please try again.');
    }
  };

  // Determine if the project is a video project
  const isVideo = localProject.channel !== 'LINKEDIN';

  // Determine which sections to show based on user role
  const showCinematographySection = userRole === Role.CINE;
  const showEditedVideoSection = [Role.EDITOR, Role.SUB_EDITOR].includes(userRole as Role);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b-2 border-black sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 border-2 border-black hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black uppercase text-slate-900">{localProject.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${localProject.channel === 'YOUTUBE'
                  ? 'bg-[#FF4F4F] text-white'
                  : localProject.channel === 'LINKEDIN'
                    ? 'bg-[#0085FF] text-white'
                    : 'bg-[#D946EF] text-white'
                  }`}
              >
                {localProject.channel}
              </span>
              <span className="text-sm text-slate-500 font-bold">
                Due: {format(new Date(localProject.due_date), 'MMM dd, yyyy h:mm a')}
              </span>
              <span
                className={`px-2 py-1 text-[10px] font-black uppercase border-2 border-black ${localProject.priority === 'HIGH'
                  ? 'bg-red-500 text-white'
                  : localProject.priority === 'NORMAL'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-green-500 text-white'
                  }`}
              >
                {localProject.priority}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Project Card Section - Shows writer name, submitted date, and current stage */}
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Writer</h3>
              <p className="font-medium bg-slate-50 p-2">{localProject.writer_name || '—'}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Submitted</h3>
              <p className="font-medium bg-slate-50 p-2">{format(new Date(localProject.created_at), 'MMM dd, yyyy h:mm a')}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Current Stage</h3>
              <p className="font-medium bg-slate-50 p-2">{localProject.current_stage ? localProject.current_stage.replace(/_/g, ' ') : 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Project Details Section */}
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Title</h3>
              <p className="font-medium bg-slate-50 p-2">{localProject.title}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Channel</h3>
              <p className="font-medium bg-slate-50 p-2">{localProject.channel}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Status</h3>
              <span className={`inline-block px-2 py-1 text-xs font-black uppercase border-2 border-black ${localProject.status === 'DONE'
                ? 'bg-green-500 text-white'
                : localProject.status === 'WAITING_APPROVAL'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-blue-500 text-white'
                }`}>
                {localProject.status}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Assigned To</h3>
              <p className="font-medium bg-slate-50 p-2">{localProject.assigned_to_role || 'Unassigned'}</p>
            </div>

            {/* Conditionally show delivery date only for video editing stage */}
            {localProject.current_stage === WorkflowStage.VIDEO_EDITING && localProject.delivery_date && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Delivery Date</h3>
                <p className="font-medium bg-slate-50 p-2">{formatDateDDMMYYYY(localProject.delivery_date)}</p>
              </div>
            )}

            {/* Conditionally show shoot date for cinematography stage */}
            {localProject.current_stage === WorkflowStage.CINEMATOGRAPHY && localProject.shoot_date && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-1">Shoot Date</h3>
                <p className="font-medium bg-slate-50 p-2">{formatDateDDMMYYYY(localProject.shoot_date)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Script Content Section */}
        {(localProject.data?.script_content || localProject.data?.idea_description) && (
          <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
            <h3 className="text-lg font-black uppercase mb-4">
              {localProject.data?.source === 'IDEA_PROJECT' ? 'Idea Description' : 'Script Content'}
            </h3>
            <div className="max-h-60 overflow-y-auto border-2 border-gray-200 p-4 bg-gray-50">
              {localProject.data?.script_content
                ? <div className="font-sans text-sm" dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(localProject.data.script_content) }} />
                : localProject.data?.idea_description
                  ? <div className="font-sans text-sm" dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(localProject.data.idea_description) }} />
                  : <div className="text-slate-400 italic">No content available</div>}
            </div>
          </div>
        )}

        {/* Cinematography Instructions and Raw Video Section - Only for CINE role */}
        {showCinematographySection && (
          <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Video className="w-5 h-5" />
              <h2 className="text-xl font-black uppercase">Cinematography Instructions</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase mb-2 block">Cinematography Instructions</label>
                <textarea
                  value={localProject.data?.cinematography_instructions || ''}
                  className="w-full p-2 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none min-h-[100px]"
                  placeholder="Enter cinematography instructions"
                  readOnly
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-500 uppercase mb-2 block">Raw Video Link</label>
                <input
                  type="text"
                  value={localProject.video_link || ''}
                  className="w-full p-2 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
                  placeholder="Paste Google Drive link for raw video"
                  readOnly
                />
              </div>
            </div>
          </div>
        )}

        {/* Edited Video Section - Only for EDITOR/SUB-EDITOR when project is in VIDEO_EDITING stage */}
        {showEditedVideoSection && isVideo && localProject.current_stage === WorkflowStage.VIDEO_EDITING && (
          <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Video className="w-5 h-5" />
              <h2 className="text-xl font-black uppercase">Edited Video</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase mb-2 block">Edited Video Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editedVideoLink}
                    onChange={(e) => setEditedVideoLink(e.target.value)}
                    className="flex-1 p-2 border-2 border-black font-medium focus:bg-yellow-50 focus:outline-none"
                    placeholder="Paste Google Drive link for edited video"
                    readOnly={!canEdit}
                  />
                  {canEdit && (
                    <button
                      onClick={handleSaveEditedVideo}
                      className="px-4 py-2 bg-[#4ADE80] border-2 border-black text-black font-black uppercase hover:translate-y-[1px] transition-all"
                    >
                      Save
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Upload the edited video link here</p>
              </div>

              {localProject.video_link && (
                <div className="pt-4 border-t-2 border-gray-200">
                  <h3 className="text-md font-bold text-slate-700 mb-2">Raw Video Reference</h3>
                  <div className="bg-blue-50 border-2 border-blue-200 p-3">
                    <p className="text-sm font-bold text-blue-800 mb-1">Raw Video Link:</p>
                    <a
                      href={localProject.video_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all font-medium"
                    >
                      {localProject.video_link}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comments and Feedback Section - Same as CMO Project Details */}
        <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-xl font-black uppercase mb-6 border-b-2 border-black pb-3 text-slate-900">
            Project Comments & Feedback
          </h3>

          {/* Display current project dates and script reference link if they exist */}
          {(localProject?.shoot_date || localProject?.delivery_date || localProject?.post_scheduled_date || localProject?.data?.script_reference_link) && (
            <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {localProject?.shoot_date && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">📅 Shoot Date:</span>
                    <span className="font-bold text-green-600">{formatDateDDMMYYYY(localProject.shoot_date)}</span>
                  </div>
                )}
                {localProject?.delivery_date && localProject.current_stage === WorkflowStage.VIDEO_EDITING && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">📦 Delivery Date:</span>
                    <span className="font-bold text-blue-600">{formatDateDDMMYYYY(localProject.delivery_date)}</span>
                  </div>
                )}
                {localProject?.post_scheduled_date && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">🗓️ Post Date:</span>
                    <span className="font-bold text-purple-600">{formatDateDDMMYYYY(localProject.post_scheduled_date)}</span>
                  </div>
                )}
                {localProject?.data?.script_reference_link && (
                  <div className="flex items-center">
                    <span className="mr-2 font-bold text-slate-700">🔗 Script Link:</span>
                    <a href={localProject.data.script_reference_link} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 underline">
                      View Script
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Display forwarded comments from CMO and CEO */}
          {localProject?.forwarded_comments && localProject.forwarded_comments.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-black uppercase mb-3 text-slate-700 border-l-4 border-blue-500 pl-3">
                Forwarded Comments from CMO/CEO
              </h4>
              <div className="space-y-3 ml-2">
                {localProject.forwarded_comments
                  .filter(comment => ['CMO', 'CEO'].includes(comment.from_role))
                  .map((comment, index) => {
                    const timestamp = new Date(comment.created_at).toLocaleString();

                    return (
                      <div key={`forwarded-${comment.id || index}`} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center mb-1">
                          <span className="font-bold text-blue-800">{comment.from_role} Comment</span>
                          <span className="mx-2 text-slate-400">•</span>
                          <span className="text-sm text-slate-500">{timestamp}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-black uppercase border-2 border-black bg-blue-500 text-white">
                            {comment.action}
                          </span>
                          <span className="font-medium text-slate-800">{comment.comment}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

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
                        📅 Shoot Date: <span className="text-green-600">{comment.comment}</span>
                      </div>
                    )}
                    {comment.action === 'SET_DELIVERY_DATE' && (
                      <div className="mt-2 text-sm text-slate-600 font-bold">
                        📦 Delivery Date: <span className="text-blue-600">{comment.comment}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 italic">No comments yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorScripts;