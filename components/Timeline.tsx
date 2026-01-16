import React from 'react';
import { Project, WorkflowStage, HistoryEvent, Role } from '../types';
import { format } from 'date-fns';

interface TimelineProps {
  project: Project;
  users: any[]; // Pass users to get writer names for multi-writer approval
  forRole?: Role; // Optional role to customize display for specific roles
}

const Timeline: React.FC<TimelineProps> = ({ project, users, forRole }) => {
  // Define the logical workflow order to ensure proper display sequence
  const workflowOrder = [
    WorkflowStage.SCRIPT,           // Writer submission
    WorkflowStage.SCRIPT_REVIEW_L1, // CMO review
    WorkflowStage.SCRIPT_REVIEW_L2, // CEO review
    WorkflowStage.CINEMATOGRAPHY,   // Cine shoot/upload
    WorkflowStage.VIDEO_EDITING,    // Editor work
    WorkflowStage.SUB_EDITOR_ASSIGNMENT, // Editor assigns to sub-editor
    WorkflowStage.SUB_EDITOR_PROCESSING, // Sub-editor work
    WorkflowStage.THUMBNAIL_DESIGN, // Designer work
    WorkflowStage.MULTI_WRITER_APPROVAL, // Multi-writer approval
    WorkflowStage.FINAL_REVIEW_CMO, // Final CMO review
    WorkflowStage.FINAL_REVIEW_CEO, // Final CEO review
    WorkflowStage.OPS_SCHEDULING,   // Ops scheduling
    WorkflowStage.POSTED            // Project posted
  ];
  
  // Check if history exists and is an array
  const projectHistory = project.history || [];
  
  // Deduplicate history events using: stage + action + actor_id + timestamp
  const deduplicatedHistory = projectHistory.reduce((acc, event) => {
    const eventKey = `${event.stage}-${event.action}-${event.actor_id}-${event.timestamp}`;
    if (!acc.keys.has(eventKey)) {
      acc.keys.add(eventKey);
      acc.events.push(event);
    }
    return acc;
  }, { keys: new Set(), events: [] }).events;
  
  // Sort history by logical workflow order, then by timestamp for actions in the same stage
  const sortedHistory = [...deduplicatedHistory].sort((a, b) => {
    // First, sort by workflow stage order
    const stageIndexA = workflowOrder.indexOf(a.stage);
    const stageIndexB = workflowOrder.indexOf(b.stage);
      
    if (stageIndexA !== stageIndexB) {
      // If stage indices are different, sort by workflow order
      return stageIndexA - stageIndexB;
    }
      
    // If stages are the same, sort chronologically (oldest first)
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  // Get all writers for multi-writer approval visualization
  const allWriters = users.filter(user => user.role === Role.WRITER);
  
  // Get approved writers from history
  const approvedWriters = new Set(
    projectHistory
      .filter(event => 
        event.stage === WorkflowStage.MULTI_WRITER_APPROVAL && 
        event.action === 'APPROVED'
      )
      .map(event => event.actor_id)
  );

  // Get pending writers
  const pendingWriters = allWriters.filter(writer => !approvedWriters.has(writer.id));

  // Don't render timeline for OPS role
  if (forRole === Role.OPS) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-black text-slate-900 uppercase">Project Timeline</h3>
      
      <div className="space-y-6">
        {sortedHistory.length > 0 ? sortedHistory.map((event, index) => {
          // Format the timestamp
          const formattedTime = format(new Date(event.timestamp), 'dd MMM yyyy • hh:mm a');
          
          // Determine the label based on stage and action
          let label = '';
          let roleLabel = '';
          
          switch (event.stage) {
            case WorkflowStage.SCRIPT:
              if (event.action === 'CREATED') {
                
                // ❌ Never show System row (for any role)
                if (event.actor_name === 'System') return null;
                
                // ✅ Writer-created row only
                label = `Writer submitted script`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.SCRIPT_REVIEW_L1:
              if (event.action === 'APPROVED') {
                label = `CMO approved (script review)`;
                roleLabel = event.actor_name;
              } else if (event.action === 'REWORK') {
                label = `CMO rework (script review)`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.SCRIPT_REVIEW_L2:
              if (event.action === 'APPROVED') {
                label = `CEO approved (script review)`;
                roleLabel = event.actor_name;
              } else if (event.action === 'REWORK') {
                label = `CEO rework (script review)`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.CINEMATOGRAPHY:
              if (event.action === 'CREATED' || event.action === 'SUBMITTED') {
                label = `Cinematographer set the date`;
                // Get the date from project data if available
                const shootDate = project.data?.shoot_date || project.shoot_date;
                if (shootDate) {
                  roleLabel = format(new Date(shootDate), 'dd MMM yyyy');
                } else {
                  roleLabel = event.actor_name;
                }
              } else if (event.action === 'UPLOAD' || event.action === 'DIRECT_UPLOAD') {
                label = `Cinematographer uploaded the video`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.VIDEO_EDITING:
              if (event.action === 'SET_DELIVERY_DATE') {
                label = `Editor set the delivery date`;
                // Get the delivery date from project data if available
                const deliveryDate = project.data?.delivery_date || project.delivery_date;
                if (deliveryDate) {
                  roleLabel = format(new Date(deliveryDate), 'dd MMM yyyy');
                } else {
                  roleLabel = event.actor_name;
                }
              } else if (event.action === 'UPLOAD_VIDEO') {
                // Determine if this was editor or sub-editor based on the history
                // Look for assignment to sub-editor that happened before this upload
                const assignmentEvent = projectHistory.find(h => 
                  h.stage === WorkflowStage.SUB_EDITOR_ASSIGNMENT && 
                  h.action === 'SUBMITTED' &&
                  new Date(h.timestamp) <= new Date(event.timestamp)
                );
                
                // If there was an assignment to sub-editor before this upload, it's a sub-editor upload
                const isSubEditorUpload = !!assignmentEvent;
                
                label = isSubEditorUpload ? `Sub-editor uploaded the video` : `Editor uploaded the video`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.SUB_EDITOR_ASSIGNMENT:
              if (event.action === 'SUBMITTED') {
                label = `Editor assigned the project to Sub-Editor`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.SUB_EDITOR_PROCESSING:
              if (event.action === 'SET_DELIVERY_DATE') {
                label = `Sub-editor set the delivery date`;
                // Get the delivery date from project data if available
                const deliveryDate = project.data?.delivery_date || project.delivery_date;
                if (deliveryDate) {
                  roleLabel = format(new Date(deliveryDate), 'dd MMM yyyy');
                } else {
                  roleLabel = event.actor_name;
                }
              } else if (event.action === 'REWORK_VIDEO_SUBMITTED' || event.action === 'APPROVED') {
                label = `Sub-editor uploaded the video`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.THUMBNAIL_DESIGN:
              if (event.action === 'APPROVED') {
                label = `Designer uploaded the thumbnail`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.MULTI_WRITER_APPROVAL:
              if (event.action === 'APPROVED') {
                // Get the specific writer name from users
                const writer = users.find(u => u.id === event.actor_id);
                label = `Writer ${writer ? writer.full_name : event.actor_name} approved the video`;
                roleLabel = event.actor_name;
              } else if (event.action === 'SUBMITTED') {
                label = `Writer approval requested`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.FINAL_REVIEW_CMO:
              if (event.action === 'APPROVED') {
                label = `CMO approved (final review)`;
                roleLabel = event.actor_name;
              } else if (event.action === 'REWORK') {
                label = `CMO rework (final review)`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.FINAL_REVIEW_CEO:
              if (event.action === 'APPROVED') {
                label = `CEO approved (final review)`;
                roleLabel = event.actor_name;
              } else if (event.action === 'REWORK') {
                label = `CEO rework (final review)`;
                roleLabel = event.actor_name;
              }
              break;
              
            case WorkflowStage.OPS_SCHEDULING:
              if (event.action === 'APPROVED') {
                label = `OPS scheduled the post date`;
                // Get the scheduled date from project data if available
                const scheduledDate = project.data?.post_scheduled_date || project.post_scheduled_date;
                if (scheduledDate) {
                  roleLabel = format(new Date(scheduledDate), 'dd MMM yyyy');
                } else {
                  roleLabel = event.actor_name;
                }
              }
              break;
              
            case WorkflowStage.POSTED:
              if (event.action === 'PUBLISHED') {
                label = `OPS posted the project`;
                roleLabel = event.actor_name;
              }
              break;
              
            default:
              label = `${event.action} in ${event.stage}`;
              roleLabel = event.actor_name;
          }

          return (
            <div key={`${event.stage}-${event.action}-${index}`} className="flex flex-col border-l-4 border-black pl-4 py-2">
              <div className="font-bold text-slate-900 text-lg">{label} – {roleLabel}</div>
              <div className="text-sm text-slate-500 font-bold">{formattedTime}</div>
            </div>
          );
        }) : (
          <div className="text-slate-500 italic py-2">No timeline history available yet.</div>
        )}
        
        {/* Multi-writer approval visualization - Show for MULTI_WRITER_APPROVAL and POST_WRITER_REVIEW stages */}
        {(project.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL || project.current_stage === WorkflowStage.POST_WRITER_REVIEW) && (
          <div className="pt-4 border-t-4 border-black mt-6">
            <div className="font-bold text-slate-900 text-lg mb-2">Multi-Writer Approval Status:</div>
            
            {/* Show approved writers */}
            <div className="mb-3">
              <div className="font-semibold text-slate-800 mb-1">Approved Writers:</div>
              <div className="flex flex-wrap gap-2">
                {Array.from(approvedWriters).length > 0 ? (
                  Array.from(approvedWriters).map((actorId, idx) => {
                    const writer = allWriters.find(w => w.id === actorId);
                    return writer ? (
                      <span 
                        key={idx} 
                        className="px-3 py-1.5 text-sm font-medium bg-green-100 text-green-800 border-2 border-green-300 rounded-full"
                      >
                        ✓ {writer.full_name}
                      </span>
                    ) : null;
                  })
                ) : (
                  <span className="text-sm text-slate-500 italic">No writers have approved yet</span>
                )}
              </div>
            </div>
            
            {/* Show pending writers */}
            <div>
              <div className="font-semibold text-slate-800 mb-1">Pending Approvals:</div>
              <div className="flex flex-wrap gap-2">
                {pendingWriters.length > 0 ? (
                  pendingWriters.map((writer, idx) => (
                    <span 
                      key={idx} 
                      className="px-3 py-1.5 text-sm font-medium bg-yellow-100 text-yellow-800 border-2 border-yellow-300 rounded-full"
                    >
                      ⏳ {writer.full_name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500 italic">All writers have approved</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Timeline;