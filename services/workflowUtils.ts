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
 * Check if the project is an influencer video (JOBBOARD or LEAD MAGNET)
 */
export function isInfluencerVideo(project: Project | any): boolean {
  if (!project) return false;
  
  // Check brand (new)
  const brandSelection = project.brand || project.data?.brand || project.brandSelected; // Handle different object shapes
  if (['APPLYWIZZ_JOB_BOARD', 'LEAD_MAGNET_RTW', 'SHYAMS_PERSONAL_BRANDING'].includes(brandSelection)) {
    return true;
  }
  
  // Backward compatibility with legacy content_type
  const contentType = project.content_type || project.contentType;
  if (['JOBBOARD', 'LEAD_MAGNET'].includes(contentType)) {
    return true;
  }
  
  return false;
}

/**
 * Canonical rework condition for all roles
 */
export function isActiveRework(project: Project | undefined, userRole: string): boolean {
  if (!project) return false;
  return project.status === 'REWORK' && project.assigned_to_role === userRole;
}

/**
 * Get the canonical rework comment for display
 * Primary source: history (for REWORK actions)
 * Secondary source: forwarded_comments (as fallback)
 */
export function getCanonicalReworkComment(project: Project | undefined): { comment: string | null; actor_name: string | null; from_role?: string | null } | null {
  if (!project) return null;

  // 1. Check history FIRST for REWORK actions (most authoritative)
  if (project.history && project.history.length > 0) {
    const sortedHistory = [...project.history].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Look for the most recent REWORK action
    const reworkAction = sortedHistory.find(h =>
      h.action === 'REWORK' || h.action === 'REJECTED' || h.action.startsWith('REWORK_') || h.action.includes('REWORK')
    );

    if (reworkAction) {
      return {
        comment: reworkAction.comment || null,
        actor_name: reworkAction.actor_name || 'Reviewer',
        from_role: reworkAction.from_role || reworkAction.actor_role || null
      };
    }
  }

  // 2. Check forwarded_comments as fallback
  if (project.forwarded_comments && Array.isArray(project.forwarded_comments) && project.forwarded_comments.length > 0) {
    // Look for REWORK or REJECTED comments
    const reworkComment = project.forwarded_comments
      .slice()
      .reverse()
      .find(c => c.action === 'REWORK' || c.action === 'REJECTED' || c.action?.includes('REWORK'));

    if (reworkComment?.comment) {
      return {
        comment: reworkComment.comment,
        actor_name: reworkComment.actor_name || 'Reviewer',
        from_role: reworkComment.from_role || null
      };
    }

    // If no rework-specific comment, use the latest one
    const latestForwarded = project.forwarded_comments[project.forwarded_comments.length - 1];
    if (latestForwarded?.comment) {
      return {
        comment: latestForwarded.comment,
        actor_name: latestForwarded.actor_name || 'Reviewer',
        from_role: latestForwarded.from_role || null
      };
    }
  }

  return null;
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
        const isSubmissionAction = ['SUBMITTED', 'APPROVED', 'REWORK_SUBMITTED', 'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED', 'DIRECT_UPLOAD'].includes(h.action);
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
    latestAction?.includes("REWORK_") ||
    project?.status === 'WAITING_APPROVAL';
  const isApproved = latestAction === "APPROVED" || project?.status === 'DONE';

  return {
    isRejected,
    isRework: isRework && project?.status !== 'WAITING_APPROVAL' && project?.status !== 'DONE',
    isTargetedRework: false,
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

  // First, check if the project status is REWORK and the user's role matches the assigned role in the current stage
  if (project?.status === 'REWORK' && userRole === 'EDITOR' && project.assigned_to_role === 'EDITOR' && project.current_stage === 'VIDEO_EDITING') {
    isRework = true;
    isTargetedRework = true;
  }
  else if (project?.status === 'REWORK' && userRole === 'CINE' && project.assigned_to_role === 'CINE' && project.current_stage === 'CINEMATOGRAPHY') {
    isRework = true;
    isTargetedRework = true;
  }
  else if (project?.status === 'REWORK' && userRole === 'DESIGNER' && project.assigned_to_role === 'DESIGNER' && (project.current_stage === 'THUMBNAIL_DESIGN' || project.current_stage === 'CREATIVE_DESIGN')) {
    isRework = true;
    isTargetedRework = true;
  }
  else if (project?.status === 'REWORK' && userRole === 'SUB_EDITOR' && project.assigned_to_role === 'SUB_EDITOR' && (project.current_stage === 'SUB_EDITOR_ASSIGNMENT' || project.current_stage === 'SUB_EDITOR_PROCESSING')) {
    isRework = true;
    isTargetedRework = true;
  }

  if (project?.history && project.history.length > 0 && !isTargetedRework) { // Only check history if we haven't already identified it as targeted rework
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
        const isSubmissionAction = ['SUBMITTED', 'APPROVED', 'REWORK_SUBMITTED', 'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED', 'DIRECT_UPLOAD'].includes(h.action);
        const actionTimestamp = new Date(h.timestamp).getTime();
        return isSubmissionAction && actionTimestamp > reworkTimestamp;
      });

      // Check if project has moved to a later stage after the rework action
      const hasLaterStageTransition = sortedHistory.some(h => {
        const stageChangeActions = [
          'EDITOR_VIDEO_UPLOADED',
          'SUB_EDITOR_ASSIGNED',
          'SUB_EDITOR_COMPLETED',
          'DESIGN_COMPLETED',
          'THUMBNAIL_COMPLETED'
        ];
        const actionTimestamp = new Date(h.timestamp).getTime();
        return stageChangeActions.includes(h.action) && actionTimestamp > reworkTimestamp;
      });

      // Only show rework if there's no later submission/approval AND no later stage transition
      if (!hasLaterSubmission && !hasLaterStageTransition) {
        isRework = true;
        isTargetedRework = true;
      }
    }

    if (rejectedAction) {
      const rejectedTimestamp = new Date(rejectedAction.timestamp).getTime();
      const hasLaterSubmission = sortedHistory.some(h => {
        const isSubmissionAction = ['SUBMITTED', 'APPROVED', 'REWORK_SUBMITTED', 'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED', 'DIRECT_UPLOAD'].includes(h.action);
        const actionTimestamp = new Date(h.timestamp).getTime();
        return isSubmissionAction && actionTimestamp > rejectedTimestamp;
      });

      // Check if project has moved to a later stage after the reject action
      const hasLaterStageTransition = sortedHistory.some(h => {
        const stageChangeActions = [
          'EDITOR_VIDEO_UPLOADED',
          'SUB_EDITOR_ASSIGNED',
          'SUB_EDITOR_COMPLETED',
          'DESIGN_COMPLETED',
          'THUMBNAIL_COMPLETED'
        ];
        const actionTimestamp = new Date(h.timestamp).getTime();
        return stageChangeActions.includes(h.action) && actionTimestamp > rejectedTimestamp;
      });

      // Only show rejected if there's no later submission/approval AND no later stage transition
      if (!hasLaterSubmission && !hasLaterStageTransition) {
        isRejected = true;
        isRework = true; // Rejected projects are also considered in rework state
        isTargetedRework = true;
      }
    }
  }

  const isInReview =
    latestAction === "SUBMITTED" ||
    latestAction?.includes("REWORK_") ||
    project?.status === 'WAITING_APPROVAL';
    
  const isApproved = latestAction === "APPROVED" || project?.status === 'DONE';

  // Final guards: Rework/TargetedRework should only be true if status corresponds
  const finalIsRework = isRework && project?.status !== 'WAITING_APPROVAL' && project?.status !== 'DONE';
  const finalIsTargetedRework = isTargetedRework && project?.status !== 'WAITING_APPROVAL' && project?.status !== 'DONE';

  return {
    isRejected,
    isRework: finalIsRework,
    isTargetedRework: finalIsTargetedRework,
    isInReview,
    isApproved,
    latestAction
  };
}

