import { useState, useCallback } from 'react';
import { supabase, withRetry, formatError } from '../supabase';
import { useCompany } from '../contexts/CompanyContext';

export interface ServiceProposal {
    id: string;
    company_id: string;
    user_id: string;
    customer_name: string;
    customer_email?: string;
    customer_phone?: string;
    date: string;
    valid_until?: string;
    total_amount: number;
    status: 'draft' | 'sent' | 'approved' | 'rejected' | 'cancelled';
    items: {
        description: string;
        quantity: number;
        unit_price: number;
    }[];
    notes?: string;
    created_at?: string;
}

export const useProposals = () => {
    const { activeCompany } = useCompany();
    const [loading, setLoading] = useState(false);

    const fetchProposals = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return { data: [], error: 'Não autenticado' };

            let query = supabase.from('service_proposals').select('*');
            
            if (activeCompany) {
                query = query.eq('company_id', activeCompany.id);
            } else {
                query = query.eq('user_id', session.user.id).is('company_id', null);
            }

            const { data, error } = await withRetry(async () => await query.order('created_at', { ascending: false }));
            if (error) throw error;
            return { data: data || [], error: null };
        } catch (err: any) {
            console.error('Fetch proposals error:', err);
            return { data: [], error: formatError(err) };
        } finally {
            setLoading(false);
        }
    }, [activeCompany]);

    const saveProposal = useCallback(async (proposal: Partial<ServiceProposal>) => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('Não autenticado');

            const dataToSave = {
                ...proposal,
                user_id: session.user.id,
                company_id: activeCompany?.id || null,
            };

            const { data, error } = await supabase
                .from('service_proposals')
                .upsert(dataToSave)
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (err: any) {
            console.error('Save proposal error:', err);
            return { data: null, error: formatError(err) };
        } finally {
            setLoading(false);
        }
    }, [activeCompany]);

    const deleteProposal = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('service_proposals')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Delete proposal error:', err);
            return { success: false, error: formatError(err) };
        } finally {
            setLoading(false);
        }
    }, []);

    const updateStatus = useCallback(async (id: string, status: ServiceProposal['status']) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('service_proposals')
                .update({ status })
                .eq('id', id);

            if (error) throw error;
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Update status error:', err);
            return { success: false, error: formatError(err) };
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        fetchProposals,
        saveProposal,
        deleteProposal,
        updateStatus
    };
};
