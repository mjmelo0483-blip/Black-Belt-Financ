
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useProfile } from '../hooks/useProfile';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [search, setSearch] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/transactions?q=${encodeURIComponent(search.trim())}`);
      setSearch('');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#233648] bg-[#111a22]/90 backdrop-blur-md px-6 py-3 shrink-0">
      <div className="flex items-center gap-4 lg:gap-8 flex-1">
        <button onClick={onMenuClick} className="md:hidden text-white hover:text-primary transition-colors">
          <span className="material-symbols-outlined">menu</span>
        </button>

        <form onSubmit={handleSearch} className="hidden sm:flex max-w-md w-full">
          <div className="relative w-full text-[#92adc9] focus-within:text-primary transition-colors">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full h-10 pl-10 pr-3 py-2 border-none rounded-lg bg-[#233648] text-white placeholder-[#92adc9] focus:ring-1 focus:ring-primary text-sm outline-none transition-all focus:bg-[#2d445a]"
              placeholder="Buscar transações, contas ou ajuda..."
              type="text"
            />
          </div>
        </form>
      </div>

      <div className="flex items-center gap-3 lg:gap-4 justify-end">
        <button
          onClick={() => setIsBusiness(!isBusiness)}
          className={`hidden sm:flex items-center justify-center h-9 px-3 rounded-lg transition-all border font-bold text-xs ${isBusiness
            ? 'bg-primary/20 border-primary text-primary'
            : 'bg-[#233648] hover:bg-[#2d445a] text-white border-transparent hover:border-[#324d67]'
            }`}
        >
          <span className="mr-2 uppercase tracking-tighter">{isBusiness ? 'Empresarial' : 'Pessoal'}</span>
          <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`flex items-center justify-center size-9 rounded-lg transition-colors ${showNotifications ? 'bg-primary text-white' : 'bg-[#233648] hover:bg-[#2d445a] text-[#92adc9] hover:text-white'
              }`}
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-[#111a22]"></span>
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)}></div>
              <div className="absolute right-0 mt-2 w-80 bg-[#233648] border border-[#324d67] rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-[#324d67] flex justify-between items-center bg-[#1a2b3a]">
                  <h3 className="text-white font-bold text-sm">Notificações</h3>
                  <span className="text-primary text-[10px] font-black uppercase tracking-widest cursor-pointer hover:underline">Limpar</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <div className="p-4 hover:bg-[#2d445a] transition-colors border-b border-[#324d67]/30 cursor-pointer group">
                    <p className="text-white text-xs font-semibold group-hover:text-primary transition-colors">Fatura do Cartão Vencendo</p>
                    <p className="text-[#92adc9] text-[10px] mt-1">Sua fatura do cartão BLACK BELT vence em 2 dias. Evite juros!</p>
                  </div>
                  <div className="p-4 hover:bg-[#2d445a] transition-colors border-b border-[#324d67]/30 cursor-pointer group">
                    <p className="text-white text-xs font-semibold group-hover:text-primary transition-colors">Meta de Orçamento Atingida</p>
                    <p className="text-[#92adc9] text-[10px] mt-1">Você atingiu 90% do seu orçamento em Lazer.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => navigate('/categories')}
          className="flex items-center justify-center size-9 rounded-lg bg-[#233648] hover:bg-[#2d445a] text-[#92adc9] hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </button>

        <div className="relative">
          <div
            onClick={() => setShowProfile(!showProfile)}
            className="h-9 w-9 rounded-full bg-cover bg-center border-2 border-[#233648] hover:border-primary cursor-pointer transition-all overflow-hidden"
            style={{ backgroundImage: `url(${profile?.avatar_url || 'https://picsum.photos/id/64/100/100'})` }}
          />

          {showProfile && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowProfile(false)}></div>
              <div className="absolute right-0 mt-2 w-48 bg-[#233648] border border-[#324d67] rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-3 border-b border-[#324d67] bg-[#1a2b3a]">
                  <p className="text-white font-bold text-xs">Minha Conta</p>
                </div>
                <div className="py-1">
                  <button onClick={() => { navigate('/profile'); setShowProfile(false); }} className="w-full text-left px-4 py-2 text-[#92adc9] hover:text-white hover:bg-[#2d445a] text-xs font-bold transition-colors flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">person</span>
                    Perfil
                  </button>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-bold transition-colors flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sair
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
