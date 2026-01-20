import React, { useState, useEffect } from 'react';
import { Project, Role } from '../../types';
import { db } from '../../services/supabaseDb';

interface TimelineViewProps {
  project: Project;
}

const CmoTimelineView: React.FC<TimelineViewProps> = ({ project }) => {
  const [writerApprovals, setWriterApprovals] = useState<any[]>([]);
  const [allWriters, setAllWriters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Function to format timestamp for display
  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return 'Not completed';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Function to get role label
  const getRoleLabel = (role: Role) => {
    const labels: Record<Role, string> = {
      [Role.ADMIN]: 'Admin',
      [Role.WRITER]: 'Writer',
      [Role.CINE]: 'Cinematographer',
      [Role.EDITOR]: 'Editor',
      [Role.SUB_EDITOR]: 'Sub-Editor',
      [Role.DESIGNER]: 'Designer',
      [Role.CMO]: 'CMO',
      [Role.CEO]: 'CEO',
      [Role.OPS]: 'Operations',
      [Role.OBSERVER]: 'Observer'
    };
    return labels[role];
  };

  useEffect(() => {
    const loadWriterData = async () => {
      setLoading(true);
      
      try {
        // Get all writer approvals for this project
        const projectApprovals = project.history?.filter(
          (historyItem: any) => 
            historyItem.stage === 'MULTI_WRITER_APPROVAL' && 
            historyItem.action === 'APPROVED'
        ) || [];
        
        // Get all users from the system and filter by writer role
        const allUsers = await db.users.getAll();
        const allWritersData = allUsers.filter(user => user.role === Role.WRITER);
        
        setWriterApprovals(projectApprovals);
        setAllWriters(allWritersData);
      } catch (error) {
        console.error('Error loading writer data:', error);
        // Fallback to empty arrays
        setWriterApprovals([]);
        setAllWriters([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadWriterData();
  }, [project]);

  // Build timeline items
  const timelineItems = [];

  // Add writer submission
  if (project.writer_submitted_at) {
    timelineItems.push({
      id: 'writer-submitted',
      label: 'Writer Submitted',
      timestamp: project.writer_submitted_at,
      status: 'completed',
      description: 'Project submitted by writer'
    });
  }

  // Add CMO approval/rework
  if (project.cmo_approved_at) {
    timelineItems.push({
      id: 'cmo-approved',
      label: 'CMO Approved',
      timestamp: project.cmo_approved_at,
      status: 'completed',
      description: 'Project approved by CMO'
    });
  } else if (project.cmo_rework_at) {
    timelineItems.push({
      id: 'cmo-rework',
      label: 'CMO Requested Rework',
      timestamp: project.cmo_rework_at,
      status: 'rework',
      description: 'CMO requested rework on project'
    });
  }

  // Add CEO approval/rework
  if (project.ceo_approved_at) {
    timelineItems.push({
      id: 'ceo-approved',
      label: 'CEO Approved',
      timestamp: project.ceo_approved_at,
      status: 'completed',
      description: 'Project approved by CEO'
    });
  } else if (project.ceo_rework_at) {
    timelineItems.push({
      id: 'ceo-rework',
      label: 'CEO Requested Rework',
      timestamp: project.ceo_rework_at,
      status: 'rework',
      description: 'CEO requested rework on project'
    });
  }

  // Add Cine upload
  if (project.cine_uploaded_at) {
    timelineItems.push({
      id: 'cine-uploaded',
      label: 'Cine Uploaded Video',
      timestamp: project.cine_uploaded_at,
      status: 'completed',
      description: 'Raw video uploaded by cinematographer'
    });
  }

  // Add Editor upload
  if (project.editor_uploaded_at) {
    timelineItems.push({
      id: 'editor-uploaded',
      label: 'Editor Uploaded Video',
      timestamp: project.editor_uploaded_at,
      status: 'completed',
      description: 'Edited video uploaded by editor'
    });
  }

  // Add Sub-Editor upload
  if (project.data?.sub_editor_uploaded_at) {
    timelineItems.push({
      id: 'sub-editor-uploaded',
      label: 'Sub-Editor Uploaded Video',
      timestamp: project.data.sub_editor_uploaded_at,
      status: 'completed',
      description: 'Edited video uploaded by sub-editor'
    });
  }

  // Add Designer upload
  if (project.designer_uploaded_at) {
    timelineItems.push({
      id: 'designer-uploaded',
      label: 'Designer Uploaded Assets',
      timestamp: project.designer_uploaded_at,
      status: 'completed',
      description: 'Assets uploaded by designer'
    });
  }

  // Add multi-writer approval information if the project is in MULTI_WRITER_APPROVAL stage
  if (project.current_stage === 'MULTI_WRITER_APPROVAL') {
    // Identify approved and pending writers
    const approvedWriters = [];
    const pendingWriters = [];
    
    allWriters.forEach((writer: any) => {
      const hasApproved = writerApprovals.some(
        (approval: any) => approval.actor_id === writer.id
      );
      
      if (hasApproved) {
        const approval = writerApprovals.find(
          (approval: any) => approval.actor_id === writer.id
        );
        approvedWriters.push({
          name: writer.full_name,
          timestamp: approval.timestamp,
          comment: approval.comment
        });
      } else {
        pendingWriters.push(writer.full_name);
      }
    });
    
    // Add approved writers to timeline
    approvedWriters.forEach((writer, index) => {
      timelineItems.push({
        id: `writer-approved-${index}`,
        label: `Writer Approved: ${writer.name}`,
        timestamp: writer.timestamp,
        status: 'completed',
        description: `Project approved by writer ${writer.name}`
      });
    });
    
    // Add pending writers info if there are any
    if (pendingWriters.length > 0) {
      timelineItems.push({
        id: 'writers-pending',
        label: 'Writers Pending Approval',
        timestamp: new Date().toISOString(),
        status: 'pending',
        description: `Awaiting approval from: ${pendingWriters.join(', ')}`
      });
    }
  }

  // Sort timeline items by timestamp
  timelineItems.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (loading) {
    return (
      <div className="border-2 border-black p-4 bg-white">
        <h3 className="text-lg font-black uppercase mb-4 border-b-2 border-black pb-2">Project Timeline</h3>
        <p className="text-gray-500 italic">Loading timeline information...</p>
      </div>
    );
  }

  return (
    <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <h3 className="text-xl font-black uppercase mb-6 border-b-2 border-black pb-3 text-slate-900">
        Project Timeline
      </h3>
      
      {timelineItems.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 italic font-medium">No timeline events recorded yet</p>
          <p className="text-sm text-gray-400 mt-1">Workflow events will appear here as they occur</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-2 top-3 bottom-3 w-0.5 bg-gray-200"></div>
          
          <div className="space-y-6 pl-8">
            {timelineItems.map((item, index) => (
              <div key={item.id} className="relative">
                {/* Timeline dot */}
                <div className={`absolute -left-9 w-4 h-4 rounded-full border-4 border-white ${{
                  'completed': 'bg-green-500',
                  'rework': 'bg-red-500',
                  'pending': 'bg-yellow-500'
                }[item.status] || 'bg-gray-300'}`}></div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <h4 className={`font-black text-base ${
                      item.status === 'completed' ? 'text-green-800' :
                      item.status === 'rework' ? 'text-red-800' :
                      item.status === 'pending' ? 'text-yellow-800' :
                      'text-gray-800'
                    }`}>
                      {item.label}
                    </h4>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {item.description}
                  </p>
                  
                  {/* Status badge */}
                  <div className="mt-3 flex items-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                      item.status === 'completed' ? 'bg-green-100 text-green-800' :
                      item.status === 'rework' ? 'bg-red-100 text-red-800' :
                      item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      <span className={`w-2 h-2 rounded-full mr-1.5 ${
                        item.status === 'completed' ? 'bg-green-500' :
                        item.status === 'rework' ? 'bg-red-500' :
                        item.status === 'pending' ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`}></span>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CmoTimelineView;