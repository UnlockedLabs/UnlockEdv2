import React from 'react';
import { useState, useEffect } from 'react';
import { INIT_KRATOS_LOGIN_FLOW, User } from '@/common';
import { AuthContext, fetchUser, handleLogout } from '@/useAuth';
import { useNavigate } from 'react-router-dom';
import { tabSessionManager } from '@/tabSession';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const passReset = '/reset-password';
    const [user, setUser] = useState<User | undefined>();
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    useEffect(() => {
        const checkAuth = async () => {
            const authUser = await fetchUser();
            if (authUser) {
                const hasValidTabSession =
                    await tabSessionManager.validateSession();
                if (!hasValidTabSession) {
                    await handleLogout();
                    return;
                }
                setUser(authUser);
            }
            setLoading(false);
        };
        void checkAuth();
    }, []);
    if (loading) {
        return <div></div>;
    }
    if (!user && !loading) {
        window.location.href = INIT_KRATOS_LOGIN_FLOW;
        return null;
    } else if (
        !loading &&
        user?.password_reset &&
        window.location.pathname !== passReset
    ) {
        navigate(passReset);
        return null;
    }
    return (
        <AuthContext.Provider value={{ user, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};
