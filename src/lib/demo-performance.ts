import type { DashboardSummary } from "@/lib/app-types";

export type CommunityAthlete = {
  id: string;
  name: string;
  role: string;
  level: string;
  avatar: string;
  score: number;
  streak: number;
  sessions: number;
  danceScore: number;
  topMove: string;
  trend: "up" | "steady";
};

export type DemoAchievement = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  points: number;
  threshold: number;
  progress: number;
  unlocked: boolean;
  unlockedDate: string | null;
};

export const DEMO_COMMUNITY_LEADERBOARD: CommunityAthlete[] = [
  {
    id: "athlete-riya",
    name: "Riya",
    role: "Dance captain",
    level: "Gold",
    avatar: "RI",
    score: 94,
    streak: 12,
    sessions: 28,
    danceScore: 92,
    topMove: "Snap And Release",
    trend: "up",
  },
  {
    id: "athlete-aarav",
    name: "Aarav",
    role: "Consistency lead",
    level: "Silver",
    avatar: "AA",
    score: 88,
    streak: 9,
    sessions: 24,
    danceScore: 84,
    topMove: "Groove Drop",
    trend: "steady",
  },
  {
    id: "athlete-maya",
    name: "Maya",
    role: "Form specialist",
    level: "Silver",
    avatar: "MY",
    score: 86,
    streak: 7,
    sessions: 21,
    danceScore: 78,
    topMove: "Open Hit",
    trend: "up",
  },
  {
    id: "athlete-kabir",
    name: "Kabir",
    role: "New challenger",
    level: "Bronze",
    avatar: "KB",
    score: 79,
    streak: 4,
    sessions: 13,
    danceScore: 76,
    topMove: "Reset Center",
    trend: "up",
  },
];

export const DEMO_ACHIEVEMENTS: DemoAchievement[] = [
  {
    id: "ach_first_steps",
    name: "First Steps",
    description: "Complete your first fitness or dance session",
    category: "milestone",
    icon: "Start",
    points: 10,
    threshold: 1,
    progress: 1,
    unlocked: true,
    unlockedDate: "2026-06-20T09:00:00.000Z",
  },
  {
    id: "ach_hip_hop_debut",
    name: "Hip-Hop Debut",
    description: "Complete your first hip-hop dance session",
    category: "dance",
    icon: "Beat",
    points: 30,
    threshold: 1,
    progress: 1,
    unlocked: true,
    unlockedDate: "2026-06-21T09:00:00.000Z",
  },
  {
    id: "ach_groove_builder",
    name: "Groove Builder",
    description: "Complete 10 dance sessions with saved timing and phrase evidence",
    category: "dance",
    icon: "Groove",
    points: 120,
    threshold: 10,
    progress: 6,
    unlocked: false,
    unlockedDate: null,
  },
  {
    id: "ach_form_scholar",
    name: "Form Scholar",
    description: "Finish 10 sessions with a score of 85 or higher",
    category: "fitness",
    icon: "Score",
    points: 150,
    threshold: 10,
    progress: 4,
    unlocked: false,
    unlockedDate: null,
  },
  {
    id: "ach_week_warrior",
    name: "Week Warrior",
    description: "Build a 7-day training streak",
    category: "consistency",
    icon: "Streak",
    points: 50,
    threshold: 7,
    progress: 5,
    unlocked: false,
    unlockedDate: null,
  },
];

export const DEMO_DASHBOARD_SUMMARY: DashboardSummary = {
  streak: 5,
  totalWorkouts: 12,
  totalMinutes: 286,
  totalCalories: 1840,
  averageScore: 84,
  adherence: 78,
  recentSessions: [
    {
      id: "demo-session-01",
      type: "dance",
      exerciseType: "dance_basic",
      date: "2026-06-28T17:15:00.000Z",
      duration: 18,
      caloriesBurned: 155,
      compositeScore: 86,
      summary: "Starter groove improved on timing, with cleaner arm hits in the final phrase.",
    },
    {
      id: "demo-session-02",
      type: "strength",
      exerciseType: "squat",
      date: "2026-06-27T17:40:00.000Z",
      duration: 22,
      caloriesBurned: 175,
      compositeScore: 82,
      summary: "Knee tracking stayed mostly controlled; depth needs one more focused set.",
    },
    {
      id: "demo-session-03",
      type: "dance",
      exerciseType: "dance_basic",
      date: "2026-06-26T18:05:00.000Z",
      duration: 16,
      caloriesBurned: 140,
      compositeScore: 79,
      summary: "Groove bounce was consistent, but transitions landed slightly late.",
    },
  ],
  weightTrend: [
    { date: "2026-06-21T00:00:00.000Z", weight: 70.8 },
    { date: "2026-06-24T00:00:00.000Z", weight: 70.4 },
    { date: "2026-06-28T00:00:00.000Z", weight: 70.1 },
  ],
  activePlan: {
    id: "demo-plan-groove",
    name: "Dance + Form Builder",
    progress: 42,
    currentWeek: 2,
    daysPerWeek: 4,
  },
  activeNutritionPlan: {
    id: "demo-nutrition-plan",
    name: "Balanced Performance Plate",
    dailyCalories: 2140,
    proteinGrams: 126,
    carbsGrams: 256,
    fatGrams: 62,
  },
  communityLeaderboard: DEMO_COMMUNITY_LEADERBOARD,
  featuredAchievements: DEMO_ACHIEVEMENTS,
};

export const DEMO_ACHIEVEMENT_STATS = {
  totalSessions: 12,
  totalCalories: 1840,
  totalReps: 92,
  danceSessionsCount: 6,
  strengthSessionsCount: 6,
  bestCompositeScore: 89,
  highScoreSessions: 4,
  curlScorecards: 8,
  squatScorecards: 14,
  danceScoreSessions: 6,
  currentStreak: 5,
  weeklySessionPeak: 5,
};
