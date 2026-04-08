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
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "basics", title: "About You", icon: User },
  { id: "body", title: "Body Stats", icon: Scale },
  { id: "goals", title: "Goals", icon: Target },
  { id: "experience", title: "Experience", icon: Dumbbell },
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
      await updateProfile({
        name: name.trim(),
        age: age ? Number(age) : undefined,
        gender: (gender || undefined) as any,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        targetWeightKg: targetWeight ? Number(targetWeight) : undefined,
        experience,
        goals,
        dietaryPrefs,
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-orange-500/10 to-rose-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-2xl shadow-2xl border-0 bg-card/80 backdrop-blur-xl">
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
                      ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white"
                      : i === currentStep
                      ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white ring-4 ring-orange-500/20"
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
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Flame className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold mb-3">Welcome to FitCoach AI</h2>
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
                    <h2 className="text-2xl font-bold">What should we call you?</h2>
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
                    <h2 className="text-2xl font-bold">Your Body Stats</h2>
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
                    <h2 className="text-2xl font-bold">What are your goals?</h2>
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
                            "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div
                            className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center",
                              isSelected
                                ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white"
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
                    <h2 className="text-2xl font-bold">Your Fitness Level</h2>
                    <p className="text-muted-foreground">This helps us tailor your workouts</p>
                  </div>

                  <div className="space-y-3">
                    {experienceLevels.map((level) => (
                      <button
                        key={level.value}
                        onClick={() => setExperience(level.value)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                          experience === level.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            experience === level.value
                              ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white"
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

              {/* Diet Step */}
              {steps[currentStep].id === "diet" && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold">Dietary Preferences</h2>
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
                            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div
                            className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              isSelected
                                ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white"
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
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Check className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold mb-3">You're All Set, {name}!</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    Your personalized fitness journey is ready. We've created workout and nutrition 
                    plans based on your goals and preferences.
                  </p>

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
                className="gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600"
              >
                {saving ? "Saving..." : "Go to Dashboard"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600"
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
