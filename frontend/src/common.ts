export enum UserRole {
  Admin = "admin",
  Student = "student",
}

export const DEFAULT_ADMIN_ID = 1;
export interface User {
  id: number;
  name_first: string;
  name_last: string;
  username: string;
  role: string;
  email: string;
  [key: string]: any;
}

export interface UserWithMappings {
  User: User;
  logins: Array<ProviderMapping>;
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

export interface ProviderMapping {
  id: number;
  provider_platform_id: number;
  user_id: number;
  external_user_id: string;
  external_login_id: string;
  external_username: string;
  created_at: Date;
  updated_at: Date;
}

export interface PaginatedResponse<T> {
  message: string;
  data: Array<T>;
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}

export interface ServerResponse<T> {
  [key: string]: any;
  message: string;
  data: Array<T>;
}

export interface Category {
  id: number;
  name: string;
  links: Array<CategoryLink>;
  rank: number;
}

export interface CategoryLink {
  [linkName: string]: string;
}

export interface OidcClient {
  client_id: string;
  client_secret: string;
  scopes: string;
  auth_url: string;
  token_url: string;
}

export interface Activity {
  browser_name: string;
  clicked_url: string;
  created_at: string;
  device: string;
  id: number;
  platform: string;
  updated_at: Date;
  user_name_first: string;
  user_name_last: string;
}
export interface Program {
  id: number;
  provider_platform_id: number;
  name: string;
  description: string;
  external_id: string;
  thumbnail_url: string;
  is_public: boolean;
  external_url: string;
  created_at: Date;
  updated_at: Date;
}
export interface Milestone {
  id: number;
  program_id: number;
  type: string;
  external_url: string;
  description: string;
  external_id: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ProviderPlatform {
  access_key: string;
  account_id: string;
  base_url: string;
  description: string;
  icon_url: string;
  id: number;
  name: string;
  state: ProviderPlatformState;
  type: ProviderPlatformType;
  oidc_id: number;
  [key: string | ProviderPlatformState | ProviderPlatformType]: any;
}

export enum ProviderPlatformState {
  ENABLED = "enabled",
  DISABLED = "disabled",
  ARCHIVED = "archived",
}

export enum ProviderPlatformType {
  CANVAS_CLOUD = "canvas_cloud",
  CANVAS_OSS = "canvas_oss",
  KOLIBRI = "kolibri",
}
