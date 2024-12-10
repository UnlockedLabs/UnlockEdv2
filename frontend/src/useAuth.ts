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
import axios from 'axios';

interface AuthContextType {
    user: User | undefined;
    setUser: Dispatch<SetStateAction<User | undefined>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
    undefined
);

export const AdminRoles = [UserRole.SystemAdmin, UserRole.Admin];

export const isAdministrator = (user: User | undefined): boolean => {
    return user !== undefined && AdminRoles.includes(user.role);
};

export const isStudent = (user: User): boolean => {
    return !AdminRoles.includes(user.role);
};

export const SESSION_URL = '/sessions/whoami';
export const KRATOS_CHECK_FLOW_URL = '/self-service/login/flows?id=';

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
        const resp = await axios.get<OryFlow>(KRATOS_CHECK_FLOW_URL + flow);
        if (resp.status !== 200) {
            console.error('Error initializing login flow');
            return { flow_id: '', challenge: '', csrf_token: '' };
        }
        return {
            flow_id: resp.data.id,
            challenge: resp.data.oauth2_login_challenge,
            csrf_token: resp.data.ui.nodes[0].attributes.value
        };
    } catch {
        return { flow_id: '', challenge: '', csrf_token: '' };
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
        const checkResp = await axios.get<OrySessionWhoami>(SESSION_URL, {
            withCredentials: true
        });
        if (
            checkResp.status === 200 &&
            checkResp.data.active &&
            checkResp.data.identity.traits
        ) {
            const reqBody = {
                username: checkResp.data.identity.traits.username,
                identity: checkResp.data.identity.id,
                csrf_token: attributes?.csrf_token,
                session: checkResp.data,
                challenge: attributes?.challenge
            };
            const resp = (await API.post(
                'auth/refresh',
                reqBody
            )) as ServerResponseOne<AuthResponse>;
            if (resp.success)
                return json<AuthFlow>(redirectTo(resp.data.redirect_to));
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
            const logout = await axios.get(
                (resp.data as AuthResponse).redirect_to
            );
            if (logout.status === 200) {
                const logoutResp = logout.data as AuthResponse;
                window.location.replace(
                    logoutResp.logout_url ?? INIT_KRATOS_LOGIN_FLOW
                );
            }
        }
    } catch (error) {
        window.location.href = INIT_KRATOS_LOGIN_FLOW;
        console.log('Logout failed', error);
    }
}

const accessValues = new Map<FeatureAccess, number>([
    [FeatureAccess.OpenContentAccess, 1],
    [FeatureAccess.ProviderAccess, 2],
    [FeatureAccess.ProgramAccess, 3]
]);
const adminAccessLinks = [
    '/operational-insights', // temporary layer 0 until implemented
    '/knowledge-insights',
    '/learning-insights',
    '/learning-insights' // temporary until layer 3 is implemented
];

const studentAccessLinks = [
    '/home', // temporary layer 0 until implemented
    '/trending-content',
    '/learning-path', // temporary until layer 3 is implemented
    '/learning-path' // temporary until layer 3 is implemented
];

export const getDashboardLink = (user?: User) => {
    if (!user) return '/';

    const maxFeature =
        user?.feature_access
            .map((ax) => accessValues.get(ax) ?? 0)
            .sort((a, b) => a - b)
            .pop() ?? 0;
    return isAdministrator(user)
        ? adminAccessLinks[maxFeature]
        : studentAccessLinks[maxFeature];
};
