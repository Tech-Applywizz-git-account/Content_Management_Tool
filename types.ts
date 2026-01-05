export enum Role {
  ADMIN = 'ADMIN',
  WRITER = 'WRITER',
  CINE = 'CINE',
  EDITOR = 'EDITOR',
  DESIGNER = 'DESIGNER',
  CMO = 'CMO',
  CEO = 'CEO',
  OPS = 'OPS',
  OBSERVER = 'OBSERVER',
}

export enum Channel {
  LINKEDIN = 'LINKEDIN',
  YOUTUBE = 'YOUTUBE',
  INSTAGRAM = 'INSTAGRAM',
}

export enum WorkflowStage {
  SCRIPT = 'SCRIPT',
  SCRIPT_REVIEW_L1 = 'SCRIPT_REVIEW_L1', // CMO
  SCRIPT_REVIEW_L2 = 'SCRIPT_REVIEW_L2', // CEO
  CINEMATOGRAPHY = 'CINEMATOGRAPHY', // Cinematographer schedules shoot
  VIDEO_EDITING = 'VIDEO_EDITING', // Editor edits video
  THUMBNAIL_DESIGN = 'THUMBNAIL_DESIGN', // Designer creates thumbnail (video path)
  CREATIVE_DESIGN = 'CREATIVE_DESIGN', // Designer creates creative (creative-only path)
  FINAL_REVIEW_CMO = 'FINAL_REVIEW_CMO', // CMO Round 2
  FINAL_REVIEW_CEO = 'FINAL_REVIEW_CEO', // CEO Round 2
  OPS_SCHEDULING = 'OPS_SCHEDULING', // Ops schedules post
  POSTED = 'POSTED', // Content posted/completed
  REWORK = 'REWORK', // Rework stage
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  REJECTED = 'REJECTED',
  DONE = 'DONE',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type ContentType = 'VIDEO' | 'CREATIVE_ONLY';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  job_title?: string;  // For OBSERVER role: COO, CRO, CTO, CFO, etc.
  avatar_url?: string;
  status: UserStatus;
  last_login?: string;
  phone?: string;
}

export interface Project {
  id: string;
  title: string;
  channel: Channel;
  content_type: ContentType; // Video or Creative-Only
  current_stage: WorkflowStage;
  assigned_to_role: Role;
  assigned_to_user_id?: string; // Optional, usually assigned by role
  status: TaskStatus;
  priority: Priority;
  due_date: string;
  created_at: string;
  shoot_date?: string; // Cinematographer sets
  delivery_date?: string; // Editor/Designer sets
  post_scheduled_date?: string; // Ops sets
  video_link?: string; // Cinematographer uploads raw video
  edited_video_link?: string; // Editor uploads edited video
  thumbnail_link?: string; // Designer uploads (video path)
  creative_link?: string; // Designer uploads (creative-only path)
  data: ProjectData; // Flexible JSON blob for form inputs
  history: HistoryEvent[];
}

export interface ProjectData {
  script_content?: string;
  script_notes?: string;
  brief?: string;
  captions?: string;
  tags?: string;
  live_url?: string;
  video_title_final?: string;
  [key: string]: any;
}

export interface HistoryEvent {
  id: string;
  stage: WorkflowStage;
  actor_id: string;
  actor_name: string;
  action: 'CREATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'REWORK' | 'REWORK_VIDEO_SUBMITTED' | 'REWORK_EDIT_SUBMITTED' | 'REWORK_DESIGN_SUBMITTED';
  comment?: string;
  timestamp: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  user_role: Role;
  action: string;
  details: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Admin',
  [Role.WRITER]: 'Content Writer',
  [Role.CINE]: 'Cinematographer',
  [Role.EDITOR]: 'Video Editor',
  [Role.DESIGNER]: 'Graphic Designer',
  [Role.CMO]: 'CMO (Approver)',
  [Role.CEO]: 'CEO (Approver)',
  [Role.OPS]: 'Operations',
  [Role.OBSERVER]: 'Observer (View-Only)',
};

export const OBSERVER_TITLES: Record<string, string> = {
  COO: 'Chief Operating Officer',
  CRO: 'Chief Revenue Officer',
  CTO: 'Chief Technology Officer',
  CFO: 'Chief Financial Officer',
  BOARD: 'Board Member',
  VP: 'Vice President',
  SVP: 'Senior Vice President',
  DIRECTOR: 'Director',
  OTHER: 'Other Executive'
};

export const STAGE_LABELS: Record<WorkflowStage, string> = {
  [WorkflowStage.SCRIPT]: 'Scripting',
  [WorkflowStage.SCRIPT_REVIEW_L1]: 'Script Review (CMO)',
  [WorkflowStage.SCRIPT_REVIEW_L2]: 'Script Review (CEO)',
  [WorkflowStage.CINEMATOGRAPHY]: 'Cinematography',
  [WorkflowStage.VIDEO_EDITING]: 'Video Editing',
  [WorkflowStage.THUMBNAIL_DESIGN]: 'Thumbnail Design',
  [WorkflowStage.CREATIVE_DESIGN]: 'Creative Design',
  [WorkflowStage.FINAL_REVIEW_CMO]: 'Final Review (CMO)',
  [WorkflowStage.FINAL_REVIEW_CEO]: 'Final Review (CEO)',
  [WorkflowStage.OPS_SCHEDULING]: 'Scheduling',
  [WorkflowStage.POSTED]: 'Posted',
  [WorkflowStage.REWORK]: 'Rework',
};