export enum UserRole {
  Admin = "admin",
  Student = "student",
}

export interface User {
  id: number;
  name_first: string;
  name_last: string;
  username: string;
  role: string;
  email: string;
  password_reset: boolean;
}

export type PageProps<
  T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
  auth: {
    user: User;
  };
};
