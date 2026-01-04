import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vywyqyasvprmzokgnqgz.supabase.co';
const supabaseAnonKey = 'sb_publishable_XL2fwcI5Xj2A6o1X3oulZw_ebiph847';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
