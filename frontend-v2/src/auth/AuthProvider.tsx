import React, { useState, useEffect } from 'react';
import { INIT_KRATOS_LOGIN_FLOW, User } from '@/types';
import { AuthContext, fetchUser, handleLogout } from '@/auth/useAuth';
import { useNavigate } from 'react-router-dom';
import { tabSessionManager } from '@/session/tabSession';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const passReset = '/reset-password';
    const [user, setUser] = useState<User | undefined>();
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        const checkAuth = async () => {
            const authUser = await fetchUser();
            if (cancelled) return;
            if (authUser) {
                const hasValidTabSession =
                    await tabSessionManager.validateSession();
                if (cancelled) return;
                if (!hasValidTabSession) {
                    await handleLogout();
                    return;
                }
                setUser(authUser);
            }
            setLoading(false);
        };
        void checkAuth();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            window.location.href = INIT_KRATOS_LOGIN_FLOW;
            return;
        }
        if (user.password_reset && window.location.pathname !== passReset) {
            navigate(passReset);
        }
    }, [loading, user, navigate]);

    if (loading || !user) {
        return null;
    }

    return (
        <AuthContext.Provider value={{ user, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};
