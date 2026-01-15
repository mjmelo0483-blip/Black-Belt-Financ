import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, withRetry } from '../supabase';

export interface Company {
    id: string;
    name: string;
    owner_id: string;
    created_at: string;
}

export interface CompanyMember {
    id: string;
    company_id: string;
    user_id: string;
    email: string;
    role: 'admin' | 'member';
}

interface CompanyContextType {
    companies: Company[];
    activeCompany: Company | null;
    setActiveCompany: (company: Company | null) => void;
    loading: boolean;
    refreshCompanies: () => Promise<void>;
    createCompany: (name: string) => Promise<Company | undefined>;
    addMember: (email: string, role?: 'admin' | 'member') => Promise<void>;
    removeMember: (memberId: string) => Promise<void>;
    members: CompanyMember[];
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activeCompany, setActiveCompanyState] = useState<Company | null>(() => {
        const saved = localStorage.getItem('active_company');
        return saved ? JSON.parse(saved) : null;
    });
    const [members, setMembers] = useState<CompanyMember[]>([]);
    const [loading, setLoading] = useState(true);

    const setActiveCompany = (company: Company | null) => {
        setActiveCompanyState(company);
        if (company) {
            localStorage.setItem('active_company', JSON.stringify(company));
        } else {
            localStorage.removeItem('active_company');
        }
    };

    const fetchCompanies = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setCompanies([]);
                return;
            }

            // Fetch companies where user is owner or member
            const { data, error } = await supabase
                .from('companies')
                .select('*');

            if (error) throw error;
            setCompanies(data || []);

            // If active company is not in the list anymore, clear it
            if (activeCompany && !data?.find(c => c.id === activeCompany.id)) {
                setActiveCompany(null);
            }
        } catch (error) {
            console.error('Error fetching companies:', error);
        } finally {
            setLoading(false);
        }
    }, [activeCompany]);

    const fetchMembers = useCallback(async () => {
        if (!activeCompany) {
            setMembers([]);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('company_members')
                .select('*')
                .eq('company_id', activeCompany.id);

            if (error) throw error;
            setMembers(data || []);
        } catch (error) {
            console.error('Error fetching members:', error);
        }
    }, [activeCompany]);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const createCompany = async (name: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            // 1. Create company
            const { data: company, error } = await supabase
                .from('companies')
                .insert({ name, owner_id: session.user.id })
                .select()
                .single();

            if (error) throw error;

            // 2. Add owner as admin member
            await supabase.from('company_members').insert({
                company_id: company.id,
                user_id: session.user.id,
                email: session.user.email,
                role: 'admin'
            });

            await fetchCompanies();
            setActiveCompany(company);
            return company;
        } catch (error) {
            console.error('Error creating company:', error);
            throw error;
        }
    };

    const addMember = async (email: string, role: 'admin' | 'member' = 'member') => {
        if (!activeCompany) return;
        try {
            // Find user id by email from profiles (if they already joined)
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .single();

            const { error } = await supabase
                .from('company_members')
                .insert({
                    company_id: activeCompany.id,
                    email,
                    user_id: profiles?.id, // May be null if user hasn't registered yet
                    role
                });

            if (error) throw error;
            await fetchMembers();
        } catch (error) {
            console.error('Error adding member:', error);
            throw error;
        }
    };

    const removeMember = async (memberId: string) => {
        try {
            const { error } = await supabase
                .from('company_members')
                .delete()
                .eq('id', memberId);

            if (error) throw error;
            await fetchMembers();
        } catch (error) {
            console.error('Error removing member:', error);
            throw error;
        }
    };

    return (
        <CompanyContext.Provider value={{
            companies,
            activeCompany,
            setActiveCompany,
            loading,
            refreshCompanies: fetchCompanies,
            createCompany,
            addMember,
            removeMember,
            members
        }}>
            {children}
        </CompanyContext.Provider>
    );
};

export const useCompany = () => {
    const context = useContext(CompanyContext);
    if (context === undefined) {
        throw new Error('useCompany must be used within a CompanyProvider');
    }
    return context;
};
