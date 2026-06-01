"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUserProfile, Goal, DietaryPref, ExperienceLevel } from "@/hooks/useUserProfile";
import {
  ArrowRight,
  ArrowLeft,
  User,
  Target,
  Utensils,
  Dumbbell,
  Sparkles,
  Check,
  Flame,
  Scale,
  Activity,
  Brain,
  Leaf,
  Fish,
  Beef,
  Pizza,
  Clock,
  Music2,
  Shield,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "basics", title: "About You", icon: User },
  { id: "body", title: "Body Stats", icon: Scale },
  { id: "goals", title: "Goals", icon: Target },
  { id: "experience", title: "Experience", icon: Dumbbell },
  { id: "calibration", title: "Coach", icon: Brain },
  { id: "diet", title: "Diet", icon: Utensils },
  { id: "complete", title: "Complete", icon: Check },
];

const goalOptions: { value: Goal; label: string; description: string; icon: any }[] = [
  { value: "fat_loss", label: "Lose Weight", description: "Burn fat and get lean", icon: Flame },
  { value: "muscle_gain", label: "Build Muscle", description: "Gain strength and size", icon: Dumbbell },
  { value: "endurance", label: "Boost Endurance", description: "Improve stamina and cardio", icon: Activity },
  { value: "mobility", label: "Flexibility", description: "Increase mobility and reduce pain", icon: Activity },
  { value: "dance_skill", label: "Dance Better", description: "Learn moves and groove", icon: Sparkles },
];

const dietOptions: { value: DietaryPref; label: string; icon: any }[] = [
  { value: "omnivore", label: "Omnivore", icon: Beef },
  { value: "vegetarian", label: "Vegetarian", icon: Leaf },
  { value: "vegan", label: "Vegan", icon: Leaf },
  { value: "pescatarian", label: "Pescatarian", icon: Fish },
  { value: "keto", label: "Keto", icon: Beef },
  { value: "mediterranean", label: "Mediterranean", icon: Pizza },
];

const experienceLevels: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: "beginner", label: "Beginner", description: "New to fitness or returning after a long break" },
  { value: "intermediate", label: "Intermediate", description: "1-3 years of consistent training" },
  { value: "advanced", label: "Advanced", description: "3+ years with solid technique" },
];

const equipmentOptions = ["Bodyweight", "Dumbbells", "Resistance band", "Yoga mat", "Chair/bench", "Open floor"];
const scheduleOptions = [
  { days: 3, label: "3 days/week", detail: "Steady and realistic" },
  { days: 4, label: "4 days/week", detail: "Balanced progress" },
  { days: 5, label: "5 days/week", detail: "Aggressive routine" },
];
const durationOptions = [15, 25, 35, 45];