/**
 * Determine if user can edit based on role and workflow state
 */
export function canUserEdit(role: string, workflowState: WorkflowState, assignedRole?: string, currentStage?: string): boolean {
  const { isRework, isRejected, isApproved, isInReview, latestAction } = workflowState;

  // Primary check: if the current stage matches the user's role and assigned role, allow access
  // This handles the most common case where a user should be able to edit in their assigned stage
  if ((currentStage === 'VIDEO_EDITING' && role === Role.EDITOR && assignedRole === Role.EDITOR) ||
    (currentStage === 'SUB_EDITOR_ASSIGNMENT' && role === Role.SUB_EDITOR && assignedRole === Role.SUB_EDITOR) ||
    (currentStage === 'SUB_EDITOR_PROCESSING' && role === Role.SUB_EDITOR && assignedRole === Role.SUB_EDITOR) ||
    (currentStage === 'THUMBNAIL_DESIGN' && role === Role.DESIGNER && assignedRole === Role.DESIGNER) ||
    (currentStage === 'CREATIVE_DESIGN' && role === Role.DESIGNER && assignedRole === Role.DESIGNER) ||
    (currentStage === 'CINEMATOGRAPHY' && role === Role.CINE && assignedRole === Role.CINE)) {
    return true;
  }

  // For rework scenarios, implement hierarchical access based on the assigned role
  if (!isRework) {
    // If not in rework state, check if the role matches the assigned role OR the current stage
    // This handles cases where the assigned_role might not be properly set but the stage indicates who should work
    return role === assignedRole ||
      (currentStage === 'VIDEO_EDITING' && role === Role.EDITOR) ||
      (currentStage === 'SUB_EDITOR_ASSIGNMENT' && role === Role.SUB_EDITOR) ||
      (currentStage === 'SUB_EDITOR_PROCESSING' && role === Role.SUB_EDITOR) ||
      (currentStage === 'THUMBNAIL_DESIGN' && role === Role.DESIGNER) ||
      (currentStage === 'CREATIVE_DESIGN' && role === Role.DESIGNER) ||
      (currentStage === 'CINEMATOGRAPHY' && role === Role.CINE);
  }

  // When in rework state, we need to balance hierarchical access rules with current stage assignments
  // If the project has moved to a new stage and is assigned to a new role, that role should be able to work on it
  // regardless of the historical rework state
  const currentStagePermission =
    (currentStage === 'VIDEO_EDITING' && role === Role.EDITOR) ||
    (currentStage === 'SUB_EDITOR_ASSIGNMENT' && role === Role.SUB_EDITOR) ||
    (currentStage === 'SUB_EDITOR_PROCESSING' && role === Role.SUB_EDITOR) ||
    (currentStage === 'THUMBNAIL_DESIGN' && role === Role.DESIGNER) ||
    (currentStage === 'CREATIVE_DESIGN' && role === Role.DESIGNER) ||
    (currentStage === 'CINEMATOGRAPHY' && role === Role.CINE);

  // If the current stage permits the role, allow access even if in rework state
  if (currentStagePermission && role === assignedRole) {
    return true;
  }

  // Otherwise, fall back to hierarchical access rules based on the original assigned role at rework time:
  // - If originally assigned to CINE: CINE, EDITOR, and DESIGNER can edit
  // - If originally assigned to EDITOR: EDITOR and DESIGNER can edit
  // - If originally assigned to SUB_EDITOR: SUB_EDITOR and EDITOR can edit
  // - If originally assigned to DESIGNER: only DESIGNER can edit
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
 * Returns comments based on two criteria:
 * 1. From workflow history: action = 'REWORK' or 'REJECTED' where to_role = current_user_role
 * 2. From current project state: project.status = 'REWORK' and assigned_to_role = current_user_role
 * Only returns comments if no resubmission has happened after the rework request
 */
export function getLatestReworkRejectComment(project: Project | undefined, userRole?: string): { comment: string | null; actor_name: string | null } | null {
  if (!project) {
    return null;
  }

  // Check if the project is currently in REWORK status and assigned to the user's role
  if (project.status === 'REWORK' && userRole && project.assigned_to_role === userRole) {
    // If the project is currently assigned for rework to this user, show the rework comments
    // First, look for the most recent rework/reject action in history
    if (project.history && project.history.length > 0) {
      // Sort by timestamp to get the most recent actions
      const sortedHistory = [...project.history].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Find the most recent REWORK or REJECTED action
      const reworkRejectAction = sortedHistory.find(h => {
        const isReworkOrRejected = h.action === 'REWORK' || h.action === 'REJECTED';
        return isReworkOrRejected;
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
    }

    // If we couldn't find a rework/reject action in history, check forwarded_comments
    if (project.forwarded_comments && Array.isArray(project.forwarded_comments) && project.forwarded_comments.length > 0) {
      const latestComment = project.forwarded_comments[project.forwarded_comments.length - 1];
      if (latestComment && typeof latestComment === 'object' && latestComment.comment) {
        return {
          comment: latestComment.comment,
          actor_name: latestComment.actor_name || null
        };
      }
    }


  }

  // Fall back to the original logic for historical rework/reject comments
  if (!project.history || project.history.length === 0) {
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
    case 'REWORK_SUBMITTED':
    case 'REWORK_VIDEO_SUBMITTED':
    case 'REWORK_EDIT_SUBMITTED':
    case 'REWORK_DESIGN_SUBMITTED':
    case 'EDITOR_VIDEO_UPLOADED':
    case 'DESIGNER_ASSET_UPLOADED':
    case 'SUB_EDITOR_VIDEO_UPLOADED':
    case 'CINE_VIDEO_UPLOADED':
      if (role === Role.EDITOR) {
        return { editor_uploaded_at: now };
      }
      if (role === Role.SUB_EDITOR) {
        return { sub_editor_uploaded_at: now };
      }
      if (role === Role.DESIGNER) {
        return { designer_uploaded_at: now };
      }
      if (role === Role.CINE) {
        return { cine_uploaded_at: now };
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
    case 'SUB_EDITOR_ASSIGNED':
      // When editor assigns project to sub-editor
      if (role === Role.EDITOR) {
        return { editor_uploaded_at: now };
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
      const isSubmissionAction = ['SUBMITTED', 'APPROVED', 'REWORK_SUBMITTED', 'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED', 'DIRECT_UPLOAD'].includes(h.action);
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
      const isSubmissionAction = ['SUBMITTED', 'APPROVED', 'REWORK_SUBMITTED', 'REWORK_VIDEO_SUBMITTED', 'REWORK_EDIT_SUBMITTED', 'REWORK_DESIGN_SUBMITTED', 'DIRECT_UPLOAD'].includes(h.action);
      const actionTimestamp = new Date(h.timestamp).getTime();
      return isSubmissionAction && actionTimestamp > reworkTimestamp;
    });

    // Return true only if there was a rework action by this role and it hasn't been resolved by submission/approval
    return !hasLaterSubmission;
  }

  return false;
}
