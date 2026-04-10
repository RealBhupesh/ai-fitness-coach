import OpenAI from "openai";
import type { AppUserProfile } from "@/lib/app-types";
import { buildFallbackNutritionPlan, buildFallbackWorkoutPlan } from "@/lib/server/app-data";

type ChatRole = "system" | "user" | "assistant";

const openAiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const groqClient = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    })
  : null;

function getClient() {
  if (groqClient) {
    return { client: groqClient, model: "llama-3.3-70b-versatile", provider: "groq" as const };
  }
  if (openAiClient) {
    return { client: openAiClient, model: "gpt-4o-mini", provider: "openai" as const };
  }
  return null;
}

function profileContext(profile: AppUserProfile | null | undefined) {
  if (!profile) {
    return "No profile has been completed yet.";
  }

  return [
    `Name: ${profile.name}`,
    `Experience: ${profile.experience}`,
    `Goals: ${profile.goals.join(", ") || "none"}`,
    `Weight: ${profile.weightKg ?? "unknown"} kg`,
    `Target weight: ${profile.targetWeightKg ?? "unknown"} kg`,
    `Dietary preferences: ${profile.dietaryPrefs.join(", ") || "none"}`,
    `Injuries: ${profile.injuries.join(", ") || "none"}`,
    `Pain points: ${profile.painPoints.join(", ") || "none"}`,
    `Equipment: ${profile.equipmentAccess.join(", ") || "none"}`,
    `Workout frequency: ${profile.workoutFrequency ?? "unknown"} days/week`,
    `Workout duration: ${profile.workoutDuration ?? "unknown"} minutes`,
    `Coaching tone: ${profile.coachingTone ?? "friendly"}`,
  ].join("\n");
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const bounded = Math.max(min, Math.min(max, value));
  return Number(bounded.toFixed(digits));
}

function stringArray(value: unknown, fallback: string[], maxItems: number) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, maxItems);
}

function jsonObject(content: string | null | undefined) {
  if (!content) return {};
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function generateCoachMessage({
  profile,
  recentMessages,
  sessionSummary,
  sessionContext,
  userMessage,
}: {
  profile: AppUserProfile | null;
  recentMessages: Array<{ role: ChatRole; content: string }>;
  sessionSummary?: string;
  sessionContext?: string;
  userMessage: string;
}) {
  const clientInfo = getClient();
  const system = `You are FitCoach AI, a personal fitness, dance, and nutrition coach.
Use the profile and recent training context to provide personalized, practical advice.
Keep the tone concise, specific, and encouraging. Mention safety and regressions where relevant.

Profile
${profileContext(profile)}

Saved coaching summary
${sessionSummary || "No saved coaching summary yet."}

Saved coaching context
${sessionContext || "No saved coaching context yet."}`;

  if (clientInfo) {
    const completion = await clientInfo.client.chat.completions.create({
      model: clientInfo.model,
      temperature: 0.6,
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        ...recentMessages,
        { role: "user", content: userMessage },
      ],
    });

    return {
      message:
        completion.choices[0]?.message?.content ??
        "I could not generate a response right now. Please try again.",
      model: completion.model,
      tokens: completion.usage?.total_tokens ?? 0,
      provider: clientInfo.provider,
    };
  }

  return {
    message: `Here is a profile-aware starting point: focus on ${profile?.goals[0] ?? "general fitness"}, keep sessions around ${
      profile?.workoutDuration ?? 30
    } minutes, and prioritize clean form over intensity. If you tell me today's workout, equipment, or pain points, I can make this more specific.`,
    model: "fallback",
    tokens: 0,
    provider: "fallback" as const,
  };
}

