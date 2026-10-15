import { db } from "./index";
import { achievements, danceRoutines, danceStyles, exercises } from "./schema";
import { eq } from "drizzle-orm";
import { dbPool } from "./index";
import { nanoid } from "nanoid";

// Seed data for exercises
const exercisesData = [
  // Strength Training - Legs
  {
    id: nanoid(),
    name: "Squats",
    category: "strength",
    muscleGroup: "legs",
    equipment: "bodyweight",
    difficulty: "beginner",
    description: "A fundamental lower body exercise that targets quads, glutes, and hamstrings.",
    instructions: JSON.stringify([
      "Stand with feet shoulder-width apart",
      "Keep chest up and core engaged",
      "Lower down by bending knees and hips",
      "Keep knees tracking over toes",
      "Push through heels to return to start",
    ]),
    calories: 8,
    formPoints: JSON.stringify([
      "Keep knees aligned with toes",
      "Maintain neutral spine",
      "Chest stays up throughout movement",
      "Full depth squat when possible",
    ]),
    commonMistakes: JSON.stringify([
      "Knees caving inward",
      "Rising on toes",
      "Rounding lower back",
      "Not going deep enough",
    ]),
    modifications: JSON.stringify([
      "Box squats for beginners",
      "Jump squats for advanced",
      "Add weight for progression",
    ]),
  },
  {
    id: nanoid(),
    name: "Lunges",
    category: "strength",
    muscleGroup: "legs",
    equipment: "bodyweight",
    difficulty: "beginner",
    description: "Unilateral leg exercise for building strength and balance.",
    instructions: JSON.stringify([
      "Stand tall with feet hip-width apart",
      "Step forward with one leg",
      "Lower hips until both knees bent at 90 degrees",
      "Push back to starting position",
      "Alternate legs",
    ]),
    calories: 7,
    formPoints: JSON.stringify([
      "Front knee stays over ankle",
      "Back knee hovers above ground",
      "Torso remains upright",
      "Equal weight distribution",
    ]),
    commonMistakes: JSON.stringify([
      "Knee extending past toes",
      "Leaning forward",
      "Short range of motion",
    ]),
    modifications: JSON.stringify([
      "Reverse lunges for beginners",
      "Walking lunges for intermediate",
      "Jumping lunges for advanced",
    ]),
  },
  // Strength Training - Upper Body
  {
    id: nanoid(),
    name: "Push-ups",
    category: "strength",
    muscleGroup: "chest",
    equipment: "bodyweight",
    difficulty: "beginner",
    description: "Classic upper body exercise targeting chest, shoulders, and triceps.",
    instructions: JSON.stringify([
      "Start in plank position with hands shoulder-width",
      "Keep body in straight line from head to heels",
      "Lower chest toward floor by bending elbows",
      "Keep elbows at 45-degree angle",
      "Push back up to starting position",
    ]),
    calories: 7,
    formPoints: JSON.stringify([
      "Straight body line throughout",
      "Elbows at 45 degrees",
      "Full range of motion",
      "Controlled movement",
    ]),
    commonMistakes: JSON.stringify([
      "Hips sagging",
      "Elbows flaring out",
      "Incomplete range of motion",
      "Head dropping",
    ]),
    modifications: JSON.stringify([
      "Wall push-ups for beginners",
      "Knee push-ups for intermediate",
      "Diamond push-ups for advanced",
    ]),
  },
  {
    id: nanoid(),
    name: "Plank",
    category: "strength",
    muscleGroup: "core",
    equipment: "bodyweight",
    difficulty: "beginner",
    description: "Isometric core exercise that builds full-body stability.",
    instructions: JSON.stringify([
      "Start in forearm plank position",
      "Elbows under shoulders",
      "Body forms straight line",
      "Engage core and glutes",
      "Hold position",
    ]),
    calories: 5,
    formPoints: JSON.stringify([
      "Neutral spine alignment",
      "Hips level",
      "Core actively engaged",
      "Breathing steady",
    ]),
    commonMistakes: JSON.stringify([
      "Hips too high or low",
      "Shoulders rolling forward",
      "Holding breath",
    ]),
    modifications: JSON.stringify([
      "Knee plank for beginners",
      "Side plank for variation",
      "Plank with leg lift for advanced",
    ]),
  },
  // HIIT
  {
    id: nanoid(),
    name: "Burpees",
    category: "hiit",
    muscleGroup: "full_body",
    equipment: "bodyweight",
    difficulty: "intermediate",
    description: "Full-body explosive exercise that combines strength and cardio.",
    instructions: JSON.stringify([
      "Start standing",
      "Drop into squat position",
      "Place hands on floor and jump feet back to plank",
      "Do a push-up",
      "Jump feet back to hands",
      "Explode up into jump",
    ]),
    calories: 12,
    formPoints: JSON.stringify([
      "Maintain core stability in plank",
      "Full push-up depth",
      "Explosive jump at top",
      "Controlled landing",
    ]),
    commonMistakes: JSON.stringify([
      "Skipping push-up",
      "Poor plank form",
      "Not fully extending in jump",
    ]),
    modifications: JSON.stringify([
      "Step-back burpees for beginners",
      "No push-up variation",
      "Add tuck jump for advanced",
    ]),
  },
  {
    id: nanoid(),
    name: "Mountain Climbers",
    category: "hiit",
    muscleGroup: "core",
    equipment: "bodyweight",
    difficulty: "intermediate",
    description: "Dynamic core and cardio exercise.",
    instructions: JSON.stringify([
      "Start in high plank position",
      "Drive one knee toward chest",
      "Quickly switch legs",
      "Maintain plank position throughout",
      "Continue alternating at quick pace",
    ]),
    calories: 10,
    formPoints: JSON.stringify([
      "Hips stay level",
      "Core remains engaged",
      "Quick leg switches",
      "Controlled movement",
    ]),
    commonMistakes: JSON.stringify([
      "Hips rising too high",
      "Shoulders moving forward",
      "Incomplete knee drive",
    ]),
    modifications: JSON.stringify([
      "Slow mountain climbers for beginners",
      "Cross-body mountain climbers for obliques",
      "Mountain climber to push-up for advanced",
    ]),
  },
  // Cardio
  {
    id: nanoid(),
    name: "Jumping Jacks",
    category: "cardio",
    muscleGroup: "full_body",
    equipment: "bodyweight",
    difficulty: "beginner",
    description: "Classic cardio warm-up exercise.",
    instructions: JSON.stringify([
      "Stand with feet together, arms at sides",
      "Jump while spreading legs shoulder-width",
      "Simultaneously raise arms overhead",
      "Jump back to starting position",
      "Repeat at steady pace",
    ]),
    calories: 8,
    formPoints: JSON.stringify([
      "Land softly on balls of feet",
      "Full arm extension overhead",
      "Maintain rhythm",
      "Stay light on feet",
    ]),
    commonMistakes: JSON.stringify([
      "Landing too hard",
      "Incomplete arm movement",
      "Poor posture",
    ]),
    modifications: JSON.stringify([
      "Step jacks for low impact",
      "Half jacks for beginners",
      "Power jacks for advanced",
    ]),
  },
  // Yoga/Flexibility
  {
    id: nanoid(),
    name: "Downward Dog",
    category: "yoga",
    muscleGroup: "full_body",
    equipment: "bodyweight",
    difficulty: "beginner",
    description: "Foundational yoga pose for full-body stretch and strength.",
    instructions: JSON.stringify([
      "Start on hands and knees",
      "Lift hips up and back",
      "Straighten legs as much as comfortable",
      "Press hands firmly into ground",
      "Head between arms, looking at feet",
    ]),
    calories: 3,
    formPoints: JSON.stringify([
      "Long spine from hands to hips",
      "Weight distributed between hands and feet",
      "Shoulders away from ears",
      "Heels working toward floor",
    ]),
    commonMistakes: JSON.stringify([
      "Rounding the back",
      "Locking elbows",
      "Shoulders creeping to ears",
    ]),
    modifications: JSON.stringify([
      "Bent knees for tight hamstrings",
      "Hands on blocks for limited flexibility",
      "Three-legged dog for advanced",
    ]),
  },
  {
    id: nanoid(),
    name: "Child's Pose",
    category: "yoga",
    muscleGroup: "back",
    equipment: "bodyweight",
    difficulty: "beginner",
    description: "Restorative yoga pose for relaxation and gentle stretch.",
    instructions: JSON.stringify([
      "Kneel on floor with toes together",
      "Sit back on heels",
      "Fold forward, extending arms ahead",
      "Rest forehead on floor",
      "Breathe deeply and relax",
    ]),
    calories: 2,
    formPoints: JSON.stringify([
      "Hips sink toward heels",
      "Arms extended or at sides",
      "Forehead resting comfortably",
      "Deep, slow breathing",
    ]),
    commonMistakes: JSON.stringify([
      "Tensing shoulders",
      "Forcing hips down",
      "Shallow breathing",
    ]),
    modifications: JSON.stringify([
      "Knees wider for comfort",
      "Pillow under forehead",
      "Arms at sides for relaxation",
    ]),
  },
];

