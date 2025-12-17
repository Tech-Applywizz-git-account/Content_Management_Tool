import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Only allow POST and OPTIONS methods
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
        // Get the service role key from environment (secure!)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? ''

        if (!serviceRoleKey) {
            throw new Error('SERVICE_ROLE_KEY not set')
        }

        // Create admin client with service role key
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Get request body
        const { email, userData } = await req.json()

        if (!email || !userData) {
            return new Response(
                JSON.stringify({ error: 'Missing email or userData' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate required userData fields
        if (!userData.full_name || !userData.role) {
            return new Response(
                JSON.stringify({ error: 'Missing required userData fields: full_name and role' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate role against allowed values
        const allowedRoles = ['ADMIN', 'WRITER', 'CINE', 'EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER']
        if (!allowedRoles.includes(userData.role)) {
            return new Response(
                JSON.stringify({ error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Attempting to invite user: ${email} with role: ${userData.role}`)

        // Construct redirect URL properly
        const origin = req.headers.get('origin') || 'http://localhost:3000'
        const redirectUrl = `${origin}/set-password?email=${encodeURIComponent(email)}&role=${userData.role}`
        console.log(`Redirect URL: ${redirectUrl}`)

        // Try to invite the user
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: userData,
            redirectTo: redirectUrl
        })

        // Handle case where user already exists
        if (error) {
            console.error('Supabase Invite Error:', error)

            // Check if it's a user already exists error
            if (error.message && error.message.includes('already')) {
                // User already exists, try to get the existing user
                try {
                    // List users and find by email (pagination-safe for small user bases)
                    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
                        page: 1,
                        perPage: 1000
                    })

                    if (listError) {
                        console.error('Error listing users:', listError)
                        throw error // Re-throw original error
                    }

                    const existingUser = userList?.users?.find(u => u.email === email)

                    if (existingUser) {
                        // Update the existing user's metadata
                        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                            existingUser.id,
                            {
                                user_metadata: {
                                    ...existingUser.user_metadata,
                                    ...userData
                                }
                            }
                        )

                        if (updateError) {
                            console.error('Error updating existing user metadata:', updateError)
                        }

                        // Upsert the user record in the public.users table
                        const { error: dbError } = await supabaseAdmin
                            .from('users')
                            .upsert({
                                id: existingUser.id,
                                email: email,
                                full_name: userData.full_name,
                                role: userData.role,
                                phone: userData.phone || null,
                                status: 'ACTIVE'
                            }, {
                                onConflict: 'id'
                            })

                        if (dbError) {
                            console.error('Failed to update user record:', dbError)
                            throw new Error(`Failed to update existing user record: ${dbError.message}`)
                        }

                        console.log('Existing user updated successfully:', existingUser.id)

                        return new Response(
                            JSON.stringify({
                                success: true,
                                message: 'User already existed, updated successfully',
                                user: existingUser
                            }),
                            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        )
                    } else {
                        // User not found in list but invite says they exist
                        throw new Error('User already exists but could not be found in user list')
                    }
                } catch (listOrUpdateError) {
                    console.error('Error handling existing user:', listOrUpdateError)
                    throw error // Re-throw original error
                }
            } else {
                // Some other error occurred
                throw error
            }
        }

        console.log('User invited successfully:', data.user?.id)

        // Create/update user record in public.users table
        const { error: dbError } = await supabaseAdmin
            .from('users')
            .upsert({
                id: data.user?.id,
                email: email,
                full_name: userData.full_name,
                role: userData.role,
                phone: userData.phone || null,
                status: 'ACTIVE'
            }, {
                onConflict: 'id'
            })

        if (dbError) {
            console.error('Failed to create user record:', dbError)
            // Even if database upsert fails, we should still return success since the invite was successful
            // But we'll log the error for debugging
            return new Response(
                JSON.stringify({
                    success: true,
                    user: data.user,
                    warning: 'User invited successfully but failed to create database record: ' + dbError.message
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ success: true, user: data.user }),
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