export async function generateWorkoutPlan(profile: AppUserProfile | null) {
  const fallback = buildFallbackWorkoutPlan(profile);
  const clientInfo = getClient();

  if (!clientInfo) {
    return {
      plan: fallback,
      provider: "fallback" as const,
      model: "fallback",
    };
  }

  const prompt = `Generate a personalized workout plan for this user.
Return strict JSON only with this shape:
{
  "name": string,
  "description": string,
  "goal": string,
  "duration": number,
  "daysPerWeek": number,
  "difficulty": "beginner" | "intermediate" | "advanced",
  "weeklySchedule": [
    {
      "day": string,
      "focus": string,
      "warmUp": string[],
      "coolDown": string[],
      "exercises": [
        {
          "exerciseName": string,
          "sets": number,
          "reps": number,
          "restSeconds": number
        }
      ]
    }
  ],
  "progressionRules": string[],
  "regressionRules": string[]
}

Rules:
- Keep duration between 4 and 16 weeks.
- Keep daysPerWeek between 2 and 6.
- Use realistic bodyweight or dumbbell-friendly exercises when equipment is limited.
- Respect injuries and pain points.
- Keep daily exercise lists concise and actionable.

Profile
${profileContext(profile)}`;

  const completion = await clientInfo.client.chat.completions.create({
    model: clientInfo.model,
    temperature: 0.5,
    max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are an expert fitness coach. Return strict JSON only." },
      { role: "user", content: prompt },
    ],
  });

  const parsed = jsonObject(completion.choices[0]?.message?.content);
  const weeklySchedule = Array.isArray(parsed.weeklySchedule)
    ? parsed.weeklySchedule
        .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .slice(0, 7)
        .map((item: Record<string, unknown>, index: number) => ({
          day:
            typeof item.day === "string" && item.day.trim()
              ? item.day.trim()
              : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index] ?? `Day ${index + 1}`,
          focus: typeof item.focus === "string" && item.focus.trim() ? item.focus.trim() : "General fitness",
          warmUp: stringArray(item.warmUp, ["March in place", "Arm circles", "Hip openers"], 5),
          coolDown: stringArray(item.coolDown, ["Walk for 2 minutes", "Hamstring stretch", "Breathing reset"], 5),
          exercises: Array.isArray(item.exercises)
            ? item.exercises
                .filter((exercise: unknown): exercise is Record<string, unknown> => Boolean(exercise) && typeof exercise === "object")
                .slice(0, 6)
                .map((exercise: Record<string, unknown>) => ({
                  exerciseName:
                    typeof exercise.exerciseName === "string" && exercise.exerciseName.trim()
                      ? exercise.exerciseName.trim()
                      : "Bodyweight movement",
                  sets: clampInteger(exercise.sets, 1, 8, 3),
                  reps: clampInteger(exercise.reps, 1, 30, 10),
                  restSeconds: clampInteger(exercise.restSeconds, 15, 180, 60),
                }))
            : [],
        }))
    : fallback.weeklySchedule;

  return {
    plan: {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : fallback.name,
      description:
        typeof parsed.description === "string" && parsed.description.trim() ? parsed.description.trim() : fallback.description,
      goal: typeof parsed.goal === "string" && parsed.goal.trim() ? parsed.goal.trim() : fallback.goal,
      duration: clampInteger(parsed.duration, 4, 16, fallback.duration),
      daysPerWeek: clampInteger(parsed.daysPerWeek, 2, 6, fallback.daysPerWeek),
      difficulty:
        parsed.difficulty === "beginner" || parsed.difficulty === "intermediate" || parsed.difficulty === "advanced"
          ? parsed.difficulty
          : fallback.difficulty,
      weeklySchedule: weeklySchedule.length ? weeklySchedule : fallback.weeklySchedule,
      progressionRules: stringArray(parsed.progressionRules, fallback.progressionRules, 6),
      regressionRules: stringArray(parsed.regressionRules, fallback.regressionRules, 6),
    },
    provider: clientInfo.provider,
    model: completion.model,
  };
}

