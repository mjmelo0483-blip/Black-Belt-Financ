
import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { useProfile } from '../hooks/useProfile';
import { useView } from '../contexts/ViewContext';
import logo from '../assets/logo.png';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const { isBusiness } = useView();
  const [isSupportExpanded, setIsSupportExpanded] = React.useState(false);

  const navItems = [
    { label: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
    ...(isBusiness ? [
      { label: 'Vendas', icon: 'shopping_cart', path: '/sales' },
      { label: 'Análise de Vendas', icon: 'analytics', path: '/sales-dashboard' },
    ] : []),
    { label: 'Fluxo de Caixa', icon: 'payments', path: '/cashflow' },
    { label: 'Lançamentos', icon: 'swap_horiz', path: '/transactions' },
    { label: 'Orçamento', icon: 'pie_chart', path: '/budget' },
    { label: 'Cartões', icon: 'credit_card', path: '/cards' },
    { label: 'Investimentos', icon: 'monitoring', path: '/investments' },
    { label: 'Minhas Contas', icon: 'account_balance', path: '/accounts' },
    { label: 'Categorias', icon: 'label', path: '/categories' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-[#111a22] border-r border-[#233648] z-50 
        transform transition-transform duration-300 lg:relative lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="size-16 rounded-xl bg-[#1c2a38] flex items-center justify-center overflow-hidden border border-[#233648] shadow-lg shadow-black/20">
              <img
                src={logo}
                alt="Black Belt Financ Logo"
                className="size-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-white text-sm font-black leading-tight tracking-tight uppercase">Black Belt Financ</h1>
              <p className="text-[#92adc9] text-[9px] uppercase tracking-widest font-black opacity-70">Finance Control</p>
            </div>
          </div>

          <nav className="flex-1 flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                  ${isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/10'
                    : 'text-[#92adc9] hover:bg-[#233648] hover:text-white'}
                `}
              >
                <span className={`material-symbols-outlined ${location.pathname.includes(item.path) ? 'fill' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-4">
            <div
              className="p-4 rounded-xl bg-[#1c2a38] border border-[#233648] transition-all duration-300 cursor-pointer overflow-hidden group"
              onClick={() => setIsSupportExpanded(!isSupportExpanded)}
            >
              <div className="flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#92adc9] group-hover:text-primary transition-colors">support_agent</span>
                  <span className="text-xs font-semibold text-[#92adc9] group-hover:text-white transition-colors">Suporte</span>
                </div>
                <span className={`material-symbols-outlined text-[18px] text-[#92adc9] transition-transform duration-300 ${isSupportExpanded ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </div>

              <div className={`transition-all duration-300 ${isSupportExpanded ? 'max-h-32 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}`}>
                <p className="text-xs text-white mb-3">Precisa de ajuda com suas finanças?</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open('https://wa.me/seu-numero', '_blank');
                  }}
                  className="w-full h-9 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                  Contatar Assessor
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-[#233648]">
              <div
                onClick={() => { navigate('/profile'); onClose(); }}
                className="flex items-center gap-3 px-2 cursor-pointer group"
              >
                <div
                  className="size-9 rounded-full bg-cover bg-center border border-[#233648] group-hover:border-primary transition-colors"
                  style={{ backgroundImage: `url(${profile?.avatar_url || 'https://picsum.photos/id/64/100/100'})` }}
                />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-white text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {profile?.full_name || 'Usuário Logado'}
                  </span>
                  <span className="text-[#92adc9] text-[10px] truncate">Conta Ativa</span>
                </div>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-all text-sm font-medium mt-2"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sair
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
