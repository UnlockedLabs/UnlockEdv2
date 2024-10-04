import '@/bootstrap';
import React, { useEffect, useState } from 'react';
import { User } from './common';
import API from './api/api';
import { AuthContext } from '@/useAuth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const [user, setUser] = useState<User | undefined>();
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const fetchUser = async () => {
            const response = await API.get<User>(`auth`);
            setUser(response.data as User);
            setLoading(false);
        };
        fetchUser();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }
    if (!user) {
        return;
    } else if (
        user.password_reset &&
        window.location.pathname !== '/reset-password'
    ) {
        window.location.href = '/reset-password';
        return;
    }
    return (
        <AuthContext.Provider value={{ user, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};
