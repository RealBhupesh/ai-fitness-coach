import type { AppUserProfile } from "@/lib/app-types";

const DEMO_COOKIE = "fitcoach_demo";
const DEMO_STORAGE_KEY = "fitcoach_demo_v1";
const DEMO_PROFILE_COOKIE = "fitcoach_demo_profile";
const DEMO_PROFILE_STORAGE_KEY = "fitcoach_demo_profile_v1";
const DEMO_WORKOUT_PLAN_COOKIE = "fitcoach_demo_workout_plan";
const DEMO_WORKOUT_PLAN_STORAGE_KEY = "fitcoach_demo_workout_plan_v1";
const DEMO_NUTRITION_PLAN_COOKIE = "fitcoach_demo_nutrition_plan";
const DEMO_NUTRITION_PLAN_STORAGE_KEY = "fitcoach_demo_nutrition_plan_v1";

declare global {
  var __fitcoachDemoProfile: AppUserProfile | undefined;
  var __fitcoachDemoWorkoutPlan: unknown;
  var __fitcoachDemoNutritionPlan: unknown;
}

export const DEMO_COOKIE_NAME = DEMO_COOKIE;
export const DEMO_PROFILE_COOKIE_NAME = DEMO_PROFILE_COOKIE;
export const DEMO_WORKOUT_PLAN_COOKIE_NAME = DEMO_WORKOUT_PLAN_COOKIE;
export const DEMO_NUTRITION_PLAN_COOKIE_NAME = DEMO_NUTRITION_PLAN_COOKIE;

export const DEMO_USER = {
  id: "demo-user-001",
  email: "demo@fitcoach.local",
  name: "Demo User",
  emailVerified: false,
  image: null as string | null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

function parseCookieValue(cookieHeader: string, key: string) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`))
    ?.slice(key.length + 1);
}

function readJsonStorage<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJsonStorage(key: string, value: unknown) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

function clearJsonStorage(key: string) {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(key);
  }
}

function readJsonCookie<T>(cookieHeader: string, key: string) {
  const rawValue = parseCookieValue(cookieHeader, key);
  if (!rawValue) return null;

  try {
    return JSON.parse(decodeURIComponent(rawValue)) as T;
  } catch {
    return null;
  }
}

function normalizeDemoProfile(profile: Partial<AppUserProfile> = {}): AppUserProfile {
  return {
    userId: DEMO_USER.id,
    email: DEMO_USER.email,
    name: profile.name?.trim() || DEMO_USER.name,
    age: profile.age,
    gender: profile.gender,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    targetWeightKg: profile.targetWeightKg,
    experience: profile.experience ?? "beginner",
    goals: profile.goals ?? [],
    dietaryPrefs: profile.dietaryPrefs ?? [],
    injuries: profile.injuries ?? [],
    painPoints: profile.painPoints ?? [],
    equipmentAccess: profile.equipmentAccess ?? [],
    allergies: profile.allergies,
    workoutFrequency: profile.workoutFrequency,
    workoutDuration: profile.workoutDuration,
    cuisinePreference: profile.cuisinePreference,
    budgetTier: profile.budgetTier,
    coachingTone: profile.coachingTone,
    sleepHours: profile.sleepHours,
    onboardingCompleted: profile.onboardingCompleted ?? false,
    lastUpdated: profile.lastUpdated ?? new Date().toISOString(),
  };
}

function getServerDemoProfile() {
  return globalThis.__fitcoachDemoProfile ?? null;
}

function setServerDemoProfile(profile: AppUserProfile | null) {
  globalThis.__fitcoachDemoProfile = profile ?? undefined;
}

function getServerDemoWorkoutPlan<T>() {
  return (globalThis.__fitcoachDemoWorkoutPlan as T | undefined) ?? null;
}

function setServerDemoWorkoutPlan<T>(plan: T | null) {
  globalThis.__fitcoachDemoWorkoutPlan = plan ?? undefined;
}

function getServerDemoNutritionPlan<T>() {
  return (globalThis.__fitcoachDemoNutritionPlan as T | undefined) ?? null;
}

function setServerDemoNutritionPlan<T>(plan: T | null) {
  globalThis.__fitcoachDemoNutritionPlan = plan ?? undefined;
}

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

export function getDemoProfile(): AppUserProfile | null {
  const raw = readJsonStorage<Partial<AppUserProfile>>(DEMO_PROFILE_STORAGE_KEY);
  return raw ? normalizeDemoProfile(raw) : getServerDemoProfile();
}

export function saveDemoProfile(profile: Partial<AppUserProfile>) {
  const normalized = normalizeDemoProfile(profile);
  setServerDemoProfile(normalized);

  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_PROFILE_COOKIE}=${encodeURIComponent(JSON.stringify(normalized))}; path=/; max-age=2592000; samesite=lax`;
  }

  writeJsonStorage(DEMO_PROFILE_STORAGE_KEY, normalized);

  return normalized;
}

