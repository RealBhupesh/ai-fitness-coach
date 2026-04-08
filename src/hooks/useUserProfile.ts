"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth/client";
import type { AppUserProfile, DietaryPref, ExperienceLevel, Goal } from "@/lib/app-types";
import { getDummyProfile, getDummySession, setDummyProfile, type DummyUser } from "@/lib/dummy-auth";

export type { DietaryPref, ExperienceLevel, Goal, AppUserProfile as UserProfile };

export function useUserProfile() {
  const { data: sessionData, isPending } = useSession();
  const [dummySession, setDummySession] = useState<DummyUser | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDummySession(getDummySession());
  }, []);

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

    if (dummySession?.id) {
      const localProfile = getDummyProfile<AppUserProfile>();
      const nextProfile = localProfile ?? buildDefaultProfile(dummySession);
      setDummyProfile(nextProfile);
      setProfile(nextProfile);
      setLoading(false);
      return nextProfile;
    }

    setProfile(null);
    setLoading(false);
    return null;
  }, [buildDefaultProfile, dummySession, sessionData?.user?.email, sessionData?.user?.id, sessionData?.user?.name]);

  useEffect(() => {
    if (!isPending) {
      void refreshProfile();
    }
  }, [isPending, refreshProfile]);

  const updateProfile = useCallback(
    async (partial: Partial<AppUserProfile>) => {
      if (sessionData?.user?.id) {
        try {
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
        } catch (error) {
          // If real auth path fails but a demo session exists, continue in demo mode.
          if (!dummySession?.id) {
            throw error;
          }
        }
      }

      if (dummySession?.id) {
        const current = getDummyProfile<AppUserProfile>() ?? buildDefaultProfile(dummySession);
        const nextProfile: AppUserProfile = {
          ...current,
          ...partial,
          userId: dummySession.id,
          email: dummySession.email,
          lastUpdated: new Date().toISOString(),
        };
        setDummyProfile(nextProfile);
        setProfile(nextProfile);
        return nextProfile;
      }

      return null;
    },
    [buildDefaultProfile, dummySession, sessionData?.user?.id],
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

    if (dummySession?.id) {
      const fallback = buildDefaultProfile(dummySession);
      setDummyProfile(fallback);
      setProfile(fallback);
    }
  }, [buildDefaultProfile, dummySession, refreshProfile, sessionData?.user?.id]);

  const effectiveSession = sessionData ?? (dummySession ? ({ user: dummySession } as any) : null);

  return {
    profile,
    loading: loading || isPending,
    session: effectiveSession,
    updateProfile,
    resetProfile,
    refreshProfile,
  };
}
