import { createClient } from '@supabase/supabase-js';

// Read from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail-fast validation in development
if (!supabaseUrl || !supabaseAnonKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');

    throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n\n` +
        `Please create a .env file in the project root with:\n` +
        `VITE_SUPABASE_URL=your_supabase_url\n` +
        `VITE_SUPABASE_ANON_KEY=your_anon_key\n\n` +
        `See .env.example for reference.`
    );
}

// Custom fetch with timeout and logging for better debugging
const customFetch = (url: string, options: RequestInit = {}) => {
    const timeout = 30000; // 30 seconds timeout

    return Promise.race([
        fetch(url, options),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Request timed out after ${timeout}ms. Please check your network connection.`)), timeout)
        )
    ]);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage
    },
    global: {
        fetch: customFetch
    }
});