export function clearDemoProfile() {
  setServerDemoProfile(null);
  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_PROFILE_COOKIE}=; path=/; max-age=0`;
  }
  clearJsonStorage(DEMO_PROFILE_STORAGE_KEY);
}

export function getDemoProfileFromCookie(cookieHeader: string) {
  const raw = readJsonCookie<Partial<AppUserProfile>>(cookieHeader, DEMO_PROFILE_COOKIE);
  if (raw) {
    const normalized = normalizeDemoProfile(raw);
    setServerDemoProfile(normalized);
    return normalized;
  }
  return getServerDemoProfile();
}

export function buildDemoProfile(profile: Partial<AppUserProfile> = {}) {
  return normalizeDemoProfile(profile);
}

export function getDemoWorkoutPlan<T>() {
  return readJsonStorage<T>(DEMO_WORKOUT_PLAN_STORAGE_KEY) ?? getServerDemoWorkoutPlan<T>();
}

export function saveDemoWorkoutPlan<T>(plan: T) {
  setServerDemoWorkoutPlan(plan);
  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_WORKOUT_PLAN_COOKIE}=${encodeURIComponent(JSON.stringify(plan))}; path=/; max-age=2592000; samesite=lax`;
  }
  writeJsonStorage(DEMO_WORKOUT_PLAN_STORAGE_KEY, plan);
  return plan;
}

export function getDemoWorkoutPlanFromCookie<T>(cookieHeader: string) {
  const plan = readJsonCookie<T>(cookieHeader, DEMO_WORKOUT_PLAN_COOKIE);
  if (plan) {
    setServerDemoWorkoutPlan(plan);
    return plan;
  }
  return getServerDemoWorkoutPlan<T>();
}

export function clearDemoWorkoutPlan() {
  setServerDemoWorkoutPlan(null);
  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_WORKOUT_PLAN_COOKIE}=; path=/; max-age=0`;
  }
  clearJsonStorage(DEMO_WORKOUT_PLAN_STORAGE_KEY);
}

export function getDemoNutritionPlan<T>() {
  return readJsonStorage<T>(DEMO_NUTRITION_PLAN_STORAGE_KEY) ?? getServerDemoNutritionPlan<T>();
}

export function saveDemoNutritionPlan<T>(plan: T) {
  setServerDemoNutritionPlan(plan);
  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_NUTRITION_PLAN_COOKIE}=${encodeURIComponent(JSON.stringify(plan))}; path=/; max-age=2592000; samesite=lax`;
  }
  writeJsonStorage(DEMO_NUTRITION_PLAN_STORAGE_KEY, plan);
  return plan;
}

export function getDemoNutritionPlanFromCookie<T>(cookieHeader: string) {
  const plan = readJsonCookie<T>(cookieHeader, DEMO_NUTRITION_PLAN_COOKIE);
  if (plan) {
    setServerDemoNutritionPlan(plan);
    return plan;
  }
  return getServerDemoNutritionPlan<T>();
}

export function clearDemoNutritionPlan() {
  setServerDemoNutritionPlan(null);
  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_NUTRITION_PLAN_COOKIE}=; path=/; max-age=0`;
  }
  clearJsonStorage(DEMO_NUTRITION_PLAN_STORAGE_KEY);
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
  clearDemoProfile();
  clearDemoWorkoutPlan();
  clearDemoNutritionPlan();
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
