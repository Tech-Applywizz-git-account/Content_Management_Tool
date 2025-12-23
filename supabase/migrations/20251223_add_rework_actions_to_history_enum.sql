-- ============================================================================
-- ADD REWORK ACTIONS TO HISTORY_ACTION ENUM
-- ============================================================================
-- This migration adds new rework action types to the history_action enum

-- Add new enum values to the history_action enum type
ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'REWORK_VIDEO_SUBMITTED';
ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'REWORK_EDIT_SUBMITTED';
ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'REWORK_DESIGN_SUBMITTED';

COMMENT ON TYPE history_action IS 'Enum for workflow history actions including rework submissions';