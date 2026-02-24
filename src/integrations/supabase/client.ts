import { createClient } from '@supabase/supabase-js';

// Simple approach - directly access environment variables
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase config loaded:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlPreview: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'MISSING'
});

if (!supabaseUrl || !supabaseKey) {
    console.warn("Missing Supabase URL or Anon Key - using placeholder client");
}

// Configure Supabase client with proper auth settings
const supabaseOptions = {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage
    }
};

// Robust placeholder client that won't crash when common chainable methods are called
const createPlaceholderClient = () => {
    const mockResult = { data: null, error: new Error('Supabase not configured'), count: 0 };
    const mockChainable = {
        select: () => mockChainable,
        eq: () => mockChainable,
        order: () => mockChainable,
        limit: () => mockChainable,
        single: () => Promise.resolve(mockResult),
        maybeSingle: () => Promise.resolve(mockResult),
        insert: () => mockChainable,
        update: () => mockChainable,
        delete: () => mockChainable,
        upsert: () => mockChainable,
        overlaps: () => mockChainable,
        then: (cb: any) => Promise.resolve(mockResult).then(cb),
        catch: (cb: any) => Promise.resolve(mockResult).catch(cb),
    };

    return {
        auth: {
            onAuthStateChange: (callback: any) => {
                console.warn('Supabase not configured - auth state change listener is a no-op');
                return { data: { subscription: { unsubscribe: () => { } } } };
            },
            getSession: async () => {
                console.warn('Supabase not configured - getSession returns null');
                return { data: { session: null }, error: null };
            },
            getUser: async () => {
                console.warn('Supabase not configured - getUser returns null');
                return { data: { user: null }, error: null };
            },
            signInWithPassword: async (credentials: any) => {
                console.warn('Supabase not configured - signInWithPassword is a no-op');
                return { data: { user: null, session: null }, error: new Error('Supabase not configured') };
            },
            signOut: async () => {
                console.warn('Supabase not configured - signOut is a no-op');
                return { error: null };
            }
        },
        from: (table: string) => mockChainable,
        channel: (name: string) => ({
            on: () => ({ subscribe: () => ({ unsubscribe: () => { } }) }),
            subscribe: () => ({ unsubscribe: () => { } })
        }),
        removeChannel: () => { }
    } as any;
};

export const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, supabaseOptions)
    : createPlaceholderClient();

// Optional: Export admin client if service key is available (for dev/local use)
export const supabaseAdmin = serviceKey
    ? createClient(supabaseUrl!, serviceKey, supabaseOptions)
    : null;