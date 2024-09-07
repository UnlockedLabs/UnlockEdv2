import '@/bootstrap';
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    Dispatch,
    SetStateAction
} from 'react';
import axios from 'axios';
import { AuthResponse, User, BROWSER_URL } from './common';
import UnauthorizedNotFound from './Pages/Unauthorized';
import API from './api/api';

interface AuthContextType {
    user: User | null;
    setUser: Dispatch<SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const [user, setUser] = useState<User | null>(null);
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
        return null;
    } else if (
        user.password_reset === true &&
        window.location.pathname !== '/reset-password'
    ) {
        window.location.href = '/reset-password';
        return null;
    }
    return (
        <AuthContext.Provider value={{ user, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const AdminOnly: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    if (user.role === 'admin') {
        return <>{children}</>;
    } else {
        return <UnauthorizedNotFound which="unauthorized" />;
    }
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const handleLogout = async () => {
    try {
        const resp = await API.post<AuthResponse>('logout', {});
        if (resp.success) {
            const logout = await axios.get(
                (resp.data as AuthResponse).redirect_to
            );
            if (logout.status === 200) {
                window.location.href = logout.data.logout_url;
            }
        }
    } catch (error) {
        window.location.href = BROWSER_URL;
        console.log('Logout failed', error);
    }
};
