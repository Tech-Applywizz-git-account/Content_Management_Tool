import { Project, Role } from '../types';

export interface WorkflowState {
  isRejected: boolean;
  isRework: boolean;
  isTargetedRework: boolean; // True if current user's role was specifically targeted for rework
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

  // For the general workflow state (without role context), we check if there's any unresolved rework
  let isRework = false;

  if (project?.history && project.history.length > 0) {
    // Sort history by timestamp descending to find the most recent actions
    const sortedHistory = [...project.history].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Find the most recent REWORK or REJECTED action
    const reworkAction = sortedHistory.find(h => {
      return h.action === 'REWORK' || h.action === 'REJECTED';
    });

    // Check if there's a later SUBMITTED or APPROVED action after the rework/reject action
    if (reworkAction) {
      const reworkTimestamp = new Date(reworkAction.timestamp).getTime();
      const hasLaterSubmission = sortedHistory.some(h => {
        const isSubmissionAction = ['SUBMITTED', 'APPROVED'].includes(h.action);
        const actionTimestamp = new Date(h.timestamp).getTime();
        return isSubmissionAction && actionTimestamp > reworkTimestamp;
      });

      // Only show rework if there's no later submission/approval
      if (!hasLaterSubmission) {
        isRework = true;
      }
    }
  }

  const isInReview =
    latestAction === "SUBMITTED" ||
    latestAction?.includes("REWORK_");
  const isApproved = latestAction === "APPROVED";

  return {
    isRejected,
    isRework,
    isTargetedRework: false, // Default value, will be calculated separately based on user context
    isInReview,
    isApproved,
    latestAction
  };
}

/**
 * Determine workflow state with role-specific context (for targeted rework detection)
 */