// Seed data for dance styles
const danceStylesData = [
  {
    id: nanoid(),
    name: "Zumba",
    description: "High-energy Latin-inspired dance fitness program that combines dance and aerobic movements with upbeat music.",
    difficulty: "beginner",
    intensity: "high",
    caloriesPerHour: 500,
    musicStyle: "Latin, International, Hip-Hop",
    benefits: JSON.stringify([
      "Burns 500+ calories per hour",
      "Improves cardiovascular fitness",
      "Enhances coordination and rhythm",
      "Full-body workout",
      "Stress relief through dance",
      "Suitable for all fitness levels",
      "Fun and engaging",
    ]),
    imageUrl: "/images/dance/zumba.jpg",
    videoUrl: "/videos/dance/zumba-intro.mp4",
  },
  {
    id: nanoid(),
    name: "Hip-Hop Dance",
    description: "Urban dance style featuring dynamic moves, grooves, and freestyle elements.",
    difficulty: "intermediate",
    intensity: "high",
    caloriesPerHour: 450,
    musicStyle: "Hip-Hop, R&B, Pop",
    benefits: JSON.stringify([
      "Improves agility and coordination",
      "Builds stamina and endurance",
      "Enhances rhythm and musicality",
      "Boosts confidence and self-expression",
      "Full-body conditioning",
    ]),
    imageUrl: "/images/dance/hiphop.jpg",
    videoUrl: "/videos/dance/hiphop-intro.mp4",
  },
  {
    id: nanoid(),
    name: "Ballet Fitness",
    description: "Classical ballet-inspired workout focusing on grace, posture, and core strength.",
    difficulty: "beginner",
    intensity: "moderate",
    caloriesPerHour: 350,
    musicStyle: "Classical, Contemporary",
    benefits: JSON.stringify([
      "Improves posture and alignment",
      "Builds core strength",
      "Enhances flexibility",
      "Develops balance and grace",
      "Tones muscles without bulk",
      "Increases body awareness",
    ]),
    imageUrl: "/images/dance/ballet.jpg",
    videoUrl: "/videos/dance/ballet-intro.mp4",
  },
];

