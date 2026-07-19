import { postJson } from "./client";

export type TokenResponse = {
  access_token: string;
  token_type: string;
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
