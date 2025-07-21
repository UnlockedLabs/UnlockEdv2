import { Dispatch, SetStateAction, createContext, useContext } from 'react';
import { LoaderFunction, json, redirect } from 'react-router-dom';
import {
    AuthFlow,
    AuthResponse,
    INIT_KRATOS_LOGIN_FLOW,
    Facility,
    OryFlow,
    OrySessionWhoami,
    ServerResponseOne,
    User,
    UserRole,
    FeatureAccess
} from './common';
import API from './api/api';

interface AuthContextType {
    user: User | undefined;
    setUser: Dispatch<SetStateAction<User | undefined>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
    undefined
);

export const AdminRoles = [
    UserRole.SystemAdmin,
    UserRole.FacilityAdmin,
    UserRole.DepartmentAdmin
];

export const AllRoles = [UserRole.Student, ...AdminRoles];

export function canSwitchFacility(user: User): boolean {
    return isSysAdmin(user) || isDeptAdmin(user);
}
export const isAdministrator = (user: User | undefined): boolean => {
    return user !== undefined && AdminRoles.includes(user.role);
};
export const isSysAdmin = (u: User) => u.role === UserRole.SystemAdmin;

export const isDeptAdmin = (u: User) => u.role === UserRole.DepartmentAdmin;

export const isFacilityAdmin = (user: User | undefined): boolean => {
    return user !== undefined && user.role === UserRole.FacilityAdmin;
};

export const isStudent = (user: User): boolean => {
    return !AdminRoles.includes(user.role);
};

export const SESSION_URL = '/sessions/whoami';
export const KRATOS_CHECK_FLOW_URL = '/self-service/login/flows?id=';
export const AUTHCALLBACK = '/authcallback';

export async function fetchUser(): Promise<User | undefined> {
    const response = await API.get<User>('auth');
    const user = response.data as User;
    return user;
}

export const checkRole: LoaderFunction = async () => {
    const user = await fetchUser();
    return redirect(getDashboardLink(user));
};

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export const initFlow = async (flow: string): Promise<AuthFlow> => {
    try {
        const resp = await fetch(KRATOS_CHECK_FLOW_URL + flow, {
            credentials: 'include'
        });
        if (resp.status !== 200) {
            // bad flow id, redirect to login
            return redirectTo(INIT_KRATOS_LOGIN_FLOW);
        }
        const jsonResp = (await resp.json()) as OryFlow;
        return {
            flow_id: jsonResp.id,
            challenge: jsonResp.oauth2_login_challenge,
            csrf_token: jsonResp.ui.nodes[0].attributes.value
        };
    } catch {
        return redirectTo(INIT_KRATOS_LOGIN_FLOW);
    }
};

export const hasFeature = (user: User, ...axx: FeatureAccess[]): boolean => {
    return axx.every((ax) => user.feature_access.includes(ax));
};

export const checkDefaultFacility: LoaderFunction = async () => {
    const resp = await API.get<Facility>('facilities/1');
    if (resp.success && resp.type == 'one') {
        return json<Facility>(resp.data);
    } else {
        return json<null>(null);
    }
};

const redirectTo = (url: string): AuthFlow => {
    return {
        flow_id: '',
        challenge: '',
        csrf_token: '',
        redirect_to: url
    };
};

export const checkExistingFlow: LoaderFunction = async ({ request }) => {
    const url = new URL(request.url);
    const queryParams = new URLSearchParams(url.search);
    const flow = queryParams.get('flow');
    if (!flow) {
        console.log('No login flow specified');
        return json<AuthFlow>(redirectTo(INIT_KRATOS_LOGIN_FLOW));
    }
    const attributes = await initFlow(flow);
    try {
        const checkResp = await fetch(SESSION_URL, {
            credentials: 'include'
        });
        if (checkResp.status === 200) {
            const jsonResp = (await checkResp.json()) as OrySessionWhoami;
            if (jsonResp.active && jsonResp.identity.traits) {
                if (!attributes.challenge) {
                    // if the user is logged in and there is no oauth2 challenge:
                    // redirect to the auth callback
                    return json<AuthFlow>(redirectTo(AUTHCALLBACK));
                }
                const reqBody = {
                    username: jsonResp.identity.traits.username,
                    identity: jsonResp.identity.id,
                    csrf_token: attributes?.csrf_token,
                    session: jsonResp,
                    challenge: attributes?.challenge
                };
                const resp = (await API.post(
                    'auth/refresh',
                    reqBody
                )) as ServerResponseOne<AuthResponse>;
                if (resp.success)
                    return json<AuthFlow>(redirectTo(resp.data.redirect_to));
            }
        }
    } catch {
        console.error('No active sessions found for this user');
    }
    return json<AuthFlow>(attributes);
};

export async function handleLogout(): Promise<void> {
    try {
        const resp = await API.post<AuthResponse, object>('logout', {});
        if (resp.success) {
            const logout = await fetch(
                (resp.data as AuthResponse).redirect_to,
                { credentials: 'include' }
            );
            if (logout.status === 200) {
                window.dispatchEvent(new Event('logoutEvent'));
                const logoutResp = (await logout.json()) as AuthResponse;
                window.location.replace(
                    logoutResp.logout_url ?? INIT_KRATOS_LOGIN_FLOW
                );
            }
        }
    } catch (error) {
        window.location.href = INIT_KRATOS_LOGIN_FLOW;
        console.error('Logout failed', error);
    }
}

export const getDashboardLink = (user?: User) => {
    if (!user) return '/';
    return isAdministrator(user) ? getAdminLink(user) : getResidentLink(user);
};

const getAdminLink = (user: User): string => {
    if (user.feature_access.includes(FeatureAccess.OpenContentAccess)) {
        return '/knowledge-insights';
    }
    if (user.feature_access.includes(FeatureAccess.ProviderAccess)) {
        return '/learning-insights';
    }
    return '/operational-insights';
};

const getResidentLink = (user: User): string => {
    if (user.feature_access.includes(FeatureAccess.OpenContentAccess)) {
        return '/home';
    }
    if (user.feature_access.includes(FeatureAccess.ProviderAccess)) {
        return '/learning-path';
    }
    return '/temp-home';
};

export function isUserDeactivated(user: User): boolean {
    return user.deactivated_at != null;
}