const danceRoutineData = [
  {
    id: nanoid(),
    danceStyleId: danceStylesData[0].id,
    name: "Starter Groove Flow",
    durationMs: 60000,
    checkpoints: JSON.stringify({
      bpm: 96,
      steps: [
        { timeMs: 0, cue: "Open frame on the beat", target: "dance_basic" },
        { timeMs: 8000, cue: "Settle into the groove", target: "dance_basic" },
        { timeMs: 16000, cue: "Lift the energy and stay tall", target: "dance_basic" },
        { timeMs: 24000, cue: "Reset shoulders and hips level", target: "dance_basic" },
        { timeMs: 32000, cue: "Open frame on the beat", target: "dance_basic" },
        { timeMs: 40000, cue: "Hold the rhythm through the transition", target: "dance_basic" },
        { timeMs: 48000, cue: "Finish strong and centered", target: "dance_basic" },
      ],
    }),
    difficulty: "beginner",
    musicUrl: "/routines/starter-groove-click.wav",
    thumbnailUrl: "/routines/starter-groove-thumbnail.svg",
  },
];

// Seed data for achievements
const achievementsData = [
  {
    id: nanoid(),
    name: "First Steps",
    description: "Complete your first workout",
    category: "milestone",
    icon: "👟",
    threshold: 1,
    points: 10,
  },
  {
    id: nanoid(),
    name: "Week Warrior",
    description: "Complete 7 days of workouts",
    category: "consistency",
    icon: "🔥",
    threshold: 7,
    points: 50,
  },
  {
    id: nanoid(),
    name: "Month Master",
    description: "Complete 30 days of workouts",
    category: "consistency",
    icon: "💪",
    threshold: 30,
    points: 200,
  },
  {
    id: nanoid(),
    name: "Century Club",
    description: "Complete 100 workouts",
    category: "workout",
    icon: "🎯",
    threshold: 100,
    points: 500,
  },
  {
    id: nanoid(),
    name: "Calorie Crusher",
    description: "Burn 10,000 total calories",
    category: "workout",
    icon: "🔥",
    threshold: 10000,
    points: 300,
  },
  {
    id: nanoid(),
    name: "Dance Master",
    description: "Complete 50 dance sessions",
    category: "workout",
    icon: "💃",
    threshold: 50,
    points: 250,
  },
  {
    id: nanoid(),
    name: "Strength Legend",
    description: "Complete 100 strength training sessions",
    category: "workout",
    icon: "🏋️",
    threshold: 100,
    points: 400,
  },
  {
    id: nanoid(),
    name: "Perfect Week",
    description: "Complete all planned workouts in a week",
    category: "consistency",
    icon: "⭐",
    threshold: 1,
    points: 100,
  },
  {
    id: nanoid(),
    name: "Early Bird",
    description: "Complete 20 morning workouts",
    category: "workout",
    icon: "🌅",
    threshold: 20,
    points: 150,
  },
  {
    id: nanoid(),
    name: "Transformation",
    description: "Track progress for 90 consecutive days",
    category: "milestone",
    icon: "🦋",
    threshold: 90,
    points: 1000,
  },
];

