import React from 'react';
import { Project, HistoryEvent, Role } from '../types';
import { format } from 'date-fns';

interface TimelineProps {
  project: Project;
  users?: any[]; // Keep for compatibility but strictly use event data
  forRole?: Role;
}

const Timeline: React.FC<TimelineProps> = ({ project, forRole }) => {
  // Check if history exists
  const projectHistory = project.history || [];

  // FILTERING: Exclude system events and invalid entries
  const validEvents = projectHistory.filter(event => {
    // Exclude CREATED action
    if (event.action === 'CREATED') return false;

    // Exclude System actor
    if (event.actor_name === 'System') return false;

    // Exclude missing actor info
    if (!event.actor_id || !event.actor_role || !event.actor_name) return false;

    return true;
  });

  // DEDUPLICATION: Remove duplicate events matching all criteria
  const uniqueEventsMap = new Map<string, HistoryEvent>();

  validEvents.forEach(event => {
    // Create unique key based on requirements
    // ${actor_id}_${action}_${stage}_${comment}_${timestamp}
    // ensure timestamp comparison is safe (e.g. to the second if needed, but string equality usually works for exact dupes)
    const key = `${event.actor_id}_${event.action}_${event.stage}_${event.comment || ''}_${event.timestamp}`;

    if (!uniqueEventsMap.has(key)) {
      uniqueEventsMap.set(key, event);
    }
  });

  // Convert to array and SORT by timestamp DESC (Latest first)
  const sortedHistory = Array.from(uniqueEventsMap.values()).sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Don't render timeline for OPS role if requested (preserving existing logic)
  if (forRole === Role.OPS) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-black text-slate-900 uppercase">Project Timeline</h3>

      <div className="space-y-6">
        {sortedHistory.length > 0 ? (
          sortedHistory.map((event, index) => {
            const formattedTime = format(new Date(event.timestamp), 'dd MMM yyyy • hh:mm a');

            // Format: ACTION by Role – Comment
            // e.g. APPROVED by Writer – Script approved
            // Clean up role display if needed (e.g. 'WRITER' -> 'Writer')
            const displayRole = event.actor_role
              ? event.actor_role.charAt(0) + event.actor_role.slice(1).toLowerCase().replace('_', ' ')
              : 'Unknown Role';

            // Determine border color based on action type
            let borderColor = 'border-black';
            if (event.action === 'APPROVED') borderColor = 'border-green-500';
            else if (event.action === 'REWORK') borderColor = 'border-yellow-500';
            else if (event.action === 'REJECTED') borderColor = 'border-red-500';

            return (
              <div key={`${index}-${event.timestamp}`} className={`flex flex-col border-l-4 ${borderColor} pl-4 py-2`}>
                <div className="font-bold text-slate-900 text-lg">
                  <span className="uppercase">{event.action}</span> by <span className="capitalize">{displayRole}</span>
                  {event.comment && <span className="font-normal text-slate-700"> – {event.comment}</span>}
                </div>
                <div className="text-sm text-slate-500 font-bold">{formattedTime}</div>
              </div>
            );
          })
        ) : (
          <div className="text-slate-500 italic py-2">No timeline history available yet.</div>
        )}
      </div>
    </div>
  );
};

export default Timeline;
