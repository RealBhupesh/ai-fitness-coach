"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Apple, Droplet, Flame, Plus, ShoppingCart, Sparkles, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type NutritionPlanRecord = {
  id: string;
  name: string;
  description?: string | null;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  meals?: string | null;
  hydrationLiters?: number | null;
  mealTiming?: string | null;
  groceryList?: string | null;
};

type FoodEntry = {
  id: string;
  foodName: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion?: string | null;
  date: string;
};

type Meal = {
  type: string;
  name: string;
  ingredients: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTime?: number;
};

const parseJson = <T,>(raw: string | null | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export default function NutritionPage() {
  const [plan, setPlan] = useState<NutritionPlanRecord | null>(null);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    mealType: "breakfast",
    foodName: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    portion: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [planRes, logRes] = await Promise.all([
        fetch("/api/nutrition", { cache: "no-store" }),
        fetch("/api/nutrition/log", { cache: "no-store" }),
      ]);
      const planData = await planRes.json();
      const logData = await logRes.json();
      if (!planRes.ok) throw new Error(planData.error || "Failed to load nutrition");
      if (!logRes.ok) throw new Error(logData.error || "Failed to load food log");
      setPlan(planData.plan ?? null);
      setEntries(logData.entries ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load nutrition");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const todaysEntries = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return entries.filter((entry) => entry.date.slice(0, 10) === today);
  }, [entries]);

  const consumed = useMemo(
    () =>
      todaysEntries.reduce(
        (sum, entry) => ({
          calories: sum.calories + entry.calories,
          protein: sum.protein + entry.protein,
          carbs: sum.carbs + entry.carbs,
          fat: sum.fat + entry.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [todaysEntries],
  );

  const meals = useMemo(() => parseJson<Meal[]>(plan?.meals, []), [plan?.meals]);
  const groceryList = useMemo(
    () => parseJson<Array<{ item: string; quantity: string; estimatedCost?: string }>>(plan?.groceryList, []),
    [plan?.groceryList],
  );
  const reminders = useMemo(() => parseJson<string[]>(plan?.mealTiming, []), [plan?.mealTiming]);

  const handleGenerate = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/nutrition/generate", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate plan");
      toast.success("Nutrition plan generated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate plan");
    } finally {
      setSaving(false);
    }
  };

  const handleLogFood = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealType: form.mealType,
          foodName: form.foodName,
          calories: Number(form.calories),
          protein: Number(form.protein || 0),
          carbs: Number(form.carbs || 0),
          fat: Number(form.fat || 0),
          portion: form.portion || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to log food");
      toast.success("Food logged");
      setOpen(false);
      setForm({ mealType: "breakfast", foodName: "", calories: "", protein: "", carbs: "", fat: "", portion: "" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to log food");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Nutrition</h1>
          <p className="mt-1 text-muted-foreground">Meal plan, hydration targets, and a real food log stored in the app database.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={handleGenerate} disabled={saving}>
            <Sparkles className="h-4 w-4" />
            Generate nutrition plan
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Log food
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log a meal</DialogTitle>
                <DialogDescription>Food entries update today&apos;s macro totals and adherence.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="mealType">Meal type</Label>
                  <Input id="mealType" value={form.mealType} onChange={(event) => setForm((prev) => ({ ...prev, mealType: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="foodName">Food name</Label>
                  <Input id="foodName" value={form.foodName} onChange={(event) => setForm((prev) => ({ ...prev, foodName: event.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calories">Calories</Label>
                    <Input id="calories" value={form.calories} onChange={(event) => setForm((prev) => ({ ...prev, calories: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portion">Portion</Label>
                    <Input id="portion" value={form.portion} onChange={(event) => setForm((prev) => ({ ...prev, portion: event.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="protein">Protein</Label>
                    <Input id="protein" value={form.protein} onChange={(event) => setForm((prev) => ({ ...prev, protein: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carbs">Carbs</Label>
                    <Input id="carbs" value={form.carbs} onChange={(event) => setForm((prev) => ({ ...prev, carbs: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fat">Fat</Label>
                    <Input id="fat" value={form.fat} onChange={(event) => setForm((prev) => ({ ...prev, fat: event.target.value }))} />
                  </div>
                </div>
                <Button onClick={handleLogFood} disabled={saving || !form.foodName || !form.calories}>
                  {saving ? "Saving..." : "Log food"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-60 rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <Flame className="mb-2 h-5 w-5 text-orange-500" />
                <p className="text-2xl font-bold">
                  {consumed.calories} / {plan?.dailyCalories ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Calories</p>
                <Progress className="mt-3 h-2" value={plan?.dailyCalories ? (consumed.calories / plan.dailyCalories) * 100 : 0} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Apple className="mb-2 h-5 w-5 text-emerald-500" />
                <p className="text-2xl font-bold">
                  {consumed.protein} / {plan?.proteinGrams ?? 0}g
                </p>
                <p className="text-sm text-muted-foreground">Protein</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Utensils className="mb-2 h-5 w-5 text-blue-500" />
                <p className="text-2xl font-bold">
                  {consumed.carbs} / {plan?.carbsGrams ?? 0}g
                </p>
                <p className="text-sm text-muted-foreground">Carbs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Droplet className="mb-2 h-5 w-5 text-cyan-500" />
                <p className="text-2xl font-bold">{plan?.hydrationLiters ?? 0}L</p>
                <p className="text-sm text-muted-foreground">Hydration target</p>
              </CardContent>
            </Card>
          </div>

          {!plan ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <Utensils className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold">No active nutrition plan</p>
                  <p className="text-sm text-muted-foreground">Generate one from your profile to unlock meal suggestions and grocery lists.</p>
                </div>
                <Button onClick={handleGenerate} disabled={saving}>
                  Generate nutrition plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="plan" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 md:w-[420px]">
                <TabsTrigger value="plan">Meal plan</TabsTrigger>
                <TabsTrigger value="log">Food log</TabsTrigger>
                <TabsTrigger value="groceries">Groceries</TabsTrigger>
              </TabsList>

              <TabsContent value="plan" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description || "Daily targets and meal ideas tailored to your saved profile."}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {meals.map((meal) => (
                      <div key={`${meal.type}-${meal.name}`} className="rounded-xl border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{meal.name}</p>
                            <p className="text-sm capitalize text-muted-foreground">{meal.type}</p>
                          </div>
                          <span className="text-sm font-medium">{meal.calories} kcal</span>
                        </div>
                        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                          {meal.ingredients.map((ingredient) => (
                            <li key={ingredient}>• {ingredient}</li>
                          ))}
                        </ul>
                        <p className="mt-3 text-xs text-muted-foreground">
                          P{meal.protein} C{meal.carbs} F{meal.fat}
                          {meal.prepTime ? ` • ${meal.prepTime} min prep` : ""}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Hydration and timing</CardTitle>
                    <CardDescription>Use these reminders to keep intake consistent across the day.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {reminders.map((reminder) => (
                      <p key={reminder}>• {reminder}</p>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="log" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Today&apos;s food log</CardTitle>
                    <CardDescription>Entries saved today and used for your macro totals.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {todaysEntries.map((entry) => (
                      <div key={entry.id} className="rounded-xl border p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{entry.foodName}</p>
                          <span className="text-xs uppercase text-muted-foreground">{entry.mealType}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{entry.calories} kcal</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          P{entry.protein} C{entry.carbs} F{entry.fat}
                          {entry.portion ? ` • ${entry.portion}` : ""}
                        </p>
                      </div>
                    ))}
                    {todaysEntries.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No meals logged yet today.</div> : null}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="groceries" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                      Grocery list
                    </CardTitle>
                    <CardDescription>Plan-derived staples for the current nutrition cycle.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {groceryList.map((item) => (
                      <div key={`${item.item}-${item.quantity}`} className="rounded-xl border p-4">
                        <p className="font-medium">{item.item}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}
                          {item.estimatedCost ? ` • ${item.estimatedCost}` : ""}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
