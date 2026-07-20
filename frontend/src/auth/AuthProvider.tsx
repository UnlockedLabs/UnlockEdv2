import React, { useState, useEffect } from 'react';
import { INIT_KRATOS_LOGIN_FLOW, User } from '@/types';
import { AuthContext, fetchUser, handleLogout } from '@/auth/useAuth';
import { useNavigate } from 'react-router-dom';
import { tabSessionManager } from '@/session/tabSession';
import { identifyUser } from '@/lib/events';

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
                identifyUser(authUser);
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

    // Self-heal stale sessions. feature_access (and other traits) are resolved
    // server-side on every request, but the client caches the user from the
    // one-shot fetch at mount. Re-fetch when the tab regains visibility so a
    // per-facility feature toggle made by an admin re-gates a resident's nav and
    // routes without a manual reload. The backend already enforces the change
    // immediately (401s); this just keeps the UI honest.
    useEffect(() => {
        if (loading || !user) return;
        let inFlight = false;
        const revalidate = async () => {
            if (document.hidden || inFlight) return;
            inFlight = true;
            try {
                const fresh = await fetchUser();
                // API.get resolves even on failure (an expired session yields an
                // empty object), so only adopt a response that carries a real
                // identity — never blank a live session on a transient error.
                if (
                    typeof fresh?.id !== 'number' ||
                    !Array.isArray(fresh.feature_access)
                ) {
                    return;
                }
                // Only adopt when something that gates the UI actually changed,
                // so a refocus with no change doesn't re-render the whole tree.
                const changed =
                    fresh.role !== user.role ||
                    fresh.facility_id !== user.facility_id ||
                    fresh.feature_access.join() !== user.feature_access.join();
                if (changed) setUser(fresh);
            } finally {
                inFlight = false;
            }
        };
        const onVisibility = () => void revalidate();
        document.addEventListener('visibilitychange', onVisibility);
        return () =>
            document.removeEventListener('visibilitychange', onVisibility);
    }, [loading, user]);

    if (loading || !user) {
        return null;
    }

    return (
        <AuthContext.Provider value={{ user, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};
