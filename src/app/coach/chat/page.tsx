"use client";

import { motion } from "framer-motion";
import { AICoachChat } from "@/components/AICoachChat";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Brain, Dumbbell, Heart, Music2, Sparkles, TrendingUp, Utensils, Zap } from "lucide-react";

const capabilities = [
  { icon: Dumbbell, label: "Workout Planning", description: "Custom training blocks and form guidance" },
  { icon: Utensils, label: "Nutrition Advice", description: "Meal structure, macros, and groceries" },
  { icon: Music2, label: "Dance Coaching", description: "Routine practice and timing cues" },
  { icon: TrendingUp, label: "Progress Review", description: "Summaries across sessions and trends" },
  { icon: Heart, label: "Recovery Guidance", description: "Rest, mobility, and safe regressions" },
  { icon: Brain, label: "Motivation", description: "Session-aware encouragement and next steps" },
];

export default function ChatPage() {
  const { loading, profile } = useUserProfile();

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-[600px] text-muted-foreground">Loading your coach...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">AI Fitness Coach</h1>
          <Badge className="bg-gradient-to-r from-orange-500 to-rose-500 text-white">
            <Zap className="h-3 w-3 mr-1" />
            Groq-ready coach
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Ask about workouts, nutrition, recovery, or your latest session. The coach uses your saved profile and recent activity.
        </p>
        {profile?.goals?.length ? (
          <p className="text-sm text-muted-foreground mt-2">
            Current focus: <span className="text-foreground">{profile.goals.map((goal) => goal.replace(/_/g, " ")).join(", ")}</span>
          </p>
        ) : null}
      </motion.div>

      <div className="grid lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3"
        >
          <AICoachChat className="h-[calc(100vh-240px)] min-h-[520px]" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">What This Coach Uses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {capabilities.map((capability, index) => {
                const Icon = capability.icon;
                return (
                  <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{capability.label}</div>
                      <div className="text-xs text-muted-foreground">{capability.description}</div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-rose-500">
                  <Brain className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Best prompt pattern</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ask with context: exercise, equipment, time available, pain points, and goal. That gives the coach enough signal to tailor the answer.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
