const DEMO_COOKIE = "fitcoach_demo";
const DEMO_STORAGE_KEY = "fitcoach_demo_v1";

export const DEMO_COOKIE_NAME = DEMO_COOKIE;

export const DEMO_USER = {
  id: "demo-user-001",
  email: "demo@fitcoach.local",
  name: "Demo User",
  emailVerified: false,
  image: null as string | null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

export function isDemoUser(userId: string) {
  return userId === DEMO_USER.id;
}

export function createDemoSession() {
  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=2592000; samesite=lax`;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(DEMO_USER));
  }
  return DEMO_USER;
}

export function getDemoSession(): typeof DEMO_USER | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDemoSession() {
  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0`;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(DEMO_STORAGE_KEY);
  }
}

export function hasDemoCookie(cookieHeader: string) {
  return cookieHeader.includes(`${DEMO_COOKIE}=1`);
}

export function buildDemoServerSession() {
  return {
    user: { ...DEMO_USER },
    session: {
      id: "demo-session",
      token: "demo-token",
      userId: DEMO_USER.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: null as string | null,
      userAgent: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}
