// src/context/CreditContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

const CreditContext = createContext();

export const CreditProvider = ({ children }) => {
    const [credits, setCredits] = useState({ remaining: 0, total: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Replace with real API call later
        setTimeout(() => {
            setCredits({ remaining: 120, total: 500 });
            setIsLoading(false);
        }, 500);
    }, []);

    return (
        <CreditContext.Provider value={{ credits, isLoading }}>
            {children}
        </CreditContext.Provider>
    );
};

export const useCredit = () => useContext(CreditContext);
