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
    UserStatus,
    HistoryEvent
} from '../types';
import { Notification } from '../types';
import { getTimestampUpdate, isReworkProject, isInfluencerVideo, isCareerApplyShyamGroup, isGeneralInfluencerVideo } from './workflowUtils';

// 🚀 DATABASE CLIENT CONFIGURATION
// Use standard client for all operations to ensure session consistency and bypass project mismatches.
// This is critical for internal tools where RLS is disabled and consistent identity is required.
const dbClient = supabase;
console.log('🔧 Database client initialized: Using Standard Authenticated Client');

console.log('🔍 Initializing supabaseDb service');

// User cache for session management
let currentUserCache: User | null = null;
const supabaseRestUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseRestServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseRestAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            Promise.resolve(promise),
            new Promise<T>((_, reject) => {
                timeoutId = globalThis.setTimeout(() => reject(new Error(message)), ms);
            })
        ]);
    } finally {
        if (timeoutId) {
            globalThis.clearTimeout(timeoutId);
        }
    }
};

const createLocalProjectId = () => {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
        const random = Math.random() * 16 | 0;
        const value = char === 'x' ? random : (random & 0x3 | 0x8);
        return value.toString(16);
    });
};

const insertProjectViaRest = async (insertData: any): Promise<Project> => {
    const apiKey = supabaseRestServiceKey || supabaseRestAnonKey;
    if (!supabaseRestUrl || !apiKey) {
        throw new Error('Supabase REST config is missing.');
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(`${supabaseRestUrl}/rest/v1/projects`, {
            method: 'POST',
            headers: {
                apikey: apiKey,
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal'
            },
            body: JSON.stringify(insertData),
            signal: controller.signal
        });

        if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`Failed to create project: ${response.status} ${response.statusText} ${responseText}`);
        }

        return {
            ...insertData,
            status: insertData.status || insertData.task_status || TaskStatus.TODO,
            created_at: insertData.created_at || new Date().toISOString(),
            history: []
        } as Project;
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw new Error('Database timeout: Project creation took too long. Please check your connection and try again.');
        }
        throw error;
    } finally {
        globalThis.clearTimeout(timeoutId);
    }
};

// ============================================================================
// AUTHENTICATION
// ============================================================================

