
import React, { createContext, useContext, useState, useEffect } from 'react';

interface ViewContextType {
    isBusiness: boolean;
    setIsBusiness: (value: boolean) => void;
    toggleView: () => void;
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

export const ViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isBusiness, setIsBusiness] = useState(() => {
        const saved = localStorage.getItem('view_mode');
        return saved === 'business';
    });

    useEffect(() => {
        localStorage.setItem('view_mode', isBusiness ? 'business' : 'personal');

        // Update body theme color or other global styles if needed
        if (isBusiness) {
            document.documentElement.classList.add('business-mode');
        } else {
            document.documentElement.classList.remove('business-mode');
        }
    }, [isBusiness]);

    const toggleView = () => setIsBusiness(prev => !prev);

    return (
        <ViewContext.Provider value={{ isBusiness, setIsBusiness, toggleView }}>
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
