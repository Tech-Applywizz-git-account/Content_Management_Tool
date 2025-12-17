// Mock data using existing type definitions
import { User, Project, SystemLog, Role, UserStatus, TaskStatus, Channel, WorkflowStage } from '../types';

// Store passwords separately (not in User type)
export const MOCK_PASSWORDS: Record<string, string> = {
    'admin@applywizz.com': 'admin123',
    'ceo@applywizz.com': 'ceo123',
    'cmo@applywizz.com': 'cmo123',
    'writer@applywizz.com': 'writer123',
    'editor@applywizz.com': 'editor123',
    'designer@applywizz.com': 'designer123',
    'cine@applywizz.com': 'cine123',
    'ops@applywizz.com': 'ops123',
    'observer@applywizz.com': 'observer123'
};

export const MOCK_USERS: User[] = [
    {
        id: 'user-admin-001',
        email: 'admin@applywizz.com',
        full_name: 'Admin User',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        phone: '+91-9876543210',
        last_login: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    },
    {
        id: 'user-ceo-001',
        email: 'ceo@applywizz.com',
        full_name: 'CEO Person',
        role: Role.CEO,
        status: UserStatus.ACTIVE,
        phone: '+91-9876543211',
        last_login: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
    },
    {
        id: 'user-cmo-001',
        email: 'cmo@applywizz.com',
        full_name: 'CMO Marketing',
        role: Role.CMO,
        status: UserStatus.ACTIVE,
        phone: '+91-9876543212',
        last_login: new Date(Date.now() - 1000 * 60 * 60).toISOString()
    },
    {
        id: 'user-writer-001',
        email: 'writer@applywizz.com',
        full_name: 'Writer Content',
        role: Role.WRITER,
        status: UserStatus.ACTIVE,
        phone: '+91-9876543213',
        last_login: new Date(Date.now() - 1000 * 60 * 15).toISOString()
    },
    {
        id: 'user-editor-001',
        email: 'editor@applywizz.com',
        full_name: 'Editor Video',
        role: Role.EDITOR,
        status: UserStatus.ACTIVE,
        phone: '+91-9876543214',
        last_login: new Date(Date.now() - 1000 * 60 * 45).toISOString()
    },
    {
        id: 'user-designer-001',
        email: 'designer@applywizz.com',
        full_name: 'Designer Creative',
        role: Role.DESIGNER,
        status: UserStatus.ACTIVE,
        phone: '+91-9876543215',
        last_login: new Date(Date.now() - 1000 * 60 * 20).toISOString()
    },
    {
        id: 'user-cine-001',
        email: 'cine@applywizz.com',
        full_name: 'Cine Shooter',
        role: Role.CINE,
        status: UserStatus.ACTIVE,
        phone: '+91-9876543216',
        last_login: new Date(Date.now() - 1000 * 60 * 90).toISOString()
    },
    {
        id: 'user-ops-001',
        email: 'ops@applywizz.com',
        full_name: 'Operations Manager',
        role: Role.OPS,
        status: UserStatus.ACTIVE,
        phone: '+91-9876543217',
        last_login: new Date(Date.now() - 1000 * 60 * 10).toISOString()
    },
    {
        id: 'user-observer-001',
        email: 'observer@applywizz.com',
        full_name: 'Observer View',
        role: Role.OBSERVER,
        job_title: 'CTO',
        status: UserStatus.ACTIVE,
        phone: '+91-9876543218',
        last_login: new Date(Date.now() - 1000 * 60 * 120).toISOString()
    }
];

