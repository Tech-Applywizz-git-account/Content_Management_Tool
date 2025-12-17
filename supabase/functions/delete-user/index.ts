import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed. Use POST.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        // Get service role key from environment
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? ''

        if (!serviceRoleKey) {
            throw new Error('SERVICE_ROLE_KEY not set')
        }

        // Create admin client
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Get user ID from request
        const { userId } = await req.json()

        if (!userId) {
            return new Response(
                JSON.stringify({ error: 'Missing userId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Attempting to delete user: ${userId}`)

        // Verify user exists first
        const { data: existingUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)

        if (getUserError || !existingUser) {
            return new Response(
                JSON.stringify({ error: 'User not found in authentication' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Delete from auth.users (will cascade to public.users due to foreign key)
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteAuthError) {
            console.error('Error deleting from auth.users:', deleteAuthError)
            throw new Error(`Failed to delete user from authentication: ${deleteAuthError.message}`)
        }

        console.log(`User deleted from auth.users: ${userId}`)

        // Also explicitly delete from public.users to ensure cleanup
        const { error: deleteDbError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', userId)

        if (deleteDbError) {
            console.warn('Warning: Failed to delete from public.users (may have already cascaded):', deleteDbError)
            // Don't throw - auth deletion succeeded which is most important
        }

        console.log(`User fully deleted: ${userId}`)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'User deleted successfully',
                userId: userId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Edge Function error:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
