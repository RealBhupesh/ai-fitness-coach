"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile, Goal, DietaryPref, ExperienceLevel } from "@/hooks/useUserProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "fat_loss", label: "Fat Loss" },
  { value: "muscle_gain", label: "Muscle Gain" },
  { value: "endurance", label: "Endurance" },
  { value: "mobility", label: "Mobility" },
  { value: "dance_skill", label: "Dance Skill" },
];

const DIET_OPTIONS: { value: DietaryPref; label: string }[] = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "keto", label: "Keto" },
  { value: "mediterranean", label: "Mediterranean" },
];

export default function OnboardingFlow() {
  const router = useRouter();
  const { profile, updateProfile } = useUserProfile();

  const [name, setName] = useState(profile?.name ?? "");
  const [age, setAge] = useState<string>(profile?.age?.toString() ?? "");
  const [gender, setGender] = useState<string>(profile?.gender ?? "");
  const [heightCm, setHeightCm] = useState<string>(profile?.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState<string>(profile?.weightKg?.toString() ?? "");
  const [experience, setExperience] = useState<ExperienceLevel>(profile?.experience ?? "beginner");
  const [goals, setGoals] = useState<Goal[]>(profile?.goals ?? []);
  const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPref[]>(profile?.dietaryPrefs ?? []);
  const [allergies, setAllergies] = useState<string>(profile?.allergies ?? "");

  const toggleArrayValue = <T,>(arr: T[], v: T) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const onSubmit = () => {
    if (!name.trim()) return alert("Please enter your name");
    updateProfile({
      name: name.trim(),
      age: age ? Number(age) : undefined,
      gender: (gender || undefined) as any,
      heightCm: heightCm ? Number(heightCm) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      experience,
      goals,
      dietaryPrefs,
      allergies: allergies || undefined,
    });
    router.push("/dashboard");
  };

  return (
    <div className="mx-auto max-w-4xl w-full">
      <Card>
        <CardHeader>
          <CardTitle>Welcome! Let's personalize your coaching</CardTitle>
          <CardDescription>
            Share your fitness, dance, and nutrition preferences to tailor your plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="age">Age</Label>
              <Input id="age" type="number" min={1} value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="height">Height (cm)</Label>
              <Input id="height" type="number" min={50} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input id="weight" type="number" min={10} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Gender</Label>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "non_binary", label: "Non-binary" },
                  { value: "prefer_not_to_say", label: "Prefer not to say" },
                ].map((g) => (
                  <Button
                    key={g.value}
                    type="button"
                    variant={gender === g.value ? "default" : "secondary"}
                    onClick={() => setGender(g.value)}
                    className="w-full"
                  >
                    {g.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Experience Level</Label>
              <Select value={experience} onValueChange={(v) => setExperience(v as ExperienceLevel)}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="Select experience" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Goals (choose 1-3)</Label>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                {GOAL_OPTIONS.map((g) => (
                  <Button
                    key={g.value}
                    type="button"
                    variant={goals.includes(g.value) ? "default" : "secondary"}
                    onClick={() => setGoals((prev) => toggleArrayValue(prev, g.value))}
                    className="w-full"
                  >
                    {g.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Dietary Preferences</Label>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                {DIET_OPTIONS.map((d) => (
                  <Button
                    key={d.value}
                    type="button"
                    variant={dietaryPrefs.includes(d.value) ? "default" : "secondary"}
                    onClick={() => setDietaryPrefs((prev) => toggleArrayValue(prev, d.value))}
                    className="w-full"
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="allergies">Allergies / Restrictions</Label>
              <Input id="allergies" placeholder="e.g., peanuts, gluten" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => router.push("/dashboard")}>Skip</Button>
            <Button onClick={onSubmit}>Save & Continue</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}