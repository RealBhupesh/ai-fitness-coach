export const DUMMY_AUTH_COOKIE = "fitcoach_dummy_session";
const DUMMY_USER_KEY = "fitcoach_dummy_user_v1";
const DUMMY_PROFILE_KEY = "fitcoach_dummy_profile_v1";

export type DummyUser = {
  id: string;
  email: string;
  name: string;
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function createDummySession(name = "Demo User", email = "demo@fitcoach.local"): DummyUser {
  const user: DummyUser = {
    id: "demo-user",
    email,
    name,
  };

  if (typeof document !== "undefined") {
    document.cookie = `${DUMMY_AUTH_COOKIE}=1; path=/; max-age=2592000; samesite=lax`;
  }

  writeJson(DUMMY_USER_KEY, user);
  return user;
}

export function clearDummySession() {
  if (typeof document !== "undefined") {
    document.cookie = `${DUMMY_AUTH_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(DUMMY_USER_KEY);
    window.localStorage.removeItem(DUMMY_PROFILE_KEY);
  }
}

export function getDummySession(): DummyUser | null {
  return readJson<DummyUser>(DUMMY_USER_KEY);
}

export function getDummyProfile<T>(): T | null {
  return readJson<T>(DUMMY_PROFILE_KEY);
}

export function setDummyProfile(value: unknown) {
  writeJson(DUMMY_PROFILE_KEY, value);
}
