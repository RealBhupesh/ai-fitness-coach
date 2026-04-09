"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth/client";
import type { AppUserProfile, DietaryPref, ExperienceLevel, Goal } from "@/lib/app-types";

export type { DietaryPref, ExperienceLevel, Goal, AppUserProfile as UserProfile };

export function useUserProfile() {
  const { data: sessionData, isPending } = useSession();
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const buildDefaultProfile = useCallback((user: { id: string; email?: string | null; name?: string | null }): AppUserProfile => {
    return {
      userId: user.id,
      email: user.email ?? undefined,
      name: user.name ?? "Athlete",
      experience: "beginner",
      goals: [],
      dietaryPrefs: [],
      injuries: [],
      painPoints: [],
      equipmentAccess: [],
      onboardingCompleted: false,
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    setLoading(true);

    if (sessionData?.user?.id) {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
        });

        if (!response.ok) {
          const fallback = buildDefaultProfile({
            id: sessionData.user.id,
            email: sessionData.user.email,
            name: sessionData.user.name,
          });
          setProfile(fallback);
          return fallback;
        }

        const data = await response.json();
        const nextProfile = data.profile ?? null;
        setProfile(nextProfile);
        return nextProfile;
      } catch {
        const fallback = buildDefaultProfile({
          id: sessionData.user.id,
          email: sessionData.user.email,
          name: sessionData.user.name,
        });
        setProfile(fallback);
        return fallback;
      } finally {
        setLoading(false);
      }
    }

    setProfile(null);
    setLoading(false);
    return null;
  }, [buildDefaultProfile, sessionData?.user?.email, sessionData?.user?.id, sessionData?.user?.name]);

  useEffect(() => {
    if (!isPending) {
      void refreshProfile();
    }
  }, [isPending, refreshProfile]);

  const updateProfile = useCallback(
    async (partial: Partial<AppUserProfile>) => {
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
    [sessionData?.user?.id],
  );

  const resetProfile = useCallback(async () => {
    if (sessionData?.user?.id) {
      await fetch("/api/profile", {
        method: "DELETE",
        credentials: "include",
      });
      await refreshProfile();
      return;
    }
  }, [refreshProfile, sessionData?.user?.id]);

  return {
    profile,
    loading: loading || isPending,
    session: sessionData ?? null,
    updateProfile,
    resetProfile,
    refreshProfile,
  };
}
