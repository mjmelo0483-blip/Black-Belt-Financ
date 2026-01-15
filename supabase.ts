import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vywyqyasvprmzokgnqgz.supabase.co';
// Using legacy JWT key as fallback for better compatibility with strict privacy filters
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5d3lxeWFzdnBybXpva2ducWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NzM2MTcsImV4cCI6MjA4MzA0OTYxN30.IC8UE1_wf_0nUdr8swXZMhu5zCUXju5AS6uwE8PHe0E';

console.log('--- SUPABASE CLIENT CONFIG (VER: 1.1.0) ---');
console.log('Project:', supabaseUrl.substring(0, 15) + '...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Standardizes error messages for Network/Fetch issues
 */
export function formatError(err: any, customPrefix: string = 'Erro'): string {
    const errorMsg = err?.message || (typeof err === 'string' ? err : 'Erro inesperado');
    const isNetworkError =
        errorMsg.includes('fetch') ||
        errorMsg.includes('NetworkError') ||
        err?.name === 'TypeError';

    if (isNetworkError) {
        return `${customPrefix}: Erro de rede ("Failed to fetch"). Isso geralmente ocorre se um AdBlocker (uBlock, AdBlock Plus) ou extensão de privacidade estiver bloqueando a conexão com o Supabase. Por favor, DESATIVE SEUS BLOQUEADORES e recarregue a página.`;
    }
    return `${customPrefix}: ${errorMsg}`;
}

/**
 * Helper to retry requests that fail due to network instability (Failed to fetch)
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (err: any) {
            lastError = err;
            const isNetworkError =
                err.message?.includes('fetch') ||
                err.name === 'TypeError' ||
                err.message?.includes('NetworkError');

            if (isNetworkError && i < maxRetries - 1) {
                console.warn(`Tentativa ${i + 1} falhou devido à rede. Tentando novamente em ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            throw err;
        }
    }
    throw lastError;
}
