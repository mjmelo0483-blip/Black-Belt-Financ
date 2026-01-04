import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../supabase';

const Profile: React.FC = () => {
    const navigate = useNavigate();
    const { profile, loading, updateProfile, uploadAvatar } = useProfile();
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '');
            setAvatarUrl(profile.avatar_url || '');
        }
    }, [profile]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            await updateProfile({
                full_name: fullName,
                avatar_url: avatarUrl,
            });
            setMessage({ text: 'Perfil atualizado com sucesso! Redirecionando...', type: 'success' });

            // Redirect after a short delay so the user sees the success message
            setTimeout(() => {
                navigate('/dashboard');
            }, 1500);
        } catch (error) {
            console.error('Error saving profile:', error);
            setMessage({ text: 'Erro ao atualizar perfil.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setMessage(null);
        try {
            const publicUrl = await uploadAvatar(file);
            setAvatarUrl(publicUrl ?? '');
            setMessage({ text: 'Foto atualizada com sucesso!', type: 'success' });
        } catch (error) {
            console.error('Error uploading:', error);
            setMessage({ text: 'Erro ao fazer upload da foto.', type: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center min-h-[400px]">
                <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 lg:p-10 flex flex-col gap-8">
            <div>
                <h1 className="text-white text-3xl font-black leading-tight tracking-tight">Meu Perfil</h1>
                <p className="text-[#92adc9] mt-1">Gerencie suas informações pessoais e aparência.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 flex flex-col items-center gap-6">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <div className="relative group">
                        <div
                            className="size-40 rounded-full border-4 border-[#233648] bg-cover bg-center shadow-2xl relative overflow-hidden transition-all group-hover:border-primary"
                            style={{ backgroundImage: `url(${avatarUrl || 'https://picsum.photos/id/64/200/200'})` }}
                        >
                            <div
                                onClick={triggerFileInput}
                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                {uploading ? (
                                    <div className="size-8 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                                )}
                            </div>
                        </div>
                        <div
                            onClick={triggerFileInput}
                            className="absolute -bottom-2 -right-2 size-10 bg-primary rounded-full flex items-center justify-center border-4 border-background-dark shadow-lg cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                            <span className="material-symbols-outlined text-white text-xl">edit</span>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-white font-bold text-lg">{fullName || 'Usuário Black Belt'}</p>
                        <p className="text-[#92adc9] text-xs uppercase tracking-widest font-black mt-1">Plano Premium</p>
                    </div>
                </div>

                <div className="md:col-span-2 bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-[#324d67]/50">
                    <form onSubmit={handleSave} className="space-y-6">
                        {message && (
                            <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                <span className="material-symbols-outlined">{message.type === 'success' ? 'check_circle' : 'error'}</span>
                                {message.text}
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest ml-1">Nome Completo</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#4a6b8a] text-[20px]">person</span>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full h-12 bg-[#111a22] border border-[#324d67] rounded-xl pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
                                    placeholder="Seu nome"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest ml-1">URL da Foto (Avatar)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#4a6b8a] text-[20px]">link</span>
                                <input
                                    type="text"
                                    value={avatarUrl}
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                    className="w-full h-12 bg-[#111a22] border border-[#324d67] rounded-xl pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
                                    placeholder="https://exemplo.com/foto.jpg"
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full h-12 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">save</span>
                                        Salvar Alterações
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
