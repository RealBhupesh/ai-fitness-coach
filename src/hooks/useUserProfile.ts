"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { isProfileReadyForEdit } from "@/lib/profile-state";
import { useSession } from "@/lib/auth/client";
import type { AppUserProfile, DietaryPref, ExperienceLevel, Goal } from "@/lib/app-types";

export type { DietaryPref, ExperienceLevel, Goal, AppUserProfile as UserProfile };

export function useUserProfile() {
  const { data: sessionData, isPending } = useSession();
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingRead = useRef<AbortController | null>(null);

  const buildDefaultProfile = useCallback((user: { id: string; email?: string | null; name?: string | null }): AppUserProfile => {
    return {
      userId: user.id,
      email: user.email ?? undefined,
      name: user.name ?? "Athlete",
      experience: "beginner",
      goals: [],
      readinessAssumptions: [],
      coachingConstraints: [],
      dietaryPrefs: [],
      injuries: [],
      painPoints: [],
      equipmentAccess: [],
      onboardingCompleted: false,
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    pendingRead.current?.abort();
    const controller = new AbortController();
    pendingRead.current = controller;
    setLoading(true);

    if (sessionData?.user?.id) {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Saved profile unavailable");

        const data = await response.json();
        if (controller.signal.aborted) return null;
        const nextProfile = data.profile ?? null;
        setProfile(nextProfile);
        setError(null);
        window.dispatchEvent(new Event("fitcoach:profile-ready"));
        return nextProfile;
      } catch {
        if (controller.signal.aborted) return null;
        setError("Saved profile unavailable");
        window.dispatchEvent(new Event("fitcoach:profile-error"));
        return null;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    setProfile(null);
    setError(null);
    setLoading(false);
    return null;
  }, [buildDefaultProfile, sessionData?.user?.email, sessionData?.user?.id, sessionData?.user?.name]);

  useEffect(() => {
    if (!isPending) {
      void refreshProfile();
    }
    return () => pendingRead.current?.abort();
  }, [isPending, refreshProfile]);

  const updateProfile = useCallback(
    async (partial: Partial<AppUserProfile>) => {
      if (!isProfileReadyForEdit(sessionData?.user?.id, profile, loading || isPending, error)) throw new Error("Load your saved profile before saving changes.");
      if (sessionData?.user?.id) {
        const response = await fetch("/api/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(partial),
        });

        if (!response.ok) {
          throw new Error("Failed to update profile");
        }

        const data = await response.json();
        setProfile(data.profile ?? null);
        return data.profile ?? null;
      }

      return null;
    },
    [sessionData?.user?.id, profile, loading, isPending, error],
  );

  const resetProfile = useCallback(async () => {
    if (sessionData?.user?.id) {
      const response = await fetch("/api/profile", {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to reset profile");
      await refreshProfile();
      return;
    }
  }, [refreshProfile, sessionData?.user?.id]);

  return {
    profile,
    loading: loading || isPending,
    error,
    session: sessionData ?? null,
    updateProfile,
    resetProfile,
    refreshProfile,
  };
}
