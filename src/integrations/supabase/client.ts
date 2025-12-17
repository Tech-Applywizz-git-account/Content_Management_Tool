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

export const supabase = supabaseUrl && supabaseKey 
    ? createClient(supabaseUrl, supabaseKey, supabaseOptions)
    : {
        auth: {
            onAuthStateChange: (callback: any) => {
                console.warn('Supabase not configured - auth state change listener is a no-op');
                return { subscription: { unsubscribe: () => {} } };
            },
            getSession: async () => {
                console.warn('Supabase not configured - getSession returns null');
                return { data: { session: null }, error: null };
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
        from: (table: string) => ({
            select: () => ({ eq: () => ({ single: () => ({ data: null, error: new Error('Supabase not configured') }) }) }),
            insert: () => ({ select: () => ({ single: () => ({ data: null, error: new Error('Supabase not configured') }) }) }),
            update: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: null, error: new Error('Supabase not configured') }) }) }) }),
            delete: () => ({ eq: () => ({ data: null, error: new Error('Supabase not configured') }) })
        })
    } as any;

// Optional: Export admin client if service key is available (for dev/local use)
export const supabaseAdmin = serviceKey
    ? createClient(supabaseUrl!, serviceKey, supabaseOptions)
    : null;