export const auth = {
    // Sign in with email/password
    async signIn(email: string, password: string) {
        console.log('🔐 Attempting login for:', email);

        try {
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
            // Sign out locally first
            console.log('Signing out locally...');
            const { error: localError } = await supabase.auth.signOut();

            if (localError) {
                console.warn('Local sign out failed:', localError);
            } else {
                console.log('Local sign out successful');
            }

            // Then sign out globally if the method is supported
            console.log('Signing out globally...');
            const { error: globalError } = await supabase.auth.signOut({ global: true });

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
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            console.warn('getCurrentUser: Failed to retrieve auth user', error);
            return null;
        }
        return data?.user || null;
    },

    /**
     * getPublicUser: The ultimate source of truth for the current user's database identity.
     * 1. Fetches the Auth User directly from Supabase.
     * 2. Resolves and Synchronizes the record in the public.users table.
     * 3. Prevents "not present in table users" errors by ensuring ID parity.
     */
    async getPublicUser(): Promise<User | null> {
        try {
            if (currentUserCache) return currentUserCache;

            const authResponse = await withTimeout(
                supabase.auth.getUser(),
                8000,
                'Authentication timed out. Please refresh and try again.'
            ) as any;
            const authUser = authResponse.data?.user;
            const authError = authResponse.error;
            if (authError || !authUser?.email) {
                console.warn('❌ getPublicUser: No authenticated session found');
                return null;
            }

            // 1. Primary Lookup: By Auth ID
            const fetchResponse = await withTimeout(
                supabase
                    .from('users')
                    .select('*')
                    .eq('id', authUser.id)
                    .maybeSingle(),
                8000,
                'User profile lookup timed out. Please refresh and try again.'
            ) as any;

            let userRecord = fetchResponse.data;
            let fetchError = fetchResponse.error;

            // 2. Secondary Lookup: By Email (Handle Desynchronized Profiles)
            if (!userRecord) {
                const emailMatchResponse = await withTimeout(
                    supabase
                        .from('users')
                        .select('*')
                        .eq('email', authUser.email)
                        .maybeSingle(),
                    8000,
                    'User profile lookup by email timed out. Please refresh and try again.'
                ) as any;

                const emailMatch = emailMatchResponse.data;

                if (emailMatch) {
                    console.warn(`🔄 Syncing User ID for ${authUser.email}: Changing ${emailMatch.id} -> ${authUser.id}`);
                    const syncedUserResponse = await withTimeout(
                        dbClient
                            .from('users')
                            .update({ id: authUser.id })
                            .eq('email', authUser.email)
                            .select()
                            .single(),
                        8000,
                        'User profile sync timed out. Please refresh and try again.'
                    ) as any;
                    userRecord = syncedUserResponse.data;
                }
            }

            // 3. Last Resort: Auto-Create missing profile
            if (!userRecord) {
                console.log('📝 Creating missing public profile for:', authUser.email);
                const fullName = authUser.user_metadata?.full_name ||
                    authUser.user_metadata?.name ||
                    authUser.email.split('@')[0];

                const newUserResponse = await withTimeout(
                    dbClient
                        .from('users')
                        .insert([{
                            id: authUser.id,
                            email: authUser.email,
                            full_name: fullName,
                            role: authUser.user_metadata?.role || 'DESIGNER',
                            status: 'ACTIVE'
                        }])
                        .select()
                        .single(),
                    8000,
                    'User profile creation timed out. Please refresh and try again.'
                ) as any;

                if (newUserResponse.error) throw newUserResponse.error;
                userRecord = newUserResponse.data;
            }

            currentUserCache = userRecord as User;
            return currentUserCache;

        } catch (err) {
            console.error('❌ getPublicUser failed:', err);
            return null;
        }
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
        const supabaseUrl = (process as any).env?.VITE_SUPABASE_URL || 'https://zxnevoulicmapqmniaos.supabase.co';

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
        const supabaseUrl = (process as any).env?.VITE_SUPABASE_URL || 'https://zxnevoulicmapqmniaos.supabase.co';

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

        // Use admin client if available (for localhost/dev/admin tools) to bypass RLS
        // Fallback to public client (RLS enforced)
        const client = supabaseAdmin || supabase;

        const { data, error } = await client
            .from('users')
            .select(`
                id,
                email,
                full_name,
                role,
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
        console.log('🔍 Fetching sub-editors list...');
        // Fetch users with SUB_EDITOR role
        const { data: subEditors, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'SUB_EDITOR')
            .eq('status', UserStatus.ACTIVE);

        if (error) {
            console.error('Error fetching sub-editors:', error);
            throw error;
        }

        // Also fetch Ajay specifically if he's not already in the list
        // Ajay's email: ajaypapagari@applywizz.com
        const { data: ajayUser, error: ajayError } = await supabase
            .from('users')
            .select('*')
            .eq('email', 'ajaypapagari@applywizz.com')
            .single();

        let results = [...(subEditors || [])];

        // Add Ajay if found and not already in the list
        if (!ajayError && ajayUser) {
            if (!results.find(u => u.id === ajayUser.id)) {
                results.push(ajayUser);
            }
        }

        // Filter out Harshitha as requested
        results = results.filter(u => !u.full_name?.toLowerCase().includes('harshitha'));

        console.log(`✅ Fetched ${results.length} sub-editors (after filtering Harshitha and adding Ajay if needed)`);
        return results as User[];
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
        if (user) {
            const publicUser = await auth.getPublicUser();
            if (publicUser) {
                await systemLogs.add({
                    actor_id: publicUser.id,
                    actor_name: publicUser.full_name,
                    actor_role: publicUser.role,
                    action: 'USER_DELETED',
                    details: `User ${user.full_name} (${user.email}) was deleted by ${publicUser.full_name}`
                });
            }
        }

        return true;
    }
};

export const SYSTEM_BRANDS = [
    { id: 'sys-1', brand_name: 'Shyam Personal Brand', target_audience: 'Founders & Creators', campaign_objective: 'Personal Branding', isSystem: true, brand_type: 'REEL' },
    { id: 'sys-2', brand_name: 'ApplyWizz', target_audience: 'Job Seekers', campaign_objective: 'App Installations', isSystem: true, brand_type: 'REEL' },
    { id: 'sys-3', brand_name: 'ApplyWizz Job Board', target_audience: 'Employers & Job Seekers', campaign_objective: 'Job Board Engagement', isSystem: true, brand_type: 'REEL' },
    { id: 'sys-4', brand_name: 'Lead Magnet (RTW)', target_audience: 'Lead Generation', campaign_objective: 'Lead Generation', isSystem: true, brand_type: 'REEL' },
    { id: 'sys-5', brand_name: 'ApplyWizz USA Jobs', target_audience: 'US Job Seekers', campaign_objective: 'US Market Reach', isSystem: true, brand_type: 'REEL' },
];

export const brands = {
    async getAll() {
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from('brands')
            .select('*')
            .order('brand_name', { ascending: true });

        if (error) {
            console.warn('Could not fetch brands', error);
            return [];
        }
        return data || [];
    },
    async create(brand: {
        brand_name: string;
        campaign_objective: string;
        target_audience: string;
        deliverables: string;
        brand_type: 'REEL' | 'STORY';
        created_by_user_id?: string;
    }) {
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from('brands')
            .insert([brand])
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async delete(id: string) {
        const client = supabaseAdmin || supabase;

        // 1. First try to delete by ID
        const { error, count } = await client
            .from('brands')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) {
            console.error('Database error during brand deletion:', error);
            throw error;
        }

        if (count === 0) {
            const msg = `Failed to delete brand: Record with ID ${id} not found or permission denied (RLS).`;
            console.error(msg);
            throw new Error(msg);
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
    async getForRole(role: Role, userId?: string) {
        console.log(`📥 Fetching projects for role: ${role}`);

        let query = supabase.from('projects').select(`
      *,
      workflow_history(*)
    `);

        // ✅ FIX: Filter by stage only, not assigned_to_role
        switch (role) {
            case Role.WRITER:
                // Writer inbox: SCRIPT, REJECTED, REWORK, WAITING_APPROVAL, WRITER_VIDEO_APPROVAL, MULTI_WRITER_APPROVAL, WRITER_REVISION
                // Only show projects assigned to the writer role
                query = query.or(
                    `current_stage.eq.${WorkflowStage.SCRIPT},status.eq.${TaskStatus.REJECTED},status.eq.${TaskStatus.REWORK},status.eq.${TaskStatus.WAITING_APPROVAL},current_stage.eq.${WorkflowStage.WRITER_VIDEO_APPROVAL},current_stage.eq.${WorkflowStage.MULTI_WRITER_APPROVAL},current_stage.eq.${WorkflowStage.WRITER_REVISION}`
                ).eq('assigned_to_role', Role.WRITER);
                break;

            case Role.CMO:
                // CMO inbox: SCRIPT_REVIEW_L1, FINAL_REVIEW_CMO, and POST_WRITER_REVIEW (joint with Ops)
                query = query.or(
                    `current_stage.eq.${WorkflowStage.SCRIPT_REVIEW_L1},current_stage.eq.${WorkflowStage.FINAL_REVIEW_CMO},current_stage.eq.${WorkflowStage.POST_WRITER_REVIEW}`
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
                // Filter by assigned user if ID is provided
                if (userId) {
                    query = query.eq('assigned_to_user_id', userId);
                }
                break;

            case Role.OPS:
                // Ops inbox: include projects that have moved forward after CEO approval
                // These projects should be visible to Ops even if assigned to other roles
                // Also include projects explicitly assigned to OPS role
                const opsStages = [
                    WorkflowStage.PARTNER_REVIEW,
                    WorkflowStage.SENT_TO_INFLUENCER,
                    WorkflowStage.PA_FINAL_REVIEW,
                    WorkflowStage.POST_WRITER_REVIEW,
                    WorkflowStage.OPS_SCHEDULING,
                    WorkflowStage.POSTED
                ];

                // Combine the conditions properly for Supabase OR query
                const stageCondition = `current_stage.in.(${opsStages.join(',')})`;
                const roleCondition = `assigned_to_role.eq.${Role.OPS}`;
                query = query.or(`${stageCondition},${roleCondition}`);
                break;

            case Role.PARTNER_ASSOCIATE:
                // Partner Associate inbox: PARTNER_REVIEW, SENT_TO_INFLUENCER, and PA_FINAL_REVIEW stage
                query = query.or(`current_stage.eq.${WorkflowStage.PARTNER_REVIEW},current_stage.eq.${WorkflowStage.SENT_TO_INFLUENCER},current_stage.eq.${WorkflowStage.PA_FINAL_REVIEW}`);
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
            // Perform all visibility queries in parallel for maximum performance
            const [
                { data: historyData, error: historyError },
                { data: assignedByIdData, error: assignedByIdError },
                { data: assignedByRoleData, error: assignedByRoleError },
                { data: visibleToRoleData, error: visibleToRoleError },
                { data: directDesignerUploadsData, error: directDesignerUploadsError }
            ] = await Promise.all([
                supabase.from('workflow_history').select('project_id, timestamp, projects (*)').eq('actor_id', user.id),
                supabase.from('projects').select('*').eq('assigned_to_user_id', user.id),
                supabase.from('projects').select('*').in('assigned_to_role', [user.role, ...(user.secondary_roles || [])]),
                supabase.from('projects').select('*').overlaps('visible_to_roles', [user.role, ...(user.secondary_roles || [])]),
                user.role === Role.DESIGNER
                    ? supabase.from('projects').select('*').eq('created_by_user_id', user.id).eq('data->>source', 'DESIGNER_DIRECT_UPLOAD')
                    : Promise.resolve({ data: [], error: null })
            ]);

            if (historyError) throw historyError;
            if (assignedByIdError) throw assignedByIdError;
            if (assignedByRoleError) throw assignedByRoleError;
            if (visibleToRoleError) throw visibleToRoleError;
            if (directDesignerUploadsError) throw directDesignerUploadsError;

            if (!historyData || !assignedByIdData || !assignedByRoleData || !visibleToRoleData) {
                console.warn('One or more visibility queries returned null data');
            }

            // ✅ Merge all results and remove duplicates
            const projectMap = new Map<string, Project & { latest_activity?: Date }>();

            // Helper function to check if a project should be visible to the user based on rework rules
            const isProjectVisibleToUser = (project: any) => {
                // Designer-created direct uploads are handed off to CMO immediately,
                // but the creating designer should still see them in delivered history.
                if (project.data?.source === 'DESIGNER_DIRECT_UPLOAD') {
                    return project.created_by_user_id === user.id ||
                        project.assigned_to_role === user.role ||
                        project.visible_to_roles?.includes(user.role);
                }

                // If project is in REWORK status, strict filtering applies
                if (project.status === 'REWORK') {
                    // 1. If we have a rework_target_role (new column), use it for strict filtering
                    if (project.rework_target_role) {
                        return project.rework_target_role === user.role;
                    }

                    // 2. Fallback to legacy data field if column is empty
                    if (project.data?.rework_target_role) {
                        return project.data.rework_target_role === user.role;
                    }

                    // 3. Fallback to assigned_to_role if no rework_target_role is specified
                    return project.assigned_to_role === user.role;
                }

                // If not in REWORK status, project is visible
                return true;
            };

            // Add history projects
            historyData.forEach((row: any) => {
                if (row.projects) {
                    const project = row.projects;
                    // Only add project if it should be visible to the user
                    if (isProjectVisibleToUser(project)) {
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
                }
            });

            // Add projects assigned to user by ID (may overwrite history entries if more recent)
            assignedByIdData.forEach((project: any) => {
                if (isProjectVisibleToUser(project)) {
                    if (!projectMap.has(project.id) ||
                        !projectMap.get(project.id)?.latest_activity ||
                        new Date(project.updated_at) > new Date(projectMap.get(project.id)!.latest_activity!)) {
                        projectMap.set(project.id, {
                            ...project,
                            latest_activity: new Date(project.updated_at)
                        });
                    }
                }
            });

            // Add projects assigned to user's role (may overwrite previous entries if more recent)
            assignedByRoleData.forEach((project: any) => {
                if (isProjectVisibleToUser(project)) {
                    if (!projectMap.has(project.id) ||
                        !projectMap.get(project.id)?.latest_activity ||
                        new Date(project.updated_at) > new Date(projectMap.get(project.id)!.latest_activity!)) {
                        projectMap.set(project.id, {
                            ...project,
                            latest_activity: new Date(project.updated_at)
                        });
                    }
                }
            });

            // Add projects where user's role is in visible_to_roles (may overwrite previous entries if more recent)
            visibleToRoleData.forEach((project: any) => {
                if (isProjectVisibleToUser(project)) {
                    if (!projectMap.has(project.id) ||
                        !projectMap.get(project.id)?.latest_activity ||
                        new Date(project.updated_at) > new Date(projectMap.get(project.id)!.latest_activity!)) {
                        projectMap.set(project.id, {
                            ...project,
                            latest_activity: new Date(project.updated_at)
                        });
                    }
                }
            });

            directDesignerUploadsData.forEach((project: any) => {
                if (isProjectVisibleToUser(project)) {
                    if (!projectMap.has(project.id) ||
                        !projectMap.get(project.id)?.latest_activity ||
                        new Date(project.updated_at || project.created_at) > new Date(projectMap.get(project.id)!.latest_activity!)) {
                        projectMap.set(project.id, {
                            ...project,
                            latest_activity: new Date(project.updated_at || project.created_at)
                        });
                    }
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
                    // Group history by project_id
                    const typedHistoryData = historyData as unknown as HistoryEvent[];
                    const historyMap = new Map<string, HistoryEvent[]>();
                    typedHistoryData.forEach((entry) => {
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
        current_stage?: WorkflowStage;
        status?: TaskStatus;
        task_status?: TaskStatus;
        assigned_to_role: Role;
        assigned_to_user_id?: string;
        priority?: Priority;
        due_date: string;
        data: any;
        brand?: string;

        // Creator info (display and workflow)
        created_by_user_id?: string | null;
        created_by_name?: string | null;
        writer_id: string;
        writer_name?: string | null;

        // Direct Video/Designer properties
        edited_video_link?: string;
        edited_at?: string;
        editor_uploaded_at?: string;
        edited_by_user_id?: string;
        edited_by_name?: string;
        video_link?: string;
        cine_uploaded_at?: string;
        creative_link?: string;
        thumbnail_link?: string;
        designer_uploaded_at?: string;
        designer_name?: string;
        visible_to_roles?: Role[] | null;
    }) {
        console.log('Creating project with data:', projectData);

        // HARD GUARD: Ensure writer_id is provided to prevent FK violations
        if (!projectData.writer_id) {
            throw new Error('writer_id is REQUIRED and must be a valid public.users.id');
        }

        // Prepare the insert data object carefully
        const insertData: any = {
            id: createLocalProjectId(),
            title: projectData.title,
            channel: projectData.channel,
            content_type: projectData.content_type,
            assigned_to_role: projectData.assigned_to_role,
            due_date: projectData.due_date,
            data: projectData.data,

            // Creator info (display and workflow)
            created_by_user_id: projectData.created_by_user_id ?? null,
            created_by_name: projectData.created_by_name ?? null,
            writer_id: projectData.writer_id,
            writer_name: projectData.writer_name ?? null,

            // Direct Video/Designer properties
            edited_video_link: projectData.edited_video_link,
            edited_at: projectData.edited_at,
            editor_uploaded_at: projectData.editor_uploaded_at,
            edited_by_user_id: projectData.edited_by_user_id,
            edited_by_name: projectData.edited_by_name,
            video_link: projectData.video_link,
            cine_uploaded_at: projectData.cine_uploaded_at,
            creative_link: projectData.creative_link,
            thumbnail_link: projectData.thumbnail_link,
            designer_uploaded_at: projectData.designer_uploaded_at,
            designer_name: projectData.designer_name,
            visible_to_roles: projectData.visible_to_roles ?? null,

            // Use provided values or defaults if not provided
            brand: projectData.brand,
            current_stage: projectData.current_stage || WorkflowStage.SCRIPT,
            task_status: projectData.task_status || projectData.status || TaskStatus.TODO,
            status: projectData.status || TaskStatus.TODO,
            priority: projectData.priority || 'NORMAL'
        };

        // Only include assigned_to_user_id if it's explicitly provided (not undefined)
        // This prevents potential constraint violations from null values
        if (projectData.assigned_to_user_id !== undefined && projectData.assigned_to_user_id !== null) {
            insertData.assigned_to_user_id = projectData.assigned_to_user_id;
        }

        console.log('Prepared insert data:', insertData);
        console.log('   - created_by_user_id:', insertData.created_by_user_id);
        console.log('   - writer_id:', insertData.writer_id);

        if (supabaseRestServiceKey) {
            console.log('Executing INSERT via direct REST client');
            console.log('   - Effective client type: DIRECT_ADMIN_REST');
            const restCreatedProject = await insertProjectViaRest(insertData);
            console.log('Successfully created project with ID:', restCreatedProject.id);
            return restCreatedProject;
        }

        try {
            console.log('🔗 Executing INSERT with database client');
            console.log('   - Client type:', dbClient === supabaseAdmin ? 'ADMIN' : 'ANON');
            const insertClient = supabaseAdmin || dbClient;
            console.log('   - Has service role:', !!supabaseAdmin);
            console.log('   - Effective client type:', insertClient === supabaseAdmin ? 'ADMIN' : 'ANON');

            console.log('🔗 Executing INSERT with database client... (Wait started)');
            const insertPromise = insertClient
                .from('projects')
                .insert([insertData])
                .select()
                .single();

            const result = await withTimeout(
                insertPromise,
                15000,
                'Database timeout: Project creation took too long. Please check your connection and try again.'
            ) as any;

            console.log('📊 INSERT result received:', result);

            if (result.error) {
                console.error('Failed to create project:', result.error);
                console.error('Error details:', JSON.stringify(result.error, null, 2));
                console.error('Error hint:', result.error.hint);
                console.error('Error message:', result.error.message);
                console.error('Error code:', result.error.code);
                throw new Error(`Failed to create project: ${result.error.message}`);
            }

            if (!result.data) {
                console.error('No data returned from insert');
                throw new Error('No data returned from project creation');
            }

            console.log('✅ Successfully created project with ID:', result.data.id);
            const createdProject = result.data as any;
            if (!createdProject.status && createdProject.task_status) {
                createdProject.status = createdProject.task_status;
            }
            return createdProject as Project;
        } catch (error: any) {
            console.error('❌ Project creation failed:', error);
            throw error;
        }
    },

    // Update project
    async update(id: string, updates: Partial<Project>) {
        console.log('Updating project', id, 'with data:', updates);

        // --- Asset History Preservation Logic ---
        // Fetch current project state to check if assets are being overwritten
        const { data: currentProject } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (currentProject) {
            // Define asset field mappings to their history arrays
            const assetMappings = [
                { linkField: 'video_link' as const, historyField: 'cine_video_links_history' as const },
                { linkField: 'edited_video_link' as const, historyField: 'editor_video_links_history' as const },
                { linkField: 'thumbnail_link' as const, historyField: 'designer_video_links_history' as const },
                { linkField: 'creative_link' as const, historyField: 'designer_video_links_history' as const }
            ];

            for (const mapping of assetMappings) {
                const newValue = updates[mapping.linkField];
                const oldValue = currentProject[mapping.linkField];

                // If link is changing and we have an old value, preserve it in history
                if (newValue && oldValue && newValue !== oldValue) {
                    console.log(`📦 Preserving old ${mapping.linkField} in history before update`);

                    // Special case: sub-editor vs editor history
                    let actualHistoryField = mapping.historyField;
                    if (mapping.linkField === 'edited_video_link' && currentUserCache?.role === Role.SUB_EDITOR) {
                        actualHistoryField = 'sub_editor_video_links_history' as any;
                    }

                    const existingHistory = currentProject[actualHistoryField] || [];
                    // Only add if not already in history to avoid duplicates
                    if (!existingHistory.includes(oldValue)) {
                        (updates as any)[actualHistoryField] = [...existingHistory, oldValue];
                    }
                }
            }
        }

        // Remove ownership fields before update to let backend handle it
        // HARD SAFETY: writer_id must NEVER be updated after creation
        const {
            created_by,
            created_by_user_id,
            writer_id,
            writer_name,
            ...cleanUpdates
        } = updates as any;


        const dbUpdates = { ...cleanUpdates };
        if (dbUpdates.status) {
            dbUpdates.task_status = dbUpdates.status;
        }

        const { error } = await supabase
            .from('projects')
            .update(dbUpdates)
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

        // Prepare top-level updates to keep them in sync with data blob
        // This ensures the top-level columns used for filtering/dashboards are accurate
        const topLevelUpdates: any = { data: newData };

        // Sync brand
        if (dataUpdates.brand) {
            topLevelUpdates.brand = dataUpdates.brand === 'OTHER' ? dataUpdates.brand_other : dataUpdates.brand;
        }

        const result = await this.update(id, topLevelUpdates);
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
        // First delete workflow history to avoid FK constraint violations
        const { error: historyError } = await supabase
            .from('workflow_history')
            .delete()
            .eq('project_id', id);

        if (historyError) {
            console.error('Failed to delete workflow history during project deletion:', historyError);
            // We continue anyway as the project deletion might still work if cascade is enabled
        }

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
        nextRole: Role | string, // NEW MEANING: next responsible role
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
        console.log('📝 [recordAction] START for project:', projectId);
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await withTimeout(
            auth.getPublicUser(),
            12000,
            'Designer profile lookup timed out. Please refresh and try again.'
        );
        const finalUserId = publicUser?.id || userId;
        const finalUserName = publicUser?.full_name || userName;

        console.log('📝 [recordAction] Finding stage for project:', projectId);
        // 1. Fetch current stage from projects table BEFORE insertion (Mandatory Fix)
        // This ensures from_stage correctly captures the stage before the transition
        const { data: project, error: fetchError } = await supabase
            .from('projects')
            .select('current_stage, assigned_to_role')
            .eq('id', projectId)
            .single();

        if (fetchError || !project) {
            console.error('❌ [recordAction] Failed to fetch project:', fetchError);
            throw fetchError || new Error('Project not found');
        }
        console.log('📝 [recordAction] Current project stage found:', project.current_stage);

        const fromStage = actorRole || project.assigned_to_role;
        const toStage = nextRole;

        // Map frontend action values to strictly allowed database actions
        const actionMap: Record<string, string> = {
            'CREATED': 'SUBMITTED',
            'SUBMITTED': 'SUBMITTED',
            'APPROVED': 'APPROVED',
            'REWORK': 'REWORK',
            'REWORK_VIDEO_SUBMITTED': 'SUBMITTED',
            'REWORK_EDIT_SUBMITTED': 'SUBMITTED',
            'REWORK_DESIGN_SUBMITTED': 'SUBMITTED',
            'REWORK_SUBMITTED': 'SUBMITTED',
            'REJECTED': 'REJECTED',
            'PUBLISHED': 'APPROVED',
            'SUB_EDITOR_ASSIGNED': 'SUBMITTED',
            'ASSIGNED_TO_SUB_EDITOR': 'SUBMITTED',
            'SUB_EDITOR_VIDEO_UPLOADED': 'SUBMITTED',
            'EDITOR_VIDEO_UPLOADED': 'SUBMITTED',
            'CINE_VIDEO_UPLOADED': 'SUBMITTED',
            'VIDEO_REWORK_ROUTED_TO_SUB_EDITOR': 'REWORK',
            'VIDEO_REWORK_ROUTED_TO_EDITOR': 'REWORK'
        };

        const dbAction = actionMap[action] || 'SUBMITTED';

        // Log the data we're about to insert for debugging
        console.log('Recording workflow history with role-based transition:', {
            project_id: projectId,
            from_stage: fromStage,
            to_stage: toStage,
            action: dbAction
        });

        const { error } = await supabase
            .from('workflow_history')
            .insert({
                project_id: projectId,
                from_stage: fromStage, // ROLE
                to_stage: toStage,     // ROLE
                stage: project.current_stage, // Keep original stage info here if field exists
                actor_id: finalUserId,
                actor_name: finalUserName,
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
            throw error;
        }

        // 2. Update timestamps based on the action and the role that was assigned when action happened
        const timestampUpdates = getTimestampUpdate(action, project.assigned_to_role);
        if (Object.keys(timestampUpdates).length > 0) {
            await supabase
                .from('projects')
                .update(timestampUpdates)
                .eq('id', projectId);
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
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await withTimeout(
            auth.getPublicUser(),
            12000,
            'Designer profile lookup timed out. Please refresh and try again.'
        );
        const finalUserId = publicUser?.id || userId;
        const finalUserName = publicUser?.full_name || userName;

        // Fetch current state BEFORE any updates to ensure accurate from_stage recording
        const currentProject = await projects.getById(projectId);
        if (!currentProject) {
            throw new Error('Project not found');
        }

        // 1. Add workflow history BEFORE project update (Mandatory Fix)
        await this.recordAction(
            projectId,
            nextRole, // to_stage is now the next ROLE
            finalUserId,
            finalUserName,
            'SUBMITTED',
            comment || 'Submitted for review',
            undefined, // scriptContent
            Role.WRITER, // fromRole
            nextRole, // toRole
            Role.WRITER // actorRole
        );

        // 2. Update project
        const { error: updateError } = await supabase
            .from('projects')
            .update({
                current_stage: nextStage,
                assigned_to_role: nextRole,
                status: TaskStatus.WAITING_APPROVAL
            })
            .eq('id', projectId);

        if (updateError) {
            console.error('Failed to update project:', updateError);
            throw updateError;
        }

        // Fetch the updated project separately to avoid conflicting select parameters
        const { data: updateData, error: fetchDataError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (fetchDataError) {
            console.error('Failed to fetch updated project:', fetchDataError);
            throw fetchDataError;
        }

        if (!updateData) {
            throw new Error('Project not found or no rows updated');
        }

        const data = updateData;

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
            .select('id, full_name')
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

        // Get the IDs of active writers
        let finalWriterUsers = writerUsers;

        // Look for Varshini and Kishore specifically
        const specialWriters = writerUsers.filter(w =>
            (w as any).full_name?.toLowerCase().includes('varshini') ||
            (w as any).full_name?.toLowerCase().includes('kishore')
        );

        // If we found either Varshini or Kishore, they (and only they) are required
        if (specialWriters.length > 0) {
            console.log('📝 Found Varshini/Kishore - setting them as required writers');
            finalWriterUsers = specialWriters;
        } else {
            console.log('⚠️ No writers named Varshini or Kishore found. Requiring all active writers.');
            finalWriterUsers = writerUsers;
        }

        console.log('📋 Required writers:', finalWriterUsers.map(w => w.full_name || 'Unknown'));

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

        // Get the IDs of required writers
        const requiredWriterIds = new Set(finalWriterUsers.map(writer => writer.id));

        // Filter approvals to only include those from required writers
        const approvedRequiredWriterIds = new Set(approvals.filter(approval =>
            requiredWriterIds.has(approval.actor_id)
        ).map(approval => approval.actor_id));

        console.log('✅ Approved required writer IDs:', Array.from(approvedRequiredWriterIds));

        // Check if all required writers have approved
        const allWritersHaveApproved = finalWriterUsers.every(writer =>
            approvedRequiredWriterIds.has(writer.id)
        );

        console.log('🎯 All required writers approved:', allWritersHaveApproved);
        console.log('📊 Comparison:', {
            totalRequiredWriters: finalWriterUsers.length,
            approvedWriters: approvedRequiredWriterIds.size,
            requiredWriterIds: Array.from(requiredWriterIds),
            approvedIds: Array.from(approvedRequiredWriterIds)
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
        fromRoleOverride?: string,
        metadata?: any,
        targetUserId?: string | null,
        extraUpdates?: any
    ) {
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();
        const finalUserId = publicUser?.id || userId;
        const finalUserName = publicUser?.full_name || userName;
        const finalUserRole = publicUser?.role || userRole;

        // First get the current project to preserve important fields
        // First get the current project to preserve important fields
        let rawProject;
        try {
            rawProject = await projects.getById(projectId);
        } catch (error) {
            console.error('Failed to fetch current project for approval:', error);
            throw error;
        }

        // Check if the brand belongs to a Partner Associate if at CEO final review stage
        const brandName = rawProject.brand || rawProject.data?.brand;
        let isPAProject = false;

        if (rawProject.current_stage === WorkflowStage.FINAL_REVIEW_CEO && brandName) {
            try {
                const { data: brandMatch } = await supabase
                    .from('brands')
                    .select('id')
                    .eq('brand_name', brandName)
                    .maybeSingle();

                if (brandMatch) {
                    isPAProject = true;
                    console.log(`✅ Project ${projectId} identified as Partner Associate brand: ${brandName}`);
                }
            } catch (err) {
                console.warn('Error checking brand PA status:', err);
            }
        }

        // Create a partial project object with only the properties we need
        const currentProject = {
            id: rawProject.id,
            current_stage: rawProject.current_stage,
            assigned_to_user_id: rawProject.assigned_to_user_id,
            brand: brandName,
            // Fill in other required fields with defaults to satisfy Project type
            title: rawProject.title,
            channel: rawProject.channel,
            content_type: rawProject.content_type,
            assigned_to_role: rawProject.assigned_to_role,
            status: rawProject.status,
            priority: rawProject.priority,
            due_date: rawProject.due_date,
            created_at: rawProject.created_at,
            data: {
                ...rawProject.data,
                is_pa_brand: isPAProject
            },
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
            console.log('👤 Current user ID:', finalUserId);
            console.log('🎯 Next stage/role parameters:', { nextStage, nextRole });

            // Validate that only writers can approve in MULTI_WRITER_APPROVAL stage
            if (userRole !== Role.WRITER) {
                console.log(`⚠️ User with role ${userRole} attempted to approve in MULTI_WRITER_APPROVAL stage. Only writers can approve here.`);
                // Instead of recording as APPROVED, we should record the actual action that was taken
                // This handles cases where non-writers (like editors uploading videos) trigger advanceWorkflow

                // Determine the appropriate action type based on the comment
                let actionType = 'SUBMITTED'; // Default action
                const lowerComment = (comment || '').toLowerCase();
                if (lowerComment.includes('uploaded')) {
                    actionType = 'SUBMITTED';
                }

                // Record the actual action taken by the non-writer
                await this.recordAction(
                    projectId,
                    nextRole, // to_stage
                    finalUserId,
                    finalUserName,
                    actionType,
                    comment || `${finalUserName} performed action in ${currentProject.current_stage}`,
                    undefined,
                    currentProject.assigned_to_role as Role, // fromRole
                    nextRole, // toRole
                    finalUserRole, // actorRole
                    metadata // Pass through metadata
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

            // Check if special writers exist in the system
            const { data: allWriters } = await supabase
                .from('users')
                .select('full_name')
                .eq('role', Role.WRITER)
                .eq('status', 'ACTIVE');

            const hasSpecialWriters = allWriters?.some(w =>
                w.full_name?.toLowerCase().includes('varshini') ||
                w.full_name?.toLowerCase().includes('kishore')
            );

            // If special writers exist, only they can approve
            if (hasSpecialWriters) {
                const name = finalUserName?.toLowerCase() || '';
                if (!name.includes('varshini') && !name.includes('kishore')) {
                    console.log(`⚠️ User ${finalUserName} is not authorized to approve in this stage. Only Varshini and Kishore can approve.`);
                    return await projects.getById(projectId);
                }
            }

            // First, check if this writer has already approved this project in the MULTI_WRITER_APPROVAL stage
            const { data: existingApproval, error: existingError } = await supabase
                .from('workflow_history')
                .select('id')
                .eq('project_id', projectId)
                .eq('stage', WorkflowStage.MULTI_WRITER_APPROVAL)
                .eq('actor_id', finalUserId)
                .eq('action', 'APPROVED')
                .maybeSingle();

            if (existingApproval) {
                console.log('⚠️ Writer has already approved this project in MULTI_WRITER_APPROVAL stage');
                return await projects.getById(projectId);
            }

            // Record the approval for this specific writer
            await this.recordAction(
                projectId,
                Role.WRITER, // Staying with writers for now
                finalUserId,
                finalUserName,
                'APPROVED',
                comment || `${finalUserName} approved the project`,
                undefined,
                Role.WRITER, // fromRole
                Role.WRITER, // toRole (indicates individual approval)
                Role.WRITER // actorRole
            );
            console.log('✅ Successfully recorded individual writer approval:', finalUserId);

            // Fetch progress data to decide if we should advance
            const { data: activeWriters } = await supabase
                .from('users')
                .select('id')
                .eq('role', Role.WRITER)
                .eq('status', 'ACTIVE');

            const totalWritersRequired = activeWriters?.length || 0;
            const approvedCount = await this.getApprovedWritersCount(projectId);
            const allRequiredApproved = await this.checkAllWritersApproved(projectId);

            console.log(`🎯 Approval Progress: ${approvedCount}. All required approved: ${allRequiredApproved}`);

            if (allRequiredApproved) {
                console.log('🚀 All writers have approved, advancing to VIDEO_EDITING stage');

                // 1. Record the final TRANSITION action BEFORE update (Mandatory Fix)
                await this.recordAction(
                    projectId,
                    nextRole, // nextRole is the target
                    finalUserId,
                    finalUserName,
                    actionOverride || 'SUBMITTED',
                    comment || `All writers have approved - Project advanced to ${nextStage}.`,
                    undefined,
                    Role.WRITER, // fromRole
                    nextRole,    // toRole
                    Role.WRITER,  // actorRole
                    metadata
                );

                // 2. Update project
                const updateData: any = {
                    current_stage: nextStage,
                    assigned_to_role: nextRole,
                    assigned_to_user_id: null,
                    status: TaskStatus.WAITING_APPROVAL,
                    visible_to_roles: [nextRole, Role.WRITER, Role.OPS],
                    updated_at: new Date().toISOString()
                };

                const { error: updateError } = await supabase
                    .from('projects')
                    .update(updateData)
                    .eq('id', projectId);

                if (updateError) {
                    console.error('❌ Failed to update project to next stage:', updateError);
                    throw updateError;
                }

                // Notify New Role Users
                const { data: targetUsers } = await supabase
                    .from('users')
                    .select('id')
                    .eq('role', nextRole)
                    .eq('status', 'ACTIVE');

                if (targetUsers && targetUsers.length > 0) {
                    for (const targetUser of targetUsers) {
                        try {
                            const dbWithNotifications = db as any;
                            await dbWithNotifications.notifications.create(
                                targetUser.id,
                                projectId,
                                'PROJECT_ASSIGNED',
                                'New Project Ready',
                                `Writers have approved the project: ${currentProject.title}. Please review.`
                            );
                        } catch (notificationError) {
                            console.error('Failed to send notification:', notificationError);
                        }
                    }
                }

                console.log('✅ Workflow successfully transitioned to VIDEO_EDITING stage.');
                return await projects.getById(projectId);
            } else {
                console.log('⏳ Approval incomplete. Staying in MULTI_WRITER_APPROVAL.');
                await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId);
                return await projects.getById(projectId);
            }
        } else { // Normal approval flow for other stages
            // Automatically determine next stage if at CEO final review to handle PA brands
            let finalNextStage = nextStage;
            let finalNextRole = nextRole;

            if (rawProject?.current_stage === WorkflowStage.FINAL_REVIEW_CEO && isPAProject) {
                const nextInfo = helpers.getNextStage(
                    WorkflowStage.FINAL_REVIEW_CEO,
                    rawProject.content_type,
                    'APPROVED',
                    { ...rawProject.data, is_pa_brand: true }
                );
                finalNextStage = nextInfo.stage;
                finalNextRole = nextInfo.role;
                console.log(`🔀 Overriding next stage to ${finalNextStage} (${finalNextRole}) due to PA brand detection`);
            }

            // Update project
            const projectUpdateData: any = {
                current_stage: finalNextStage,
                // Use targetUserId if provided, otherwise preserve or set to null
                assigned_to_user_id: targetUserId !== undefined ? targetUserId : (currentProject?.assigned_to_user_id || null),
                ...extraUpdates
            };

            // Special handling for FINAL_REVIEW_CMO stage
            if (finalNextStage === WorkflowStage.FINAL_REVIEW_CMO) {
                projectUpdateData.assigned_to_role = Role.CMO; // Assign to CMO
                projectUpdateData.status = TaskStatus.WAITING_APPROVAL; // Set to WAITING_APPROVAL status
                projectUpdateData.visible_to_roles = ['CMO', 'OPS']; // Make visible to CMO and OPS
            } else if (finalNextStage === WorkflowStage.MULTI_WRITER_APPROVAL) {
                // When sending to multi-writer approval, make visible to writer and ops
                projectUpdateData.assigned_to_role = Role.WRITER; // Assign to writer
                projectUpdateData.status = TaskStatus.WAITING_APPROVAL; // Set to WAITING_APPROVAL status
                projectUpdateData.visible_to_roles = ['WRITER', 'OPS']; // Make visible to writer and ops
            } else if (finalNextStage === WorkflowStage.POST_WRITER_REVIEW) {
                // When sending to post-writer review, make visible to CMO and OPS in parallel
                projectUpdateData.assigned_to_role = Role.CMO; // Primary assignee is CMO
                projectUpdateData.status = TaskStatus.WAITING_APPROVAL; // Set to WAITING_APPROVAL status
                projectUpdateData.visible_to_roles = ['CMO', 'OPS']; // Make visible to both CMO and OPS
            } else {
                projectUpdateData.assigned_to_role = finalNextRole;
                projectUpdateData.status = TaskStatus.WAITING_APPROVAL;

                // When CEO approves, check if the project uses a PA-created (dynamic) brand.
                // If it does, override the default CINE route to ensure it goes to the PA workflow.
                if (userRole === Role.CEO) {
                    const projectBrand = rawProject.brand;
                    if (projectBrand) {
                        const { data: paCreatedBrand } = await supabase
                            .from('brands')
                            .select('id, created_by_user_id')
                            .eq('brand_name', projectBrand)
                            .maybeSingle();

                        if (paCreatedBrand && paCreatedBrand.created_by_user_id) {
                            // Brand was registered by a PA — FORCE route back to PA workflow instead of default CINE
                            if (rawProject?.current_stage === WorkflowStage.SCRIPT_REVIEW_L2 || rawProject?.current_stage === WorkflowStage.FINAL_REVIEW_CEO) {
                                finalNextStage = WorkflowStage.PARTNER_REVIEW;
                                finalNextRole = Role.PARTNER_ASSOCIATE;
                                projectUpdateData.current_stage = finalNextStage;
                                projectUpdateData.assigned_to_role = finalNextRole;
                                console.log("🔀 OVERRIDING default pipeline! Routing CEO approval to PARTNER_ASSOCIATE instead.");
                            }

                            // Surface project to all PA users
                            projectUpdateData.visible_to_roles = [finalNextRole, 'PARTNER_ASSOCIATE', 'OPS'];

                            // If moving to PARTNER_REVIEW, assign to the specific creator!
                            if (finalNextStage === WorkflowStage.PARTNER_REVIEW) {
                                projectUpdateData.assigned_to_user_id = paCreatedBrand.created_by_user_id;
                                console.log(`🎯 CEO approved script: routed and assigned back to brand creator (PA): ${paCreatedBrand.created_by_user_id}`);
                            } else {
                                console.log(`✅ CEO approved project using PA brand "${projectBrand}". Added PARTNER_ASSOCIATE to visible_to_roles.`);
                            }
                        }
                    }
                }
            }

            // 1. Record the approval in workflow history BEFORE update (Mandatory Fix)
            await this.recordAction(
                projectId,
                finalNextStage,
                finalUserId,
                finalUserName,
                actionOverride || 'APPROVED',
                comment || `Approved by ${userRole}`,
                undefined,
                fromRoleOverride ? fromRoleOverride as Role : userRole,
                finalNextRole,
                finalUserRole,
                metadata
            );

            // 2. Update project
            const { error: updateError } = await supabase
                .from('projects')
                .update(projectUpdateData)
                .eq('id', projectId);

            if (updateError) {
                console.error('Failed to update project:', updateError);
                throw updateError;
            }

            // Fetch the updated project separately to avoid conflicting select parameters
            const { data: updateData, error: fetchDataError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (fetchDataError) {
                console.error('Failed to fetch updated project:', fetchDataError);
                throw fetchDataError;
            }

            if (!updateData) {
                throw new Error('Project not found or no rows updated');
            }

            const data = updateData as Project;

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
                .eq('role', finalNextRole)
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

            // Explicit notification for CMO if routed to PA_FINAL_REVIEW
            if (finalNextStage === 'PA_FINAL_REVIEW' as any) {
                const { data: cmoUsers } = await supabase
                    .from('users')
                    .select('id')
                    .eq('role', Role.CMO)
                    .eq('status', 'ACTIVE');

                if (cmoUsers && cmoUsers.length > 0) {
                    for (const cmoUser of cmoUsers) {
                        try {
                            const dbWithNotifications = db as any;
                            await dbWithNotifications.notifications.create(
                                cmoUser.id,
                                projectId,
                                'REVIEW_READY',
                                'Video Ready for Review (Notification Only)',
                                `Editor has uploaded the final video for: ${data.title}. Partner Associate has full control.`
                            );
                        } catch (notificationError) {
                            console.error('Failed to notify CMO:', notificationError);
                        }
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
        targetStage: WorkflowStage,
        targetRole: Role,
        comment?: string,
        isRework: boolean = false
    ) {
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();
        const finalUserId = publicUser?.id || userId;
        const finalUserName = publicUser?.full_name || userName;
        const finalUserRole = publicUser?.role || userRole;

        // Fetch current project state
        const { data: currentProject, error: fetchError } = await supabase
            .from('projects')
            .select('current_stage, data, assigned_to_user_id, video_link, edited_video_link, thumbnail_link, creative_link')
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

        // SPECIAL CASE: For MULTI_WRITER_APPROVAL rework, determine correct role routing
        const actualReturnToRole = (currentProject?.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL && isRework && updatedProjectData.rework_target_role)
            ? updatedProjectData.rework_target_role
            : targetRole;

        // Store rework initiator information in project metadata for routing back after completion
        let updatedData = {
            ...updatedProjectData,
            rework_initiator_role: isRework ? userRole : undefined,
            rework_initiator_stage: isRework ? currentProject?.current_stage : undefined
        };

        // Store the target role that should handle the rework for ALL rework scenarios
        // This ensures advanceWorkflow can correctly identify when the rework is done
        if (isRework && targetRole) {
            updatedData = {
                ...updatedData,
                rework_target_role: actualReturnToRole
            };
        } else {
            // Remove any existing rework_target_role if not a rework or no return role
            delete updatedData.rework_target_role;
        }

        // 1. Add workflow history BEFORE project update (Mandatory Fix)
        // Extract script content (or idea description) and asset links if available
        const videoLink = currentProject?.video_link || null;
        const editedVideoLink = currentProject?.edited_video_link || null;
        const thumbnailLink = currentProject?.thumbnail_link || null;
        const creativeLink = currentProject?.creative_link || null;

        await this.recordAction(
            projectId,
            actualReturnToRole, // to_stage is Role
            finalUserId,
            finalUserName,
            isRework ? 'REWORK' : 'REJECTED',
            comment || (isRework ? `Rework requested by ${finalUserRole}` : `Rejected by ${finalUserRole}`),
            currentProject?.data?.script_content || currentProject?.data?.idea_description || null,
            finalUserRole, // fromRole (the one who rejected)
            actualReturnToRole, // toRole (the one who must fix it)
            finalUserRole, // actorRole
            {
                rework_reason: comment,
                video_link: videoLink,
                edited_video_link: editedVideoLink,
                thumbnail_link: thumbnailLink,
                creative_link: creativeLink,
                edited_by_user_id: (currentProject as any).edited_by_user_id // Include who actually edited the video
            }
        );

        // 2. Update project
        const { error: updateError } = await supabase
            .from('projects')
            .update({
                current_stage: targetStage,
                assigned_to_role: actualReturnToRole,
                status: isRework ? TaskStatus.REWORK : TaskStatus.REJECTED,
                data: updatedData,
                visible_to_roles: null, // Clear parallel visibility so it leaves the initiator's board
                // Preserve creator information
                // Preserve assigned user ID if it exists
                assigned_to_user_id: currentProject?.assigned_to_user_id || null
            })
            .eq('id', projectId);

        if (updateError) {
            console.error('Failed to update project for rejection:', updateError);
            throw updateError;
        }

        // Fetch the updated project separately to avoid conflicting select parameters
        const { data: updateData, error: fetchDataError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (fetchDataError) {
            console.error('Failed to fetch updated project:', fetchDataError);
            throw fetchDataError;
        }

        if (!updateData) {
            throw new Error('Project not found or no rows updated');
        }

        const data = updateData;
        const actionType = isRework ? 'REWORK' : 'REJECTED';

        // Update the appropriate timestamp based on the action
        const timestampUpdates = getTimestampUpdate(actionType, finalUserRole);
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
            .eq('role', targetRole)
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
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();
        const finalUserId = publicUser?.id || userId;
        const finalUserName = publicUser?.full_name || userName;

        // 1. Add workflow history BEFORE project update (Mandatory Fix)
        await this.recordAction(
            projectId,
            Role.OPS, // TERMINATING AT OPS
            finalUserId,
            finalUserName,
            'APPROVED',
            'Project completed and published',
            undefined, // scriptContent
            Role.OPS, // fromRole
            Role.OPS, // toRole (terminating action)
            Role.OPS  // actorRole
        );

        // 2. Update project
        const { error: updateError } = await supabase
            .from('projects')
            .update({
                status: TaskStatus.DONE
            })
            .eq('id', projectId);

        if (updateError) {
            console.error('Failed to mark project as done:', updateError);
            throw updateError;
        }

        const data = await projects.getById(projectId);
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
        from_role?: Role;
        to_role?: Role;
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
            comment: entry.comment || '',
            actor_role: entry.actor_role,
            from_role: entry.from_role || entry.actor_role,
            to_role: entry.to_role || entry.actor_role
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
    getNextStage(currentStage: WorkflowStage, contentType: ContentType, action: 'APPROVED' | 'REJECTED', project?: Project | any): {
        stage: WorkflowStage;
        role: Role;
    } {
        const projectData = project?.data || project;
        const isInfluencer = isInfluencerVideo(project);
        const isCaptionBased = contentType === 'CAPTION_BASED' || projectData?.niche === 'CAPTION_BASED';

        if (action === 'REJECTED') {
            // Return to previous stage based on current stage
            const rejectMap: Record<WorkflowStage, { stage: WorkflowStage; role: Role }> = {
                [WorkflowStage.SCRIPT_REVIEW_L1]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
                [WorkflowStage.SCRIPT_REVIEW_L2]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
                [WorkflowStage.FINAL_REVIEW_CMO]: {
                    stage: (contentType === 'VIDEO' || isInfluencer || isCaptionBased) ? WorkflowStage.VIDEO_EDITING : WorkflowStage.CREATIVE_DESIGN,
                    role: (contentType === 'VIDEO' || isInfluencer || isCaptionBased) ? Role.EDITOR : Role.DESIGNER
                },
                [WorkflowStage.FINAL_REVIEW_CEO]: {
                    stage: (contentType === 'VIDEO' || isInfluencer || isCaptionBased) ? WorkflowStage.VIDEO_EDITING : WorkflowStage.CREATIVE_DESIGN,
                    role: (contentType === 'VIDEO' || isInfluencer || isCaptionBased) ? Role.EDITOR : Role.DESIGNER
                },
                // New sub-editor stages
                [WorkflowStage.SUB_EDITOR_ASSIGNMENT]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
                [WorkflowStage.SUB_EDITOR_PROCESSING]: { stage: WorkflowStage.SUB_EDITOR_ASSIGNMENT, role: Role.EDITOR },
                // Default returns
                [WorkflowStage.SCRIPT]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
                [WorkflowStage.CINEMATOGRAPHY]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
                [WorkflowStage.VIDEO_EDITING]: { stage: WorkflowStage.CINEMATOGRAPHY, role: Role.CINE },
                [WorkflowStage.WRITER_VIDEO_APPROVAL]: { stage: WorkflowStage.CINEMATOGRAPHY, role: Role.CINE },
                [WorkflowStage.THUMBNAIL_DESIGN]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
                [WorkflowStage.CREATIVE_DESIGN]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
                [WorkflowStage.MULTI_WRITER_APPROVAL]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR }, // If multi-writer approval is rejected, send back to editor
                [WorkflowStage.POST_WRITER_REVIEW]: { stage: WorkflowStage.MULTI_WRITER_APPROVAL, role: Role.WRITER }, // If post-writer review is rejected, send back to multi-writer approval
                [WorkflowStage.PARTNER_REVIEW]: { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },
                [WorkflowStage.SENT_TO_INFLUENCER]: { stage: WorkflowStage.PARTNER_REVIEW, role: Role.PARTNER_ASSOCIATE },
                [WorkflowStage.PA_FINAL_REVIEW]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
                [WorkflowStage.OPS_SCHEDULING]: projectData?.is_pa_brand
                    ? { stage: WorkflowStage.PA_FINAL_REVIEW, role: Role.PARTNER_ASSOCIATE }
                    : { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },
                [WorkflowStage.POSTED]: { stage: WorkflowStage.OPS_SCHEDULING, role: Role.OPS },
                [WorkflowStage.REWORK]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
                [WorkflowStage.WRITER_REVISION]: { stage: WorkflowStage.SCRIPT_REVIEW_L2, role: Role.CEO }
            };

            if (isInfluencer || projectData?.niche === 'LEAD_MAGNET') {
                const customRejectMap: Partial<Record<WorkflowStage, { stage: WorkflowStage; role: Role }>> = {
                    [WorkflowStage.SCRIPT_REVIEW_L1]: { stage: WorkflowStage.SCRIPT, role: Role.WRITER },
                    [WorkflowStage.SCRIPT_REVIEW_L2]: { stage: WorkflowStage.SCRIPT_REVIEW_L1, role: Role.CMO },
                    [WorkflowStage.WRITER_REVISION]: { stage: WorkflowStage.SCRIPT_REVIEW_L2, role: Role.CEO },
                    [WorkflowStage.FINAL_REVIEW_CMO]: { stage: WorkflowStage.WRITER_REVISION, role: Role.WRITER },
                    [WorkflowStage.VIDEO_EDITING]: { stage: WorkflowStage.FINAL_REVIEW_CMO, role: Role.CMO },
                    [WorkflowStage.WRITER_VIDEO_APPROVAL]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR }
                };
                const customNext = customRejectMap[currentStage];
                if (customNext) return customNext;
            }

            return rejectMap[currentStage];
        }

        // Category 2: Influencer (Job Board, Lead Magnet)
        const isInfluencerJobLead = isGeneralInfluencerVideo(project);

        // Category 1: carreridentifier, applywizz, applywizzusa jobs, shyam personal branding
        // Workflow: Writer -> CMO Script Approval -> CEO Script Approval -> CINE -> WRITER (approval) -> EDITOR -> CMO & OPS (Parallel) -> CEO -> OPS
        const isCareerApplyShyam = isCareerApplyShyamGroup(project);

        if (isInfluencerJobLead) {
            const customMap: Partial<Record<WorkflowStage, { stage: WorkflowStage; role: Role }>> = {
                [WorkflowStage.SCRIPT]: { stage: WorkflowStage.SCRIPT_REVIEW_L1, role: Role.CMO },
                [WorkflowStage.SCRIPT_REVIEW_L1]: { stage: WorkflowStage.SCRIPT_REVIEW_L2, role: Role.CEO },
                [WorkflowStage.SCRIPT_REVIEW_L2]: isCaptionBased
                    ? { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR }
                    : { stage: WorkflowStage.WRITER_REVISION, role: Role.WRITER },
                [WorkflowStage.WRITER_REVISION]: { stage: WorkflowStage.FINAL_REVIEW_CMO, role: Role.CMO },
                [WorkflowStage.FINAL_REVIEW_CMO]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
                [WorkflowStage.VIDEO_EDITING]: isCaptionBased
                    ? { stage: WorkflowStage.POST_WRITER_REVIEW, role: Role.CMO }
                    : { stage: WorkflowStage.WRITER_VIDEO_APPROVAL, role: Role.WRITER },
                // Note: The user said it ends at Writer (who submitted the script)
                [WorkflowStage.WRITER_VIDEO_APPROVAL]: { stage: WorkflowStage.POSTED, role: Role.OPS }
            };
            const next = customMap[currentStage];
            if (next) return next;
        }

        if (isCareerApplyShyam) {
            const customMap: Partial<Record<WorkflowStage, { stage: WorkflowStage; role: Role }>> = {
                [WorkflowStage.SCRIPT]: { stage: WorkflowStage.SCRIPT_REVIEW_L1, role: Role.CMO },
                [WorkflowStage.SCRIPT_REVIEW_L1]: { stage: WorkflowStage.SCRIPT_REVIEW_L2, role: Role.CEO },
                [WorkflowStage.SCRIPT_REVIEW_L2]: { stage: WorkflowStage.CINEMATOGRAPHY, role: Role.CINE },
                [WorkflowStage.CINEMATOGRAPHY]: { stage: WorkflowStage.WRITER_VIDEO_APPROVAL, role: Role.WRITER },
                [WorkflowStage.WRITER_VIDEO_APPROVAL]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },
                [WorkflowStage.VIDEO_EDITING]: { stage: WorkflowStage.POST_WRITER_REVIEW, role: Role.CMO }
            };
            const next = customMap[currentStage];
            if (next) return next;
        }

        // Approval flow
        const approvalMap: Partial<Record<WorkflowStage, { stage: WorkflowStage; role: Role }>> = {
            [WorkflowStage.SCRIPT]: { stage: WorkflowStage.SCRIPT_REVIEW_L1, role: Role.CMO },
            [WorkflowStage.SCRIPT_REVIEW_L1]: { stage: WorkflowStage.SCRIPT_REVIEW_L2, role: Role.CEO },
            [WorkflowStage.SCRIPT_REVIEW_L2]: projectData?.is_pa_brand
                ? { stage: WorkflowStage.PARTNER_REVIEW, role: Role.PARTNER_ASSOCIATE }
                : {
                    stage: isCaptionBased ? WorkflowStage.VIDEO_EDITING : ((contentType === 'VIDEO' || isInfluencer) ? WorkflowStage.CINEMATOGRAPHY : WorkflowStage.CREATIVE_DESIGN),
                    role: isCaptionBased ? Role.EDITOR : ((contentType === 'VIDEO' || isInfluencer) ? Role.CINE : Role.DESIGNER)
                },

            // CINE -> VIDEO_EDITING (Editor)
            [WorkflowStage.CINEMATOGRAPHY]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },

            // Note: WRITER_VIDEO_APPROVAL now primarily used for direct video uploads / caption based flows if needed,
            // but the main approval flow is updated to move Cine -> Editor.
            [WorkflowStage.WRITER_VIDEO_APPROVAL]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },

            // VIDEO_EDITING -> DESIGNER (if thumbnail) OR MULTI_WRITER_APPROVAL
            [WorkflowStage.VIDEO_EDITING]: {
                stage: projectData?.is_pa_brand
                    ? WorkflowStage.PA_FINAL_REVIEW
                    : (projectData?.needs_sub_editor === true
                        ? WorkflowStage.SUB_EDITOR_ASSIGNMENT
                        : (projectData?.rework_initiator_stage
                            ? projectData.rework_initiator_stage as WorkflowStage
                            : (projectData?.thumbnail_required === true
                                ? WorkflowStage.THUMBNAIL_DESIGN
                                /* SKIP MULTI_WRITER_APPROVAL: : WorkflowStage.MULTI_WRITER_APPROVAL))), */
                                : WorkflowStage.POST_WRITER_REVIEW))),
                role: projectData?.is_pa_brand
                    ? Role.PARTNER_ASSOCIATE
                    : (projectData?.needs_sub_editor === true
                        ? Role.EDITOR
                        : (projectData?.rework_initiator_stage
                            ? projectData.rework_initiator_role as Role
                            : (projectData?.thumbnail_required === true
                                ? Role.DESIGNER
                                /* SKIP MULTI_WRITER_APPROVAL: : Role.WRITER))) */
                                : Role.CMO)))
            },

            [WorkflowStage.SUB_EDITOR_ASSIGNMENT]: { stage: WorkflowStage.SUB_EDITOR_PROCESSING, role: Role.SUB_EDITOR },
            [WorkflowStage.SUB_EDITOR_PROCESSING]: {
                /* SKIP MULTI_WRITER_APPROVAL: stage: WorkflowStage.MULTI_WRITER_APPROVAL, role: Role.WRITER */
                stage: projectData?.thumbnail_required === true
                    ? WorkflowStage.THUMBNAIL_DESIGN
                    : WorkflowStage.POST_WRITER_REVIEW,
                role: projectData?.thumbnail_required === true
                    ? Role.DESIGNER
                    : Role.CMO
            },

            // MULTI_WRITER_APPROVAL -> OPS/CMO (Post Review)
            [WorkflowStage.MULTI_WRITER_APPROVAL]: {
                stage: projectData?.rework_initiator_stage
                    ? projectData.rework_initiator_stage as WorkflowStage
                    : WorkflowStage.POST_WRITER_REVIEW,
                role: projectData?.rework_initiator_stage
                    ? projectData.rework_initiator_role as Role
                    : Role.CMO
            },

            // THUMBNAIL_DESIGN -> MULTI_WRITER_APPROVAL
            [WorkflowStage.THUMBNAIL_DESIGN]: projectData?.rework_initiator_stage
                ? { stage: projectData.rework_initiator_stage as WorkflowStage, role: projectData.rework_initiator_role as Role }
                /* SKIP MULTI_WRITER_APPROVAL: : { stage: WorkflowStage.MULTI_WRITER_APPROVAL, role: Role.WRITER }, */
                : { stage: WorkflowStage.POST_WRITER_REVIEW, role: Role.CMO },

            [WorkflowStage.CREATIVE_DESIGN]: { stage: WorkflowStage.FINAL_REVIEW_CMO, role: Role.CMO },

            // POST_WRITER_REVIEW (Ops/CMO) -> CEO
            [WorkflowStage.POST_WRITER_REVIEW]: { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },

            [WorkflowStage.FINAL_REVIEW_CMO]: { stage: WorkflowStage.FINAL_REVIEW_CEO, role: Role.CEO },
            [WorkflowStage.FINAL_REVIEW_CEO]: projectData?.is_pa_brand
                ? { stage: WorkflowStage.PARTNER_REVIEW, role: Role.PARTNER_ASSOCIATE }
                : { stage: WorkflowStage.OPS_SCHEDULING, role: Role.OPS },

            [WorkflowStage.PARTNER_REVIEW]: { stage: WorkflowStage.SENT_TO_INFLUENCER, role: Role.PARTNER_ASSOCIATE },

            [WorkflowStage.SENT_TO_INFLUENCER]: { stage: WorkflowStage.PA_VIDEO_CMO_REVIEW, role: Role.CMO },
            [WorkflowStage.PA_VIDEO_CMO_REVIEW]: { stage: WorkflowStage.VIDEO_EDITING, role: Role.EDITOR },

            [WorkflowStage.PA_FINAL_REVIEW]: { stage: WorkflowStage.POSTED, role: Role.PARTNER_ASSOCIATE },

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
// User cache moved to top of file

// ============================================================================
// EXPORT ALL - Flat Interface Matching mockDb
// ============================================================================

// ============================================================================
// AI TOOLS SERVICE
// ============================================================================

export const aiTools = {
    /**
     * Check text for spelling and grammar issues using the Edge Function
     */
    async checkGrammar(text: string): Promise<{
        issues: Array<{
            type: 'spelling' | 'grammar';
            incorrect: string;
            suggestion: string;
        }>
    }> {
        if (!text || text.trim().length === 0) {
            return { issues: [] };
        }

        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
        const FUNCTION_URL = 'https://kifpnlyljlxppuzizmsf.supabase.co/functions/v1/openai-correction';

        try {
            // Get the active Supabase session
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error || !session) {
                throw new Error('No active session found to authorize Edge Function');
            }



            const response = await fetch(FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Edge Function Error:', errorText);
                throw new Error(`Failed to check grammar: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('AI Tools Error:', error);
            throw error;
        }
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
    },
    // Global Logout
    async logout() {
        console.log('🔌 DB: Executing global logout sequence...');

        try {
            // 1. Clear Supabase Session
            const { error } = await supabase.auth.signOut();
            if (error) console.warn('Supabase SignOut Warning:', error.message);
        } catch (e) {
            console.error('Supabase SignOut Exception:', e);
        }

        // 2. Clear Local Cache explicitly
        localStorage.removeItem('app_user_cache');
        localStorage.removeItem('mock_session');
        localStorage.removeItem('admin_last_view');

        // 3. Clear any other Supabase tokens (optional but safe)
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-')) {
                localStorage.removeItem(key);
            }
        });

        console.log('✅ DB: Logout sequence complete');
    },
};

