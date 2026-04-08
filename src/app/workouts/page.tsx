"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dumbbell,
  Heart,
  Flame,
  Wind,
  Activity,
  Music,
  Play,
  Clock,
  Target,
  Search,
  Filter,
  Sparkles,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Exercise {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  description: string;
  calories: number;
  muscleGroup: string;
  equipment: string;
}

interface DanceStyle {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  intensity: string;
  caloriesPerHour: number;
}

const categoryData = [
  { id: "all", label: "All Workouts", icon: Activity, color: "from-violet-500 to-purple-500" },
  { id: "strength", label: "Strength", icon: Dumbbell, color: "from-blue-500 to-cyan-500" },
  { id: "cardio", label: "Cardio", icon: Heart, color: "from-rose-500 to-pink-500" },
  { id: "hiit", label: "HIIT", icon: Flame, color: "from-orange-500 to-amber-500" },
  { id: "yoga", label: "Yoga", icon: Wind, color: "from-emerald-500 to-teal-500" },
  { id: "dance", label: "Dance", icon: Music, color: "from-pink-500 to-rose-500" },
];

const featuredWorkouts = [
  { name: "Morning Energy Boost", duration: "15 min", type: "HIIT", calories: 180, image: "🌅", color: "from-orange-500 to-amber-500" },
  { name: "Full Body Strength", duration: "45 min", type: "Strength", calories: 350, image: "💪", color: "from-blue-500 to-cyan-500" },
  { name: "Dance Cardio Party", duration: "30 min", type: "Dance", calories: 280, image: "💃", color: "from-pink-500 to-rose-500" },
  { name: "Yoga for Recovery", duration: "25 min", type: "Yoga", calories: 120, image: "🧘", color: "from-emerald-500 to-teal-500" },
];

const categoryColors: Record<string, string> = {
  strength: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  cardio: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  hiit: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  yoga: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  flexibility: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  dance: "bg-pink-500/10 text-pink-500 border-pink-500/20",
};

const categoryIcons: Record<string, any> = {
  strength: Dumbbell,
  cardio: Heart,
  hiit: Flame,
  yoga: Wind,
  flexibility: Activity,
  dance: Music,
};

export default function WorkoutsPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [danceStyles, setDanceStyles] = useState<DanceStyle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadExercises();
    loadDanceStyles();
  }, []);

  const loadExercises = async () => {
    try {
      const response = await fetch("/api/exercises");
      const data = await response.json();
      if (data.exercises) {
        setExercises(data.exercises);
      }
    } catch (error) {
      console.error("Failed to load exercises:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDanceStyles = async () => {
    try {
      const response = await fetch("/api/exercises?type=dance");
      const data = await response.json();
      if (data.danceStyles) {
        setDanceStyles(data.danceStyles);
      }
    } catch (error) {
      console.error("Failed to load dance styles:", error);
    }
  };

  const filteredExercises =
    activeCategory === "all"
      ? exercises
      : activeCategory === "dance"
      ? []
      : exercises.filter((ex) => ex.category === activeCategory);

  const searchedExercises = filteredExercises.filter(
    (ex) =>
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.muscleGroup?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Workout Library</h1>
          <p className="text-muted-foreground mt-1">
            Discover exercises and workouts for every goal
          </p>
        </div>
        <Link href="/coach/chat">
          <Button className="gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600">
            <Sparkles className="h-4 w-4" />
            Get AI Recommendation
          </Button>
        </Link>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search exercises, muscle groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </motion.div>

      {/* Featured Workouts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Featured Workouts</h2>
          <Button variant="ghost" size="sm" className="gap-1">
            View All <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredWorkouts.map((workout, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <Link href="/coach/workout">
                <Card className="overflow-hidden card-hover cursor-pointer group">
                  <div className={cn("h-32 bg-gradient-to-br flex items-center justify-center", workout.color)}>
                    <span className="text-5xl group-hover:scale-110 transition-transform">{workout.image}</span>
                  </div>
                  <CardContent className="pt-4">
                    <h3 className="font-semibold truncate">{workout.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {workout.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3" /> {workout.calories} cal
                      </span>
                    </div>
                    <Badge variant="secondary" className="mt-2">{workout.type}</Badge>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Category Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
            {categoryData.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border data-[state=active]:bg-gradient-to-r data-[state=active]:text-white data-[state=active]:border-transparent",
                    `data-[state=active]:${cat.color}`
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{cat.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-20 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : activeCategory === "dance" ? (
              <DanceGrid danceStyles={danceStyles} />
            ) : (
              <WorkoutGrid exercises={searchedExercises} />
            )}
          </div>
        </Tabs>
      </motion.div>
    </div>
  );
}

function WorkoutGrid({ exercises }: { exercises: Exercise[] }) {
  if (exercises.length === 0) {
    return (
      <div className="text-center py-12">
        <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-semibold mb-2">No exercises found</h3>
        <p className="text-sm text-muted-foreground">Try adjusting your search or category filter</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {exercises.map((exercise, i) => {
        const Icon = categoryIcons[exercise.category] || Activity;
        return (
          <motion.div
            key={exercise.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="h-full card-hover">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className={cn("p-2 rounded-lg border", categoryColors[exercise.category])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="capitalize">{exercise.difficulty}</Badge>
                </div>
                <CardTitle className="text-xl">{exercise.name}</CardTitle>
                <CardDescription className="line-clamp-2">{exercise.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span>{exercise.calories} cal/min</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="capitalize">{exercise.muscleGroup?.replace("_", " ")}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/coach/workout?exercise=${exercise.id}`} className="flex-1">
                    <Button className="w-full gap-2" variant="outline">
                      <Play className="h-4 w-4" />
                      Start
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon">
                    <Zap className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function DanceGrid({ danceStyles }: { danceStyles: DanceStyle[] }) {
  if (danceStyles.length === 0) {
    return (
      <div className="text-center py-12">
        <Music className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-semibold mb-2">No dance styles found</h3>
        <p className="text-sm text-muted-foreground">Check back soon for more dance workouts!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {danceStyles.map((style, i) => (
        <motion.div
          key={style.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="h-full card-hover overflow-hidden">
            <div className="h-32 bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
              <Music className="h-12 w-12 text-white/80" />
            </div>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-xl">{style.name}</CardTitle>
                <Badge variant="outline" className="capitalize">{style.difficulty}</Badge>
              </div>
              <CardDescription className="line-clamp-2">{style.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>{style.caloriesPerHour} cal/hr</span>
                </div>
                <Badge
                  className={cn(
                    "capitalize",
                    style.intensity === "high"
                      ? "bg-red-500"
                      : style.intensity === "moderate"
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  )}
                >
                  {style.intensity}
                </Badge>
              </div>
              <Link href={`/coach/dance?style=${style.name.toLowerCase().replace(" ", "-")}`}>
                <Button className="w-full gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600">
                  <Music className="h-4 w-4" />
                  Start Dancing
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
