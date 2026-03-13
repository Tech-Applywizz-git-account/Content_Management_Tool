export enum Role {
  ADMIN = 'ADMIN',
  WRITER = 'WRITER',
  CINE = 'CINE',
  EDITOR = 'EDITOR',
  SUB_EDITOR = 'SUB_EDITOR',
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
  JOBBOARD = 'JOBBOARD',
  LEAD_MAGNET = 'LEAD_MAGNET',
}

export enum WorkflowStage {
  SCRIPT = 'SCRIPT',
  SCRIPT_REVIEW_L1 = 'SCRIPT_REVIEW_L1', // CMO
  SCRIPT_REVIEW_L2 = 'SCRIPT_REVIEW_L2', // CEO
  CINEMATOGRAPHY = 'CINEMATOGRAPHY', // Cinematographer schedules shoot
  VIDEO_EDITING = 'VIDEO_EDITING', // Editor edits video
  SUB_EDITOR_ASSIGNMENT = 'SUB_EDITOR_ASSIGNMENT', // Main Editor assigns to sub-editor
  SUB_EDITOR_PROCESSING = 'SUB_EDITOR_PROCESSING', // Sub-editor works on video
  THUMBNAIL_DESIGN = 'THUMBNAIL_DESIGN', // Designer creates thumbnail (video path)
  CREATIVE_DESIGN = 'CREATIVE_DESIGN', // Designer creates creative (creative-only path)
  FINAL_REVIEW_CMO = 'FINAL_REVIEW_CMO', // CMO Round 2
  FINAL_REVIEW_CEO = 'FINAL_REVIEW_CEO', // CEO Round 2
  WRITER_VIDEO_APPROVAL = 'WRITER_VIDEO_APPROVAL', // Writer approves CINE video
  MULTI_WRITER_APPROVAL = 'MULTI_WRITER_APPROVAL', // Multiple writers approve in parallel
  POST_WRITER_REVIEW = 'POST_WRITER_REVIEW', // Post multi-writer approval - visible to OPS and CMO in parallel
  OPS_SCHEDULING = 'OPS_SCHEDULING', // Ops schedules post
  POSTED = 'POSTED', // Content posted/completed
  REWORK = 'REWORK', // Rework stage
  WRITER_REVISION = 'WRITER_REVISION', // Custom revision stage for specific content types
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  REJECTED = 'REJECTED',
  REWORK = 'REWORK',
  DONE = 'DONE',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export type Priority = 'HIGH' | 'NORMAL' | 'LOW';
export type ContentType = 'VIDEO' | 'CREATIVE_ONLY' | 'JOBBOARD' | 'LEAD_MAGNET' | 'CAPTION_BASED';

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
  created_by_user_id?: string; // User ID of the creator (managed by backend)
  created_by_name?: string; // Name of the creator
  writer_id?: string; // User ID of the writer (optional)
  writer_name?: string; // Name of the writer (optional)
  editor_name?: string; // Name of the editor (optional)
  designer_name?: string; // Name of the designer (optional)
  sub_editor_name?: string; // Name of the sub-editor (optional)
  created_at: string;
  writer_submitted_at?: string; // When writer submits the project
  cmo_approved_at?: string; // When CMO approves the project
  cmo_rework_at?: string; // When CMO requests rework
  ceo_approved_at?: string; // When CEO approves the project
  ceo_rework_at?: string; // When CEO requests rework
  cine_uploaded_at?: string; // When Cine uploads video
  editor_uploaded_at?: string; // When Editor uploads video
  sub_editor_uploaded_at?: string; // When Sub-Editor uploads video
  designer_uploaded_at?: string; // When Designer uploads assets
  edited_by_role?: 'EDITOR' | 'SUB_EDITOR'; // Role of the person who actually edited the video
  edited_by_user_id?: string; // User ID of the person who actually edited the video
  edited_by_name?: string; // Name of the person who actually edited the video
  edited_at?: string; // Timestamp when the video was edited
  shoot_date?: string; // Cinematographer sets
  delivery_date?: string; // Editor/Designer sets
  post_scheduled_date?: string; // Ops sets
  video_link?: string; // Cinematographer uploads raw video
  edited_video_link?: string; // Editor uploads edited video
  thumbnail_link?: string; // Designer uploads (video path)
  creative_link?: string; // Designer uploads (creative-only path)
  cine_video_links_history?: string[]; // Array of all video links uploaded by cinematographer, including previous versions for rework scenarios
  editor_video_links_history?: string[]; // Array of all edited video links uploaded by editor, including previous versions for rework scenarios
  sub_editor_video_links_history?: string[]; // Array of all edited video links uploaded by sub-editor, including previous versions for rework scenarios
  designer_video_links_history?: string[]; // Array of all creative/thumbnail links uploaded by designer, including previous versions for rework scenarios
  data: ProjectData; // Flexible JSON blob for form inputs
  history: HistoryEvent[];
  rework_target_role?: Role;
  rework_initiator_role?: Role;
  rework_initiator_stage?: WorkflowStage;
  visible_to_roles?: string[]; // Roles that can view this project
  forwarded_comments?: Array<{
    comment: string;
    actor_name: string;
    action?: string;
    from_role?: string;
    to_role?: string;
  }>; // Comments forwarded with rework requests
  first_review_opened_at?: string; // Timestamp when first reviewer opened the project
  first_review_opened_by_role?: Role; // Role of the first reviewer who opened the project
}

