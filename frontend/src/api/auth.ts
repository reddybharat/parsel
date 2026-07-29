import { getJson, patchJson, postJson } from "./client";

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type UserPreferences = {
  theme: "light" | "dark";
};

export type MeResponse = {
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  preferences: UserPreferences;
};

export type UpdateMeResponse = MeResponse & TokenResponse;

export type UpdateMePayload = {
  username?: string;
  first_name?: string | null;
  last_name?: string | null;
  preferences?: UserPreferences;
};

export async function login(login: string, password: string): Promise<TokenResponse> {
  return postJson<TokenResponse>("/auth/login", { login, password });
}

export async function register(
  username: string,
  email: string,
  password: string,
  confirmPassword: string,
): Promise<TokenResponse> {
  return postJson<TokenResponse>("/auth/register", {
    username,
    email,
    password,
    confirm_password: confirmPassword,
  });
}

export async function refreshSession(): Promise<TokenResponse> {
  return postJson<TokenResponse>("/auth/refresh");
}

export async function getMe(): Promise<MeResponse> {
  return getJson<MeResponse>("/auth/me");
}

export async function updateMe(payload: UpdateMePayload): Promise<UpdateMeResponse> {
  return patchJson<UpdateMeResponse>("/auth/me", payload);
}