export async function seedDatabase() {
  try {
    console.log("🌱 Starting database seed...");

    // Seed exercises
    console.log("📝 Seeding exercises...");
    for (const exercise of exercisesData) {
      if (!await db.query.exercises.findFirst({ where: eq(exercises.name, exercise.name) })) await db.insert(exercises).values(exercise).onConflictDoNothing();
    }
    console.log(`✅ Seeded ${exercisesData.length} exercises`);

    for (const [id,name,category] of [["bicep_curl","Bicep Curl","strength"],["warrior","Warrior","yoga"],["dance_basic","Dance Frame","dance"]]) {
      if (!await db.query.exercises.findFirst({ where: eq(exercises.name,name) })) await db.insert(exercises).values({ id, name, category, difficulty:"beginner", description:"Guided movement with camera quality checks", instructions:JSON.stringify(["Follow the camera setup guide", "Calibrate before starting", "Use comfortable controlled movement"]), isActive:true }).onConflictDoNothing();
    }
    // Seed dance styles
    console.log("💃 Seeding dance styles...");
    for (const style of danceStylesData) {
      if (!await db.query.danceStyles.findFirst({ where: eq(danceStyles.name, style.name) })) await db.insert(danceStyles).values(style).onConflictDoNothing();
    }
    console.log(`✅ Seeded ${danceStylesData.length} dance styles`);

    // Seed achievements
    console.log("🏆 Seeding achievements...");
    for (const achievement of achievementsData) {
      if (!await db.query.achievements.findFirst({ where: eq(achievements.name, achievement.name) })) await db.insert(achievements).values(achievement).onConflictDoNothing();
    }
    console.log(`✅ Seeded ${achievementsData.length} achievements`);

    // Seed dance routines
    console.log("🎵 Seeding dance routines...");
    for (const routine of danceRoutineData) {
      const style = await db.query.danceStyles.findFirst({ where: eq(danceStyles.name, "Hip-Hop Dance") });
      if (style && !await db.query.danceRoutines.findFirst({ where: eq(danceRoutines.name, routine.name) })) await db.insert(danceRoutines).values({ ...routine, danceStyleId: style.id }).onConflictDoNothing();
    }
    console.log(`✅ Seeded ${danceRoutineData.length} dance routines`);

    console.log("✨ Database seed completed successfully!");
  } catch (error) {
    console.error("Database seed failed", { code: (error as any)?.cause?.code, table: (error as any)?.cause?.table, column: (error as any)?.cause?.column });
    throw error;
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(async () => { await dbPool?.end(); process.exit(0); })
    .catch(() => process.exit(1));
}
