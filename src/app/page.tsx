"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  Dumbbell,
  Music2,
  Utensils,
  Camera,
  Brain,
  TrendingUp,
  Trophy,
  Sparkles,
  Play,
  ArrowRight,
  Activity,
  Flame,
  Target,
  Heart,
  Zap,
  CheckCircle2,
  CircleGauge,
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const features = [
  {
    icon: Camera,
    title: "Real-Time Form Analysis",
    description: "AI-powered pose detection gives instant feedback on your exercise form using your device camera.",
    color: "from-primary to-accent",
  },
  {
    icon: Brain,
    title: "Smart AI Coach",
    description: "Get personalized workout plans, nutrition advice, and answers to all your fitness questions.",
    color: "from-accent to-primary",
  },
  {
    icon: Music2,
    title: "Dance Fitness",
    description: "Learn dance moves with posture guidance. From Zumba to Hip-Hop, groove your way to fitness.",
    color: "from-cyan-400 to-primary",
  },
  {
    icon: Utensils,
    title: "Nutrition Planning",
    description: "Personalized meal plans, macro tracking, and smart grocery lists tailored to your goals.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Visualize your fitness journey with detailed charts, body measurements, and progress photos.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Trophy,
    title: "Achievements & Streaks",
    description: "Stay motivated with gamification. Earn badges, maintain streaks, and celebrate milestones.",
    color: "from-amber-500 to-orange-500",
  },
];

const workoutTypes = [
  { name: "Strength", icon: Dumbbell, count: "50+ exercises" },
  { name: "HIIT", icon: Flame, count: "20+ workouts" },
  { name: "Yoga", icon: Activity, count: "30+ flows" },
  { name: "Dance", icon: Music2, count: "15+ styles" },
  { name: "Cardio", icon: Heart, count: "25+ routines" },
];

const stats = [
  { value: "10K+", label: "Active Users" },
  { value: "500+", label: "Workout Plans" },
  { value: "98%", label: "Satisfaction" },
  { value: "24/7", label: "AI Support" },
];

export default function HomePage() {
  const { profile } = useUserProfile();
  const hasProfile = profile && profile.name;

  return (
    <div className="performance-shell relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative flex min-h-[90vh] items-center">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <motion.div
            className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_420px] lg:items-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            <div>
              <motion.div variants={fadeInUp}>
                <Badge className="mb-6 px-4 py-1.5">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Performance OS for fitness, dance, and nutrition
                </Badge>
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="mb-6 max-w-4xl text-5xl font-black uppercase leading-[0.9] md:text-7xl lg:text-8xl"
              >
                Know when to push. Know when to recover.
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl"
              >
                A wearable-inspired AI coach that turns form scorecards, hip-hop timing, calories, recovery, and achievements into one clear next move.
              </motion.p>

            <motion.div variants={fadeInUp} className="mb-12 flex flex-wrap gap-4">
              {hasProfile ? (
                <>
                  <Link href="/dashboard">
                    <Button size="lg" className="h-12 px-8">
                      Go to Dashboard
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/coach/chat">
                    <Button size="lg" variant="outline" className="h-12 px-8">
                      Chat with AI Coach
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/onboarding">
                    <Button size="lg" className="h-12 px-8">
                      Get Started Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/demo">
                    <Button size="lg" variant="outline" className="h-12 px-8">
                      Try Demo User
                    </Button>
                  </Link>
                  <Link href="/workouts">
                    <Button size="lg" variant="outline" className="h-12 px-8">
                      <Play className="mr-2 h-5 w-5" />
                      Explore Workouts
                    </Button>
                  </Link>
                </>
              )}
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeInUp}
              className="grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4"
            >
              {stats.map((stat, i) => (
                <div key={i} className="rounded-lg border bg-card/70 p-4">
                  <div className="text-2xl font-black md:text-3xl gradient-text">{stat.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
            </div>
            <motion.div variants={fadeInUp} className="relative mx-auto aspect-square w-full max-w-[420px] rounded-full border border-primary/20 bg-primary/5 p-8 shadow-[0_0_90px_color-mix(in_oklch,var(--primary)_18%,transparent)]">
              <div className="absolute inset-8 rounded-full border border-accent/20" />
              <div className="absolute inset-20 rounded-full border border-primary/25" />
              <div className="flex h-full flex-col items-center justify-center rounded-full border border-border bg-card/80 text-center backdrop-blur">
                <CircleGauge className="mb-5 h-12 w-12 text-primary" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">today readiness</p>
                <p className="mt-2 text-7xl font-black">86</p>
                <p className="mt-3 max-w-48 text-sm text-muted-foreground">Technique day. Push quality, not volume.</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Workout Types Strip */}
      <section className="py-8 border-y bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 md:gap-12">
            {workoutTypes.map((type, i) => {
              const Icon = type.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors cursor-default"
                >
                  <Icon className="h-5 w-5" />
                  <div>
                    <div className="font-medium text-foreground">{type.name}</div>
                    <div className="text-xs">{type.count}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge className="mb-4">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to{" "}
              <span className="gradient-text">Succeed</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our comprehensive platform combines AI technology with expert fitness knowledge
              to deliver a personalized coaching experience.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="h-full card-hover group border-0 bg-gradient-to-br from-card to-card/50 shadow-lg">
                    <CardHeader>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">{feature.description}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge className="mb-4">How It Works</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Start Your Journey in{" "}
              <span className="gradient-text">3 Steps</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Create Your Profile",
                description: "Tell us about your fitness goals, experience level, and preferences.",
                icon: Target,
              },
              {
                step: "02",
                title: "Get Your Plan",
                description: "Receive personalized workout and nutrition plans tailored just for you.",
                icon: Zap,
              },
              {
                step: "03",
                title: "Train & Track",
                description: "Follow guided workouts with real-time feedback and track your progress.",
                icon: TrendingUp,
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="relative text-center"
                >
                  <div className="text-6xl font-bold text-muted-foreground/10 absolute -top-4 left-1/2 -translate-x-1/2">
                    {item.step}
                  </div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-rose-500 to-violet-500" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            
            <div className="relative z-10 text-center py-16 md:py-24 px-4">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                Ready to Transform?
              </h2>
              <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
                Join thousands who have achieved their fitness goals with our AI-powered coaching platform.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href={hasProfile ? "/dashboard" : "/onboarding"}>
                  <Button size="lg" className="bg-white text-orange-600 hover:bg-white/90 h-12 px-8">
                    {hasProfile ? "Continue Training" : "Start Free Trial"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
              
              <div className="flex flex-wrap justify-center gap-6 mt-8 text-white/80">
                {["No credit card required", "Cancel anytime", "24/7 AI support"].map((text, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center">
                <Flame className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold gradient-text">FitCoach AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 FitCoach AI. Built with ❤️ for fitness enthusiasts.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
