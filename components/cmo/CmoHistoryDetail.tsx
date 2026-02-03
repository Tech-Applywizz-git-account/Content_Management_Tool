import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, Role } from '../../types';
import { format } from 'date-fns';
import { db } from '../../services/supabaseDb';
import { supabase } from '../../src/integrations/supabase/client';

interface HistoryEntry {
  action: 'APPROVED' | 'REJECTED';
  timestamp: string;
  actor_name: string;
  actor_id: string;
  comment?: string;
}

interface Props {
  project?: Project;
  history?: HistoryEntry;
  onBack?: () => void;
  onEdit?: () => void; // Optional edit callback
  currentUser?: { id: string; role: Role }; // Current user info
  activeTab?: string; // Active tab identifier (e.g., 'WRITERS')
}

const CmoHistoryDetail: React.FC<Props> = ({ project, history, onBack, onEdit, currentUser, activeTab }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [projectData, setProjectData] = useState<Project | null>(project || null);
  const [historyData, setHistoryData] = useState<HistoryEntry | null>(history || null);
  const [loading, setLoading] = useState(!project);
  const [error, setError] = useState<string | null>(null);
  const [completeHistory, setCompleteHistory] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (project && history) {
        setLoading(false);
        return;
      }

      if (!projectId) {
        // If no project ID and no props, we can't do anything
        if (!project) {
          setError('No project ID provided');
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('projects')
          .select('*, workflow_history(*)')
          .eq('id', projectId)
          .single();

        if (error) throw error;
        if (!data) {
          setError('Project not found');
          return;
        }

        const projectWithHistory = {
          ...data,
          history: data.workflow_history
        } as Project;

        setProjectData(projectWithHistory);

        // Find the specific history entry for this user (CMO)
        if (data.workflow_history && Array.isArray(data.workflow_history)) {
          // Find the most recent approval or rejection by the current user
          // If currentUser is not provided, we might default to finding ANY improved/rejected action relevant to CMO?
          // For now, let's assume currentUser is passed or we look for CMO actions generally if currentUser is missing
          const userId = currentUser?.id;

          let userHistory = null;
          if (userId) {
            userHistory = data.workflow_history
              .filter((h: any) => h.actor_id === userId && (h.action === 'APPROVED' || h.action === 'REJECTED'))
              .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          } else {
            // Fallback: look for general CMO actions
            userHistory = data.workflow_history
              .filter((h: any) => (h.action === 'APPROVED' || h.action === 'REJECTED')) // Broad filter if no user
              .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          }

          if (userHistory) {
            setHistoryData(userHistory as HistoryEntry);
          }
        }
  
        // Load complete project history for Writers tab
        if (activeTab === 'WRITERS' && data.workflow_history && Array.isArray(data.workflow_history)) {
          // Sort by timestamp (most recent first)
          const sortedHistory = [...data.workflow_history]
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          // Filter to include all relevant workflow stages for comprehensive history
          const commentsData = sortedHistory.filter(item => {
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
          let uniqueComments = (Array.from(uniqueEventsMap.values()) as any[])
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

          setCompleteHistory(uniqueComments);
        }
  
      } catch (err) {
        console.error('Error loading history detail:', err);
        setError('Failed to load project details');
      } finally {
        setLoading(false);
      }
    };
  
    loadData();
  }, [projectId, project, history, currentUser, activeTab]);


  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/cmo/history');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (error || !projectData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="text-2xl font-black text-slate-900 mb-4 uppercase">Error</h1>
          <p className="text-slate-600 mb-6 font-bold">{error || 'Project not found'}</p>
          <button
            onClick={handleBack}
            className="w-full bg-[#D946EF] border-2 border-black px-6 py-3 text-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  const writerName =
    projectData.writer_name ||
    projectData.data?.writer_name ||
    'Unknown Writer';

  // Check if history is null or undefined
  if (!historyData) {
    return (
      <div className="min-h-screen bg-white font-sans flex flex-col">
        <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
          <div className="flex items-center space-x-6">
            <button
              onClick={handleBack}
              className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              History Not Available
            </h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">No History Data</h2>
            <p className="text-slate-600 mb-6">
              History information for this project is not available. This might be because the project hasn't been reviewed yet.
            </p>
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-[#0085FF] text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              ← Back to History
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if current user is the actor who made the decision
  const isActor = currentUser?.id === historyData.actor_id;

  // Check if this is a script project (exclude idea projects)
  const isScriptProject = projectData.data?.source !== 'IDEA_PROJECT' || projectData.data?.script_content;

  // If not a script project, show a message and return early
  if (!isScriptProject) {
    return (
      <div className="min-h-screen bg-white font-sans flex flex-col">
        <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
          <div className="flex items-center space-x-6">
            <button
              onClick={handleBack}
              className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              Project Not Available
            </h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Idea Project</h2>
            <p className="text-slate-600 mb-6">
              This project is an idea and doesn't contain script content. Only script projects are displayed in the history details.
            </p>
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-[#0085FF] text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              ← Back to History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <header className="h-20 border-b-2 border-black flex items-center justify-between px-6 sticky top-0 bg-white z-20 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
        <div className="flex items-center space-x-6">
          <button
            onClick={handleBack}
            className="p-3 border-2 border-transparent hover:border-black hover:bg-slate-100 rounded-full transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              {projectData.data?.source === 'DESIGNER_INITIATED' ? 'Creative Details: ' : 'Script Details: '}
              {projectData.title}
            </h1>

            <div className="flex items-center space-x-2 mt-2">
              {projectData.data?.source === 'DESIGNER_INITIATED' && (
                <span className="px-2 py-0.5 text-xs font-black uppercase border-2 border-black bg-pink-100 text-pink-900">
                  DESIGNER
                </span>
              )}
              <span className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black text-white ${projectData.channel === 'YOUTUBE' ? 'bg-[#FF4F4F]' :
                projectData.channel === 'LINKEDIN' ? 'bg-[#0085FF]' :
                  'bg-[#D946EF]'
                }`}>
                {projectData.channel}
              </span>
              <span className="text-xs font-bold uppercase text-slate-500">
                Reviewed: {format(new Date(historyData.timestamp), 'MMM dd, yyyy')}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black ${projectData.priority === 'HIGH'
                  ? 'bg-red-500 text-white'
                  : projectData.priority === 'NORMAL'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-green-500 text-white'
                  }`}>
                {projectData.priority}
              </span>
            </div>
          </div>
        </div>

        {isActor && onEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-[#0085FF] text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            Edit
          </button>
        )}
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-[1920px] mx-auto w-full">

        {/* LEFT COLUMN: Content (70%) */}
        <div className="flex-1 p-6 md:p-12 space-y-10 overflow-y-auto bg-slate-50">

          {/* Info Block */}
          <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Priority</label>
              <div className={`font-bold uppercase ${projectData.priority === 'HIGH' ? 'text-red-600' : 'text-slate-900'}`}>
                {projectData.priority}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Status</label>
              <div className="font-bold text-slate-900 uppercase">
                {historyData.action}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Type</label>
              <div className="font-bold text-slate-900 uppercase">
                {projectData.data?.source === 'DESIGNER_INITIATED' ? 'Creative' : 'Script'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Channel</label>
              <div className="font-bold text-slate-900 uppercase">
                {projectData.channel}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Content Type</label>
              <div className="font-bold text-slate-900 uppercase">
                {projectData.content_type}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Reviewed</label>
              <div className="font-bold text-slate-900 uppercase">
                {format(new Date(historyData.timestamp), 'MMM dd, yyyy')}
              </div>
            </div>
          </div>

          {/* Content */}
          <section className="space-y-4">
            <h3 className="text-2xl font-black text-slate-900 uppercase">
              {projectData.data?.source === 'DESIGNER_INITIATED' ? 'Creative Link' : 'Script Content'}
            </h3>

            <div className="border-2 border-black bg-white p-8 min-h-[300px] whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {projectData.data?.source === 'DESIGNER_INITIATED'
                ? projectData.data?.creative_link || 'No creative link available.'
                : projectData.data?.script_content
                  ? (() => {
                    // Decode HTML entities to properly display the content
                    let decodedContent = projectData.data.script_content
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&amp;/g, '&')
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'")
                      .replace(/&nbsp;/g, ' ');
                    return <div dangerouslySetInnerHTML={{ __html: decodedContent }} />;
                  })()
                  : 'No script content available.'}
            </div>
          </section>

          {/* Project Comments & Feedback Section - Same as CMO Overview */}
          {activeTab === 'WRITERS' && (
            <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-xl font-black uppercase mb-6 border-b-2 border-black pb-3 text-slate-900">
                Project Comments & Feedback
              </h3>

              {/* Display current project dates and script reference link if they exist */}
              {(projectData?.shoot_date || projectData?.delivery_date || projectData?.post_scheduled_date || projectData?.data?.script_reference_link) && (
                <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {projectData?.shoot_date && (
                      <div className="flex items-center">
                        <span className="mr-2 font-bold text-slate-700">📅 Shoot Date:</span>
                        <span className="font-bold text-green-600">{format(new Date(projectData.shoot_date), 'dd/MM/yyyy')}</span>
                      </div>
                    )}
                    {projectData?.delivery_date && (
                      <div className="flex items-center">
                        <span className="mr-2 font-bold text-slate-700">📦 Delivery Date:</span>
                        <span className="font-bold text-blue-600">{format(new Date(projectData.delivery_date), 'dd/MM/yyyy')}</span>
                      </div>
                    )}
                    {projectData?.post_scheduled_date && (
                      <div className="flex items-center">
                        <span className="mr-2 font-bold text-slate-700">🗓️ Post Date:</span>
                        <span className="font-bold text-purple-600">{format(new Date(projectData.post_scheduled_date), 'dd/MM/yyyy')}</span>
                      </div>
                    )}
                    {projectData?.data?.script_reference_link && (
                      <div className="flex items-center">
                        <span className="mr-2 font-bold text-slate-700">🔗 Script Link:</span>
                        <a href={projectData.data.script_reference_link} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 underline">
                          View Script
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fetch and display comments similar to CMO Project Details */}
              {completeHistory.length > 0 ? (
                <div className="space-y-6 bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {completeHistory.map((comment: any, index: number) => {
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
                            📅 Shoot Date: <span className="text-green-600">{comment.comment || projectData?.shoot_date}</span>
                          </div>
                        )}
                        {comment.action === 'SET_DELIVERY_DATE' && (
                          <div className="mt-2 text-sm text-slate-600 font-bold">
                            📅 Delivery Date: <span className="text-blue-600">{comment.comment || projectData?.delivery_date}</span>
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
          )}

        </div>

        {/* RIGHT COLUMN: Project Status Panel (30%) - Information only */}
        <div className="w-full md:w-[450px] bg-white border-l-2 border-black p-8 shadow-[-10px_0px_20px_rgba(0,0,0,0.05)] sticky bottom-0 md:top-20 md:h-[calc(100vh-80px)] overflow-y-auto z-10">
          <h2 className="text-2xl font-black text-slate-900 uppercase mb-8 border-b-4 border-black pb-2 inline-block">Project Details</h2>

          <div className="space-y-6">
            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Writer</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    {writerName}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Review Status</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    {historyData.action}
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${historyData.action === 'APPROVED'
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
                  }`}>
                  {historyData.action}
                </span>
              </div>
            </div>

            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Reviewed By</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    {historyData.actor_name}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs font-bold text-slate-500 uppercase">
                {format(new Date(historyData.timestamp), 'MMM dd, yyyy h:mm a')}
              </div>
            </div>

            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Project Stage</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    {projectData.current_stage}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Created</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    {format(new Date(projectData.created_at), 'MMM dd, yyyy h:mm a')}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-2 border-black bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg uppercase text-slate-900">Total Reworks</div>
                  <div className="text-xs font-bold uppercase text-slate-600">
                    Lifetime
                  </div>
                </div>
                <span className="px-3 py-1 text-lg font-black uppercase border-2 border-black bg-yellow-100 text-yellow-800">
                  {projectData.history?.filter((h: any) => h.action === 'REWORK').length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CmoHistoryDetail;
