"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserProfile, Goal, DietaryPref, ExperienceLevel } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import {
  User,
  Bell,
  Palette,
  Shield,
  Scale,
  Target,
  Dumbbell,
  Utensils,
  Save,
  Trash2,
  Camera,
  Check,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";

const goalOptions: { value: Goal; label: string }[] = [
  { value: "fat_loss", label: "Fat Loss" },
  { value: "muscle_gain", label: "Muscle Gain" },
  { value: "endurance", label: "Endurance" },
  { value: "mobility", label: "Flexibility" },
  { value: "dance_skill", label: "Dance Skill" },
];

const dietOptions: { value: DietaryPref; label: string }[] = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "keto", label: "Keto" },
  { value: "mediterranean", label: "Mediterranean" },
];

export default function SettingsPage() {
  const { profile, updateProfile, resetProfile } = useUserProfile();

  // Profile fields
  const [name, setName] = useState(profile?.name ?? "");
  const [age, setAge] = useState<string>(profile?.age?.toString() ?? "");
  const [gender, setGender] = useState<string>(profile?.gender ?? "");
  const [heightCm, setHeightCm] = useState<string>(profile?.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState<string>(profile?.weightKg?.toString() ?? "");
  const [experience, setExperience] = useState<ExperienceLevel>(profile?.experience ?? "beginner");
  const [goals, setGoals] = useState<Goal[]>(profile?.goals ?? []);
  const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPref[]>(profile?.dietaryPrefs ?? []);
  const [allergies, setAllergies] = useState<string>(profile?.allergies ?? "");

  // Notification settings
  const [workoutReminders, setWorkoutReminders] = useState(true);
  const [mealReminders, setMealReminders] = useState(true);
  const [progressUpdates, setProgressUpdates] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);

  // Theme
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  // Units
  const [units, setUnits] = useState<"metric" | "imperial">("metric");

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setAge(profile.age?.toString() ?? "");
      setGender(profile.gender ?? "");
      setHeightCm(profile.heightCm?.toString() ?? "");
      setWeightKg(profile.weightKg?.toString() ?? "");
      setExperience(profile.experience ?? "beginner");
      setGoals(profile.goals ?? []);
      setDietaryPrefs(profile.dietaryPrefs ?? []);
      setAllergies(profile.allergies ?? "");
    }
  }, [profile]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleGoal = (goal: Goal) => {
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : prev.length < 3 ? [...prev, goal] : prev
    );
  };

  const toggleDiet = (diet: DietaryPref) => {
    setDietaryPrefs((prev) =>
      prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
    );
  };

  const handleSaveProfile = async () => {
    await updateProfile({
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
    toast.success("Profile saved successfully!");
  };

  const handleResetProfile = () => {
    if (confirm("Are you sure you want to reset all your data? This cannot be undone.")) {
      void resetProfile().then(() => {
        toast.success("Profile reset successfully");
        window.location.reload();
      });
    }
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
      localStorage.removeItem("theme");
    } else {
      document.documentElement.classList.toggle("dark", newTheme === "dark");
      localStorage.setItem("theme", newTheme);
    }
  };

  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
      </motion.div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="fitness" className="gap-2">
            <Dumbbell className="h-4 w-4" />
            <span className="hidden sm:inline">Fitness</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src="" alt={name} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-rose-500 text-white text-2xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Camera className="h-4 w-4" />
                      Change Photo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Max 2MB.</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="25"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non_binary">Non-binary</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleSaveProfile} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Body Measurements
                </CardTitle>
                <CardDescription>Track your physical stats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="height">Height ({units === "metric" ? "cm" : "ft"})</Label>
                    <Input
                      id="height"
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="175"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Current Weight ({units === "metric" ? "kg" : "lbs"})</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit System</Label>
                    <Select value={units} onValueChange={(v: "metric" | "imperial") => setUnits(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">Metric (kg, cm)</SelectItem>
                        <SelectItem value="imperial">Imperial (lbs, ft)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Fitness Tab */}
        <TabsContent value="fitness" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Fitness Goals
                </CardTitle>
                <CardDescription>Select up to 3 goals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {goalOptions.map((goal) => (
                    <Button
                      key={goal.value}
                      variant={goals.includes(goal.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleGoal(goal.value)}
                      className="gap-2"
                    >
                      {goals.includes(goal.value) && <Check className="h-4 w-4" />}
                      {goal.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5" />
                  Experience Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "beginner", label: "Beginner" },
                    { value: "intermediate", label: "Intermediate" },
                    { value: "advanced", label: "Advanced" },
                  ].map((level) => (
                    <Button
                      key={level.value}
                      variant={experience === level.value ? "default" : "outline"}
                      onClick={() => setExperience(level.value as ExperienceLevel)}
                      className="w-full"
                    >
                      {level.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="h-5 w-5" />
                  Dietary Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {dietOptions.map((diet) => (
                    <Button
                      key={diet.value}
                      variant={dietaryPrefs.includes(diet.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDiet(diet.value)}
                      className="gap-2"
                    >
                      {dietaryPrefs.includes(diet.value) && <Check className="h-4 w-4" />}
                      {diet.label}
                    </Button>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allergies">Allergies & Restrictions</Label>
                  <Input
                    id="allergies"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g., nuts, gluten, lactose"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <Button onClick={handleSaveProfile} className="gap-2">
            <Save className="h-4 w-4" />
            Save Fitness Settings
          </Button>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Push Notifications</CardTitle>
                <CardDescription>Configure your notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: "workouts", label: "Workout Reminders", description: "Get reminded about scheduled workouts", state: workoutReminders, setState: setWorkoutReminders },
                  { id: "meals", label: "Meal Reminders", description: "Reminders to log your meals", state: mealReminders, setState: setMealReminders },
                  { id: "progress", label: "Progress Updates", description: "Weekly progress summaries", state: progressUpdates, setState: setProgressUpdates },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </div>
                    <Switch checked={item.state} onCheckedChange={item.setState} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">Email Updates</div>
                    <div className="text-sm text-muted-foreground">Receive tips and updates via email</div>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Customize the appearance of the app</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                    { value: "system", label: "System", icon: Monitor },
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.value}
                        onClick={() => handleThemeChange(t.value as any)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                          theme === t.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{t.label}</span>
                        {theme === t.value && <Badge variant="secondary">Active</Badge>}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Shield className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Reset All Data</div>
                    <div className="text-sm text-muted-foreground">
                      This will delete all your profile data, workout history, and preferences.
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" onClick={handleResetProfile} className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
