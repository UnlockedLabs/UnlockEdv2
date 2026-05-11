import { UserRole } from './user';

export const INIT_KRATOS_LOGIN_FLOW = '/self-service/login/browser';

export interface OrySessionWhoami {
    active: boolean;
    authenticated_at: string;
    expires_at: string;
    id: string;
    identity: OryIdentity;
    issued_at: string;
    tokenized: string;
}

export interface OryIdentity {
    id: string;
    schema_id: string;
    schema_url: string;
    state: string;
    state_changed_at: string;
    traits?: OryTraits;
    updated_at: string;
}

export interface OryTraits {
    username: string;
    facility_id: number;
    role: UserRole;
    password_reset: boolean;
}

export interface OryFlow {
    active: string;
    created_at: string;
    expires_at: string;
    id: string;
    issued_at: string;
    oauth2_login_challenge?: string;
    oauth2_login_request?: Oauth2LoginRequest;
    organization_id: string;
    refresh: boolean;
    request_url: string;
    requested_aal: string;
    return_to: string;
    session_token_exchange_code: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state: any;
    type: string;
    ui: OryUi;
    updated_at: string;
}

export interface Oauth2LoginRequest {
    challenge: string;
    client: Client;
    oidc_context: OidcContext;
    request_url: string;
    requested_access_token_audience: string[];
    requested_scope: string[];
    session_id: string;
    skip: boolean;
    subject: string;
}

export interface Client {
    access_token_strategy: string;
    allowed_cors_origins: string[];
    audience: string[];
    authorization_code_grant_access_token_lifespan: string;
    authorization_code_grant_id_token_lifespan: string;
    authorization_code_grant_refresh_token_lifespan: string;
    backchannel_logout_session_required: boolean;
    backchannel_logout_uri: string;
    client_credentials_grant_access_token_lifespan: string;
    client_id: string;
    client_name: string;
    client_secret: string;
    client_secret_expires_at: number;
    client_uri: string;
    contacts: string[];
    created_at: string;
    frontchannel_logout_session_required: boolean;
    frontchannel_logout_uri: string;
    grant_types: string[];
    implicit_grant_access_token_lifespan: string;
    implicit_grant_id_token_lifespan: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jwks: any;
    jwks_uri: string;
    jwt_bearer_grant_access_token_lifespan: string;
    logo_uri: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any;
    owner: string;
    policy_uri: string;
    post_logout_redirect_uris: string[];
    redirect_uris: string[];
    refresh_token_grant_access_token_lifespan: string;
    refresh_token_grant_id_token_lifespan: string;
    refresh_token_grant_refresh_token_lifespan: string;
    registration_access_token: string;
    registration_client_uri: string;
    request_object_signing_alg: string;
    request_uris: string[];
    response_types: string[];
    scope: string;
    sector_identifier_uri: string;
    skip_consent: boolean;
    skip_logout_consent: boolean;
    subject_type: string;
    token_endpoint_auth_method: string;
    token_endpoint_auth_signing_alg: string;
    tos_uri: string;
    updated_at: string;
    userinfo_signed_response_alg: string;
}

export interface OidcContext {
    acr_values: string[];
    display: string;
    login_hint: string;
    ui_locales: string[];
}

export interface OryUi {
    action: string;
    messages: Message[];
    method: string;
    nodes: OryUiNode[];
}

export interface Message {
    id: number;
    text: string;
    type: string;
}

export interface OryUiNode {
    attributes: Attributes;
    group: string;
    messages: OryUiMessage[];
    type: string;
}

export interface Attributes {
    autocomplete: string;
    disabled: boolean;
    label: Label;
    maxlength: number;
    name: string;
    node_type: string;
    onclick: string;
    onclickTrigger: string;
    onload: string;
    onloadTrigger: string;
    pattern: string;
    required: boolean;
    type: string;
    value: string;
}

export interface Label {
    id: number;
    text: string;
    type: string;
}

export interface OryUiMessage {
    id: number;
    text: string;
    type: string;
}

export interface AuthFlow {
    flow_id: string;
    challenge?: string;
    csrf_token: string;
    redirect_to?: string;
    identifier?: string;
}

export interface AuthResponse {
    redirect_to: string;
    logout_url?: string;
    redirect_browser_to?: string;
    first_login?: boolean;
}
