import { Project, Role } from '../types';

export interface WorkflowState {
  isRejected: boolean;
  isRework: boolean;
  isInReview: boolean;
  isApproved: boolean;
  latestAction: string | null;
}

/**
 * Get the latest workflow action from project history
 */
export function getLatestAction(project: Project | undefined): string | null {
  if (!project || !project.history || project.history.length === 0) {
    return null;
  }
  
  // Sort by timestamp to get the most recent action
  const sortedHistory = [...project.history].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  return sortedHistory[0]?.action || null;
}

/**
 * Determine workflow state based on the latest action
 */
export function getWorkflowState(project: Project | undefined): WorkflowState {
  const latestAction = getLatestAction(project);

  const isRejected = latestAction === "REJECTED";
  
  // A project is in rework state if there was a "REWORK" action in history
  // and the project is still in the rework workflow (not yet fully approved)
  const hasReworkAction = project?.history?.some(h => h.action === 'REWORK') || false;
  // The project is considered in rework if:
  // 1. There was a REWORK action in history
  // 2. The latest action is not an approval (meaning the rework cycle is not complete)
  const isRework = hasReworkAction && latestAction !== 'APPROVED';
  
  const isInReview = 
    latestAction === "SUBMITTED" || 
    latestAction?.includes("REWORK_");
  const isApproved = latestAction === "APPROVED";

  return {
    isRejected,
    isRework,
    isInReview,
    isApproved,
    latestAction
  };
}

/**
 * Determine if user can edit based on role and workflow state
 */
export function canUserEdit(role: string, workflowState: WorkflowState, assignedRole?: string): boolean {
  const { isRework, isRejected, isApproved, isInReview, latestAction } = workflowState;

  // For rework scenarios, implement hierarchical access based on the assigned role
  if (!isRework) {
    // If not in rework state, only the assigned role can edit
    return role === assignedRole;
  }

  // When in rework state, implement the hierarchical access rules:
  // - If assigned to CINE: CINE, EDITOR, and DESIGNER can edit
  // - If assigned to EDITOR: EDITOR and DESIGNER can edit
  // - If assigned to DESIGNER: only DESIGNER can edit
  if (assignedRole === Role.CINE) {
    return role === Role.CINE || role === Role.EDITOR || role === Role.DESIGNER;
  } else if (assignedRole === Role.EDITOR) {
    return role === Role.EDITOR || role === Role.DESIGNER;
  } else if (assignedRole === Role.DESIGNER) {
    return role === Role.DESIGNER;
  }

  // For other roles (CMO, CEO, ADMIN), they can always edit
  return role === Role.CMO || role === Role.CEO || role === Role.ADMIN;
}

/**
 * Get the most recent rework/reject comment from project history
 */
export function getLatestReworkRejectComment(project: Project | undefined): { comment: string | null; actor_name: string | null } | null {
  if (!project || !project.history || project.history.length === 0) {
    return null;
  }
  
  // Sort by timestamp to get the most recent action
  const sortedHistory = [...project.history].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  // Find the most recent REWORK or REJECTED action
  const reworkRejectAction = sortedHistory.find(h => 
    h.action === 'REWORK' || h.action === 'REJECTED'
  );
  
  if (reworkRejectAction) {
    return {
      comment: reworkRejectAction.comment || null,
      actor_name: reworkRejectAction.actor_name || null
    };
  }
  
  return null;
}