export interface ProjectData {
  script_content?: string;
  script_notes?: string;
  brief?: string;
  captions?: string;
  tags?: string;
  live_url?: string;
  video_title_final?: string;
  thumbnail_required?: boolean;
  thumbnail_reference_link?: string;
  thumbnail_notes?: string;
  actor?: string;
  location?: string;
  lighting?: string;
  angles?: string;
  niche?: 'PROBLEM_SOLVING' | 'SOCIAL_PROOF' | 'LEAD_MAGNET' | 'OTHER';
  niche_other?: string;
  cine_thumbnail_link?: string;
  cine_thumbnail_photos?: string[];
  cine_to_writer_feedback?: string;
  script_reference_link?: string;
  influencer_name?: string;
  referral_link?: string;
  [key: string]: any;
}

export interface HistoryEvent {
  id: string;
  stage: WorkflowStage;
  from_stage?: WorkflowStage;
  to_stage?: WorkflowStage;
  actor_id: string;
  actor_name: string;
  action: 'CREATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'REWORK';
  comment?: string;
  timestamp: string;
  actor_role?: string;
  from_role?: string;
  to_role?: string;
  metadata?: any;
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
  [Role.SUB_EDITOR]: 'Sub-Editor',
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
  [WorkflowStage.SUB_EDITOR_ASSIGNMENT]: 'Sub-Editor Assignment',
  [WorkflowStage.SUB_EDITOR_PROCESSING]: 'Sub-Editor Processing',
  [WorkflowStage.THUMBNAIL_DESIGN]: 'Thumbnail Design',
  [WorkflowStage.CREATIVE_DESIGN]: 'Creative Design',
  [WorkflowStage.FINAL_REVIEW_CMO]: 'Final Review',
  [WorkflowStage.FINAL_REVIEW_CEO]: 'Final Review (CEO)',
  [WorkflowStage.MULTI_WRITER_APPROVAL]: 'Multi-Writer Approval',
  [WorkflowStage.WRITER_VIDEO_APPROVAL]: 'Writer Video Approval',
  [WorkflowStage.POST_WRITER_REVIEW]: 'Final Review',
  [WorkflowStage.OPS_SCHEDULING]: 'Scheduling',
  [WorkflowStage.POSTED]: 'Posted',
  [WorkflowStage.REWORK]: 'Rework',
  [WorkflowStage.WRITER_REVISION]: 'Writer Revision',
};

// Notification types
export type NotificationType = 'ASSET_UPLOADED' | 'ASSET_UPDATED' | 'PROJECT_ASSIGNED' | 'REVIEW_READY' | 'REWORK_REQUESTED' | 'APPROVAL_GRANTED';

export interface Notification {
  id: string;
  user_id: string;
  project_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}