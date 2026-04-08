import OpenAI from "openai";
import type { AppUserProfile } from "@/lib/app-types";

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

export async function generateCoachMessage({
  profile,
  recentMessages,
  userMessage,
}: {
  profile: AppUserProfile | null;
  recentMessages: Array<{ role: ChatRole; content: string }>;
  userMessage: string;
}) {
  const clientInfo = getClient();
  const system = `You are FitCoach AI, a personal fitness, dance, and nutrition coach.
Use the profile and recent training context to provide personalized, practical advice.
Keep the tone concise, specific, and encouraging. Mention safety and regressions where relevant.

Profile
${profileContext(profile)}`;

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

export async function generateSessionSummary(input: {
  profile: AppUserProfile | null;
  sessionSummary: string;
}) {
  const clientInfo = getClient();
  const prompt = `You are a high-precision fitness coach. Analyze this workout and produce:
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
      { role: "system", content: "You summarize workout data for users. Always return strict JSON only." },
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
Prioritize in order: safety -> elbow path -> range of motion -> tempo -> symmetry.
Use concrete bicep-curl language: "pin elbows", "stop swinging", "full extension", "squeeze at top", "slow eccentric".
Never be generic. Vary phrasing from prior cues and avoid repeating the same wording.`
          : "You are a real-time workout coach. Respond with one short coaching cue. If an issue is safety-related, lead with safety and keep it direct.",
      },
      {
        role: "user",
        content: `Exercise: ${input.exerciseType}
Reps so far: ${input.repsSoFar}
Current phase: ${input.phase ?? "unknown"}
Tracking confidence: ${typeof input.confidence === "number" ? `${Math.round(input.confidence * 100)}%` : "unknown"}
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
