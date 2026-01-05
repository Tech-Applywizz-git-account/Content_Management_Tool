import { Project } from '../types';

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
  const isRework = latestAction === "REWORK";
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
export function canUserEdit(role: string, workflowState: WorkflowState): boolean {
  const { isRework, isRejected, isApproved, isInReview } = workflowState;
  
  const canEditByRole: Record<string, boolean> = {
    WRITER: isRework,
    CINE: isRework,
    EDITOR: isRework,
    DESIGNER: isRework,
    REVIEWER: false, // Assuming no specific reviewer role
    CMO: true,       // CMO can always edit (for reviews)
    CEO: true,       // CEO can always edit (for reviews)
    ADMIN: true,     // Admin can always edit
    OPS: false       // Ops doesn't typically edit content
  };

  return canEditByRole[role] ?? false;
}