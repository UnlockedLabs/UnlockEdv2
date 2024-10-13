import { Dispatch, SetStateAction, createContext, useContext } from 'react';
import { AuthResponse, BROWSER_URL, User } from './common';
import API from './api/api';
import axios from 'axios';

interface AuthContextType {
    user: User | undefined;
    setUser: Dispatch<SetStateAction<User | undefined>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
    undefined
);

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export async function handleLogout(): Promise<void> {
    try {
        const resp = await API.post<AuthResponse>('logout', {});
        if (resp.success) {
            const logout = await axios.get(
                (resp.data as AuthResponse).redirect_to
            );
            if (logout.status === 200) {
                const logoutResp = logout.data as AuthResponse;
                window.location.replace(logoutResp.logout_url ?? BROWSER_URL);
            }
        }
    } catch (error) {
        window.location.href = BROWSER_URL;
        console.log('Logout failed', error);
    }
}
