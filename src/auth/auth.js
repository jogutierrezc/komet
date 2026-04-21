const AUTH_KEY = 'komet_auth';

export function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function login() {
  localStorage.setItem(AUTH_KEY, 'true');
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}
