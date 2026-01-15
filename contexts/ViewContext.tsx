
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useProfileContext } from './ProfileContext';

interface ViewContextType {
    isBusiness: boolean;
    setIsBusiness: (value: boolean) => void;
    toggleView: () => void;
    isBusinessOnly: boolean;
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

export const ViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { profile } = useProfileContext();
    const isBusinessOnly = profile?.is_business_only === true;

    const [isBusiness, setIsBusiness] = useState(() => {
        const saved = localStorage.getItem('view_mode');
        return saved === 'business';
    });

    useEffect(() => {
        if (isBusinessOnly && !isBusiness) {
            setIsBusiness(true);
        }
    }, [isBusinessOnly, isBusiness]);

    useEffect(() => {
        localStorage.setItem('view_mode', isBusiness ? 'business' : 'personal');

        // Update body theme color or other global styles if needed
        if (isBusiness) {
            document.documentElement.classList.add('business-mode');
        } else {
            document.documentElement.classList.remove('business-mode');
        }
    }, [isBusiness]);

    const toggleView = () => {
        if (isBusinessOnly) return;
        setIsBusiness(prev => !prev);
    };

    return (
        <ViewContext.Provider value={{ isBusiness, setIsBusiness, toggleView, isBusinessOnly }}>
            {children}
        </ViewContext.Provider>
    );
};

export const useView = () => {
    const context = useContext(ViewContext);
    if (context === undefined) {
        throw new Error('useView must be used within a ViewProvider');
    }
    return context;
};
