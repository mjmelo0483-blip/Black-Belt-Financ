import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vywyqyasvprmzokgnqgz.supabase.co';
// Using legacy JWT key as fallback for better compatibility with strict privacy filters
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5d3lxeWFzdnBybXpva2ducWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NzM2MTcsImV4cCI6MjA4MzA0OTYxN30.IC8UE1_wf_0nUdr8swXZMhu5zCUXju5AS6uwE8PHe0E';

console.log('Supabase client loaded targeting:', supabaseUrl.substring(0, 15) + '...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