export const influencers = {
    async getAll() {
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from('influencers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Could not fetch influencers', error);
            return [];
        }
        return data || [];
    },

    async create(influencer: {
        influencer_name: string;
        instagram_profile: string;
        influencer_email: string;
        campaign_type: string;
        niche: string;
        commercials: string;
        location: string;
        budget: string;
        brand_name: string;
        contact_details?: string;
        brand_type?: string;
        payment?: string;
        platform_type?: string;
        vercel_form_link?: string;
        created_by_user_id?: string;
    }) {
        const client = supabaseAdmin || supabase;
        // Only insert columns that exist in the table schema
        const insertPayload = {
            influencer_name: influencer.influencer_name,
            instagram_profile: influencer.instagram_profile,
            influencer_email: influencer.influencer_email,
            campaign_type: influencer.campaign_type,
            niche: influencer.niche,
            commercials: influencer.commercials,
            location: influencer.location,
            budget: influencer.budget,
            brand_name: influencer.brand_name,
            contact_details: influencer.contact_details,
            brand_type: influencer.brand_type,
            payment: influencer.payment,
            platform_type: influencer.platform_type,
            vercel_form_link: influencer.vercel_form_link,
            created_by_user_id: influencer.created_by_user_id,
        };
        const { data, error } = await client
            .from('influencers')
            .insert([insertPayload])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const client = supabaseAdmin || supabase;
        const { error, count } = await client
            .from('influencers')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) throw error;
        if (count === 0) throw new Error('Failed to delete influencer');
        return true;
    },

    /**
     * Log a new influencer outreach to the dedicated influencers table
     */
    async log(data: {
        parent_project_id: string;
        instance_project_id: string;
        influencer_name: string;
        influencer_email: string;
        script_content?: string;
        content_description?: string;
        sent_by: string;
        sent_by_id?: string;
        status?: string;
        brand_name?: string;
    }) {
        console.log('📝 Logging influencer to dedicated table:', data.influencer_name);
        try {
            const client = supabaseAdmin || supabase;
            const { error } = await client
                .from('influencers')
                .insert([{
                    ...data,
                    sent_at: new Date().toISOString()
                }]);

            if (error) {
                console.warn('⚠️ Could not log to influencers table:', error.message);
                return false;
            }
            return true;
        } catch (e) {
            console.warn('⚠️ Influencer logging failed:', e);
            return false;
        }
    },

    /**
     * Get all influencers for a specific parent script
     */
    async getByParent(parentId: string) {
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from('influencers')
            .select('*')
            .eq('parent_project_id', parentId)
            .order('sent_at', { ascending: false });

        if (error) {
            console.warn('Error fetching from influencers table:', error);
            return [];
        }
        return data;
    },

    /**
     * Get all influencers associated with a specific brand
     */
    async getByBrand(brandName: string) {
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from('influencers')
            .select('*')
            .eq('brand_name', brandName)
            .order('influencer_name', { ascending: true });

        if (error) {
            console.warn(`Error fetching influencers for brand ${brandName}:`, error);
            return [];
        }
        return data || [];
    },

    async update(id: string, updates: Partial<any>) {
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from('influencers')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};