export default function OnboardingPage() {
  const router = useRouter();
  const { updateProfile, profile, session, loading } = useUserProfile();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string>("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [experience, setExperience] = useState<ExperienceLevel>("beginner");
  const [workoutFrequency, setWorkoutFrequency] = useState(4);
  const [workoutDuration, setWorkoutDuration] = useState(25);
  const [equipmentAccess, setEquipmentAccess] = useState<string[]>(["Bodyweight", "Open floor"]);
  const [injuries, setInjuries] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [coachingTone, setCoachingTone] = useState<"friendly" | "strict" | "motivational">("friendly");
  const [danceInterest, setDanceInterest] = useState(true);
  const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPref[]>([]);
  const [allergies, setAllergies] = useState("");

  const progress = ((currentStep) / (steps.length - 1)) * 100;

  const toggleGoal = (goal: Goal) => {
    setGoals((prev) =>
      prev.includes(goal)
        ? prev.filter((g) => g !== goal)
        : prev.length < 3
        ? [...prev, goal]
        : prev
    );
  };

  const toggleDiet = (diet: DietaryPref) => {
    setDietaryPrefs((prev) =>
      prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
    );
  };

  const toggleEquipment = (item: string) => {
    setEquipmentAccess((prev) => (prev.includes(item) ? prev.filter((value) => value !== item) : [...prev, item]));
  };

  const canProceed = () => {
    switch (steps[currentStep].id) {
      case "welcome":
        return true;
      case "basics":
        return name.trim().length >= 2;
      case "body":
        return true; // Optional
      case "goals":
        return goals.length > 0;
      case "experience":
        return true;
      case "calibration":
        return workoutFrequency > 0 && workoutDuration > 0 && equipmentAccess.length > 0;
      case "diet":
        return true; // Optional
      case "complete":
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  useEffect(() => {
    if (!loading && !session?.user?.id) {
      router.replace("/login?next=/onboarding");
    }
  }, [loading, router, session?.user?.id]);

  useEffect(() => {
    if (profile?.onboardingCompleted) {
      router.replace("/dashboard");
    }
  }, [profile?.onboardingCompleted, router]);

  const handleComplete = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const finalGoals = danceInterest && !goals.includes("dance_skill") ? [...goals, "dance_skill" as Goal] : goals;
      await updateProfile({
        name: name.trim(),
        age: age ? Number(age) : undefined,
        gender: (gender || undefined) as any,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        targetWeightKg: targetWeight ? Number(targetWeight) : undefined,
        experience,
        goals: finalGoals,
        dietaryPrefs,
        injuries: injuries.split(",").map((item) => item.trim()).filter(Boolean),
        painPoints: painPoints.split(",").map((item) => item.trim()).filter(Boolean),
        equipmentAccess,
        workoutFrequency,
        workoutDuration,
        coachingTone,
        allergies: allergies || undefined,
        onboardingCompleted: true,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save profile right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="performance-shell flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-3xl border-border bg-card/90 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <CardHeader className="pb-2">
          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                    i < currentStep
                      ? "bg-primary text-primary-foreground"
                      : i === currentStep
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {i < currentStep ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-1.5" />
        </CardHeader>

        <CardContent className="pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Welcome Step */}
              {steps[currentStep].id === "welcome" && (
                <div className="text-center py-8">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_40px_color-mix(in_oklch,var(--primary)_20%,transparent)]">
                    <Flame className="h-10 w-10 text-primary" />
                  </div>
                  <h2 className="mb-3 text-4xl font-black uppercase leading-none">Welcome to FitCoach AI</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-6">
                    Let's personalize your fitness journey. Answer a few questions so we can create
                    the perfect workout and nutrition plan for you.
                  </p>
                  <p className="text-sm text-muted-foreground">This takes about 2 minutes</p>
                </div>
              )}

              {/* Basics Step */}
              {steps[currentStep].id === "basics" && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-black uppercase">What should we call you?</h2>
                    <p className="text-muted-foreground">Let's get to know each other</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Your Name</Label>
                      <Input
                        id="name"
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-2 h-12"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="age">Age (optional)</Label>
                        <Input
                          id="age"
                          type="number"
                          placeholder="25"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          className="mt-2 h-12"
                        />
                      </div>
                      <div>
                        <Label>Gender (optional)</Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {[
                            { value: "male", label: "Male" },
                            { value: "female", label: "Female" },
                          ].map((g) => (
                            <Button
                              key={g.value}
                              variant={gender === g.value ? "default" : "outline"}
                              onClick={() => setGender(g.value)}
                              className="h-12"
                            >
                              {g.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Body Stats Step */}
              {steps[currentStep].id === "body" && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-black uppercase">Your Body Stats</h2>
                    <p className="text-muted-foreground">This helps us calculate your targets (optional)</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="height">Height (cm)</Label>
                      <Input
                        id="height"
                        type="number"
                        placeholder="175"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        className="mt-2 h-12"
                      />
                    </div>
                    <div>
                      <Label htmlFor="weight">Current Weight (kg)</Label>
                      <Input
                        id="weight"
                        type="number"
                        placeholder="70"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className="mt-2 h-12"
                      />
                    </div>
                    <div>
                      <Label htmlFor="target">Target Weight (kg)</Label>
                      <Input
                        id="target"
                        type="number"
                        placeholder="65"
                        value={targetWeight}
                        onChange={(e) => setTargetWeight(e.target.value)}
                        className="mt-2 h-12"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Your data is stored locally and never shared.
                  </p>
                </div>
              )}

              {/* Goals Step */}
              {steps[currentStep].id === "goals" && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-black uppercase">What are your goals?</h2>
                    <p className="text-muted-foreground">Select up to 3 fitness goals</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {goalOptions.map((goal) => {
                      const Icon = goal.icon;
                      const isSelected = goals.includes(goal.value);
                      return (
                        <button
                          key={goal.value}
                          onClick={() => toggleGoal(goal.value)}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-lg border transition-all text-left",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div
                            className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{goal.label}</div>
                            <div className="text-sm text-muted-foreground">{goal.description}</div>
                          </div>
                          {isSelected && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Experience Step */}
              {steps[currentStep].id === "experience" && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-black uppercase">Your Fitness Level</h2>
                    <p className="text-muted-foreground">This helps us tailor your workouts</p>
                  </div>

                  <div className="space-y-3">
                    {experienceLevels.map((level) => (
                      <button
                        key={level.value}
                        onClick={() => setExperience(level.value)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left",
                          experience === level.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            experience === level.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <Dumbbell className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{level.label}</div>
                          <div className="text-sm text-muted-foreground">{level.description}</div>
                        </div>
                        {experience === level.value && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Coach Calibration Step */}
              {steps[currentStep].id === "calibration" && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-black uppercase">Calibrate your coach</h2>
                    <p className="text-muted-foreground">This decides how the app guides your first week.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border bg-background/35 p-4">
                      <div className="flex items-center gap-2 font-medium">
                        <Clock className="h-4 w-4 text-primary" />
                        Weekly schedule
                      </div>
                      <div className="mt-3 grid gap-2">
                        {scheduleOptions.map((option) => (
                          <Button key={option.days} type="button" variant={workoutFrequency === option.days ? "default" : "outline"} className="h-auto justify-start py-3" onClick={() => setWorkoutFrequency(option.days)}>
                            <span className="text-left">
                              <span className="block">{option.label}</span>
                              <span className="block text-xs opacity-75">{option.detail}</span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-background/35 p-4">
                      <div className="flex items-center gap-2 font-medium">
                        <Timer className="h-4 w-4 text-primary" />
                        Session length
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {durationOptions.map((duration) => (
                          <Button key={duration} type="button" variant={workoutDuration === duration ? "default" : "outline"} onClick={() => setWorkoutDuration(duration)}>
                            {duration} min
                          </Button>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between rounded-lg border px-3 py-2">
                        <span className="flex items-center gap-2 text-sm">
                          <Music2 className="h-4 w-4 text-fuchsia-500" />
                          Include hip-hop practice
                        </span>
                        <Button type="button" size="sm" variant={danceInterest ? "default" : "outline"} onClick={() => {
                          setDanceInterest((value) => !value);
                          setGoals((prev) => {
                            if (danceInterest) return prev.filter((goal) => goal !== "dance_skill");
                            return prev.includes("dance_skill") ? prev : [...prev, "dance_skill"];
                          });
                        }}>
                          {danceInterest ? "On" : "Off"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-background/35 p-4">
                    <div className="flex items-center gap-2 font-medium">
                      <Dumbbell className="h-4 w-4 text-primary" />
                      Equipment available
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {equipmentOptions.map((item) => (
                        <Button key={item} type="button" size="sm" variant={equipmentAccess.includes(item) ? "default" : "outline"} onClick={() => toggleEquipment(item)}>
                          {item}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="injuries" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Injury notes
                      </Label>
                      <Input id="injuries" placeholder="e.g., knee pain, shoulder history" value={injuries} onChange={(event) => setInjuries(event.target.value)} className="mt-2 h-12" />
                    </div>
                    <div>
                      <Label htmlFor="pain">Pain points to avoid</Label>
                      <Input id="pain" placeholder="e.g., jumping, deep squats" value={painPoints} onChange={(event) => setPainPoints(event.target.value)} className="mt-2 h-12" />
                    </div>
                  </div>

                  <div>
                    <Label>Coaching tone</Label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(["friendly", "motivational", "strict"] as const).map((tone) => (
                        <Button key={tone} type="button" variant={coachingTone === tone ? "default" : "outline"} className="capitalize" onClick={() => setCoachingTone(tone)}>
                          {tone}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Diet Step */}
              {steps[currentStep].id === "diet" && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-black uppercase">Dietary Preferences</h2>
                    <p className="text-muted-foreground">Select all that apply (optional)</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {dietOptions.map((diet) => {
                      const Icon = diet.icon;
                      const isSelected = dietaryPrefs.includes(diet.value);
                      return (
                        <button
                          key={diet.value}
                          onClick={() => toggleDiet(diet.value)}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div
                            className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="font-medium text-sm">{diet.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <Label htmlFor="allergies">Food Allergies / Restrictions</Label>
                    <Input
                      id="allergies"
                      placeholder="e.g., nuts, gluten, lactose"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      className="mt-2 h-12"
                    />
                  </div>
                </div>
              )}

              {/* Complete Step */}
              {steps[currentStep].id === "complete" && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Check className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="mb-3 text-4xl font-black uppercase leading-none">You're All Set, {name}!</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    Your coach is calibrated around your goals, available time, equipment, safety notes, and preferred coaching tone.
                  </p>

                  <div className="mx-auto mb-8 grid max-w-xl gap-3 text-left md:grid-cols-3">
                    <div className="rounded-lg border bg-muted/25 p-3">
                      <p className="text-sm font-medium">Day 1</p>
                      <p className="mt-1 text-xs text-muted-foreground">{danceInterest || goals.includes("dance_skill") ? "Hip-hop baseline" : "Fitness baseline"} • {workoutDuration} min</p>
                    </div>
                    <div className="rounded-lg border bg-muted/25 p-3">
                      <p className="text-sm font-medium">Day 2</p>
                      <p className="mt-1 text-xs text-muted-foreground">Weak metric practice • short technique block</p>
                    </div>
                    <div className="rounded-lg border bg-muted/25 p-3">
                      <p className="text-sm font-medium">Day 3</p>
                      <p className="mt-1 text-xs text-muted-foreground">Repeat and unlock first achievement</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 mb-8">
                    {goals.map((goal) => (
                      <span
                        key={goal}
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                      >
                        {goal.replace("_", " ")}
                      </span>
                    ))}
                    <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm">
                      {experience}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {steps[currentStep].id === "complete" ? (
              <Button
                onClick={handleComplete}
                disabled={saving}
                className="gap-2"
              >
                {saving ? "Saving..." : "Go to Dashboard"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="gap-2"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          {saveError ? (
            <p className="mt-3 text-sm text-rose-500 text-right">{saveError}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