export const MOCK_PROJECTS: Project[] = [
    {
        id: 'proj-001',
        title: 'Instagram Reel - Product Launch',
        channel: Channel.INSTAGRAM,
        content_type: 'VIDEO',
        current_stage: WorkflowStage.SCRIPT,
        assigned_to_role: Role.WRITER,
        status: TaskStatus.IN_PROGRESS,
        priority: 'HIGH',
        due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        data: {
            script_content: 'Hook: New product launching soon!\nBody: Features and benefits...\nCTA: Pre-order now!',
        },
        history: []
    },
    {
        id: 'proj-002',
        title: 'YouTube Tutorial Video',
        channel: Channel.YOUTUBE,
        content_type: 'VIDEO',
        current_stage: WorkflowStage.CINEMATOGRAPHY,
        assigned_to_role: Role.CINE,
        status: TaskStatus.TODO,
        priority: 'NORMAL',
        due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        data: {
            script_content: 'Quick tutorial on our software features',
        },
        history: []
    },
    {
        id: 'proj-003',
        title: 'LinkedIn Thought Leadership',
        channel: Channel.LINKEDIN,
        content_type: 'CREATIVE_ONLY',
        current_stage: WorkflowStage.SCRIPT_REVIEW_L1,
        assigned_to_role: Role.CMO,
        status: TaskStatus.WAITING_APPROVAL,
        priority: 'NORMAL',
        due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        data: {
            script_content: 'The future of digital marketing in 2025...',
        },
        history: []
    },
    {
        id: 'proj-004',
        title: 'Instagram Story - Behind the Scenes',
        channel: Channel.INSTAGRAM,
        content_type: 'VIDEO',
        current_stage: WorkflowStage.VIDEO_EDITING,
        assigned_to_role: Role.EDITOR,
        status: TaskStatus.IN_PROGRESS,
        priority: 'NORMAL',
        due_date: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        data: {
            script_content: 'A day in the life at ApplyWizz office',
        },
        video_link: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
        history: []
    },
    {
        id: 'proj-005',
        title: 'YouTube Customer Testimonial',
        channel: Channel.YOUTUBE,
        content_type: 'VIDEO',
        current_stage: WorkflowStage.FINAL_REVIEW_CEO,
        assigned_to_role: Role.CEO,
        status: TaskStatus.WAITING_APPROVAL,
        priority: 'HIGH',
        due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
        data: {
            script_content: 'Customer shares success story with our product',
        },
        edited_video_link: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_2mb.mp4',
        thumbnail_link: 'https://via.placeholder.com/1920x1080/F38181/FFFFFF?text=Testimonial',
        history: []
    },
    {
        id: 'proj-006',
        title: 'Instagram Creative - Product Features',
        channel: Channel.INSTAGRAM,
        content_type: 'CREATIVE_ONLY',
        current_stage: WorkflowStage.CREATIVE_DESIGN,
        assigned_to_role: Role.DESIGNER,
        status: TaskStatus.TODO,
        priority: 'NORMAL',
        due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        data: {
            brief: 'Create product feature carousel'
        },
        history: []
    },
    {
        id: 'proj-007',
        title: 'LinkedIn Post - Company Update',
        channel: Channel.LINKEDIN,
        content_type: 'CREATIVE_ONLY',
        current_stage: WorkflowStage.OPS_SCHEDULING,
        assigned_to_role: Role.OPS,
        status: TaskStatus.TODO,
        priority: 'NORMAL',
        due_date: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        data: {
            script_content: 'Quarterly company update post',
        },
        creative_link: 'https://via.placeholder.com/1200x630/4ECDC4/FFFFFF?text=Company+Update',
        history: []
    },
    {
        id: 'proj-008',
        title: 'YouTube Completed Video',
        channel: Channel.YOUTUBE,
        content_type: 'VIDEO',
        current_stage: WorkflowStage.POSTED,
        assigned_to_role: Role.OPS,
        status: TaskStatus.DONE,
        priority: 'NORMAL',
        due_date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        data: {
            script_content: 'Published tutorial video',
            live_url: 'https://youtube.com/watch?v=demo123'
        },
        history: []
    }
];

export const MOCK_LOGS: SystemLog[] = [
    {
        id: 'log-001',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        user_id: 'user-admin-001',
        user_name: 'Admin User',
        user_role: Role.ADMIN,
        action: 'LOGIN',
        details: 'User Admin User logged in'
    },
    {
        id: 'log-002',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        user_id: 'user-writer-001',
        user_name: 'Writer Content',
        user_role: Role.WRITER,
        action: 'LOGIN',
        details: 'User Writer Content logged in'
    },
    {
        id: 'log-003',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        user_id: 'user-admin-001',
        user_name: 'Admin User',
        user_role: Role.ADMIN,
        action: 'USER_CREATED',
        details: 'User Observer View created with role OBSERVER'
    },
    {
        id: 'log-004',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        user_id: 'user-writer-001',
        user_name: 'Writer Content',
        user_role: Role.WRITER,
        action: 'PROJECT_CREATED',
        details: 'Project "Instagram Story - Behind the Scenes" created'
    },
    {
        id: 'log-005',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        user_id: 'user-editor-001',
        user_name: 'Editor Video',
        user_role: Role.EDITOR,
        action: 'PROJECT_UPDATED',
        details: 'Project status updated to IN_PROGRESS'
    }
];

// Helper to get password for a user (only for mock auth)
export const getUserPassword = (email: string): string | undefined => {
    return MOCK_PASSWORDS[email];
};
