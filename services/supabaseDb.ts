import { supabase, supabaseAdmin } from '../src/integrations/supabase/client';
import {
    User,
    Project,
    WorkflowStage,
    Role,
    TaskStatus,
    Channel,
    ContentType,
    Priority,
    UserStatus
} from '../types';

import { Notification } from '../types';
import { getTimestampUpdate } from './workflowUtils';

console.log('🔍 Initializing supabaseDb service');

// ============================================================================
// AUTHENTICATION
// ============================================================================

export const auth = {
    // Sign in with email/password
    async signIn(email: string, password: string) {
        console.log('🔐 Attempting login for:', email);

        try {
            // Pre-login signOut to ensure clean state (safe to ignore errors)
            try {
                await supabase.auth.signOut();
            } catch (signOutErr) {
                console.warn('Pre-login signOut failed (safe to ignore if no session):', signOutErr);
            }

            // Real authentication using Supabase
            console.log('Login: calling signInWithPassword...');
            const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

            if (signInError) {
                throw new Error(signInError.message);
            }

            if (!user) {
                throw new Error('Login failed - no user returned');
            }

            // Get full user details
            console.log('Login: fetching user profile...');
            const userData = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (userData.error) {
                throw new Error(`User profile fetch failed: ${userData.error.message}`);
            }

            if (!userData.data) {
                throw new Error('User profile not found in database');
            }

            currentUserCache = userData.data as User;
            console.log('User logged in and cached:', currentUserCache.full_name);

            // Update last login
            try {
                await supabase
                    .from('users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('email', email);
            } catch (updateError) {
                console.warn('Failed to update last login timestamp:', updateError);
            }

            return userData.data as User;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    // Sign out
    async signOut() {
        try {
            // Sign out with local scope first
            console.log('Signing out with local scope...');
            const { error: localError } = await supabase.auth.signOut({ scope: 'local' });

            if (localError) {
                console.warn('Local sign out failed:', localError);
            } else {
                console.log('Local sign out successful');
            }

            // Then sign out with global scope
            console.log('Signing out with global scope...');
            const { error: globalError } = await supabase.auth.signOut({ scope: 'global' });

            if (globalError) {
                console.warn('Global sign out failed:', globalError);
            } else {
                console.log('Global sign out successful');
            }

            // Return any error that occurred
            const finalError = localError || globalError;
            if (finalError) {
                throw finalError;
            }

            return { error: null };
        } catch (error) {
            console.error('Sign out error:', error);
            return { error };
        }
    },

    // Get current session user
    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },

    // Send password reset email
    async resetPassword(email: string) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/set-password`,
        });

        if (error) throw error;
    },

    // Update password
    async updatePassword(newPassword: string) {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;
    },

    // Invite user by email (Admin only)
    async inviteUser(email: string, userData: { full_name: string; role: Role; phone?: string }) {
        console.log('inviteUser called with:', email, userData);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zxnevoulicmapqmniaos.supabase.co';

        // --- STRATEGY 1: Local Admin Client (Dev Mode / w Service Key) ---
        if (supabaseAdmin) {
            console.log('⚡ Using Local Service Role Key for Invitation');

            try {
                // 1. Invite User via Email
                // This sends the magic link pointing to /set-password
                const inviteData: any = {
                    redirectTo: `${window.location.origin}/set-password`,
                    data: {
                        full_name: userData.full_name,
                        role: userData.role,
                        phone: userData.phone
                    }
                };

                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
                    email,
                    inviteData
                );

                if (authError) {
                    console.error('Auth invite failed:', authError);
                    throw new Error(`Failed to send invitation: ${authError.message}`);
                }

                // Safe ID Extraction
                const invitedUserId =
                    authData?.user?.id ||
                    (authData as any)?.id ||
                    (authData as any)?.user_id ||
                    null;

                if (!invitedUserId) {
                    console.error('❌ Invite succeeded but no User ID returned:', authData);
                    throw new Error('Invitation sent but User ID missing from response.');
                }

                console.log('✅ Invitation sent, User ID:', invitedUserId);

                // 2. Create Public User Record
                // Use admin client for DB upsert to bypass RLS issues and handle potential triggers or existing records
                console.log('🔄 Upserting to public.users...');

                // Prepare user record data
                const userRecordData: any = {
                    id: invitedUserId,
                    email,
                    full_name: userData.full_name,
                    role: userData.role,
                    phone: userData.phone,
                    status: UserStatus.ACTIVE,
                    last_login: null
                };

                const { data: publicUser, error: dbError } = await supabaseAdmin
                    .from('users')
                    .upsert([userRecordData], { onConflict: 'id' })
                    .select()
                    .single();

                if (dbError) {
                    console.error('❌ Public DB upsert failed:', dbError);
                    // Critical: If DB upsert fails AND it wasn't swallowed by upstream, throw.
                    throw new Error(`Failed to create database record: ${dbError.message}`);
                }

                console.log('✅ User successfully created/updated in public.users:', publicUser);

                return publicUser;

            } catch (error: any) {
                console.error('Local admin invitation failed:', error);
                throw error; // Propagate error, DO NOT create ghost user
            }
        }

        // --- STRATEGY 2: Edge Function (Production) ---
        console.log('⚠️ No Service Key found, trying Edge Function...');

        try {
            // Check session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No active session found to authorize Edge Function');

            // Prepare the payload
            const payload: any = {
                email,
                userData: {
                    full_name: userData.full_name,
                    role: userData.role,
                    phone: userData.phone
                },
                redirectTo: `${window.location.origin}/set-password`
            };

            const response = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Edge Function Failed: ${text}`);
            }
            return await response.json();

        } catch (err: any) {
            console.error('Edge function strategy failed:', err);
            // DO NOT create ghost user fallback
            throw new Error(`Invitation failed: ${err.message}`);
        }
    },

    // Delete user (Admin only) - Calls secure Edge Function
    async deleteUser(userId: string) {
        console.log('deleteUser called for:', userId);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zxnevoulicmapqmniaos.supabase.co';

        // 1. Attempt to delete from Supabase Auth via Edge Function
        // We do this first because optimal flow is Auth Delete -> Cascade to Public
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                console.log('Calling delete-user Edge Function...');
                const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.warn('Edge Function returned error (continuing to DB delete):', errorText);
                } else {
                    console.log('Edge Function success');
                }
            } else {
                console.warn('No active session, skipping Edge Function (Auth deletion)');
            }
        } catch (authError) {
            console.warn('Error calling Edge Function (continuing to DB delete):', authError);
        }

        // 2. FORCE delete from public.users
        // This is critical for the UI to update. 
        // If Auth Delete cascaded, this will throw "0 rows affected", which we catch and ignore.
        // If Auth Delete failed or didn't cascade, this will delete the record and return success.
        console.log('Executing direct database deletion...');
        try {
            await users.delete(userId);
            console.log('Database deletion successful');
        } catch (dbError: any) {
            // If the error is "0 rows affected", it means the user is already gone (likely cascaded)
            if (dbError.message && dbError.message.includes('0 rows affected')) {
                console.log('User already removed from database (likely cascaded from Auth delete)');
                return { message: 'User deleted (cascaded)' };
            }
            // Real DB error? Throw it.
            console.error('Database deletion failed:', dbError);
            throw dbError;
        }

        return { message: 'User deleted' };
    }
};

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export const users = {
    // Get all users
    async getAll() {
        console.log("📡 DB: Fetching all users...");
        const { data, error } = await supabase
            .from('users')
            .select(`
                id,
                email,
                full_name,
                role,
                avatar_url,
                status,
                phone,
                last_login,
                created_at,
                updated_at
            `)
            .order('created_at', { ascending: false });

        console.log('Raw response from Supabase:', { data, error });

        if (error) {
            console.error("❌ DB: Fetch users failed:", error);
            throw error;
        }

        console.log(`✅ DB: Found ${data?.length || 0} users`);
        console.log('Users data:', data);
        return data as User[];
    },

    // Get user by ID
    async getById(id: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as User;
    },

    // Get user by email
    async getByEmail(email: string) {
        console.log('🔍 getByEmail: Fetching user for:', email);

        const { data, error } = await supabase
            .from('users')
            .select(`
                id,
                email,
                full_name,
                role,
                avatar_url,
                status,
                phone,
                last_login,
                created_at,
                updated_at
            `)
            .eq('email', email);

        if (error) {
            console.error('❌ getByEmail: Database error:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            console.warn('⚠️  getByEmail: No user found for email:', email);
            throw new Error(`No user found with email: ${email}`);
        }

        if (data.length > 1) {
            console.error(`🔴 getByEmail: DUPLICATE USERS DETECTED for ${email}! Found ${data.length} users.`);
            console.error('🔴 User IDs:', data.map(u => u.id));
            console.warn('⚠️  getByEmail: Returning first match, but you should clean up duplicates!');
        }

        console.log('✅ getByEmail: User found:', data[0].full_name);
        return data[0] as User;
    },

    // Create new user
    async create(userData: {
        email: string;
        full_name: string;
        role: Role;
        phone?: string;
        status?: UserStatus;
    }) {
        try {
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    email: userData.email,
                    full_name: userData.full_name,
                    role: userData.role,
                    phone: userData.phone,
                    status: userData.status || UserStatus.ACTIVE
                }])
                .select()
                .single();

            if (error) {
                console.error('Error creating user in database:', error);
                throw error;
            }

            // Log user creation
            try {
                await systemLogs.add({
                    actor_id: data.id,
                    actor_name: userData.full_name,
                    actor_role: userData.role,
                    action: 'USER_CREATED',
                    details: `User ${userData.full_name} created with role ${userData.role}`
                });
            } catch (logError) {
                console.warn('Failed to log user creation:', logError);
            }

            return data as User;
        } catch (error) {
            console.error('Failed to create user:', error);
            throw error;
        }
    },

    // Update user
    async update(id: string, updates: Partial<User>) {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log user update
        await systemLogs.add({
            actor_id: id,
            actor_name: data.full_name,
            actor_role: data.role,
            action: 'USER_UPDATED',
            details: `User ${data.full_name} updated`
        });

        return data as User;
    },

    // Update last login
    async updateLastLogin(id: string) {
        const { error } = await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    },

    // Get all sub-editors
    async getSubEditors() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'SUB_EDITOR')
            .eq('status', UserStatus.ACTIVE);

        if (error) {
            console.error('Error fetching sub-editors:', error);
            throw error;
        }

        return data as User[];
    },

    // Delete user (from both Auth and Database)
    async delete(id: string) {
        // Get user details for logging
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        // Delete from database first
        const { error: dbError, count } = await supabase
            .from('users')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (dbError) throw new Error(`Database deletion failed: ${dbError.message}`);

        if (count === 0) {
            console.warn(`⚠️ Delete operation returned 0 rows affected for ID: ${id}`);
            throw new Error('User could not be deleted from database. Verify RLS policies allow deletion.');
        }

        // Delete from Supabase Auth (requires admin access via Edge Function)
        //Note cannot delete from auth directly from client - would need an Edge Function
        // For now, just delete from database - auth user will remain but won't be able to login

        // Log user deletion
        if (user && currentUserCache) {
            await systemLogs.add({
                actor_id: currentUserCache.id,
                actor_name: currentUserCache.full_name,
                actor_role: currentUserCache.role,
                action: 'USER_DELETED',
                details: `User ${user.full_name} (${user.email}) was deleted by ${currentUserCache.full_name}`
            });
        }

        return true;
    }
};

