import { Channel, Role, WorkflowStage, UserStatus } from './types';

// Define the linear workflow for each channel
// NOTE: LINKEDIN uses CREATIVE_DESIGN (creative-only path)
// YOUTUBE/INSTAGRAM use full video production path (CINEMATOGRAPHY -> VIDEO_EDITING -> THUMBNAIL_DESIGN)
export const WORKFLOWS: Record<Channel, { stage: WorkflowStage; role: Role }[]> = {
    [Channel.LINKEDIN]: [
        { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
        { stage: WorkflowStage.SCRIPT_REVIEW_L1, role: Role.CMO },
        { stage: WorkflowStage.SCRIPT_REVIEW_L2, role: Role.CEO },
        { stage: WorkflowStage.CREATIVE_DESIGN, role: Role.DESIGNER },
        { stage: WorkflowStage.FINAL_REVIEW_CMO, role: Role.CMO },
        { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },
        { stage: WorkflowStage.OPS_SCHEDULING, role: Role.OPS },
        { stage: WorkflowStage.POSTED, role: Role.OPS },
    ],
    [Channel.YOUTUBE]: [
        { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
        { stage: WorkflowStage.SCRIPT_REVIEW_L1, role: Role.CMO },
        { stage: WorkflowStage.SCRIPT_REVIEW_L2, role: Role.CEO },
        { stage: WorkflowStage.CINEMATOGRAPHY, role: Role.CINE },
        { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
        { stage: WorkflowStage.THUMBNAIL_DESIGN, role: Role.DESIGNER },
        { stage: WorkflowStage.FINAL_REVIEW_CMO, role: Role.CMO },
        { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },
        { stage: WorkflowStage.OPS_SCHEDULING, role: Role.OPS },
        { stage: WorkflowStage.POSTED, role: Role.OPS },
    ],
    [Channel.INSTAGRAM]: [
        { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
        { stage: WorkflowStage.SCRIPT_REVIEW_L1, role: Role.CMO },
        { stage: WorkflowStage.SCRIPT_REVIEW_L2, role: Role.CEO },
        { stage: WorkflowStage.CINEMATOGRAPHY, role: Role.CINE },
        { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
        { stage: WorkflowStage.THUMBNAIL_DESIGN, role: Role.DESIGNER },
        { stage: WorkflowStage.FINAL_REVIEW_CMO, role: Role.CMO },
        { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },
        { stage: WorkflowStage.OPS_SCHEDULING, role: Role.OPS },
        { stage: WorkflowStage.POSTED, role: Role.OPS },
    ],
};

export const DEMO_USERS = [
    { id: 'u1', email: 'writer@applywizz.com', full_name: 'Alice Writer', role: Role.WRITER, status: UserStatus.ACTIVE, last_login: new Date().toISOString() },
    { id: 'u2', email: 'cmo@applywizz.com', full_name: 'Carol CMO', role: Role.CMO, status: UserStatus.ACTIVE, last_login: new Date().toISOString() },
    { id: 'u3', email: 'ceo@applywizz.com', full_name: 'Bob CEO', role: Role.CEO, status: UserStatus.ACTIVE, last_login: new Date().toISOString() },
    { id: 'u4', email: 'cine@applywizz.com', full_name: 'Dave Cine', role: Role.CINE, status: UserStatus.ACTIVE, last_login: new Date().toISOString() },
    { id: 'u5', email: 'editor@applywizz.com', full_name: 'Eve Editor', role: Role.EDITOR, status: UserStatus.ACTIVE, last_login: new Date().toISOString() },
    { id: 'u6', email: 'design@applywizz.com', full_name: 'Frank Design', role: Role.DESIGNER, status: UserStatus.ACTIVE, last_login: new Date().toISOString() },
    { id: 'u7', email: 'ops@applywizz.com', full_name: 'Grace Ops', role: Role.OPS, status: UserStatus.ACTIVE, last_login: new Date().toISOString() },
    { id: 'u8', email: 'admin@applywizz.com', full_name: 'Admin User', role: Role.ADMIN, status: UserStatus.ACTIVE, last_login: new Date().toISOString() },
    { id: 'u9', email: 'inactive@applywizz.com', full_name: 'Sam Sleeper', role: Role.WRITER, status: UserStatus.INACTIVE, last_login: '2023-01-01T10:00:00Z' },
];