export async function generateNutritionPlan(profile: AppUserProfile | null) {
  const fallback = buildFallbackNutritionPlan(profile);
  const clientInfo = getClient();

  if (!clientInfo) {
    return {
      plan: fallback,
      provider: "fallback" as const,
      model: "fallback",
    };
  }

  const prompt = `Generate a personalized nutrition plan for this user.
Return strict JSON only with this shape:
{
  "dailyCalories": number,
  "macros": {
    "proteinGrams": number,
    "carbsGrams": number,
    "fatGrams": number
  },
  "meals": [
    {
      "type": "breakfast" | "lunch" | "dinner" | "snack",
      "name": string,
      "ingredients": string[],
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "prepTime": number,
      "budgetTier": string,
      "cuisineTag": string
    }
  ],
  "hydration": {
    "dailyLiters": number,
    "reminders": string[]
  },
  "groceryList": [
    {
      "item": string,
      "quantity": string,
      "estimatedCost": string
    }
  ],
  "mealTimingAdvice": string,
  "notes": string
}

Rules:
- Keep calories between 1400 and 4200.
- Respect dietary preferences, allergies, budget, and goal.
- Use realistic meal ideas for the user's cuisine preference.
- Keep grocery list practical and concise.

Profile
${profileContext(profile)}`;

  const completion = await clientInfo.client.chat.completions.create({
    model: clientInfo.model,
    temperature: 0.45,
    max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are an expert sports nutrition coach. Return strict JSON only." },
      { role: "user", content: prompt },
    ],
  });

  const parsed = jsonObject(completion.choices[0]?.message?.content);
  const macros = typeof parsed.macros === "object" && parsed.macros ? (parsed.macros as Record<string, unknown>) : {};

  return {
    plan: {
      dailyCalories: clampInteger(parsed.dailyCalories, 1400, 4200, fallback.dailyCalories),
      macros: {
        proteinGrams: clampInteger(macros.proteinGrams, 60, 320, fallback.macros.proteinGrams),
        carbsGrams: clampInteger(macros.carbsGrams, 80, 550, fallback.macros.carbsGrams),
        fatGrams: clampInteger(macros.fatGrams, 30, 180, fallback.macros.fatGrams),
      },
      meals: Array.isArray(parsed.meals)
        ? parsed.meals
            .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
            .slice(0, 6)
            .map((item: Record<string, unknown>, index: number) => ({
              type:
                item.type === "breakfast" || item.type === "lunch" || item.type === "dinner" || item.type === "snack"
                  ? item.type
                  : fallback.meals[index]?.type ?? "meal",
              name:
                typeof item.name === "string" && item.name.trim() ? item.name.trim() : fallback.meals[index]?.name ?? "Balanced meal",
              ingredients: stringArray(item.ingredients, fallback.meals[index]?.ingredients ?? ["Whole foods"], 8),
              calories: clampInteger(item.calories, 100, 1600, fallback.meals[index]?.calories ?? 400),
              protein: clampInteger(item.protein, 0, 120, fallback.meals[index]?.protein ?? 25),
              carbs: clampInteger(item.carbs, 0, 180, fallback.meals[index]?.carbs ?? 40),
              fat: clampInteger(item.fat, 0, 80, fallback.meals[index]?.fat ?? 12),
              prepTime: clampInteger(item.prepTime, 0, 120, fallback.meals[index]?.prepTime ?? 15),
              budgetTier:
                typeof item.budgetTier === "string" && item.budgetTier.trim()
                  ? item.budgetTier.trim()
                  : fallback.meals[index]?.budgetTier ?? "medium",
              cuisineTag:
                typeof item.cuisineTag === "string" && item.cuisineTag.trim()
                  ? item.cuisineTag.trim()
                  : fallback.meals[index]?.cuisineTag ?? "balanced",
            }))
        : fallback.meals,
      hydration: {
        dailyLiters: clampNumber(
          parsed.hydration && typeof parsed.hydration === "object" ? (parsed.hydration as Record<string, unknown>).dailyLiters : undefined,
          1.5,
          6,
          fallback.hydration.dailyLiters,
        ),
        reminders: stringArray(
          parsed.hydration && typeof parsed.hydration === "object" ? (parsed.hydration as Record<string, unknown>).reminders : undefined,
          fallback.hydration.reminders,
          6,
        ),
      },
      groceryList: Array.isArray(parsed.groceryList)
        ? parsed.groceryList
            .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
            .slice(0, 12)
            .map((item: Record<string, unknown>, index: number) => ({
              item:
                typeof item.item === "string" && item.item.trim()
                  ? item.item.trim()
                  : fallback.groceryList[index]?.item ?? "Staple ingredient",
              quantity:
                typeof item.quantity === "string" && item.quantity.trim()
                  ? item.quantity.trim()
                  : fallback.groceryList[index]?.quantity ?? "1 unit",
              estimatedCost:
                typeof item.estimatedCost === "string" && item.estimatedCost.trim()
                  ? item.estimatedCost.trim()
                  : fallback.groceryList[index]?.estimatedCost ?? "variable",
            }))
        : fallback.groceryList,
      mealTimingAdvice:
        typeof parsed.mealTimingAdvice === "string" && parsed.mealTimingAdvice.trim()
          ? parsed.mealTimingAdvice.trim()
          : fallback.mealTimingAdvice,
      notes: typeof parsed.notes === "string" && parsed.notes.trim() ? parsed.notes.trim() : fallback.notes,
    },
    provider: clientInfo.provider,
    model: completion.model,
  };
}

