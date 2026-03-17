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
    file_url?: string;
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

    const uploadFile = async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `proposals/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
            .from('proposals')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('proposals')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const saveProposal = useCallback(async (proposal: Partial<ServiceProposal>, file?: File) => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('Não autenticado');

            let fileUrl = proposal.file_url;
            if (file) {
                fileUrl = await uploadFile(file);
            }

            const dataToSave = {
                ...proposal,
                file_url: fileUrl,
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

    const deleteProposal = useCallback(async (id: string, fileUrl?: string) => {
        setLoading(true);
        try {
            // Delete file from storage if exists
            if (fileUrl) {
                const path = fileUrl.split('/').pop();
                if (path) {
                    await supabase.storage.from('proposals').remove([`proposals/${path}`]);
                }
            }

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