export const db = {

    // Keep namespaced access for advanced usage
    auth,
    users,
    brands,
    projects,
    workflow,
    workflowHistory,
    systemLogs,
    storage,
    helpers,
    notifications,
    aiTools,
    influencers,
    influencerStories: {
        async getByInfluencer(influencerId: string) {
            const client = supabaseAdmin || supabase;
            const { data, error } = await client
                .from('influencer_stories')
                .select('*')
                .eq('influencer_id', influencerId)
                .order('story_date', { ascending: true });
            if (error) throw error;
            return data || [];
        },
        async add(story: { influencer_id: string; story_date: string; story_link: string; story_caption?: string; created_by_user_id?: string }) {
            const client = supabaseAdmin || supabase;
            const { data, error } = await client
                .from('influencer_stories')
                .insert([story])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        async update(id: string, updates: { story_date?: string; story_link?: string; story_caption?: string }) {
            const client = supabaseAdmin || supabase;
            const { data, error } = await client
                .from('influencer_stories')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        async delete(id: string) {
            const client = supabaseAdmin || supabase;
            const { error } = await client
                .from('influencer_stories')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return true;
        }
    },


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
        const publicUser = await auth.getPublicUser();
        if (publicUser) {
            try {
                await systemLogs.add({
                    actor_id: publicUser.id,
                    actor_name: publicUser.full_name,
                    actor_role: publicUser.role,
                    action: 'LOGOUT',
                    details: `User ${publicUser.full_name} logged out`
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
    async deleteProject(id: string) {
        return await projects.delete(id);
    },

    async getProjects(user: User): Promise<Project[]> {
        // For Admin and Observer roles, show all projects
        if ([Role.ADMIN, Role.OBSERVER].includes(user.role)) {
            return await projects.getAll();
        }

        // Parallel fetch for primary and secondary roles
        const roles = [user.role, ...(user.secondary_roles || [])];
        const projectsForRoles = await Promise.all(roles.map(role => projects.getForRole(role, user.id)));

        // Flatten and remove duplicates by ID
        const allProjects = projectsForRoles.flat();
        const seenIds = new Set();
        return allProjects.filter(p => {
            if (seenIds.has(p.id)) return false;
            seenIds.add(p.id);
            return true;
        });
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

    async createProject(title: string, channel: Channel, dueDate: string, contentType: ContentType = 'VIDEO', priority: Priority = 'NORMAL', brand?: string): Promise<Project> {
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();

        if (!publicUser) {
            throw new Error('User profile not found. Cannot create project without a valid public user ID.');
        }

        const projectData = {
            title,
            channel,
            brand,
            content_type: contentType,
            assigned_to_role: Role.WRITER, // Always starts with writer
            assigned_to_user_id: publicUser.id, // Explicitly assign to the creator (writer)
            due_date: dueDate,
            priority,
            data: { brand },
            // Set display information using the verified public.users.id
            created_by_user_id: publicUser.id,
            created_by_name: publicUser.full_name,
            writer_id: publicUser.id,
            writer_name: publicUser.full_name,
        };

        // Create the project and return the real project with Supabase UUID
        const createdProject = await projects.create(projectData);

        // Record the creation in workflow history using the verified public.users.id
        await workflow.recordAction(
            createdProject.id,
            Role.WRITER, // next responsible role is Writer
            publicUser.id,
            publicUser.full_name,
            'CREATED',
            'Project created by writer',
            undefined,
            Role.WRITER, // fromRole
            Role.WRITER, // toRole
            Role.WRITER  // actorRole
        );

        return createdProject;
    },

    async createDirectCreativeProject(title: string, channel: Channel, dueDate: string, priority: Priority = 'NORMAL'): Promise<Project> {
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();

        if (!publicUser) {
            throw new Error('User profile not found. Cannot create project without a valid public user ID.');
        }

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
            // Set creator information using the verified public.users.id
            created_by_user_id: publicUser.id,
            created_by_name: publicUser.full_name,
            writer_id: publicUser.id,
            writer_name: publicUser.full_name,
        };

        // Create the project and return the real project with Supabase UUID
        const createdProject = await projects.create(projectData);

        // Record the creation in workflow history using the verified public.users.id
        await workflow.recordAction(
            createdProject.id,
            Role.CMO, // next responsible role is CMO
            publicUser.id,
            publicUser.full_name,
            'CREATED',
            'Direct Creative Upload project created',
            undefined,
            Role.CMO, // fromRole
            Role.CMO, // toRole
            Role.CMO  // actorRole
        );

        return createdProject;
    },

    async createDirectVideoProject(title: string, channel: Channel, dueDate: string, videoLink: string, priority: Priority = 'NORMAL', brand?: string, niche?: string, nicheOther?: string, scriptContent?: string, scriptReferenceLink?: string): Promise<Project> {
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();

        if (!publicUser) {
            throw new Error('User profile not found. Cannot create project without a valid public user ID.');
        }

        // Create a project that starts at the MULTI_WRITER_APPROVAL stage for direct video uploads
        // Flow: Editor -> 2 writers approval -> cmo -> ceo -> ops
        const projectData = {
            title,
            channel,
            content_type: 'VIDEO' as ContentType,
            /* SKIP MULTI_WRITER_APPROVAL: current_stage: WorkflowStage.MULTI_WRITER_APPROVAL, 
            assigned_to_role: Role.WRITER, */
            current_stage: WorkflowStage.POST_WRITER_REVIEW,
            assigned_to_role: Role.CMO,
            status: TaskStatus.WAITING_APPROVAL,
            due_date: dueDate,
            priority,
            brand,
            edited_video_link: videoLink,
            data: {
                brand,
                video_link: videoLink,
                source: 'EDITOR_DIRECT_UPLOAD',
                script_content: scriptContent,
                script_reference_link: scriptReferenceLink
            },
            // Set creator information
            created_by_user_id: publicUser.id,
            created_by_name: publicUser.full_name,
            edited_by_user_id: publicUser.id,
            edited_by_name: publicUser.full_name,
            edited_at: new Date().toISOString(),
            editor_uploaded_at: new Date().toISOString(),
            writer_id: publicUser.id,
            writer_name: publicUser.full_name,
            // Important for parallel visibility in post-writer review
            /* SKIP MULTI_WRITER_APPROVAL: visible_to_roles: [Role.WRITER, Role.CMO, Role.CEO, Role.OPS] as any */
            visible_to_roles: [Role.CMO, Role.OPS] as any
        };

        // Create the project and return the real project with Supabase UUID
        const createdProject = await projects.create(projectData);

        // Record the action in workflow history
        await workflow.recordAction(
            createdProject.id,
            /* SKIP MULTI_WRITER_APPROVAL: Role.WRITER, // next responsible role is Writer */
            Role.CMO, // next responsible role is CMO
            publicUser.id,
            publicUser.full_name,
            'SUBMITTED',
            /* SKIP MULTI_WRITER_APPROVAL: 'Direct Video Upload: Video submitted directly by Editor. Moving to Multi-Writer Approval.', */
            'Direct Video Upload: Video submitted directly by Editor. Moving to CMO Approval.',
            undefined,
            Role.EDITOR, // fromRole
            /* SKIP MULTI_WRITER_APPROVAL: Role.WRITER, // toRole */
            Role.CMO, // toRole
            Role.EDITOR  // actorRole
        );

        return createdProject;
    },

    async createCineDirectProject(title: string, channel: Channel, dueDate: string, videoLink: string, priority: Priority = 'NORMAL', brand?: string, niche?: string, nicheOther?: string, scriptContent?: string, scriptReferenceLink?: string): Promise<Project> {
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();

        if (!publicUser) {
            throw new Error('User profile not found. Cannot create project without a valid public user ID.');
        }

        // Create a project that starts at the VIDEO_EDITING stage for direct cine footage uploads
        // Flow: Cine -> Editor -> Designer -> 2 writers approval -> cmo -> ceo -> ops
        const projectData = {
            title,
            channel,
            content_type: 'VIDEO' as ContentType,
            current_stage: WorkflowStage.VIDEO_EDITING,
            assigned_to_role: Role.EDITOR,
            status: TaskStatus.IN_PROGRESS,
            due_date: dueDate,
            priority,
            brand,
            niche,
            niche_other: nicheOther,
            video_link: videoLink,
            data: {
                brand,
                niche,
                niche_other: nicheOther,
                raw_footage_link: videoLink,
                source: 'CINE_DIRECT_UPLOAD',
                script_content: scriptContent,
                script_reference_link: scriptReferenceLink
            },
            // Set creator information
            created_by_user_id: publicUser.id,
            created_by_name: publicUser.full_name,
            cine_uploaded_at: new Date().toISOString(),
            writer_id: publicUser.id, // Set cine as initial writer/creator for visibility
            writer_name: publicUser.full_name,
            visible_to_roles: [Role.EDITOR, Role.WRITER, Role.CMO, Role.CEO, Role.OPS] as any
        };

        // Create the project
        const createdProject = await projects.create(projectData);

        // Record the action in workflow history
        await workflow.recordAction(
            createdProject.id,
            Role.EDITOR, // next responsible role is Editor
            publicUser.id,
            publicUser.full_name,
            'SUBMITTED',
            'Direct Footage Upload: Footage submitted directly by Cinematographer. Moving to Video Editing.',
            undefined,
            Role.CINE,   // fromRole
            Role.EDITOR, // toRole
            Role.CINE    // actorRole
        );

        return createdProject;
    },

    /**
     * createDesignerProject: Secure, production-ready project creation for the Designer role.
     * Manages ID verification, workflow routing, and visibility metadata.
     */
    async createDesignerProject(
        title: string,
        channel: Channel,
        dueDate: string,
        description: string,
        link: string,
        priority: Priority = 'NORMAL',
        contentType: ContentType = 'CREATIVE_ONLY',
        brand?: string,
        niche?: string,
        nicheOther?: string
    ): Promise<Project> {
        // 1. Mandatory User Verification
        const publicUser = await withTimeout(
            auth.getPublicUser(),
            12000,
            'Designer profile lookup timed out. Please refresh and try again.'
        );
        if (!publicUser) {
            throw new Error('Project creation failed: No valid user profile found. Please re-login.');
        }

        // 2. Prepare Project Structure. getPublicUser already resolves the public.users
        // profile, so avoid a second verification request that can hang on repeat submits.
        const projectData = {
            title,
            channel,
            content_type: contentType,
            current_stage: WorkflowStage.FINAL_REVIEW_CMO,
            assigned_to_role: Role.CMO,
            status: TaskStatus.WAITING_APPROVAL,
            task_status: TaskStatus.WAITING_APPROVAL,
            due_date: dueDate,
            priority,
            brand,
            creative_link: link,   // ← top-level column in projects table
            data: {
                brand,
                brief: description,
                niche,
                niche_other: nicheOther,
                requested_content_type: contentType,
                creative_link: link, // ← kept for backward-compat in JSONB
                source: 'DESIGNER_DIRECT_UPLOAD'
            },
            // Creator Tracking (Resolves FK Constraints)
            created_by_user_id: publicUser.id,
            created_by_name: publicUser.full_name,
            writer_id: publicUser.id,
            writer_name: publicUser.full_name,
            designer_name: publicUser.full_name,
            designer_uploaded_at: new Date().toISOString(),
            // Ensure visibility for CMO and Subsequent Roles
            visible_to_roles: [Role.CMO] as any
        };

        console.log('🚀 Attempting project creation for:', title, 'by', publicUser.email);

        try {
            // 4. Create Project
            const createdProject = await projects.create(projectData);

            // 5. Record Workflow History. The project is already routed to CMO, so
            // history logging should not make the designer submission fail.
            try {
                await withTimeout(
                    workflow.recordAction(
                        createdProject.id,
                        Role.CMO,
                        publicUser.id,
                        publicUser.full_name,
                        'SUBMITTED',
                        `Designer submitted creative link: ${link}. Routing to CMO for Final Review.`,
                        undefined,
                        Role.DESIGNER,
                        Role.CMO,
                        Role.DESIGNER
                    ),
                    6000,
                    'Workflow history logging timed out.'
                );
            } catch (historyError) {
                console.warn('Designer project created, but workflow history logging failed:', historyError);
            }

            return createdProject;
        } catch (error: any) {
            console.error('❌ createDesignerProject FAILED:', error);
            throw error;
        }
    },

    async createIdeaProject(title: string, channel: Channel, contentType: ContentType, description: string, priority: Priority = 'NORMAL'): Promise<Project> {
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();

        if (!publicUser) {
            throw new Error('User profile not found. Cannot create project without a valid public user ID.');
        }

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
            // Set display information using the verified public.users.id
            created_by_user_id: publicUser.id,
            created_by_name: publicUser.full_name,
            writer_id: publicUser.id,
            writer_name: publicUser.full_name,
        };

        // Create the project and return the real project with Supabase UUID
        const createdProject = await projects.create(projectData);

        // Record the creation in workflow history using the verified public.users.id
        await workflow.recordAction(
            createdProject.id,
            Role.CMO, // next responsible role is CMO
            publicUser.id,
            publicUser.full_name,
            'CREATED',
            'Idea project created and submitted to CMO',
            undefined,
            Role.WRITER, // fromRole (assuming writer creates ideas)
            Role.CMO,    // toRole
            Role.WRITER  // actorRole
        );

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
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.warn(`Attempt ${attempts + 1} to fetch project failed:`, errorMessage);
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
            project
        );

        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();
        if (!publicUser) {
            throw new Error('User profile not found. Cannot submit project without a valid public user ID.');
        }

        const result = await workflow.submitForReview(
            projectId,
            publicUser.id,
            publicUser.full_name,
            nextStageInfo.stage,
            nextStageInfo.role,
            'Submitted for review'
        );

        // Refresh the project data to ensure UI is up to date
        const updatedProject = await projects.getById(projectId);
        console.log('Project updated after submitToReview:', updatedProject);

        return result;
    },

    async advanceWorkflow(projectId: string, comment?: string, videoLink?: string) {
        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();
        if (!publicUser) {
            console.error('No current user for advanceWorkflow');
            throw new Error('No current user for advanceWorkflow');
        }

        // Ensure we have a real project with proper ID
        if (!projectId || projectId.startsWith('temp_')) {
            throw new Error('Cannot advance project with temporary ID. Project must be saved to Supabase first.');
        }

        // Get the project with retry mechanism
        let project: Project | null = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                project = await projects.getById(projectId);
                if (project) break;
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.warn(`Attempt ${attempts + 1} to fetch project failed:`, errorMessage);
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

        console.log('🔍 Advancing workflow for project:', project.id, 'Stage:', project.current_stage);

        // 1️⃣ Determine if this is a rework submission
        // We use isReworkProject utility to detect based on rework_target_role
        const isFromRework = isReworkProject(project);

        // Use rework metadata from project or project.data
        const trackingInitiatorRole = project.rework_initiator_role || project.data?.rework_initiator_role;
        const trackingInitiatorStage = project.rework_initiator_stage || project.data?.rework_initiator_stage;

        // Check if the brand belongs to a Partner Associate
        const brandName = project.brand || project.data?.brand;
        let isPAProject = project.data?.is_pa_brand || false; // Use existing flag from project.data

        // If not already flagged, check the brand registry
        if (!isPAProject && brandName) {
            try {
                const { data: brandMatch } = await supabase
                    .from('brands')
                    .select('id, created_by_user_id')
                    .eq('brand_name', brandName)
                    .maybeSingle();

                // If brand exists and was created by a PA, mark as PA project
                if (brandMatch && brandMatch.created_by_user_id) {
                    const { data: brandCreator } = await supabase
                        .from('users')
                        .select('role')
                        .eq('id', brandMatch.created_by_user_id)
                        .maybeSingle();

                    if (brandCreator && brandCreator.role === Role.PARTNER_ASSOCIATE) {
                        isPAProject = true;
                        console.log(`✅ advanceWorkflow: Identified as PA brand: ${brandName}`);
                    }
                }
            } catch (err) {
                console.warn('Error checking brand PA status in advanceWorkflow:', err);
            }
        }

        // Prepare project data with PA status for getNextStage
        const projectDataWithPA = {
            ...project.data,
            is_pa_brand: isPAProject
        };

        let nextStageInfo: { stage: WorkflowStage; role: Role };

        // 2️⃣ Priority 1: Handle Rework Routing (Submitter returns to Initiator)
        if (isFromRework && trackingInitiatorRole && trackingInitiatorStage) {
            console.log('🔄 Rework detected: preparing to return to initiator', trackingInitiatorRole);
            nextStageInfo = {
                stage: trackingInitiatorStage as WorkflowStage,
                role: trackingInitiatorRole as Role
            };
        }
        // 3️⃣ Priority 2: Special Stage Handling (Idea Project Approval)
        else if (project.data?.source === 'IDEA_PROJECT' && project.current_stage === WorkflowStage.FINAL_REVIEW_CEO) {
            console.log('💡 Idea approved: converting to script stage');
            nextStageInfo = { stage: WorkflowStage.SCRIPT, role: Role.WRITER };
        }
        // 4️⃣ Priority 3: Multi-Writer Intermediate Steps
        else if (project.current_stage === WorkflowStage.MULTI_WRITER_APPROVAL && project.assigned_to_role === Role.WRITER) {
            console.log('📊 Multi-writer intermediate approval - staying in same stage');
            nextStageInfo = { stage: WorkflowStage.MULTI_WRITER_APPROVAL, role: Role.WRITER };
        }
        // 4️⃣ Priority 3.5: Specific Cine to Writer transition
        else if (project.current_stage === WorkflowStage.CINEMATOGRAPHY) {
            console.log('🎬 Cine uploaded video: routing to writer for approval');
            nextStageInfo = { stage: WorkflowStage.WRITER_VIDEO_APPROVAL, role: Role.WRITER };
        }
        // 5️⃣ Priority 4: Standard Workflow Progression
        else {
            nextStageInfo = helpers.getNextStage(
                project.current_stage as WorkflowStage,
                project.content_type,
                'APPROVED',
                projectDataWithPA
            );
        }

        console.log('🎯 Determined Next Stage:', nextStageInfo.stage, 'Role:', nextStageInfo.role);

        // 6️⃣ Execute Approval & Advance
        // Determine the action type: Reviewers (CMO/CEO) "APPROVE", Creators (Writer/Cine/Editor) "SUBMIT"
        const reviewStages = [
            WorkflowStage.SCRIPT_REVIEW_L1,
            WorkflowStage.SCRIPT_REVIEW_L2,
            WorkflowStage.FINAL_REVIEW_CMO,
            WorkflowStage.FINAL_REVIEW_CEO,
            WorkflowStage.POST_WRITER_REVIEW,
            WorkflowStage.MULTI_WRITER_APPROVAL,
            WorkflowStage.WRITER_VIDEO_APPROVAL
        ];

        let advanceAction = reviewStages.includes(project.current_stage as WorkflowStage) ? 'APPROVED' : 'SUBMITTED';
        let reworkMetadata: any = undefined;
        let targetUserId: string | null | undefined = undefined;
        let extraUpdates: any = {};

        // 🎬 Special logic for Cine submission
        if (project.current_stage === WorkflowStage.CINEMATOGRAPHY) {
            targetUserId = (project as any).writer_id || null;
            if (videoLink) {
                extraUpdates.video_link = videoLink;
            }
            // Ensure status is WAITING_APPROVAL
            extraUpdates.status = TaskStatus.WAITING_APPROVAL;

            // Atomically update data object with comments
            if (comment) {
                const currentData = (project as any).data || {};
                const parsedData = typeof currentData === 'string' ? JSON.parse(currentData) : currentData;

                extraUpdates.data = {
                    ...parsedData,
                    cine_comments: comment.trim()
                };
            }

            // If it's the first time Cine is uploading, use default comment if none provided
            if (!comment) {
                comment = "Raw video submitted for writer approval";
            }
        }

        // 🎬 Special logic for Editor submission
        if (project.current_stage === WorkflowStage.VIDEO_EDITING) {
            targetUserId = (project as any).writer_id || null;
            // Ensure status is WAITING_APPROVAL
            extraUpdates.status = TaskStatus.WAITING_APPROVAL;

            if (!comment) {
                comment = "Edited video submitted for writer approval";
            }
        }

        if (isFromRework) {
            advanceAction = 'SUBMITTED';
            const role = publicUser.role;

            // Calculate metadata for asset comparison (Before vs After)
            let beforeLink = null;
            let afterLink = null;

            if (role === Role.CINE) {
                beforeLink = project.cine_video_links_history?.[project.cine_video_links_history.length - 1] || null;
                afterLink = project.video_link;
            } else if (role === Role.EDITOR) {
                beforeLink = project.editor_video_links_history?.[project.editor_video_links_history.length - 1] || null;
                afterLink = project.edited_video_link;
            } else if (role === Role.SUB_EDITOR) {
                beforeLink = project.sub_editor_video_links_history?.[project.sub_editor_video_links_history.length - 1] || null;
                afterLink = project.edited_video_link;
            } else if (role === Role.DESIGNER) {
                beforeLink = project.designer_video_links_history?.[project.designer_video_links_history.length - 1] || null;
                afterLink = project.thumbnail_link || project.creative_link;
            }

            reworkMetadata = {
                before_link: beforeLink,
                after_link: afterLink,
                reworked_by_role: role
            };
            console.log(`📝 Recording specialized rework history for ${role}:`, reworkMetadata);
        }

        const result = await workflow.approve(
            projectId,
            publicUser.id,
            publicUser.full_name,
            publicUser.role,
            nextStageInfo.stage,
            nextStageInfo.role,
            comment,
            advanceAction,
            undefined, // fromRoleOverride
            reworkMetadata,
            targetUserId,
            extraUpdates
        );

        // 7️⃣ CLEAR rework tracking once project successfully returns to initiator
        // We check if the result project is now assigned to the role we intended to return to
        if (isFromRework && result && result.assigned_to_role === (trackingInitiatorRole as Role)) {
            console.log('🧹 Clearing rework metadata after successful return to initiator');
            const { data: currentData } = await supabase.from('projects').select('data').eq('id', projectId).single();
            const updatedProjectData = { ...currentData?.data };

            // Delete from data object
            delete updatedProjectData.rework_initiator_role;
            delete updatedProjectData.rework_initiator_stage;
            delete updatedProjectData.rework_target_role;

            // Update project - also clearing top-level columns to be thorough
            await supabase.from('projects').update({
                data: updatedProjectData,
                rework_initiator_role: null,
                rework_initiator_stage: null,
                rework_target_role: null
            }).eq('id', projectId);
        }

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
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.warn(`Attempt ${attempts + 1} to fetch project failed:`, errorMessage);
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
            [WorkflowStage.WRITER_VIDEO_APPROVAL]: Role.WRITER,
            [WorkflowStage.MULTI_WRITER_APPROVAL]: Role.WRITER,
            [WorkflowStage.POST_WRITER_REVIEW]: Role.CMO, // Assign to CMO for approval
            [WorkflowStage.PARTNER_REVIEW]: Role.PARTNER_ASSOCIATE,
            [WorkflowStage.SENT_TO_INFLUENCER]: Role.PARTNER_ASSOCIATE,
            [WorkflowStage.PA_FINAL_REVIEW]: Role.PARTNER_ASSOCIATE,
            [WorkflowStage.OPS_SCHEDULING]: Role.OPS,
            [WorkflowStage.POSTED]: Role.OPS,
            [WorkflowStage.REWORK]: Role.WRITER,
            [WorkflowStage.WRITER_REVISION]: Role.WRITER
        };

        // Determine base target role from stage
        let baseTargetRole = stageToRoleMap[targetStage] || Role.WRITER;

        // SPECIAL CASE: When VIDEO_EDITING or MULTI_WRITER_APPROVAL stage is selected with EDITOR role, 
        // check who did the last edit and route to the actual editor (SUB_EDITOR vs EDITOR)
        if ((targetStage === WorkflowStage.VIDEO_EDITING || targetStage === WorkflowStage.MULTI_WRITER_APPROVAL) && baseTargetRole === Role.EDITOR) {
            // Check if the last edit was done by SUB_EDITOR using the new edited_by_role field
            // This is the most reliable indicator of who actually edited the video
            if (project.edited_by_role === 'SUB_EDITOR') {
                // If sub-editor was involved in the last edit, route to SUB_EDITOR
                baseTargetRole = Role.SUB_EDITOR;
            } else {
                // Otherwise, route to EDITOR (or default to EDITOR if no edited_by_role is set)
                baseTargetRole = Role.EDITOR;
            }
        }

        // Special case: When CEO rejects (not rework) from FINAL_REVIEW_CEO, send back to CMO instead of CEO
        let targetRole = Role.WRITER;
        if (project.current_stage === WorkflowStage.FINAL_REVIEW_CEO && targetStage !== WorkflowStage.SCRIPT && !isRework) {
            targetRole = Role.CMO;
        } else {
            targetRole = baseTargetRole;
        }

        // Store rework metadata if this is a rework request
        if (isRework) {
            // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
            const publicUser = await auth.getPublicUser();
            if (!publicUser) {
                throw new Error('User profile not found. Cannot set rework metadata without a valid public user ID.');
            }

            console.log('📝 Storing rework metadata for initiator return:', {
                role: publicUser.role,
                stage: project.current_stage,
                target: targetRole
            });
            const { data: currentData } = await supabase.from('projects').select('data').eq('id', projectId).single();
            const updatedProjectData = {
                ...currentData?.data,
                rework_initiator_role: publicUser.role,
                rework_initiator_stage: project.current_stage,
                rework_target_role: targetRole
            };

            await supabase.from('projects').update({
                data: updatedProjectData,
                rework_initiator_role: publicUser.role,
                rework_initiator_stage: project.current_stage,
                rework_target_role: targetRole
            }).eq('id', projectId);
        }

        // ALWAYS fetch the public user profile to ensure ID consistency and prevent FK violations
        const publicUser = await auth.getPublicUser();
        if (!publicUser) {
            throw new Error('User profile not found. Cannot reject task without a valid public user ID.');
        }

        const result = await workflow.reject(
            projectId,
            publicUser.id,
            publicUser.full_name,
            publicUser.role,
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
    } catch (err) {
        const errorValue = err instanceof Error ? err : new Error(String(err));
        console.error('🔴 Token Health: Corrupted token detected:', errorValue);
        return { healthy: false, status: 'tokens_corrupted', action: 'clear' };
    }
};

export default db;