export async function generateSessionSummary(input: {
  profile: AppUserProfile | null;
  sessionSummary: string;
  exerciseType?: string;
}) {
  const clientInfo = getClient();
  const isDance = input.exerciseType === "dance_basic" || /dance/i.test(input.sessionSummary);
  const prompt = isDance
    ? `You are a high-precision dance coach. Analyze this session and produce:
1) conciseSummary (1-2 sentences)
2) whatWentRight (2-4 bullet points)
3) whatWentWrong (2-4 bullet points)
4) practicePlan (3-6 concrete drills/advice items for next session)
5) techniqueScorecard with numeric scores 0-100 for:
   - elbowPath (use this key for frame width and arm carriage quality)
   - rangeOfMotion (use this key for arm lines and body levels)
   - tempoControl (use this key for beat timing and phrase accuracy)
   - torsoStability (use this key for torso stack and hip control)
6) topMistakes as exactly 3 items, each:
   - mistake
   - whyItHurtsPerformance
   - exactFix
7) correctivePlan5Min as exactly 3 timed blocks:
   - minuteRange (e.g. "0:00-1:30")
   - drill
   - focusCue

Return strict JSON with keys:
{
  "conciseSummary": string,
  "whatWentRight": string[],
  "whatWentWrong": string[],
  "practicePlan": string[],
  "techniqueScorecard": {
    "elbowPath": number,
    "rangeOfMotion": number,
    "tempoControl": number,
    "torsoStability": number
  },
  "topMistakes": [
    {
      "mistake": string,
      "whyItHurtsPerformance": string,
      "exactFix": string
    }
  ],
  "correctivePlan5Min": [
    {
      "minuteRange": string,
      "drill": string,
      "focusCue": string
    }
  ]
}

Focus on exact issues like frame width, wrist height mismatch, shoulder or hip tilt, torso lean, locked knees, and being early or late to the beat.

Profile
${profileContext(input.profile)}

Session data
${input.sessionSummary}`
    : `You are a high-precision fitness coach. Analyze this workout and produce:
1) conciseSummary (1-2 sentences)
2) whatWentRight (2-4 bullet points)
3) whatWentWrong (2-4 bullet points)
4) practicePlan (3-6 concrete drills/advice items for next session)
5) techniqueScorecard with numeric scores 0-100 for:
   - elbowPath
   - rangeOfMotion
   - tempoControl
   - torsoStability
6) topMistakes as exactly 3 items, each:
   - mistake
   - whyItHurtsPerformance
   - exactFix
7) correctivePlan5Min as exactly 3 timed blocks:
   - minuteRange (e.g. "0:00-1:30")
   - drill
   - focusCue

Return strict JSON with keys:
{
  "conciseSummary": string,
  "whatWentRight": string[],
  "whatWentWrong": string[],
  "practicePlan": string[],
  "techniqueScorecard": {
    "elbowPath": number,
    "rangeOfMotion": number,
    "tempoControl": number,
    "torsoStability": number
  },
  "topMistakes": [
    {
      "mistake": string,
      "whyItHurtsPerformance": string,
      "exactFix": string
    }
  ],
  "correctivePlan5Min": [
    {
      "minuteRange": string,
      "drill": string,
      "focusCue": string
    }
  ]
}

Profile
${profileContext(input.profile)}

Workout data
${input.sessionSummary}`;

  if (!clientInfo) {
    if (isDance) {
      return {
        summary: "Dance phrase completed. The next gains come from cleaner frame control, softer knees, and sharper timing.",
        keyInsights: ["You stayed with the routine and built phrase consistency.", "Your next step is making each count look cleaner side to side."],
        nextSessionFocus: [
          "Practice hitting the frame wide, then relaxing into the groove on the next count.",
          "Keep both knees soft so the bounce comes from the legs instead of the low back.",
          "Match both wrists and shoulders before adding more energy.",
        ],
        techniqueScorecard: {
          elbowPath: 72,
          rangeOfMotion: 70,
          tempoControl: 68,
          torsoStability: 74,
        },
        topMistakes: [
          {
            mistake: "Frame collapses inward on the hit",
            whyItHurtsPerformance: "Makes the choreography look small and late even if you know the counts.",
            exactFix: "Reach both wrists wider at shoulder level before you drop into the groove.",
          },
          {
            mistake: "Knees locking between counts",
            whyItHurtsPerformance: "Removes bounce and sends impact into the joints instead of letting the rhythm travel through the legs.",
            exactFix: "Keep a small bend in both knees through the whole phrase.",
          },
          {
            mistake: "Torso drifting off-center",
            whyItHurtsPerformance: "Breaks balance and makes the upper-body line look disconnected from the hips.",
            exactFix: "Stack ribs over hips and reset center before the next hit.",
          },
        ],
        correctivePlan5Min: [
          { minuteRange: "0:00-1:30", drill: "Mirror frame hits", focusCue: "Both wrists wide and level." },
          { minuteRange: "1:30-3:30", drill: "Soft-knee groove pulses", focusCue: "Stay springy, never locked." },
          { minuteRange: "3:30-5:00", drill: "Four-count hit-and-groove phrase", focusCue: "Hit wide, drop smooth, stay on beat." },
        ],
      };
    }

    return {
      summary: "Solid session completed. Keep building consistency and focus on clean movement quality.",
      keyInsights: ["You completed the session and built training consistency.", "Your next gains come from cleaner form under fatigue."],
      nextSessionFocus: [
        "Perform 2 slow warm-up sets before working reps.",
        "Use a 2-second lowering phase on every rep.",
        "Stop each set when form starts to break.",
      ],
      techniqueScorecard: {
        elbowPath: 70,
        rangeOfMotion: 72,
        tempoControl: 68,
        torsoStability: 74,
      },
      topMistakes: [
        {
          mistake: "Elbows drift forward during the concentric phase",
          whyItHurtsPerformance: "Shifts tension away from the biceps and reduces consistent loading.",
          exactFix: "Keep elbows pinned to your ribs; imagine pressing triceps lightly into your torso every rep.",
        },
        {
          mistake: "Incomplete extension at the bottom",
          whyItHurtsPerformance: "Cuts effective range and limits stimulus through full muscle length.",
          exactFix: "Lower until arms are nearly straight, then pause 0.5s before curling up.",
        },
        {
          mistake: "Torso sway to finish difficult reps",
          whyItHurtsPerformance: "Uses momentum instead of muscular force, reducing quality and control.",
          exactFix: "Reduce load by 10-20%, brace abs, and perform 3-second eccentrics.",
        },
      ],
      correctivePlan5Min: [
        { minuteRange: "0:00-1:30", drill: "Wall-supported strict curls (light weight)", focusCue: "Elbows fixed, no shoulder drift." },
        { minuteRange: "1:30-3:30", drill: "Tempo curls (2 up, 3 down)", focusCue: "Own the lowering phase." },
        { minuteRange: "3:30-5:00", drill: "Half-rep top squeeze holds", focusCue: "Peak contraction without swinging." },
      ],
    };
  }

  const completion = await clientInfo.client.chat.completions.create({
    model: clientInfo.model,
    temperature: 0.45,
    max_tokens: 550,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: isDance ? "You summarize dance practice data for users. Always return strict JSON only." : "You summarize workout data for users. Always return strict JSON only." },
      { role: "user", content: prompt },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  const whatWentRight = Array.isArray(parsed.whatWentRight) ? parsed.whatWentRight.filter(Boolean).slice(0, 4) : [];
  const whatWentWrong = Array.isArray(parsed.whatWentWrong) ? parsed.whatWentWrong.filter(Boolean).slice(0, 4) : [];
  const practicePlan = Array.isArray(parsed.practicePlan) ? parsed.practicePlan.filter(Boolean).slice(0, 6) : [];
  const conciseSummary = typeof parsed.conciseSummary === "string" && parsed.conciseSummary.trim() ? parsed.conciseSummary.trim() : "";
  const techniqueScorecardRaw = parsed.techniqueScorecard ?? {};
  const techniqueScorecard = {
    elbowPath: Number.isFinite(techniqueScorecardRaw.elbowPath) ? Math.max(0, Math.min(100, Math.round(techniqueScorecardRaw.elbowPath))) : 0,
    rangeOfMotion: Number.isFinite(techniqueScorecardRaw.rangeOfMotion) ? Math.max(0, Math.min(100, Math.round(techniqueScorecardRaw.rangeOfMotion))) : 0,
    tempoControl: Number.isFinite(techniqueScorecardRaw.tempoControl) ? Math.max(0, Math.min(100, Math.round(techniqueScorecardRaw.tempoControl))) : 0,
    torsoStability: Number.isFinite(techniqueScorecardRaw.torsoStability) ? Math.max(0, Math.min(100, Math.round(techniqueScorecardRaw.torsoStability))) : 0,
  };
  const topMistakes = Array.isArray(parsed.topMistakes)
    ? parsed.topMistakes
        .filter((item: any) => item && typeof item === "object")
        .slice(0, 3)
        .map((item: any) => ({
          mistake: typeof item.mistake === "string" ? item.mistake : "Technique inconsistency detected.",
          whyItHurtsPerformance: typeof item.whyItHurtsPerformance === "string" ? item.whyItHurtsPerformance : "It reduces movement quality and progress rate.",
          exactFix: typeof item.exactFix === "string" ? item.exactFix : "Use lighter load and slow controlled reps.",
        }))
    : [];
  const correctivePlan5Min = Array.isArray(parsed.correctivePlan5Min)
    ? parsed.correctivePlan5Min
        .filter((item: any) => item && typeof item === "object")
        .slice(0, 3)
        .map((item: any) => ({
          minuteRange: typeof item.minuteRange === "string" ? item.minuteRange : "0:00-1:30",
          drill: typeof item.drill === "string" ? item.drill : "Controlled technique drill",
          focusCue: typeof item.focusCue === "string" ? item.focusCue : "Move slowly with control.",
        }))
    : [];

  return {
    summary: conciseSummary || "Workout completed.",
    keyInsights:
      (whatWentRight.length ? whatWentRight : []).concat(whatWentWrong.length ? [`Fix next: ${whatWentWrong[0]}`] : []).slice(0, 3).length
        ? (whatWentRight.length ? whatWentRight : []).concat(whatWentWrong.length ? [`Fix next: ${whatWentWrong[0]}`] : []).slice(0, 3)
        : ["Form and consistency were the main themes."],
    nextSessionFocus: practicePlan.length ? practicePlan : ["Keep technique stable under fatigue."],
    techniqueScorecard,
    topMistakes:
      topMistakes.length === 3
        ? topMistakes
        : isDance
          ? [
              {
                mistake: "Frame width collapses inward",
                whyItHurtsPerformance: "Makes the phrase read small and unclear.",
                exactFix: "Reach both wrists wider and match the arm line before dropping into the groove.",
              },
              {
                mistake: "Timing lands late on the hit",
                whyItHurtsPerformance: "Makes the move look reactive instead of musical.",
                exactFix: "Prepare one count early and arrive on the beat, not after it.",
              },
              {
                mistake: "Knees lock and torso drifts",
                whyItHurtsPerformance: "Kills bounce and pushes stress into the low back and knees.",
                exactFix: "Keep a soft bend in both knees and stack ribs over hips throughout the phrase.",
              },
            ]
          : [
            {
              mistake: "Elbows drifting from the torso",
              whyItHurtsPerformance: "Reduces bicep isolation and consistency.",
              exactFix: "Keep elbows pinned and reduce load if needed.",
            },
            {
              mistake: "Shortening the bottom range",
              whyItHurtsPerformance: "Lowers total tension and progression quality.",
              exactFix: "Reach near-full extension with control each rep.",
            },
            {
              mistake: "Using torso momentum",
              whyItHurtsPerformance: "Shifts work away from target muscles.",
              exactFix: "Brace core and slow eccentric to 3 seconds.",
            },
          ],
    correctivePlan5Min:
      correctivePlan5Min.length === 3
        ? correctivePlan5Min
        : isDance
          ? [
              { minuteRange: "0:00-1:30", drill: "Wide-frame holds", focusCue: "Reach both wrists evenly." },
              { minuteRange: "1:30-3:30", drill: "Soft-knee groove pulses", focusCue: "Bounce through the legs, not the back." },
              { minuteRange: "3:30-5:00", drill: "Hit-and-groove phrase practice", focusCue: "Arrive on the beat, then release cleanly." },
            ]
          : [
            { minuteRange: "0:00-1:30", drill: "Strict light-weight curls", focusCue: "Elbows fixed to ribs." },
            { minuteRange: "1:30-3:30", drill: "Slow eccentric curls", focusCue: "3-second lowering every rep." },
            { minuteRange: "3:30-5:00", drill: "Top-position squeeze holds", focusCue: "Pause and squeeze without sway." },
          ],
  };
}

export async function generateCoachFeedback(input: {
  profile: AppUserProfile | null;
  exerciseType: string;
  repsSoFar: number;
  phase?: string;
  confidence?: number;
  issueSignature?: string;
  triggerReason?: "issue_changed" | "score_drop" | "phase_milestone" | "manual";
  currentIssues: string[];
  currentMetrics: Array<{ name: string; score: number; detail: string; value?: number; target?: string }>;
  recentScores: Array<{ form: number; rom: number; tempo: number; safety: number }>;
}) {
  const clientInfo = getClient();
  const scoreSummary = input.recentScores
    .map((score, index) => `Rep ${index + 1}: form ${score.form}, rom ${score.rom}, tempo ${score.tempo}, safety ${score.safety}`)
    .join("\n");
  const metricSummary = input.currentMetrics
    .map((metric) => `${metric.name}: ${metric.score}/100 (${metric.detail}${metric.target ? `, target ${metric.target}` : ""}${typeof metric.value === "number" ? `, value ${metric.value}` : ""})`)
    .join("\n");
  const isBicepCurl = input.exerciseType === "bicep_curl";
  const isDance = input.exerciseType === "dance_basic";

  if (!clientInfo) {
    return {
      feedback:
        input.currentIssues[0] ??
        `Keep your ${input.exerciseType} reps smooth and controlled. Quality first, speed second.`,
      priority: input.currentIssues.some((issue) => /pain|collapse|unsafe|valgus/i.test(issue)) ? "safety" : "form",
      provider: "fallback",
      model: "fallback",
    };
  }

  const completion = await clientInfo.client.chat.completions.create({
    model: clientInfo.model,
    temperature: 0.35,
    max_tokens: 220,
    messages: [
      {
        role: "system",
        content: isBicepCurl
          ? `You are an expert strength coach focused on highly accurate bicep curl feedback.
Return exactly one short coaching cue (max 22 words).
Prioritize in order: injury risk -> elbow path -> shoulder shrug -> torso swing -> wrist stack -> range of motion -> symmetry.
Name the exact body part and exact mechanic that is failing.
Prefer language like: "left elbow drifting", "both shoulders shrugging", "right wrist folding", "torso swinging", "soft lockout", "full extension", "finish the squeeze".
If the cue is good news, be specific about what is clean.
Never be generic.
If issueSignature indicates the same mechanic as before, keep the same mechanic focus instead of inventing a new cue.`
          : isDance
            ? `You are an expert dance coach focused on precise posture and timing feedback.
Return exactly one short coaching cue (max 22 words).
Prioritize in order: injury risk -> knees locking -> torso leaning -> shoulder or hip tilt -> frame width -> arm height mismatch -> beat timing.
Name the exact body part and exact mechanic that is failing.
Prefer language like: "left wrist dropping", "hips tilting right", "knees locking", "torso leaning left", "late to the hit", "hold the frame wider".
If the cue is good news, be specific about what is clean.
Never be generic.
If issueSignature indicates the same mechanic as before, keep the same mechanic focus instead of inventing a new cue.`
            : "You are a real-time workout coach. Respond with one short coaching cue. If an issue is safety-related, lead with safety and keep it direct.",
      },
      {
        role: "user",
        content: `Exercise: ${input.exerciseType}
Reps so far: ${input.repsSoFar}
Current phase: ${input.phase ?? "unknown"}
Tracking confidence: ${typeof input.confidence === "number" ? `${Math.round(input.confidence * 100)}%` : "unknown"}
Issue signature: ${input.issueSignature ?? "none"}
Trigger reason: ${input.triggerReason ?? "manual"}
Current issues: ${input.currentIssues.join(", ") || "none"}
Current metrics:
${metricSummary || "none"}
Recent scores:
${scoreSummary}

Profile:
${profileContext(input.profile)}`,
      },
    ],
  });

  const feedback = completion.choices[0]?.message?.content?.trim() || "Keep moving with control.";
  const priority = /stop|unsafe|pain|knee|back|neck/i.test(feedback) ? "safety" : input.currentIssues.length ? "form" : "motivation";
  return { feedback, priority, provider: clientInfo.provider, model: clientInfo.model };
}
