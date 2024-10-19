import '@/bootstrap';
import React from 'react';
import { useState, useEffect } from 'react';
import { BROWSER_URL, User } from '@/common';
import { AuthContext, fetchUser } from '@/useAuth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const passReset = '/reset-password';
    const [user, setUser] = useState<User | undefined>();
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const checkAuth = async () => {
            const user = await fetchUser();
            if (user) setUser(user);
            setLoading(false);
        };
        void checkAuth();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }
    if (!user) {
        window.location.href = BROWSER_URL;
        return;
    } else if (user.password_reset && window.location.pathname !== passReset) {
        window.location.href = passReset;
        return;
    }
    return (
        <AuthContext.Provider value={{ user, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};
