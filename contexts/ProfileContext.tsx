import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, withRetry, formatError } from '../supabase';

export interface Profile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    updated_at: string;
}

interface ProfileContextType {
    profile: Profile | null;
    loading: boolean;
    updateProfile: (updates: Partial<Profile>) => Promise<Profile | undefined>;
    uploadAvatar: (file: File) => Promise<string | undefined>;
    refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setProfile(null);
                return;
            }

            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single()
            );

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setProfile(data);
            } else {
                const newProfile = {
                    id: session.user.id,
                    full_name: session.user.user_metadata?.full_name || '',
                    avatar_url: session.user.user_metadata?.avatar_url || '',
                };
                const { data: createdProfile, error: createError } = await withRetry(async () =>
                    await supabase
                        .from('profiles')
                        .upsert(newProfile)
                        .select()
                        .single()
                );

                if (createError) throw createError;
                setProfile(createdProfile);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateProfile = async (updates: Partial<Profile>) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('profiles')
                    .update({
                        ...updates,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', session.user.id)
                    .select()
                    .single()
            );

            if (error) throw error;
            setProfile(data);
            return data;
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    };

    const uploadAvatar = async (file: File) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('No user session');

            const fileExt = file.name.split('.').pop();
            const fileName = `${session.user.id}/${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await withRetry(async () =>
                await supabase.storage
                    .from('profiles')
                    .upload(filePath, file)
            );

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('profiles')
                .getPublicUrl(filePath);

            await updateProfile({ avatar_url: publicUrl });
            return publicUrl;
        } catch (error) {
            console.error('Error uploading avatar:', error);
            throw error;
        }
    };

    useEffect(() => {
        fetchProfile();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') fetchProfile();
            if (event === 'SIGNED_OUT') setProfile(null);
        });

        return () => subscription.unsubscribe();
    }, [fetchProfile]);

    return (
        <ProfileContext.Provider value={{ profile, loading, updateProfile, uploadAvatar, refreshProfile: fetchProfile }}>
            {children}
        </ProfileContext.Provider>
    );
};

export const useProfileContext = () => {
    const context = useContext(ProfileContext);
    if (context === undefined) {
        throw new Error('useProfileContext must be used within a ProfileProvider');
    }
    return context;
};