export function getWorkflowStateForRole(project: Project | undefined, userRole: string): WorkflowState {
  const latestAction = getLatestAction(project);

  // Check for targeted rework: REWORK action where to_role matches user's role and stage matches current project stage
  // AND there is no later SUBMITTED or APPROVED action that would resolve the rework
  let isRework = false;
  let isTargetedRework = false;
  let isRejected = false;

  if (project?.history && project.history.length > 0) {
    // Sort history by timestamp descending to find the most recent actions
    const sortedHistory = [...project.history].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Find the most recent REWORK action that targets the current user's role
    const reworkAction = sortedHistory.find(h => {
      return h.action === 'REWORK' &&
        h.to_role === userRole;
    });

    // Find the most recent REJECTED action that targets the current user's role
    const rejectedAction = sortedHistory.find(h => {
      return h.action === 'REJECTED' &&
        h.to_role === userRole;
    });

    // Check if there's a later SUBMITTED or APPROVED action after the rework/reject action
    if (reworkAction) {
      const reworkTimestamp = new Date(reworkAction.timestamp).getTime();
      const hasLaterSubmission = sortedHistory.some(h => {
        const isSubmissionAction = ['SUBMITTED', 'APPROVED'].includes(h.action);
        const actionTimestamp = new Date(h.timestamp).getTime();
        return isSubmissionAction && actionTimestamp > reworkTimestamp;
      });

      // Only show rework if there's no later submission/approval
      if (!hasLaterSubmission) {
        isRework = true;
        isTargetedRework = true;
      }
    }

    if (rejectedAction) {
      const rejectedTimestamp = new Date(rejectedAction.timestamp).getTime();
      const hasLaterSubmission = sortedHistory.some(h => {
        const isSubmissionAction = ['SUBMITTED', 'APPROVED'].includes(h.action);
        const actionTimestamp = new Date(h.timestamp).getTime();
        return isSubmissionAction && actionTimestamp > rejectedTimestamp;
      });

      // Only show rejected if there's no later submission/approval
      if (!hasLaterSubmission) {
        isRejected = true;
        isRework = true; // Rejected projects are also considered in rework state
        isTargetedRework = true;
      }
    }
  }

  const isInReview =
    latestAction === "SUBMITTED" ||
    latestAction?.includes("REWORK_");
  const isApproved = latestAction === "APPROVED";

  return {
    isRejected,
    isRework,
    isTargetedRework,
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
  // - If assigned to SUB_EDITOR: SUB_EDITOR and EDITOR can edit
  // - If assigned to DESIGNER: only DESIGNER can edit
  if (assignedRole === Role.CINE) {
    return role === Role.CINE || role === Role.EDITOR || role === Role.DESIGNER;
  } else if (assignedRole === Role.EDITOR) {
    return role === Role.EDITOR || role === Role.DESIGNER;
  } else if (assignedRole === Role.SUB_EDITOR) {
    return role === Role.SUB_EDITOR || role === Role.EDITOR;
  } else if (assignedRole === Role.DESIGNER) {
    return role === Role.DESIGNER;
  }

  // For other roles (CMO, CEO, ADMIN), they can always edit
  return role === Role.CMO || role === Role.CEO || role === Role.ADMIN;
}

/**
 * Get the most recent rework/reject comment from project history for a specific role
 * Only returns comments where:
 * - action = 'REWORK' or 'REJECTED'
 * - to_role = current_user_role
 * - and no resubmission has happened after the rework request
 */
export function getLatestReworkRejectComment(project: Project | undefined, userRole?: string): { comment: string | null; actor_name: string | null } | null {
  if (!project || !project.history || project.history.length === 0) {
    return null;
  }

  // Sort by timestamp to get the most recent actions
  const sortedHistory = [...project.history].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Find the most recent REWORK or REJECTED action
  const reworkRejectAction = sortedHistory.find(h => {
    const isReworkOrRejected = h.action === 'REWORK' || h.action === 'REJECTED';

    // If no user role is specified, return the first rework/reject action
    if (!userRole) {
      return isReworkOrRejected;
    }

    // If user role is specified, only return actions where to_role matches the user's role 
    // We removed strict stage matching to allow viewing comments when sent back to previous stages
    return isReworkOrRejected && h.to_role === userRole;
  });

  // If we found a rework/reject action, check if there was a resubmission after it
  if (reworkRejectAction) {
    // Find any resubmission action that happened after this rework/reject action
    const reworkRejectTimestamp = new Date(reworkRejectAction.timestamp).getTime();

    // Look for resubmission actions that happened after the rework/reject
    const hasResubmissionAfterRework = sortedHistory.some(h => {
      // Actions that indicate resubmission after rework
      const isResubmissionAction = [
        'SUBMITTED',           // General submission
        'REWORK_VIDEO_SUBMITTED',
        'REWORK_EDIT_SUBMITTED',
        'REWORK_DESIGN_SUBMITTED',
        'DIRECT_UPLOAD'
      ].includes(h.action);

      const actionTimestamp = new Date(h.timestamp).getTime();

      // Check if this resubmission happened after the rework/reject action
      return isResubmissionAction && actionTimestamp > reworkRejectTimestamp;
    });

    // If there was a resubmission after the rework, don't show the old rework comment
    if (hasResubmissionAfterRework) {
      return null;
    }

    return {
      comment: reworkRejectAction.comment || null,
      actor_name: reworkRejectAction.actor_name || null
    };
  }

  // If no targeted rework/reject action found for this user's role, return null
  // This ensures that rejected_reason from the project level is not used
  return null;
}

/**
 * Update role-specific timestamps based on the action
 */
export function getTimestampUpdate(action: string, role: Role): Partial<Record<
  'writer_submitted_at' | 'cmo_approved_at' | 'cmo_rework_at' | 'ceo_approved_at' | 'ceo_rework_at' | 'cine_uploaded_at' | 'editor_uploaded_at' | 'sub_editor_uploaded_at' | 'designer_uploaded_at',
  string
>> {
  const now = new Date().toISOString();

  switch (action) {
    case 'SUBMITTED':
      // For script submissions, consider this as writer submitting
      // For editor uploads, this should also set editor_uploaded_at
      if (role === Role.EDITOR) {
        return { editor_uploaded_at: now };
      }
      return { writer_submitted_at: now };
    case 'APPROVED':
      if (role === Role.CMO) {
        return { cmo_approved_at: now };
      } else if (role === Role.CEO) {
        return { ceo_approved_at: now };
      }
      break;
    case 'REWORK':
    case 'REJECTED':
      if (role === Role.CMO) {
        return { cmo_rework_at: now };
      } else if (role === Role.CEO) {
        return { ceo_rework_at: now };
      }
      break;
    case 'DIRECT_UPLOAD':
      // This could be used when cine/editor/sub-editor/designer uploads assets
      if (role === Role.CINE) {
        return { cine_uploaded_at: now };
      } else if (role === Role.EDITOR) {
        return { editor_uploaded_at: now };
      } else if (role === Role.SUB_EDITOR) {
        return { sub_editor_uploaded_at: now };
      } else if (role === Role.DESIGNER) {
        return { designer_uploaded_at: now };
      }
      break;
    case 'ASSIGNED_TO_SUB_EDITOR':
      // When editor assigns project to sub-editor
      if (role === Role.EDITOR) {
        return { editor_uploaded_at: now };
      }
      break;
    case 'REWORK_VIDEO_SUBMITTED':
      if (role === Role.CINE) {
        return { cine_uploaded_at: now };
      }
      break;
    case 'REWORK_EDIT_SUBMITTED':
      if (role === Role.EDITOR) {
        return { editor_uploaded_at: now };
      }
      break;
    case 'REWORK_DESIGN_SUBMITTED':
      if (role === Role.DESIGNER) {
        return { designer_uploaded_at: now };
      }
      break;
  }

  return {};
}

/**
 * Determine if a project is a rework project based on history
 * A project is considered a rework project if it has any unresolved rework-related actions in its history
 */
export function isReworkProject(project: Project): boolean {
  if (!project.history) return false;

  // Sort history by timestamp descending to find the most recent actions
  const sortedHistory = [...project.history].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Find the most recent REWORK or REJECTED action
  const reworkAction = sortedHistory.find(h => {
    const isReworkAction = h.action === 'REWORK' || h.action === 'REJECTED';
    return isReworkAction;
  });

  // If there's a rework action, check if it has been resolved by a later submission
  if (reworkAction) {
    const reworkTimestamp = new Date(reworkAction.timestamp).getTime();
    const hasLaterSubmission = sortedHistory.some(h => {
      const isSubmissionAction = ['SUBMITTED', 'APPROVED'].includes(h.action);
      const actionTimestamp = new Date(h.timestamp).getTime();
      return isSubmissionAction && actionTimestamp > reworkTimestamp;
    });

    // Return true only if there was a rework action and it hasn't been resolved by submission/approval
    return !hasLaterSubmission;
  }

  // Also check if the project status is REWORK
  const hasReworkStatus = project.status === 'REWORK';

  // Return true if there's no rework action but the status is REWORK
  return hasReworkStatus;
}

/**
 * Determine if a project is a rework project initiated by a specific role
 * A project is considered a rework project initiated by a specific role 
 * if it has any unresolved rework-related actions initiated by that role in its history
 */
export function isReworkInitiatedByRole(project: Project, role: Role): boolean {
  if (!project.history) return false;

  // Sort history by timestamp descending to find the most recent actions
  const sortedHistory = [...project.history].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Find the most recent REWORK or REJECTED action initiated by the specified role
  const reworkAction = sortedHistory.find(h => {
    const isReworkAction = h.action === 'REWORK' || h.action === 'REJECTED';
    // Check if the action was initiated by the specified role
    // The actor_role field stores the role of the person who took the action
    return isReworkAction && h.actor_role === role;
  });

  // If there's a rework action by this role, check if it has been resolved by a later submission
  if (reworkAction) {
    const reworkTimestamp = new Date(reworkAction.timestamp).getTime();
    const hasLaterSubmission = sortedHistory.some(h => {
      const isSubmissionAction = ['SUBMITTED', 'APPROVED'].includes(h.action);
      const actionTimestamp = new Date(h.timestamp).getTime();
      return isSubmissionAction && actionTimestamp > reworkTimestamp;
    });

    // Return true only if there was a rework action by this role and it hasn't been resolved by submission/approval
    return !hasLaterSubmission;
  }

  return false;
}