// ============================================================================
// PROJECT MANAGEMENT
// ============================================================================
export const projects = {
    // Get all projects
    async getAll() {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Project[];
    },

    // 🔴 DASHBOARD PROJECTS (role-based inbox)
    async getForRole(role: Role) {
        console.log(`📥 Fetching projects for role: ${role}`);

        let query = supabase.from('projects').select(`
      *,
      workflow_history(*)
    `);

        // ✅ FIX: Filter by stage only, not assigned_to_role
        switch (role) {
            case Role.WRITER:
                // Writer inbox: SCRIPT, REJECTED, REWORK, WAITING_APPROVAL, MULTI_WRITER_APPROVAL
                query = query.or(
                    `current_stage.eq.${WorkflowStage.SCRIPT},status.eq.${TaskStatus.REJECTED},status.eq.${TaskStatus.REWORK},status.eq.${TaskStatus.WAITING_APPROVAL},current_stage.eq.${WorkflowStage.MULTI_WRITER_APPROVAL}`
                );
                break;

            case Role.CMO:
                // CMO inbox: SCRIPT_REVIEW_L1 and FINAL_REVIEW_CMO
                query = query.or(
                    `current_stage.eq.${WorkflowStage.SCRIPT_REVIEW_L1},current_stage.eq.${WorkflowStage.FINAL_REVIEW_CMO}`
                );
                break;

            case Role.CEO:
                // CEO inbox: SCRIPT_REVIEW_L2 and FINAL_REVIEW_CEO
                query = query.or(
                    `current_stage.eq.${WorkflowStage.SCRIPT_REVIEW_L2},current_stage.eq.${WorkflowStage.FINAL_REVIEW_CEO}`
                );
                break;

            case Role.CINE:
                // Cinematographer inbox: CINEMATOGRAPHY only
                query = query.eq('current_stage', WorkflowStage.CINEMATOGRAPHY);
                break;

            case Role.EDITOR:
                // Editor inbox: VIDEO_EDITING only
                query = query.eq('current_stage', WorkflowStage.VIDEO_EDITING);
                break;

            case Role.DESIGNER:
                // Designer inbox: THUMBNAIL, CREATIVE only
                query = query.or(
                    `current_stage.eq.${WorkflowStage.THUMBNAIL_DESIGN},current_stage.eq.${WorkflowStage.CREATIVE_DESIGN}`
                );
                break;

            case Role.SUB_EDITOR:
                // Sub-editor inbox: SUB_EDITOR_ASSIGNMENT and SUB_EDITOR_PROCESSING
                query = query.or(
                    `current_stage.eq.${WorkflowStage.SUB_EDITOR_ASSIGNMENT},current_stage.eq.${WorkflowStage.SUB_EDITOR_PROCESSING}`
                );
                break;

            case Role.OPS:
                // Ops inbox: include projects that have moved forward after CEO approval
                // These projects should be visible to Ops even if assigned to other roles
                query = query.in('current_stage', [
                    WorkflowStage.CINEMATOGRAPHY,
                    WorkflowStage.VIDEO_EDITING,
                    WorkflowStage.FINAL_REVIEW_CMO,
                    WorkflowStage.FINAL_REVIEW_CEO,
                    WorkflowStage.POST_WRITER_REVIEW, // Include post-writer review for parallel visibility
                    WorkflowStage.OPS_SCHEDULING,
                    WorkflowStage.POSTED
                ]);
                break;

            default:
                // For roles without specific inbox stages, return empty array
                return [];
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        // Process the data to ensure history is properly formatted
        const processedData = data.map((project: any) => ({
            ...project,
            history: project.workflow_history || []
        }));

        return processedData as Project[];
    },

    // 🟢 MY WORK (UNION-based)
    async getMyWork(user: User) {
        console.log(`📘 Fetching MY WORK for ${user.role} (${user.id})`);

        try {
            // ✅ FIX: Include all projects where user participated based on the My Work Visibility Persistence Rule
            // 1. Projects where user is actor in workflow_history
            const { data: historyData, error: historyError } = await supabase
                .from('workflow_history')
                .select(`
          project_id,
          timestamp,
          projects (*)
        `)
                .eq('actor_id', user.id);

            if (historyError) throw historyError;

            // 2. Projects assigned to the user by ID
            const { data: assignedByIdData, error: assignedByIdError } = await supabase
                .from('projects')
                .select('*')
                .eq('assigned_to_user_id', user.id)

            if (assignedByIdError) throw assignedByIdError;

            // 3. Projects assigned to the user's role
            const { data: assignedByRoleData, error: assignedByRoleError } = await supabase
                .from('projects')
                .select('*')
                .eq('assigned_to_role', user.role);

            if (assignedByRoleError) throw assignedByRoleError;

            // 4. Projects where user's role is in visible_to_roles
            const { data: visibleToRoleData, error: visibleToRoleError } = await supabase
                .from('projects')
                .select('*')
                .overlaps('visible_to_roles', [user.role]);

            if (visibleToRoleError) throw visibleToRoleError;

            // ✅ Merge all results and remove duplicates
            const projectMap = new Map<string, Project & { latest_activity?: Date }>();

            // Add history projects
            historyData.forEach((row: any) => {
                if (row.projects) {
                    const project = row.projects;
                    // Only set latest_activity if not already set or if this timestamp is newer
                    if (!projectMap.has(project.id) ||
                        !projectMap.get(project.id)?.latest_activity ||
                        new Date(row.timestamp) > new Date(projectMap.get(project.id)!.latest_activity!)) {
                        projectMap.set(project.id, {
                            ...project,
                            latest_activity: new Date(row.timestamp)
                        });
                    }
                }
            });

            // Add projects assigned to user by ID (may overwrite history entries if more recent)
            assignedByIdData.forEach((project: any) => {
                if (!projectMap.has(project.id) ||
                    !projectMap.get(project.id)?.latest_activity ||
                    new Date(project.updated_at) > new Date(projectMap.get(project.id)!.latest_activity!)) {
                    projectMap.set(project.id, {
                        ...project,
                        latest_activity: new Date(project.updated_at)
                    });
                }
            });

            // Add projects assigned to user's role (may overwrite previous entries if more recent)
            assignedByRoleData.forEach((project: any) => {
                if (!projectMap.has(project.id) ||
                    !projectMap.get(project.id)?.latest_activity ||
                    new Date(project.updated_at) > new Date(projectMap.get(project.id)!.latest_activity!)) {
                    projectMap.set(project.id, {
                        ...project,
                        latest_activity: new Date(project.updated_at)
                    });
                }
            });

            // Add projects where user's role is in visible_to_roles (may overwrite previous entries if more recent)
            visibleToRoleData.forEach((project: any) => {
                if (!projectMap.has(project.id) ||
                    !projectMap.get(project.id)?.latest_activity ||
                    new Date(project.updated_at) > new Date(projectMap.get(project.id)!.latest_activity!)) {
                    projectMap.set(project.id, {
                        ...project,
                        latest_activity: new Date(project.updated_at)
                    });
                }
            });

            // Convert to array and sort by latest activity
            let result = Array.from(projectMap.values())
                .sort((a, b) => {
                    const dateA = a.latest_activity ? new Date(a.latest_activity).getTime() : 0;
                    const dateB = b.latest_activity ? new Date(b.latest_activity).getTime() : 0;
                    return dateB - dateA; // Descending order (newest first)
                })
                // Remove the temporary latest_activity property
                .map(({ latest_activity, ...project }) => project);

            // Fetch workflow history for each project to include in the response
            const projectIds = result.map(p => p.id);
            if (projectIds.length > 0) {
                const { data: historyData, error: historyError } = await supabase
                    .from('workflow_history')
                    .select('*')
                    .in('project_id', projectIds)
                    .order('timestamp', { ascending: false });

                if (!historyError && historyData) {
                    // Group history by project_id
                    const historyMap = new Map<string, any[]>();
                    historyData.forEach(entry => {
                        if (!historyMap.has(entry.project_id)) {
                            historyMap.set(entry.project_id, []);
                        }
                        historyMap.get(entry.project_id)!.push(entry);
                    });

                    // Attach history to each project
                    result = result.map(project => ({
                        ...project,
                        history: historyMap.get(project.id) || []
                    }));
                }
            }

            console.log(`✅ MY WORK fetched ${result.length} projects for ${user.role}`);
            return result as Project[];
        } catch (error) {
            console.error('❌ Failed to fetch MY WORK:', error);
            throw error;
        }
    },

    // Get project by ID
    async getById(id: string) {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Fetch workflow history for this project
        const { data: historyData, error: historyError } = await supabase
            .from('workflow_history')
            .select('*')
            .eq('project_id', id)
            .order('timestamp', { ascending: false });

        if (historyError) {
            console.error('Failed to fetch workflow history:', historyError);
            // Return project without history if history fetch fails
            return {
                ...(data as Project),
                history: []
            };
        }

        return {
            ...(data as Project),
            history: historyData || []
        };
    },

    // Get all projects that are script projects (not pure idea projects)
    async getScriptProjects() {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .or('data->>source.neq.IDEA_PROJECT,data->>script_content.not.is.null')  // Projects where source is not IDEA_PROJECT OR script_content exists
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Project[];
    },

    // Get project by ID with history (alias for clarity)
    async getByIdWithHistory(id: string) {
        return this.getById(id);
    },

    // Create new project
    async create(projectData: {
        title: string;
        channel: Channel;
        content_type: ContentType;

        // ✅ ADD THESE
        current_stage?: WorkflowStage;
        status?: TaskStatus;

        assigned_to_role: Role;
        assigned_to_user_id?: string;
        priority?: Priority;
        due_date: string;
        data: any;

        // ✅ Creator fields
        created_by_user_id?: string | null;
        created_by_name?: string | null;
        writer_id?: string | null;
        writer_name?: string | null;
    }) {
        console.log('Creating project with data:', projectData);
        const { data, error } = await supabase
            .from('projects')
            .insert([{
                title: projectData.title,
                channel: projectData.channel,
                content_type: projectData.content_type,
                assigned_to_role: projectData.assigned_to_role,
                assigned_to_user_id: projectData.assigned_to_user_id ?? null,
                due_date: projectData.due_date,
                data: projectData.data,

                // Creator info
                created_by: projectData.created_by_user_id ?? null, // Populate legacy column
                created_by_user_id: projectData.created_by_user_id ?? null,
                created_by_name: projectData.created_by_name ?? null,
                writer_id: projectData.writer_id ?? null,
                writer_name: projectData.writer_name ?? null,

                // Use provided values or defaults if not provided
                current_stage: projectData.current_stage || WorkflowStage.SCRIPT,
                status: projectData.status || TaskStatus.TODO,
                priority: projectData.priority || 'NORMAL'
            }])
            .select()
            .single();

        if (error) {
            console.error('Failed to create project:', error);
            throw error;
        }

        console.log('Successfully created project with ID:', data.id);
        return data as Project;
    },

    // Update project
    async update(id: string, updates: Partial<Project>) {
        console.log('Updating project', id, 'with data:', updates);
        const { error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Failed to update project:', error);
            throw error;
        }

        // Fetch the updated project separately to avoid conflicting select parameters
        const { data, error: fetchDataError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchDataError) {
            console.error('Failed to fetch updated project:', fetchDataError);
            throw fetchDataError;
        }

        console.log('Project updated successfully:', data);
        return data as Project;
    },

    // Update project data (JSONB field)
    async updateData(id: string, dataUpdates: any) {
        console.log('Updating project data for', id, 'with updates:', dataUpdates);
        const project = await this.getById(id);
        const newData = { ...project.data, ...dataUpdates };

        const result = await this.update(id, { data: newData });
        console.log('Project data updated successfully:', result);
        return result;
    },

    // Update project with proper timestamp handling for editor/sub-editor
    async updateWithTimestamp(id: string, updates: Partial<Project>, action: string, role: Role) {
        console.log('Updating project with timestamp for', id, 'with updates:', updates, 'action:', action, 'role:', role);

        // Update the project
        const result = await this.update(id, updates);

        // Check if this update involves asset uploads that need timestamp updates
        const currentProject = await this.getById(id);

        if (currentProject) {
            let actionForTimestamp: string | null = null;
            let roleForTimestamp: Role | null = null;

            // Get the updated project data to check what actually changed
            const updatedProject = await this.getById(id);

            if (updatedProject) {
                // Check if edited_video_link was added (Editor or Sub-Editor upload)
                if (updatedProject.edited_video_link && currentProject.edited_video_link !== updatedProject.edited_video_link) {
                    actionForTimestamp = 'DIRECT_UPLOAD';
                    // Determine if this was uploaded by editor or sub-editor based on the assigned role
                    if (updatedProject.assigned_to_role === Role.SUB_EDITOR) {
                        roleForTimestamp = Role.SUB_EDITOR;
                        console.log('Detected Sub-Editor video upload - setting sub_editor_uploaded_at timestamp');
                    } else {
                        roleForTimestamp = Role.EDITOR;
                        console.log('Detected Editor video upload - setting editor_uploaded_at timestamp');
                    }
                }
                // Check if video_link was added (Cinematographer upload)
                else if (updatedProject.video_link && currentProject.video_link !== updatedProject.video_link) {
                    actionForTimestamp = 'DIRECT_UPLOAD';
                    roleForTimestamp = Role.CINE;
                    console.log('Detected Cine video upload - setting cine_uploaded_at timestamp');
                }
                // Check if thumbnail_link or creative_link was added (Designer upload)
                else if ((updatedProject.thumbnail_link && currentProject.thumbnail_link !== updatedProject.thumbnail_link) ||
                    (updatedProject.creative_link && currentProject.creative_link !== updatedProject.creative_link)) {
                    actionForTimestamp = 'DIRECT_UPLOAD';
                    roleForTimestamp = Role.DESIGNER;
                    console.log('Detected Designer asset upload - setting designer_uploaded_at timestamp');
                }
                // Check if delivery_date was set (Editor setting delivery date)
                else if (updatedProject.delivery_date && currentProject.delivery_date !== updatedProject.delivery_date) {
                    actionForTimestamp = 'SUBMITTED';
                    // Determine if delivery date was set by editor or sub-editor
                    if (updatedProject.assigned_to_role === Role.SUB_EDITOR) {
                        roleForTimestamp = Role.SUB_EDITOR;
                        console.log('Detected Sub-Editor set delivery date - setting sub_editor_upload timestamp');
                    } else {
                        roleForTimestamp = Role.EDITOR;
                        console.log('Detected Editor set delivery date - setting editor_upload timestamp');
                    }
                }
                // Check if shoot_date was set (Cinematographer setting shoot date)
                else if (updatedProject.shoot_date && currentProject.shoot_date !== updatedProject.shoot_date) {
                    actionForTimestamp = 'SUBMITTED';
                    roleForTimestamp = Role.CINE;
                    console.log('Detected Cine set shoot date - setting cine timestamp');
                }
            }

            if (actionForTimestamp && roleForTimestamp) {
                const timestampUpdates = getTimestampUpdate(actionForTimestamp, roleForTimestamp);
                if (Object.keys(timestampUpdates).length > 0) {
                    console.log('Updating timestamps:', timestampUpdates);
                    const { data, error } = await supabase
                        .from('projects')
                        .update(timestampUpdates)
                        .eq('id', id)
                        .select();

                    if (error) {
                        console.error('Failed to update timestamps:', error);
                    } else {
                        console.log('Successfully updated timestamps:', data);
                    }
                }
            }
        }

        return result;
    },

    // Delete project
    async delete(id: string) {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

// ============================================================================
// WORKFLOW MANAGEMENT
// ============================================================================

export const workflow = {
    // Record workflow history
    async recordAction(
        projectId: string,
        stage: WorkflowStage,
        userId: string,
        userName: string,
        action: string,
        comment?: string,
        scriptContent?: string,
        fromRole?: string,
        toRole?: string,
        actorRole?: string,
        metadata: any = {}
    ) {
        // Map frontend action values to strictly allowed database actions
        const actionMap: Record<string, string> = {
            'CREATED': 'CREATED',
            'SUBMITTED': 'SUBMITTED',
            'APPROVED': 'APPROVED',
            'REWORK': 'REWORK',
            'REWORK_VIDEO_SUBMITTED': 'REWORK_VIDEO_SUBMITTED',
            'REJECTED': 'REJECTED',
            'PUBLISHED': 'PUBLISHED'
        };

        // Use ONLY the strict actions. Default to SUBMITTED if not found.
        const dbAction = actionMap[action] || 'SUBMITTED';

        // Log the data we're about to insert for debugging
        console.log('Recording workflow history with data:', {
            project_id: projectId,
            stage: stage,
            actor_id: userId,
            actor_name: userName,
            action: dbAction,
            comment: comment || '',
            script_content: scriptContent || '',
            from_role: fromRole,
            to_role: toRole,
            actor_role: actorRole,
            metadata: metadata
        });

        const { error } = await supabase
            .from('workflow_history')
            .insert({
                project_id: projectId,
                stage: stage,
                actor_id: userId,
                actor_name: userName,
                action: dbAction,
                comment: comment || '',
                script_content: scriptContent || null,
                from_role: fromRole,
                to_role: toRole,
                actor_role: actorRole,
                metadata: metadata
            });

        if (error) {
            console.error('Failed to record workflow history:', error);
            console.error('Data that failed to insert:', {
                project_id: projectId,
                stage: stage,
                actor_id: userId,
                actor_name: userName,
                action: dbAction,
                comment: comment || '',
                script_content: scriptContent || null,
                from_role: fromRole,
                to_role: toRole,
                actor_role: actorRole,
                metadata: metadata
            });
            // Log more detailed error information
            console.error('Full error details:', JSON.stringify(error, null, 2));

            // Try to get more specific error information
            if (error.message) {
                console.error('Error message:', error.message);
            }
            if (error.details) {
                console.error('Error details:', error.details);
            }
            if (error.hint) {
                console.error('Error hint:', error.hint);
            }

            throw error;
        }

        // Update the appropriate timestamp based on the action
        const project = await projects.getById(projectId);
        if (project) {
            const timestampUpdates = getTimestampUpdate(action, project.assigned_to_role);
            if (Object.keys(timestampUpdates).length > 0) {
                await supabase
                    .from('projects')
                    .update(timestampUpdates)
                    .eq('id', projectId);
            }
        }
    },

    // Submit project for review
    async submitForReview(
        projectId: string,
        userId: string,
        userName: string,
        nextStage: WorkflowStage,
        nextRole: Role,
        comment?: string
    ) {
        // First get the current project to know its current stage
        const { data: currentProject, error: fetchError } = await supabase
            .from('projects')
            .select('current_stage')
            .eq('id', projectId)
            .single();

        if (fetchError) {
            console.error('Failed to fetch current project:', fetchError);
            throw fetchError;
        }

        // Update project
        const { error: updateError } = await supabase
            .from('projects')
            .update({
                current_stage: nextStage,
                assigned_to_role: nextRole,
                status: TaskStatus.WAITING_APPROVAL
            })
            .eq('id', projectId);

        // Fetch the updated project separately to avoid conflicting select parameters
        const { data: updateData, error: fetchDataError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (updateError) {
            console.error('Failed to update project:', updateError);
            throw updateError;
        }

        if (fetchDataError) {
            console.error('Failed to fetch updated project:', fetchDataError);
            throw fetchDataError;
        }

        if (!updateData) {
            throw new Error('Project not found or no rows updated');
        }

        // Use the updated data
        const data = updateData;

        // Add workflow history
        const { error: historyError } = await supabase
            .from('workflow_history')
            .insert({
                project_id: projectId,
                stage: nextStage,
                actor_id: userId,
                actor_name: userName,
                action: 'SUBMITTED',
                comment: comment || 'Submitted for review'
            });

        if (historyError) {
            console.error('Failed to add workflow history:', historyError);
            throw historyError;
        }

        // Update the appropriate timestamp based on the action
        const timestampUpdates = getTimestampUpdate('SUBMITTED', Role.WRITER); // Assuming writer is submitting
        if (Object.keys(timestampUpdates).length > 0) {
            await supabase
                .from('projects')
                .update(timestampUpdates)
                .eq('id', projectId);
        }

        // Find users with the next role to notify
        const { data: nextRoleUsers } = await supabase
            .from('users')
            .select('id')
            .eq('role', nextRole)
            .eq('status', 'ACTIVE');

        if (nextRoleUsers && nextRoleUsers.length > 0) {
            // Send notification to all users with the next role
            for (const nextRoleUser of nextRoleUsers) {
                try {
                    const dbWithNotifications = db as any;
                    await dbWithNotifications.notifications.create(
                        nextRoleUser.id,
                        projectId,
                        'ASSET_UPLOADED',
                        'New Project Available',
                        `${userName} has submitted a project for review: ${data.title}. Please review.`
                    );
                } catch (notificationError) {
                    console.error('Failed to send notification:', notificationError);
                    // Continue with the process even if notification fails
                }
            }
        }

        return data;
    },

    // Get the count of writers who have approved
    async getApprovedWritersCount(projectId: string): Promise<number> {
        // Get all approvals for this project in MULTI_WRITER_APPROVAL stage
        const { data: approvals, error: approvalsError } = await supabase
            .from('workflow_history')
            .select('actor_id')
            .eq('project_id', projectId)
            .eq('stage', WorkflowStage.MULTI_WRITER_APPROVAL)
            .eq('action', 'APPROVED');

        if (approvalsError) {
            console.error('Error fetching approvals:', approvalsError);
            return 0;
        }

        if (!approvals) {
            return 0;
        }

        // Get all active writers to filter the approvals
        const { data: writerUsers, error: writerError } = await supabase
            .from('users')
            .select('id')
            .eq('role', Role.WRITER)
            .eq('status', 'ACTIVE');

        if (writerError) {
            console.error('Error fetching writer users:', writerError);
            // If we can't fetch writers, return 0 to be safe
            return 0;
        }

        if (!writerUsers) {
            return 0;
        }

        // Get the IDs of active writers
        const writerIds = new Set(writerUsers.map(writer => writer.id));

        // Filter approvals to only include those from active writers
        const approvedWriterIds = new Set(approvals.filter(approval =>
            writerIds.has(approval.actor_id)
        ).map(approval => approval.actor_id));

        return approvedWriterIds.size;
    },

    // Check if all required writers have approved
    async checkAllWritersApproved(projectId: string): Promise<boolean> {
        console.log('🔍 DEBUG: Checking if all writers approved for project:', projectId);

        // Get all users with the writer role
        const { data: writerUsers, error: writerError } = await supabase
            .from('users')
            .select('id')
            .eq('role', Role.WRITER)
            .eq('status', 'ACTIVE');

        if (writerError) {
            console.error('❌ Error fetching writer users:', writerError);
            return false;
        }

        if (!writerUsers || writerUsers.length === 0) {
            console.log('⚠️ No writers found');
            return false;
        }

        console.log('📋 Found writers:', writerUsers.map(w => w.id));

        // Get project to check current stage
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('current_stage')
            .eq('id', projectId)
            .single();

        if (projectError) {
            console.error('❌ Error fetching project:', projectError);
            return false;
        }

        console.log('📊 Project current stage:', project.current_stage);

        // Only check for MULTI_WRITER_APPROVAL stage
        if (project.current_stage !== WorkflowStage.MULTI_WRITER_APPROVAL) {
            console.log('🚫 Not in MULTI_WRITER_APPROVAL stage');
            return false;
        }

        // Get all approvals for this project in MULTI_WRITER_APPROVAL stage
        const { data: approvals, error: approvalsError } = await supabase
            .from('workflow_history')
            .select('actor_id')
            .eq('project_id', projectId)
            .eq('stage', WorkflowStage.MULTI_WRITER_APPROVAL)
            .eq('action', 'APPROVED');

        if (approvalsError) {
            console.error('❌ Error fetching approvals:', approvalsError);
            return false;
        }

        console.log('✅ Approvals found:', approvals || 'None');

        if (!approvals) {
            console.log('🚫 No approvals found');
            return false;
        }

        // Get the IDs of active writers
        const writerIds = new Set(writerUsers.map(writer => writer.id));

        // Filter approvals to only include those from active writers
        const approvedWriterIds = new Set(approvals.filter(approval =>
            writerIds.has(approval.actor_id)
        ).map(approval => approval.actor_id));

        console.log('✅ Approved writer IDs:', Array.from(approvedWriterIds));

        // Check if all writers have approved
        const allWritersHaveApproved = writerUsers.every(writer =>
            approvedWriterIds.has(writer.id)
        );

        console.log('🎯 All writers approved:', allWritersHaveApproved);
        console.log('📊 Comparison:', {
            totalWriters: writerUsers.length,
            approvedWriters: approvedWriterIds.size,
            writerIds: writerUsers.map(w => w.id),
            approvedIds: Array.from(approvedWriterIds)
        });

        return allWritersHaveApproved;
    },

    // Approve project
    async approve(
        projectId: string,
        userId: string,
        userName: string,
        userRole: Role,
        nextStage: WorkflowStage,
        nextRole: Role,
        comment?: string,
        actionOverride?: string,
        fromRoleOverride?: string
    ) {
        // First get the current project to preserve important fields
        // First get the current project to preserve important fields
        let rawProject;
        try {
            rawProject = await projects.getById(projectId);
        } catch (error) {
            console.error('Failed to fetch current project for approval:', error);
            throw error;
        }

        // Create a partial project object with only the properties we need
        const currentProject = {
            id: rawProject.id,
            current_stage: rawProject.current_stage,
            created_by_user_id: rawProject.created_by_user_id,
            created_by_name: rawProject.created_by_name,
            writer_id: rawProject.writer_id,
            writer_name: rawProject.writer_name,
            assigned_to_user_id: rawProject.assigned_to_user_id,
            // Fill in other required fields with defaults to satisfy Project type
            title: rawProject.title,
            channel: rawProject.channel,
            content_type: rawProject.content_type,
            assigned_to_role: rawProject.assigned_to_role,
            status: rawProject.status,
            priority: rawProject.priority,
            due_date: rawProject.due_date,
            created_by: rawProject.created_by,
            created_at: rawProject.created_at,
            data: rawProject.data,
            history: [], // We don't need history here
            // Optional fields - set to undefined or appropriate defaults
            writer_submitted_at: rawProject.writer_submitted_at,
            cmo_approved_at: rawProject.cmo_approved_at,
            cmo_rework_at: rawProject.cmo_rework_at,
            ceo_approved_at: rawProject.ceo_approved_at,
            ceo_rework_at: rawProject.ceo_rework_at,
            cine_uploaded_at: rawProject.cine_uploaded_at,
            editor_uploaded_at: rawProject.editor_uploaded_at,
            sub_editor_uploaded_at: rawProject.sub_editor_uploaded_at,
            designer_uploaded_at: rawProject.designer_uploaded_at,
            shoot_date: rawProject.shoot_date,
            delivery_date: rawProject.delivery_date,
            post_scheduled_date: rawProject.post_scheduled_date,
            video_link: rawProject.video_link,
            edited_video_link: rawProject.edited_video_link,
            thumbnail_link: rawProject.thumbnail_link,
            creative_link: rawProject.creative_link,
            first_review_opened_at: rawProject.first_review_opened_at,
            first_review_opened_by_role: rawProject.first_review_opened_by_role,
        } as Project;

        // Special handling for MULTI_WRITER_APPROVAL stage
        if (currentProject?.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL) {
            console.log('🔍 DEBUG: Handling MULTI_WRITER_APPROVAL in workflow.approve');
            console.log('📊 Current project stage:', currentProject.current_stage);
            console.log('👤 Current user ID:', userId);
            console.log('🎯 Next stage/role parameters:', { nextStage, nextRole });

            // Validate that only writers can approve in MULTI_WRITER_APPROVAL stage
            if (userRole !== Role.WRITER) {
                console.log(`⚠️ User with role ${userRole} attempted to approve in MULTI_WRITER_APPROVAL stage. Only writers can approve here.`);
                // Instead of recording as APPROVED, we should record the actual action that was taken
                // This handles cases where non-writers (like editors uploading videos) trigger advanceWorkflow

                // Determine the appropriate action type based on the comment
                let actionType = 'SUBMITTED'; // Default action
                if (comment.toLowerCase().includes('uploaded')) {
                    if (comment.toLowerCase().includes('video')) {
                        actionType = 'REWORK_VIDEO_SUBMITTED';
                    } else if (comment.toLowerCase().includes('edit')) {
                        actionType = 'REWORK_EDIT_SUBMITTED';
                    } else {
                        actionType = 'SUBMITTED';
                    }
                }

                // Record the actual action taken by the non-writer
                await this.recordAction(
                    projectId,
                    currentProject.current_stage as WorkflowStage,
                    userId,
                    userName,
                    actionType,
                    comment || `${userName} performed action in ${currentProject.current_stage}`,
                    undefined,
                    currentProject.assigned_to_role as Role, // fromRole
                    nextRole, // toRole
                    userRole // actorRole
                );

                // Update project timestamp
                const { error: updateError } = await supabase
                    .from('projects')
                    .update({
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', projectId);

                if (updateError) {
                    console.error('❌ Failed to update project timestamp:', updateError);
                    throw updateError;
                }

                return await projects.getById(projectId);
            }

            // First, check if this writer has already approved this project in the MULTI_WRITER_APPROVAL stage
            const { data: existingApproval, error: existingError } = await supabase
                .from('workflow_history')
                .select('id')
                .eq('project_id', projectId)
                .eq('stage', WorkflowStage.MULTI_WRITER_APPROVAL)
                .eq('actor_id', userId)
                .eq('action', 'APPROVED')
                .maybeSingle();

            if (existingApproval) {
                console.log('⚠️ Writer has already approved this project in MULTI_WRITER_APPROVAL stage');
                return await projects.getById(projectId);
            }

            // Record the approval for this specific writer
            await this.recordAction(
                projectId,
                WorkflowStage.MULTI_WRITER_APPROVAL,
                userId,
                userName,
                'APPROVED',
                comment || `${userName} approved the project`,
                undefined,
                Role.WRITER, // fromRole
                Role.WRITER, // toRole (indicates individual approval)
                Role.WRITER // actorRole
            );
            console.log('✅ Successfully recorded individual writer approval:', userId);

            // Fetch progress data to decide if we should advance
            const { data: activeWriters } = await supabase
                .from('users')
                .select('id')
                .eq('role', Role.WRITER)
                .eq('status', 'ACTIVE');

            const totalWritersRequired = activeWriters?.length || 0;
            const approvedCount = await this.getApprovedWritersCount(projectId);

            console.log(`🎯 Approval Progress: ${approvedCount}/${totalWritersRequired}`);

            if (totalWritersRequired > 0 && approvedCount >= totalWritersRequired) {
                console.log('🚀 All writers have approved, advancing to POST_WRITER_REVIEW stage');

                // Update project to move to POST_WRITER_REVIEW stage
                const updateData: any = {
                    current_stage: WorkflowStage.POST_WRITER_REVIEW,
                    assigned_to_role: Role.CMO,
                    assigned_to_user_id: null,
                    status: TaskStatus.WAITING_APPROVAL,
                    visible_to_roles: ['CMO', 'OPS'],
                    updated_at: new Date().toISOString()
                };

                const { error: updateError } = await supabase
                    .from('projects')
                    .update(updateData)
                    .eq('id', projectId);

                if (updateError) {
                    console.error('❌ Failed to update project to CMO stage:', updateError);
                    throw updateError;
                }

                // Record the final TRANSITION action for CMO - this triggers the email to CMO
                await this.recordAction(
                    projectId,
                    WorkflowStage.MULTI_WRITER_APPROVAL,
                    userId,
                    userName,
                    'SUBMITTED', // Using SUBMITTED for the arrival notification
                    'All writers have approved - Project advanced to post-writer review stage.',
                    undefined,
                    Role.WRITER, // fromRole
                    Role.CMO,    // toRole
                    Role.WRITER  // actorRole
                );

                // Record the final TRANSITION action for OPS - this triggers the email to OPS
                await this.recordAction(
                    projectId,
                    WorkflowStage.MULTI_WRITER_APPROVAL,
                    userId,
                    userName,
                    'SUBMITTED', // Using SUBMITTED for the arrival notification
                    'All writers have approved - Project advanced to post-writer review stage.',
                    undefined,
                    Role.WRITER, // fromRole
                    Role.OPS,    // toRole
                    Role.WRITER  // actorRole
                );

                console.log('✅ Workflow successfully transitioned to POST_WRITER_REVIEW stage.');
                return await projects.getById(projectId);
            } else {
                console.log('⏳ Approval incomplete. Staying in MULTI_WRITER_APPROVAL.');
                await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId);
                return await projects.getById(projectId);
            }
        } else { // Normal approval flow for other stages
            // Update project
            const projectUpdateData: any = {
                current_stage: nextStage,
                // Preserve creator information
                created_by_user_id: currentProject?.created_by_user_id || null,
                created_by_name: currentProject?.created_by_name || null,
                writer_id: currentProject?.writer_id || null,
                writer_name: currentProject?.writer_name || null,
                // Preserve assigned user ID if it exists
                assigned_to_user_id: currentProject?.assigned_to_user_id || null
            };

            // Special handling for FINAL_REVIEW_CMO stage
            if (nextStage === WorkflowStage.FINAL_REVIEW_CMO) {
                projectUpdateData.assigned_to_role = Role.CMO; // Assign to CMO
                projectUpdateData.status = TaskStatus.WAITING_APPROVAL; // Set to WAITING_APPROVAL status
                projectUpdateData.visible_to_roles = ['CMO', 'OPS']; // Make visible to CMO and OPS
            } else if (nextStage === WorkflowStage.WRITER_VIDEO_APPROVAL) {
                // When sending to writer video approval, make visible to writer and ops
                projectUpdateData.assigned_to_role = Role.WRITER; // Assign to writer
                projectUpdateData.status = TaskStatus.WAITING_APPROVAL; // Set to WAITING_APPROVAL status
                projectUpdateData.visible_to_roles = ['WRITER', 'OPS']; // Make visible to writer and ops
            } else if (nextStage === WorkflowStage.POST_WRITER_REVIEW) {
                // When sending to post-writer review, make visible to CMO and OPS in parallel
                projectUpdateData.assigned_to_role = Role.CMO; // Primary assignee is CMO
                projectUpdateData.status = TaskStatus.WAITING_APPROVAL; // Set to WAITING_APPROVAL status
                projectUpdateData.visible_to_roles = ['CMO', 'OPS']; // Make visible to both CMO and OPS
            } else {
                projectUpdateData.assigned_to_role = nextRole;
                projectUpdateData.status = TaskStatus.WAITING_APPROVAL;
            }

            const { error: updateError } = await supabase
                .from('projects')
                .update(projectUpdateData)
                .eq('id', projectId);

            // Fetch the updated project separately to avoid conflicting select parameters
            const { data: updateData, error: fetchDataError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (updateError) {
                console.error('Failed to update project:', updateError);
                throw updateError;
            }

            if (fetchDataError) {
                console.error('Failed to fetch updated project:', fetchDataError);
                throw fetchDataError;
            }

            if (!updateData) {
                throw new Error('Project not found or no rows updated');
            }

            // Use the updated data
            const data = updateData;

            // Use the current project stage as the stage for workflow history
            // This represents the stage where the action occurred, not where the project is going
            const historyStage = currentProject.current_stage;

            // Add workflow history
            console.log('Inserting workflow history:', {
                project_id: projectId,
                stage: historyStage,
                actor_id: userId,
                actor_name: userName,
                action: 'APPROVED',
                comment: comment || `Approved by ${userRole}`
            });

            // Record the approval in workflow history
            await this.recordAction(
                projectId,
                historyStage,
                userId,
                userName,
                'APPROVED',
                comment || `Approved by ${userRole}`,
                undefined,
                userRole, // fromRole
                nextRole, // toRole
                userRole // actorRole
            );

            // Update the appropriate timestamp based on the action
            const timestampUpdates = getTimestampUpdate('APPROVED', userRole);
            if (Object.keys(timestampUpdates).length > 0) {
                await supabase
                    .from('projects')
                    .update(timestampUpdates)
                    .eq('id', projectId);
            }

            // Find users with the next role to notify
            const { data: nextRoleUsers } = await supabase
                .from('users')
                .select('id')
                .eq('role', nextRole)
                .eq('status', 'ACTIVE');

            if (nextRoleUsers && nextRoleUsers.length > 0) {
                // Send notification to all users with the next role
                for (const nextRoleUser of nextRoleUsers) {
                    try {
                        const dbWithNotifications = db as any;
                        await dbWithNotifications.notifications.create(
                            nextRoleUser.id,
                            projectId,
                            'ASSET_UPLOADED',
                            'New Project Available',
                            `${userName} has approved a project: ${data.title}. Please review and take the next action.`
                        );
                    } catch (notificationError) {
                        console.error('Failed to send notification:', notificationError);
                        // Continue with the process even if notification fails
                    }
                }
            }

            return data;
        }
    },

    // Reject project
    async reject(
        projectId: string,
        userId: string,
        userName: string,
        userRole: Role,
        returnToStage: WorkflowStage,
        returnToRole: Role,
        comment: string,
        isRework: boolean = false  // Added parameter to distinguish between rework and reject
    ) {
        // First get the current project to preserve important fields
        const { data: currentProject, error: fetchError } = await supabase
            .from('projects')
            .select('current_stage, data, created_by_user_id, created_by_name, writer_id, writer_name, assigned_to_user_id')
            .eq('id', projectId)
            .single();

        if (fetchError) {
            console.error('Failed to fetch current project for reject:', fetchError);
            throw fetchError;
        }

        // Check if the project has script content and was originally an idea project
        let updatedProjectData = currentProject?.data || {};
        if (typeof updatedProjectData === 'string') {
            try {
                updatedProjectData = JSON.parse(updatedProjectData);
            } catch {
                updatedProjectData = {};
            }
        }

        // If the project has script content but still has IDEA_PROJECT source, remove the source
        // This ensures that idea-to-script projects are treated as script projects even when in rework
        if (updatedProjectData.script_content && updatedProjectData.source === 'IDEA_PROJECT') {
            const updatedDataCopy = { ...updatedProjectData };
            delete updatedDataCopy.source;

            // Update the project data to remove the IDEA_PROJECT source
            const { error: dataUpdateError } = await supabase
                .from('projects')
                .update({ data: updatedDataCopy })
                .eq('id', projectId);

            if (dataUpdateError) {
                console.error('Failed to update project data during reject:', dataUpdateError);
            }
        }

        // Store rework initiator information in project metadata for routing back after completion
        const updatedData = {
            ...updatedProjectData,
            rework_initiator_role: isRework ? userRole : undefined,
            rework_initiator_stage: isRework ? currentProject?.current_stage : undefined
        };

        // Update project
        const { error: updateError } = await supabase
            .from('projects')
            .update({
                current_stage: returnToStage,
                assigned_to_role: returnToRole,
                status: isRework ? TaskStatus.REWORK : TaskStatus.REJECTED,
                data: updatedData,
                // Preserve creator information
                created_by_user_id: currentProject?.created_by_user_id || null,
                created_by_name: currentProject?.created_by_name || null,
                writer_id: currentProject?.writer_id || null,
                writer_name: currentProject?.writer_name || null,
                // Preserve assigned user ID if it exists
                assigned_to_user_id: currentProject?.assigned_to_user_id || null
            })
            .eq('id', projectId);

        // Fetch the updated project separately to avoid conflicting select parameters
        const { data: updateData, error: fetchDataError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (updateError) {
            console.error('Failed to update project:', updateError);
            throw updateError;
        }

        if (fetchDataError) {
            console.error('Failed to fetch updated project:', fetchDataError);
            throw fetchDataError;
        }

        if (!updateData) {
            throw new Error('Project not found or no rows updated');
        }

        // Use the updated data
        const data = updateData;

        // Extract script content (or idea description) and asset links if available
        const scriptContent = currentProject?.data?.script_content || currentProject?.data?.idea_description || null;
        const videoLink = currentProject?.video_link || null;
        const editedVideoLink = currentProject?.edited_video_link || null;
        const thumbnailLink = currentProject?.thumbnail_link || null;
        const creativeLink = currentProject?.creative_link || null;

        // Determine the action type based on isRework parameter
        const actionType = isRework ? 'REWORK' : 'REJECTED';

        // Determine from_role and to_role for precise email routing
        // Action Required (REJECTED) -> Project Creator (WRITER)
        // Rework Required (REWORK) -> Assigned role (returnToRole)

        // Add workflow history using recordAction
        await this.recordAction(
            projectId,
            returnToStage,
            userId,
            userName,
            actionType,
            comment || (isRework ? `Rework requested by ${userRole}` : `Rejected by ${userRole}`),
            scriptContent,
            userRole, // fromRole (the one who rejected)
            returnToRole, // toRole (the one who must fix it)
            userRole, // actorRole
            {
                rework_reason: comment,
                video_link: videoLink,
                edited_video_link: editedVideoLink,
                thumbnail_link: thumbnailLink,
                creative_link: creativeLink
            }
        );

        // Update the appropriate timestamp based on the action
        const timestampUpdates = getTimestampUpdate(actionType, userRole);
        if (Object.keys(timestampUpdates).length > 0) {
            await supabase
                .from('projects')
                .update(timestampUpdates)
                .eq('id', projectId);
        }

        // Find users with the return role to notify
        const { data: returnRoleUsers } = await supabase
            .from('users')
            .select('id')
            .eq('role', returnToRole)
            .eq('status', 'ACTIVE');

        if (returnRoleUsers && returnRoleUsers.length > 0) {
            // Send notification to all users with the return role
            for (const returnRoleUser of returnRoleUsers) {
                try {
                    const dbWithNotifications = db as any;
                    await dbWithNotifications.notifications.create(
                        returnRoleUser.id,
                        projectId,
                        'REWORK_REQUESTED',
                        'Rework Requested',
                        `${userName} has requested rework on a project: ${data.title}. Please review the feedback and make necessary changes.`
                    );
                } catch (notificationError) {
                    console.error('Failed to send notification:', notificationError);
                    // Continue with the process even if notification fails
                }
            }
        }

        return data;
    },

    // Mark project as done
    async markAsDone(
        projectId: string,
        userId: string,
        userName: string
    ) {
        // Update project
        const { error: updateError } = await supabase
            .from('projects')
            .update({
                status: TaskStatus.DONE
            })
            .eq('id', projectId);

        // Fetch the updated project separately to avoid conflicting select parameters
        const { data: updateData, error: fetchDataError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (updateError) {
            console.error('Failed to update project:', updateError);
            throw updateError;
        }

        if (fetchDataError) {
            console.error('Failed to fetch updated project:', fetchDataError);
            throw fetchDataError;
        }

        if (!updateData) {
            throw new Error('Project not found or no rows updated');
        }

        // Use the updated data
        const data = updateData;

        // Add workflow history
        const { error: historyError } = await supabase
            .from('workflow_history')
            .insert({
                project_id: projectId,
                stage: WorkflowStage.POSTED,
                actor_id: userId,
                actor_name: userName,
                action: 'APPROVED',
                comment: 'Project completed and published'
            });

        if (historyError) {
            console.error('Failed to add workflow history:', historyError);
            throw historyError;
        }

        // Update the appropriate timestamp based on the action
        const timestampUpdates = getTimestampUpdate('APPROVED', Role.OPS); // Assuming ops is marking as done
        if (Object.keys(timestampUpdates).length > 0) {
            await supabase
                .from('projects')
                .update(timestampUpdates)
                .eq('id', projectId);
        }

        return data;
    }
};

// ============================================================================
// WORKFLOW HISTORY
// ============================================================================

export const workflowHistory = {
    // Get history for a project
    async getByProject(projectId: string) {
        const { data, error } = await supabase
            .from('workflow_history')
            .select('*')
            .eq('project_id', projectId)
            .order('timestamp', { ascending: false });

        if (error) throw error;
        return data;
    },

    // ✅ NEW: Get history by actor ID for counting purposes
    async getByActorId(actorId: string) {
        const { data, error } = await supabase
            .from('workflow_history')
            .select('*')
            .eq('actor_id', actorId)
            .order('timestamp', { ascending: false });

        if (error) throw error;
        return data;
    },

    // ✅ NEW: Get history by actor role for counting purposes
    async getByActorRole(actorRole: Role) {
        // We can't directly filter by actor_role since it's not in the table
        // Instead, we'll get all history entries and filter by the actor's role in the application
        const { data, error } = await supabase
            .from('workflow_history')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Add history entry
    async add(entry: {
        project_id: string;
        stage: WorkflowStage;
        actor_id: string;
        actor_name: string;
        actor_role: Role;
        action: 'CREATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
        comment?: string;
    }) {
        // Map frontend action values to database enum values
        const actionMap: Record<string, string> = {
            'CREATED': 'CREATED',
            'SUBMITTED': 'SUBMITTED',
            'APPROVED': 'APPROVED',
            'REJECTED': 'REJECTED',
            'PUBLISHED': 'PUBLISHED'
        };

        // Default to 'submit' if action not found in maps
        const dbAction = actionMap[entry.action] || 'SUBMITTED';

        // Map the entry to match the actual database schema
        const dbEntry = {
            project_id: entry.project_id,
            stage: entry.stage,
            actor_id: entry.actor_id,
            actor_name: entry.actor_name,
            action: dbAction,
            comment: entry.comment || ''
        };

        const { error } = await supabase
            .from('workflow_history')
            .insert([dbEntry]);

        if (error) throw error;

        // Fetch the inserted record separately to avoid conflicting select parameters
        const { data, error: fetchDataError } = await supabase
            .from('workflow_history')
            .select('*')
            .eq('project_id', entry.project_id)
            .eq('stage', entry.stage)
            .eq('actor_id', entry.actor_id)
            .eq('action', actionMap[entry.action] || 'SUBMITTED')
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

        if (fetchDataError) throw fetchDataError;

        return data;
    }
};

// ============================================================================
// SYSTEM LOGS
// ============================================================================

export const systemLogs = {
    // Get all logs (Admin only)
    async getAll(limit: number = 100) {
        const { data, error } = await supabase
            .from('system_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    },

    // Get logs by user
    async getByUser(userId: string, limit: number = 50) {
        const { data, error } = await supabase
            .from('system_logs')
            .select('*')
            .eq('actor_id', userId)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    },

    // Add log entry
    async add(logEntry: {
        actor_id?: string;
        actor_name: string;
        actor_role: Role;
        action: string;
        details: string;
        metadata?: any;
    }) {
        const { error } = await supabase
            .from('system_logs')
            .insert([{
                user_id: logEntry.actor_id,
                user_name: logEntry.actor_name,
                user_role: logEntry.actor_role,
                action: logEntry.action,
                details: logEntry.details,
                metadata: logEntry.metadata || {}
            }]);

        if (error) throw error;

        // Fetch the inserted record separately to avoid conflicting select parameters
        const { data, error: fetchDataError } = await supabase
            .from('system_logs')
            .select('*')
            .eq('user_name', logEntry.actor_name)
            .eq('action', logEntry.action)
            .eq('details', logEntry.details)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

        if (fetchDataError) throw fetchDataError;

        return data;
    }
};

// ============================================================================
// FILE STORAGE
// ============================================================================

export const storage = {
    // Upload video
    async uploadVideo(file: File, projectId: string) {
        const fileName = `${projectId}/${Date.now()}_${file.name}`;

        const { data, error } = await supabase.storage
            .from('videos')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('videos')
            .getPublicUrl(fileName);

        return publicUrl;
    },

    // Upload thumbnail
    async uploadThumbnail(file: File, projectId: string) {
        const fileName = `${projectId}/${Date.now()}_${file.name}`;

        const { data, error } = await supabase.storage
            .from('thumbnails')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('thumbnails')
            .getPublicUrl(fileName);

        return publicUrl;
    },

    // Upload creative
    async uploadCreative(file: File, projectId: string) {
        const fileName = `${projectId}/${Date.now()}_${file.name}`;

        const { data, error } = await supabase.storage
            .from('creatives')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('creatives')
            .getPublicUrl(fileName);

        return publicUrl;
    },

    // Delete file
    async deleteFile(bucket: 'videos' | 'thumbnails' | 'creatives', path: string) {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);

        if (error) throw error;
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const helpers = {
    // Get workflow next stage based on content type
    getNextStage(currentStage: WorkflowStage, contentType: ContentType, action: 'APPROVED' | 'REJECTED', projectData?: any): {
        stage: WorkflowStage;
        role: Role;
    } {
        if (action === 'REJECTED') {
            // Return to previous stage based on current stage
            const rejectMap: Record<WorkflowStage, { stage: WorkflowStage; role: Role }> = {
                [WorkflowStage.SCRIPT_REVIEW_L1]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
                [WorkflowStage.SCRIPT_REVIEW_L2]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
                [WorkflowStage.FINAL_REVIEW_CMO]: {
                    stage: contentType === 'VIDEO' ? WorkflowStage.VIDEO_EDITING : WorkflowStage.CREATIVE_DESIGN,
                    role: contentType === 'VIDEO' ? Role.EDITOR : Role.DESIGNER
                },
                [WorkflowStage.FINAL_REVIEW_CEO]: {
                    stage: contentType === 'VIDEO' ? WorkflowStage.VIDEO_EDITING : WorkflowStage.CREATIVE_DESIGN,
                    role: contentType === 'VIDEO' ? Role.EDITOR : Role.DESIGNER
                },
                [WorkflowStage.WRITER_VIDEO_APPROVAL]: { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },
                // New sub-editor stages
                [WorkflowStage.SUB_EDITOR_ASSIGNMENT]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
                [WorkflowStage.SUB_EDITOR_PROCESSING]: { stage: WorkflowStage.SUB_EDITOR_ASSIGNMENT, role: Role.EDITOR },
                // Default returns
                [WorkflowStage.SCRIPT]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
                [WorkflowStage.CINEMATOGRAPHY]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
                [WorkflowStage.VIDEO_EDITING]: { stage: WorkflowStage.CINEMATOGRAPHY, role: Role.CINE },
                [WorkflowStage.THUMBNAIL_DESIGN]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
                [WorkflowStage.CREATIVE_DESIGN]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
                [WorkflowStage.MULTI_WRITER_APPROVAL]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR }, // If multi-writer approval is rejected, send back to editor
                [WorkflowStage.POST_WRITER_REVIEW]: { stage: WorkflowStage.MULTI_WRITER_APPROVAL, role: Role.WRITER }, // If post-writer review is rejected, send back to multi-writer approval
                [WorkflowStage.FINAL_REVIEW_CEO_POST_APPROVAL]: { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },
                [WorkflowStage.OPS_SCHEDULING]: { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },
                [WorkflowStage.POSTED]: { stage: WorkflowStage.OPS_SCHEDULING, role: Role.OPS },
                [WorkflowStage.REWORK]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER }
            };

            return rejectMap[currentStage];
        }

        // Approval flow
        const approvalMap: Partial<Record<WorkflowStage, { stage: WorkflowStage; role: Role }>> = {
            [WorkflowStage.SCRIPT]: { stage: WorkflowStage.SCRIPT_REVIEW_L1, role: Role.CMO },
            [WorkflowStage.SCRIPT_REVIEW_L1]: { stage: WorkflowStage.SCRIPT_REVIEW_L2, role: Role.CEO },
            [WorkflowStage.SCRIPT_REVIEW_L2]: {
                stage: contentType === 'VIDEO' ? WorkflowStage.CINEMATOGRAPHY : WorkflowStage.CREATIVE_DESIGN,
                role: contentType === 'VIDEO' ? Role.CINE : Role.DESIGNER
            },
            [WorkflowStage.CINEMATOGRAPHY]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
            [WorkflowStage.VIDEO_EDITING]: {
                // When editor uploads video, check routing based on needs_sub_editor flag
                // If needs_sub_editor is true -> route to SUB_EDITOR_ASSIGNMENT
                // If needs_sub_editor is false or undefined -> route to DESIGNER or WRITER based on thumbnail requirement
                stage: projectData?.needs_sub_editor === true
                    ? WorkflowStage.SUB_EDITOR_ASSIGNMENT  // Route to sub-editor assignment
                    : (projectData?.thumbnail_required === false || projectData?.thumbnail_required === undefined
                        ? WorkflowStage.MULTI_WRITER_APPROVAL  // Go to multi-writer approval if no thumbnail needed
                        : WorkflowStage.THUMBNAIL_DESIGN),  // Go to designer if thumbnail needed
                role: projectData?.needs_sub_editor === true
                    ? Role.EDITOR  // Editor handles sub-editor assignment
                    : (projectData?.thumbnail_required === false || projectData?.thumbnail_required === undefined
                        ? Role.WRITER  // Writers handle approval if no thumbnail needed
                        : Role.DESIGNER)  // Designer handles thumbnail creation if needed
            },
            [WorkflowStage.SUB_EDITOR_ASSIGNMENT]: { stage: WorkflowStage.SUB_EDITOR_PROCESSING, role: Role.SUB_EDITOR },
            [WorkflowStage.SUB_EDITOR_PROCESSING]: {
                // After sub-editor completes work, check if thumbnail is required
                // Route to multi-writer approval or designer based on thumbnail requirement
                stage: projectData?.thumbnail_required === false
                    ? WorkflowStage.MULTI_WRITER_APPROVAL  // Go to multiple writers for approval if no thumbnail required
                    : WorkflowStage.THUMBNAIL_DESIGN,  // Go to designer if thumbnail required
                role: projectData?.thumbnail_required === false
                    ? Role.WRITER  // Writers handle multi-writer approval
                    : Role.DESIGNER  // Designer handles thumbnail creation
            },
            [WorkflowStage.THUMBNAIL_DESIGN]: { stage: WorkflowStage.MULTI_WRITER_APPROVAL, role: Role.WRITER }, // After designer completes thumbnail, send to multi-writer approval
            [WorkflowStage.CREATIVE_DESIGN]: { stage: WorkflowStage.FINAL_REVIEW_CMO, role: Role.CMO },
            [WorkflowStage.FINAL_REVIEW_CMO]: { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },
            [WorkflowStage.FINAL_REVIEW_CEO]: { stage: WorkflowStage.OPS_SCHEDULING, role: Role.OPS },  // After CEO final approval, send to ops for scheduling
            [WorkflowStage.WRITER_VIDEO_APPROVAL]: { stage: WorkflowStage.POST_WRITER_REVIEW, role: Role.CMO },  // After writer approves, send to post-writer review stage for parallel visibility to CMO and OPS
            // ❌ MULTI_WRITER_APPROVAL removed from here as per instructions
            [WorkflowStage.POST_WRITER_REVIEW]: { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO }, // After post-writer review, send to CEO for final approval before ops scheduling
            [WorkflowStage.FINAL_REVIEW_CEO_POST_APPROVAL]: { stage: WorkflowStage.OPS_SCHEDULING, role: Role.OPS },
            [WorkflowStage.OPS_SCHEDULING]: { stage: WorkflowStage.POSTED, role: Role.OPS },
            [WorkflowStage.POSTED]: { stage: WorkflowStage.POSTED, role: Role.OPS },
            [WorkflowStage.REWORK]: { stage: WorkflowStage.SCRIPT_REVIEW_L1, role: Role.CMO }
        };

        const nextStage = approvalMap[currentStage];
        if (!nextStage) {
            console.error(`❌ No next stage mapping found for: ${currentStage}`);
            throw new Error(`Use workflow.approve() for multi-writer approvals stage ${currentStage}`);
        }
        return nextStage;
    },

    // Get current session
    async getSession() {
        return await supabase.auth.getSession();
    }
};

// ============================================================================
// COMPATIBILITY WRAPPER - Matches mockDb Interface
// ============================================================================

/**
 * This wrapper layer provides a flat interface matching mockDb.ts
 * so that all components work without modification.
 */

// Session management (mimics mockDb behavior)
let currentUserCache: User | null = null;

// ============================================================================
// EXPORT ALL - Flat Interface Matching mockDb
// ============================================================================

export const db = {
    // Keep namespaced access for advanced usage
    auth,
    users,
    projects,
    workflow,
    workflowHistory,
    systemLogs,
    storage,
    helpers,

    // ========================================================================
    // FLAT COMPATIBILITY METHODS (matches mockDb.ts interface)
    // ========================================================================

    // --- Auth & Session ---
    getCurrentUser(): User | null {
        return currentUserCache;
    },

    setCurrentUser(user: User): void {
        currentUserCache = user;
        console.log('User manually set and cached:', currentUserCache.full_name);
    },

    async refreshSession(): Promise<boolean> {
        try {
            console.log('DB: Manually refreshing session...');
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', session.user.email)
                    .single();

                if (error) {
                    console.warn('DB: Error fetching user during session refresh:', error);
                    return false;
                }

                if (data) {
                    currentUserCache = data as User;
                    console.log('DB: Session refreshed successfully for:', currentUserCache.full_name);
                    return true;
                }
            } else {
                console.log('DB: No active session to refresh');
                currentUserCache = null;
            }

            return false;
        } catch (error) {
            console.error('DB: Session refresh failed:', error);
            currentUserCache = null; // Ensure cache is cleared on error
            return false;
        }
    },

    async login(email: string, password: string): Promise<User> {
        try {
            // Defensive: clear any stale local session before a fresh login attempt
            // This prevents "stuck until I delete tokens" issues when refresh tokens are invalid
            try {
                await supabase.auth.signOut();
            } catch (signOutErr) {
                console.warn('Pre-login signOut failed (safe to ignore if no session):', signOutErr);
            }

            // Real authentication using Supabase
            console.log('Login: calling signInWithPassword...');
            const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

            if (signInError) {
                throw new Error(signInError.message);
            }

            if (!user) {
                throw new Error('Login failed - no user returned');
            }

            // Get full user details
            console.log('Login: fetching user profile...');
            const userData = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (userData.error) {
                throw new Error(`User profile fetch failed: ${userData.error.message}`);
            }

            if (!userData.data) {
                throw new Error('User profile not found in database');
            }

            currentUserCache = userData.data as User;
            console.log('User logged in and cached:', currentUserCache.full_name);

            // Update last login
            try {
                await supabase
                    .from('users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('email', email);
            } catch (updateError) {
                console.warn('Failed to update last login timestamp:', updateError);
            }

            return userData.data as User;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async logout() {
        if (currentUserCache) {
            try {
                await systemLogs.add({
                    actor_id: currentUserCache.id,
                    actor_name: currentUserCache.full_name,
                    actor_role: currentUserCache.role,
                    action: 'LOGOUT',
                    details: `User ${currentUserCache.full_name} logged out`
                });
            } catch (logError) {
                console.warn('Failed to log logout event:', logError);
            }
        }

        try {
            const result = await auth.signOut();
            if (result.error) {
                console.error('Sign out error:', result.error);
                // Continue anyway to ensure local state is cleared
            }
        } catch (signOutError) {
            console.error('Sign out failed:', signOutError);
            // Continue anyway to ensure local state is cleared
        }

        currentUserCache = null;
    },

    // --- User Management ---
    async getUsers(): Promise<User[]> {
        return await users.getAll();
    },

    async addUser(userData: Omit<User, 'id' | 'last_login'>): Promise<User> {
        return await users.create({
            email: userData.email,
            full_name: userData.full_name,
            role: userData.role,
            phone: userData.phone,
            status: userData.status
        });
    },

    async inviteUser(email: string, userData: { full_name: string; role: Role; phone?: string }) {
        return await auth.inviteUser(email, userData);
    },

    async updateUser(id: string, updates: Partial<User>) {
        await users.update(id, updates);
    },

    async deleteUser(id: string) {
        return await users.delete(id);
    },

    // --- Project Management ---
    async getProjects(user: User): Promise<Project[]> {
        // For Admin and Observer roles, show all projects
        if ([Role.ADMIN, Role.OBSERVER].includes(user.role)) {
            return await projects.getAll();
        }
        // For all other roles, show projects assigned to their role with appropriate stage filtering
        return await projects.getForRole(user.role);
    },
    async getMyWork(user: User): Promise<Project[]> {
        return await projects.getMyWork(user);
    },

    async getProjectById(id: string): Promise<Project | undefined> {
        try {
            return await projects.getById(id);
        } catch (error) {
            return undefined;
        }
    },

    async createProject(title: string, channel: Channel, dueDate: string, contentType: ContentType = 'VIDEO', priority: Priority = 'NORMAL'): Promise<Project> {
        // Get current user information, either from cache or directly from auth
        const currentUserId = currentUserCache?.id || (await auth.getCurrentUser())?.id || null;
        const currentUserFullName = currentUserCache?.full_name ||
            (await auth.getCurrentUser())?.user_metadata?.full_name ||
            (await auth.getCurrentUser())?.user_metadata?.name ||
            null;

        const projectData = {
            title,
            channel,
            content_type: contentType,
            assigned_to_role: Role.WRITER, // Always starts with writer
            due_date: dueDate,
            priority,
            data: {},
            // Set creator information
            created_by_user_id: currentUserId,
            created_by_name: currentUserFullName,
            writer_id: currentUserId,
            writer_name: currentUserFullName,
        };

        // Create the project and return the real project with Supabase UUID
        const createdProject = await projects.create(projectData);

        // Record the creation in workflow history
        if (currentUserId && currentUserFullName) {
            await workflow.recordAction(
                createdProject.id,
                WorkflowStage.SCRIPT, // Starting stage for regular projects
                currentUserId,
                currentUserFullName,
                'CREATED',
                'Project created by writer'
            );
        }

        return createdProject;
    },

    async createDirectCreativeProject(title: string, channel: Channel, dueDate: string, priority: Priority = 'NORMAL'): Promise<Project> {
        // Get current user information, either from cache or directly from auth
        const currentUserId = currentUserCache?.id || (await auth.getCurrentUser())?.id || null;
        const currentUserFullName = currentUserCache?.full_name ||
            (await auth.getCurrentUser())?.user_metadata?.full_name ||
            (await auth.getCurrentUser())?.user_metadata?.name ||
            null;

        // Create a project that starts at the FINAL_REVIEW_CMO stage for direct creative uploads
        const projectData = {
            title,
            channel,
            content_type: 'CREATIVE_ONLY' as ContentType, // Always CREATIVE_ONLY for direct uploads
            current_stage: WorkflowStage.FINAL_REVIEW_CMO, // Start at CMO review
            assigned_to_role: Role.CMO, // Assign to CMO first
            status: TaskStatus.WAITING_APPROVAL, // Waiting for approval
            due_date: dueDate,
            priority,
            data: {},
            // Set creator information
            created_by_user_id: currentUserId,
            created_by_name: currentUserFullName,
            writer_id: currentUserId,
            writer_name: currentUserFullName,
        };

        // Create the project and return the real project with Supabase UUID
        const createdProject = await projects.create(projectData);

        // Record the creation in workflow history
        if (currentUserId && currentUserFullName) {
            await workflow.recordAction(
                createdProject.id,
                WorkflowStage.FINAL_REVIEW_CMO,
                currentUserId,
                currentUserFullName,
                'CREATED',
                'Direct Creative Upload project created'
            );
        }

        return createdProject;
    },

    async createDesignerProject(title: string, channel: Channel, dueDate: string, description: string, link: string, priority: Priority = 'NORMAL', contentType: ContentType = 'CREATIVE_ONLY'): Promise<Project> {
        // Get current user information, either from cache or directly from auth
        const currentUserId = currentUserCache?.id || (await auth.getCurrentUser())?.id || null;
        const currentUserFullName = currentUserCache?.full_name ||
            (await auth.getCurrentUser())?.user_metadata?.full_name ||
            (await auth.getCurrentUser())?.user_metadata?.name ||
            null;

        // Create a project that starts at the FINAL_REVIEW_CMO stage for designer-initiated projects
        const projectData = {
            title,
            channel,
            content_type: contentType, // Use the provided content type
            current_stage: WorkflowStage.FINAL_REVIEW_CMO, // Start at CMO review
            assigned_to_role: Role.CMO, // Assign to CMO first
            assigned_to_user_id: null, // No specific user assigned yet
            status: TaskStatus.WAITING_APPROVAL, // Waiting for approval
            due_date: dueDate,
            priority,
            creative_link: link, // Store the creative link in the main project record
            data: {
                brief: description, // Store description as brief
                creative_link: link, // Also store the creative link in the data object for consistency
                source: 'DESIGNER_INITIATED' // Track that this project was initiated by designer
            },
            // Set creator information
            created_by: currentUserId, // For backward compatibility
            created_by_user_id: currentUserId,
            created_by_name: currentUserFullName,
            writer_id: currentUserId,
            writer_name: currentUserFullName,
        };

        // Create the project and return the real project with Supabase UUID
        const createdProject = await projects.create(projectData);

        // Record the creation in workflow history
        if (currentUserId && currentUserFullName) {
            await workflow.recordAction(
                createdProject.id,
                WorkflowStage.FINAL_REVIEW_CMO,
                currentUserId,
                currentUserFullName,
                'CREATED',
                'Designer-initiated creative project created'
            );
        }

        return createdProject;
    },

    async createIdeaProject(title: string, channel: Channel, contentType: ContentType, description: string, priority: Priority = 'NORMAL'): Promise<Project> {
        // Create an idea project that starts at the FINAL_REVIEW_CMO stage
        // Get current user information, either from cache or directly from auth
        const currentUserId = currentUserCache?.id || (await auth.getCurrentUser())?.id || null;
        const currentUserFullName = currentUserCache?.full_name ||
            (await auth.getCurrentUser())?.user_metadata?.full_name ||
            (await auth.getCurrentUser())?.user_metadata?.name ||
            null;

        const projectData = {
            title,
            channel,
            content_type: contentType,
            current_stage: WorkflowStage.FINAL_REVIEW_CMO, // Start at CMO review
            assigned_to_role: Role.CMO, // Assign to CMO first
            status: TaskStatus.WAITING_APPROVAL, // Waiting for approval
            due_date: new Date().toISOString().split('T')[0], // Use today's date
            priority,
            data: {
                idea_description: description, // Store the idea description
                source: 'IDEA_PROJECT' // Track that this project was created as an idea
            },
            // Set creator information
            created_by_user_id: currentUserId,
            created_by_name: currentUserFullName,
            writer_id: currentUserId,
            writer_name: currentUserFullName,
        };

        // Create the project and return the real project with Supabase UUID
        const createdProject = await projects.create(projectData);

        // Record the creation in workflow history
        if (currentUserCache) {
            await workflow.recordAction(
                createdProject.id,
                WorkflowStage.FINAL_REVIEW_CMO,
                currentUserCache.id,
                currentUserCache.full_name,
                'CREATED',
                'Idea project created and submitted to CMO'
            );
        }

        return createdProject;
    },

    async updateProjectData(projectId: string, newData: Partial<any>) {
        try {
            // First get the current project to determine role for potential timestamp updates
            const currentProject = await projects.getById(projectId);

            await projects.updateData(projectId, newData);

            // Check if this update involves asset uploads that need timestamp updates
            if (currentProject) {
                let actionForTimestamp: string | null = null;
                let roleForTimestamp: Role | null = null;

                // Check for asset uploads - more robust detection
                // We need to check both the newData and the actual project data after update

                // Get the updated project data to check what actually changed
                const updatedProject = await projects.getById(projectId);

                if (updatedProject) {
                    // Check if video_link was added (Cinematographer upload)
                    if (updatedProject.video_link && !currentProject.video_link) {
                        actionForTimestamp = 'DIRECT_UPLOAD';
                        roleForTimestamp = Role.CINE;
                        console.log('Detected Cine video upload - setting cine_uploaded_at timestamp');
                    }
                    // Check if edited_video_link was added (Editor upload)
                    else if (updatedProject.edited_video_link && !currentProject.edited_video_link) {
                        actionForTimestamp = 'DIRECT_UPLOAD';
                        roleForTimestamp = Role.EDITOR;
                        console.log('Detected Editor video upload - setting editor_uploaded_at timestamp');
                    }
                    // Check if thumbnail_link or creative_link was added (Designer upload)
                    else if ((updatedProject.thumbnail_link && !currentProject.thumbnail_link) ||
                        (updatedProject.creative_link && !currentProject.creative_link)) {
                        actionForTimestamp = 'DIRECT_UPLOAD';
                        roleForTimestamp = Role.DESIGNER;
                        console.log('Detected Designer asset upload - setting designer_uploaded_at timestamp');
                    }
                    // For edited_video_link, if the project is currently assigned to SUB_EDITOR, treat as sub-editor upload
                    // Otherwise, treat as editor upload
                    else if (updatedProject.edited_video_link && !currentProject.edited_video_link) {
                        actionForTimestamp = 'DIRECT_UPLOAD';
                        // Determine if this was uploaded by editor or sub-editor based on the assigned role
                        if (updatedProject.assigned_to_role === Role.SUB_EDITOR) {
                            roleForTimestamp = Role.SUB_EDITOR;
                            console.log('Detected Sub-Editor video upload - setting sub_editor_uploaded_at timestamp');
                        } else {
                            roleForTimestamp = Role.EDITOR;
                            console.log('Detected Editor video upload - setting editor_uploaded_at timestamp');
                        }
                    }
                }

                if (actionForTimestamp && roleForTimestamp) {
                    const timestampUpdates = getTimestampUpdate(actionForTimestamp, roleForTimestamp);
                    if (Object.keys(timestampUpdates).length > 0) {
                        console.log('Updating timestamps:', timestampUpdates);
                        const { data, error } = await supabase
                            .from('projects')
                            .update(timestampUpdates)
                            .eq('id', projectId)
                            .select();

                        if (error) {
                            console.error('Failed to update timestamps:', error);
                        } else {
                            console.log('Successfully updated timestamps:', data);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Failed to update project data:', err);
            throw err; // Re-throw so caller can handle it
        }
    },

    // --- Workflow Management ---
    async submitToReview(projectId: string) {
        if (!currentUserCache) {
            console.error('No current user for submitToReview');
            throw new Error('No current user for submitToReview');
        }

        // Ensure we have a real project with proper ID
        if (!projectId || projectId.startsWith('temp_')) {
            throw new Error('Cannot submit project with temporary ID. Project must be saved to Supabase first.');
        }

        // Get the project to determine next stage with retry mechanism
        let project;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                project = await projects.getById(projectId);
                if (project) break;
            } catch (error) {
                console.warn(`Attempt ${attempts + 1} to fetch project failed:`, error.message);
            }

            attempts++;
            if (attempts < maxAttempts) {
                // Wait 100ms before retrying
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (!project) {
            throw new Error('Project not found after multiple attempts. Please try again.');
        }

        const nextStageInfo = helpers.getNextStage(
            project.current_stage,
            project.content_type,
            'APPROVED',
            project.data
        );

        const result = await workflow.submitForReview(
            projectId,
            currentUserCache.id,
            currentUserCache.full_name,
            nextStageInfo.stage,
            nextStageInfo.role,
            'Submitted for review'
        );

        // Refresh the project data to ensure UI is up to date
        const updatedProject = await projects.getById(projectId);
        console.log('Project updated after submitToReview:', updatedProject);

        return result;
    },

    async advanceWorkflow(projectId: string, comment?: string) {
        if (!currentUserCache) {
            console.error('No current user for advanceWorkflow');
            throw new Error('No current user for advanceWorkflow');
        }

        // Ensure we have a real project with proper ID
        if (!projectId || projectId.startsWith('temp_')) {
            throw new Error('Cannot advance project with temporary ID. Project must be saved to Supabase first.');
        }

        // Get the project with retry mechanism
        let project;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                project = await projects.getById(projectId);
                if (project) break;
            } catch (error) {
                console.warn(`Attempt ${attempts + 1} to fetch project failed:`, error.message);
            }

            attempts++;
            if (attempts < maxAttempts) {
                // Wait 100ms before retrying
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (!project) {
            throw new Error('Project not found after multiple attempts. Please try again.');
        }

        // 1️⃣ Block advanceWorkflow for MULTI_WRITER_APPROVAL and POST_WRITER_REVIEW
        if (project.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL) {
            console.log('⛔ advanceWorkflow blocked for MULTI_WRITER_APPROVAL');
            throw new Error('Use workflow.approve() for multi-writer approvals');
        }

        if (project.current_stage === WorkflowStage.POST_WRITER_REVIEW) {
            console.log('⛔ advanceWorkflow blocked for POST_WRITER_REVIEW');
            throw new Error('Use workflow.approve() for post-writer review approvals');
        }

        console.log('Advancing workflow for project:', project);
        console.log('Current stage:', project.current_stage);
        console.log('Content type:', project.content_type);

        // Check if the project was recently in rework status by checking workflow history
        const { data: workflowHistory, error: historyError } = await supabase
            .from('workflow_history')
            .select('*')
            .eq('project_id', projectId)
            .order('timestamp', { ascending: false })
            .limit(10); // Get recent history entries

        let isFromRework = false;
        let reworkInitiator: string | null = null;
        let reworkInitiatorRole: string | null = null;

        if (workflowHistory && workflowHistory.length > 0) {
            // Check if the most recent action was a rework or rejection
            const recentRework = workflowHistory.find(h => h.action === 'REWORK' || h.action === 'REJECTED');
            if (recentRework) {
                isFromRework = true;
                reworkInitiator = recentRework.actor_id;
                reworkInitiatorRole = recentRework.from_role;
            }
        }

        // Determine the next stage based on current stage and whether it's from rework
        let nextStageInfo;

        // CHECK FOR REWORK ROUTING: If this project has a rework_initiator_role, route back to them
        // Priority check - this takes precedence over normal workflow routing
        if (project.data?.rework_initiator_role && project.data?.rework_initiator_stage) {
            console.log('🔄 Rework metadata found - routing back to initiator:', project.data.rework_initiator_role);
            console.log('🔄 Initiator stage:', project.data.rework_initiator_stage);

            // Map the rework initiator stage back to the appropriate stage
            const reworkInitiatorRole = project.data.rework_initiator_role;
            const reworkInitiatorStage = project.data.rework_initiator_stage;

            // Route back to the stage where rework was initiated
            nextStageInfo = {
                stage: reworkInitiatorStage as WorkflowStage,
                role: reworkInitiatorRole as Role
            };

            // Clear the rework initiator metadata after routing
            console.log('🔄 Clearing rework metadata after routing');
            await supabase
                .from('projects')
                .update({
                    data: {
                        ...project.data,
                        rework_initiator_role: undefined,
                        rework_initiator_stage: undefined
                    }
                })
                .eq('id', projectId);
            console.log('✅ Rework metadata cleared successfully');
        }
        // SPECIAL CASE: If this is an idea project and CEO approves it (FINAL_REVIEW_CEO),
        // send it back to the writer to convert the idea into a script
        // This check should happen regardless of whether the project is from rework or not
        else if (project.data?.source === 'IDEA_PROJECT' && project.current_stage === WorkflowStage.FINAL_REVIEW_CEO) {
            nextStageInfo = { stage: WorkflowStage.SCRIPT, role: Role.WRITER };
        } else if (project.current_stage === WorkflowStage.VIDEO_EDITING && project.assigned_to_role === Role.EDITOR) {
            // When editor uploads video, check routing based on needs_sub_editor flag
            // Use the flexible routing logic from helpers.getNextStage
            const routingInfo = helpers.getNextStage(
                project.current_stage,
                project.content_type,
                'APPROVED',
                project.data
            );
            nextStageInfo = routingInfo;
        } else if (project.current_stage === WorkflowStage.SUB_EDITOR_ASSIGNMENT && project.assigned_to_role === Role.EDITOR) {
            // When editor assigns to sub-editor, move to sub-editor processing stage
            // Preserve the specific assigned user ID if it exists
            nextStageInfo = { stage: WorkflowStage.SUB_EDITOR_PROCESSING, role: Role.SUB_EDITOR };
            // The assigned_to_user_id is already in the project and will be preserved during the update
        } else if (project.current_stage === WorkflowStage.SUB_EDITOR_PROCESSING && project.assigned_to_role === Role.SUB_EDITOR) {
            // After sub-editor completes work, check if thumbnail is required
            if (project.data?.thumbnail_required === false) {
                // If no thumbnail required, go to writer for video approval
                nextStageInfo = { stage: WorkflowStage.WRITER_VIDEO_APPROVAL, role: Role.WRITER };
            } else {
                // If thumbnail required, go to designer
                nextStageInfo = { stage: WorkflowStage.THUMBNAIL_DESIGN, role: Role.DESIGNER };
            }
        } else if (project.current_stage === WorkflowStage.THUMBNAIL_DESIGN && project.assigned_to_role === Role.DESIGNER) {
            // After designer completes work, go to multi-writer approval
            nextStageInfo = { stage: WorkflowStage.MULTI_WRITER_APPROVAL, role: Role.WRITER };
        } else if (project.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL && project.assigned_to_role === Role.WRITER) {
            console.log('🔍 DEBUG: Processing MULTI_WRITER_APPROVAL stage for project:', projectId);

            // For MULTI_WRITER_APPROVAL stage, advanceWorkflow does NOT decide the next stage
            // The actual advancement will happen in workflow.approve() after checking all approvals
            // This prevents the race condition where we check approvals before the current approval is recorded

            // Always return to MULTI_WRITER_APPROVAL stage
            // The final decision on advancement happens in workflow.approve() after the approval is recorded
            nextStageInfo = { stage: WorkflowStage.MULTI_WRITER_APPROVAL, role: Role.WRITER };
        } else if (project.current_stage === WorkflowStage.WRITER_VIDEO_APPROVAL && project.assigned_to_role === Role.WRITER) {
            // After writer approves video, go to ops for scheduling
            nextStageInfo = { stage: WorkflowStage.OPS_SCHEDULING, role: Role.OPS };
        } else {
            // For all other transitions, use the standard hierarchy to ensure 
            // no review stages (like CMO review) are skipped, even after rework.
            nextStageInfo = helpers.getNextStage(
                project.current_stage,
                project.content_type,
                'APPROVED',
                project.data
            );
        }

        console.log('Next stage info:', nextStageInfo);

        // Determine action type: If from rework, use REWORK_VIDEO_SUBMITTED
        const advanceAction = isFromRework ? 'REWORK_VIDEO_SUBMITTED' : 'SUBMITTED';

        const result = await workflow.approve(
            projectId,
            currentUserCache.id,
            currentUserCache.full_name,
            currentUserCache.role,
            nextStageInfo.stage,
            nextStageInfo.role,
            comment,
            advanceAction,
            reworkInitiatorRole || currentUserCache.role // fromRole
        );

        // Refresh the project data to ensure UI is up to date
        const updatedProject = await projects.getById(projectId);
        console.log('Project updated after advanceWorkflow:', updatedProject);

        return result;
    },

    async rejectTask(projectId: string, targetStage: WorkflowStage, comment: string) {
        if (!currentUserCache) {
            console.error('No current user for rejectTask');
            throw new Error('No current user for rejectTask');
        }

        // Ensure we have a real project with proper ID
        if (!projectId || projectId.startsWith('temp_')) {
            throw new Error('Cannot reject project with temporary ID. Project must be saved to Supabase first.');
        }

        // Determine if this is a rework request based on the comment content
        // If the comment contains 'Project killed' or 'terminated', it's a reject, otherwise it's rework
        const isRework = !comment.includes('Project killed') && !comment.includes('terminated');

        // Get the project with retry mechanism
        let project;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                project = await projects.getById(projectId);
                if (project) break;
            } catch (error) {
                console.warn(`Attempt ${attempts + 1} to fetch project failed:`, error.message);
            }

            attempts++;
            if (attempts < maxAttempts) {
                // Wait 100ms before retrying
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (!project) {
            throw new Error('Project not found after multiple attempts. Please try again.');
        }

        // Map target stage to appropriate role
        const stageToRoleMap: Record<WorkflowStage, Role> = {
            [WorkflowStage.SCRIPT]: Role.WRITER,
            [WorkflowStage.SCRIPT_REVIEW_L1]: Role.CMO,
            [WorkflowStage.SCRIPT_REVIEW_L2]: Role.CEO,
            [WorkflowStage.CINEMATOGRAPHY]: Role.CINE,
            [WorkflowStage.VIDEO_EDITING]: Role.EDITOR,
            [WorkflowStage.SUB_EDITOR_ASSIGNMENT]: Role.EDITOR,
            [WorkflowStage.SUB_EDITOR_PROCESSING]: Role.SUB_EDITOR,
            [WorkflowStage.THUMBNAIL_DESIGN]: Role.DESIGNER,
            [WorkflowStage.CREATIVE_DESIGN]: Role.DESIGNER,
            [WorkflowStage.FINAL_REVIEW_CMO]: Role.CMO,
            [WorkflowStage.FINAL_REVIEW_CEO]: Role.CEO,
            [WorkflowStage.FINAL_REVIEW_CEO_POST_APPROVAL]: Role.OPS,
            [WorkflowStage.WRITER_VIDEO_APPROVAL]: Role.WRITER,
            [WorkflowStage.MULTI_WRITER_APPROVAL]: Role.WRITER,
            [WorkflowStage.POST_WRITER_REVIEW]: Role.CMO, // Assign to CMO for approval
            [WorkflowStage.OPS_SCHEDULING]: Role.OPS,
            [WorkflowStage.POSTED]: Role.OPS,
            [WorkflowStage.REWORK]: Role.WRITER
        };

        // Special case: When CEO rejects (not rework) from FINAL_REVIEW_CEO, send back to CMO instead of CEO
        let targetRole = Role.WRITER;
        if (project.current_stage === WorkflowStage.FINAL_REVIEW_CEO && targetStage !== WorkflowStage.SCRIPT && !isRework) {
            targetRole = Role.CMO;
        } else {
            targetRole = stageToRoleMap[targetStage] || Role.WRITER;
        }

        const result = await workflow.reject(
            projectId,
            currentUserCache.id,
            currentUserCache.full_name,
            currentUserCache.role,
            targetStage,
            targetRole,
            comment,
            isRework
        );

        // The rejected_reason field is deprecated. All rework/reject comments should be read from workflow_history.

        // Refresh the project data to ensure UI is up to date
        const updatedProject = await projects.getById(projectId);
        console.log('Project updated after rejectTask:', updatedProject);

        return result;
    },

    // --- System Logs ---
    async getSystemLogs(): Promise<any[]> {
        return await systemLogs.getAll();
    }
};

// Default export for compatibility
// ============================================================================
// TOKEN HEALTH MONITORING
// ============================================================================

/**
 * Check if authentication tokens in localStorage are healthy
 * Returns status indicating if tokens should be cleared
 */
export const tokenHealthCheck = (): {
    healthy: boolean;
    status: string;
    action?: 'clear' | 'keep';
} => {
    const tokens = Object.keys(localStorage).filter(k => k.startsWith('sb-'));

    if (tokens.length === 0) {
        return { healthy: true, status: 'no_tokens', action: 'keep' };
    }

    try {
        // Check if we can parse token data (validate JSON format)
        tokens.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) {
                JSON.parse(value); // Validate JSON structure
            }
        });

        return { healthy: true, status: 'tokens_valid_format', action: 'keep' };
    } catch (error) {
        console.error('🔴 Token Health: Corrupted token detected:', error);
        return { healthy: false, status: 'tokens_corrupted', action: 'clear' };
    }
};

// ============================================================================
// NOTIFICATIONS SERVICE
// ============================================================================

export const notifications = {
    // Create a new notification
    async create(userId: string, projectId: string, type: string, title: string, message: string) {
        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                project_id: projectId,
                type,
                title,
                message
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to create notification:', error);
            throw error;
        }

        return data;
    },

    // Get notifications for a user
    async getForUser(userId: string, limit: number = 50) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Failed to fetch notifications:', error);
            throw error;
        }

        return data;
    },

    // Mark a notification as read
    async markAsRead(notificationId: string) {
        const { data, error } = await supabase
            .from('notifications')
            .update({
                is_read: true,
                read_at: new Date().toISOString()
            })
            .eq('id', notificationId)
            .select()
            .single();

        if (error) {
            console.error('Failed to mark notification as read:', error);
            throw error;
        }

        return data;
    },

    // Mark all notifications for a user as read
    async markAllAsRead(userId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({
                is_read: true,
                read_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) {
            console.error('Failed to mark all notifications as read:', error);
            throw error;
        }

        return true;
    },

    // Get unread count for a user
    async getUnreadCount(userId: string) {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) {
            console.error('Failed to get unread count:', error);
            throw error;
        }

        return count || 0;
    }
};

export default db;




