export enum ProviderPlatformType {
    CANVAS_CLOUD = 'canvas_cloud',
    CANVAS_OSS = 'canvas_oss',
    KOLIBRI = 'kolibri',
    BRIGHTSPACE = 'brightspace'
}

export enum ProviderPlatformState {
    ENABLED = 'enabled',
    DISABLED = 'disabled',
    ARCHIVED = 'archived'
}

export interface ProviderPlatform {
    access_key: string;
    account_id: string;
    base_url: string;
    id: number;
    name: string;
    state: ProviderPlatformState;
    type: ProviderPlatformType;
    oidc_id: number;
    [key: string]:
        | string
        | number
        | ProviderPlatformState
        | ProviderPlatformType;
}

export interface ProviderUser {
    username: string;
    name_last: string;
    name_first: string;
    email: string;
    external_user_id: string;
    external_username: string;
}

export interface UserImports {
    username: string;
    temp_password: string;
    error?: string;
}

export interface ProviderResponse {
    platform?: ProviderPlatform;
    oauth2Url?: string;
}

export interface OidcClient {
    client_id: string;
    client_secret: string;
    scope: string;
    auth_url: string;
    token_url: string;
}
