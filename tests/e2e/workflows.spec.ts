import { expect,test } from "@playwright/test";
const enabled=process.env.E2E_REAL_DATABASE==="true" && !process.env.PLAYWRIGHT_USE_BUILD;
test.describe("authenticated full app",()=>{
 test.skip(!enabled,"Requires isolated PostgreSQL and a development auth server");
 test("persists real activity, verifies ownership, exports and deletes account",async({page,browser,baseURL})=>{
  test.setTimeout(180_000);
  const origin=new URL(baseURL || "http://127.0.0.1:3100").origin;
  const email=`beta-${Date.now()}@example.test`;
  const signup=await page.request.post("/api/auth/sign-up/email",{headers:{origin},data:{email,password:"Test-only-fitness-123!",name:"Beta Test"}});expect(signup.ok()).toBeTruthy();
  expect((await page.request.post("/api/profile",{headers:{origin},data:{name:"Beta Test",age:28,experience:"beginner",goals:["general_fitness"],dietaryPrefs:["vegan"],equipmentAccess:[],onboardingCompleted:true}})).ok()).toBeTruthy();
  const id=crypto.randomUUID();const payload={clientSessionId:id,type:"strength",exerciseType:"squat",totalReps:10,duration:5,compositeScore:80,exercises:[{exerciseId:"squat",sets:1,reps:10}]};
  const saved=await page.request.post("/api/workouts",{headers:{origin},data:payload});expect(saved.ok()).toBeTruthy();const sessionId=(await saved.json()).sessionId;
  const replay=await page.request.post("/api/workouts",{headers:{origin},data:payload});expect((await replay.json()).replayed).toBe(true);
  expect((await page.request.post("/api/workouts",{headers:{origin},data:{...payload,totalReps:11}})).status()).toBe(409);
  expect((await page.request.post("/api/workout-plans/generate",{headers:{origin}})).ok()).toBeTruthy();
  expect((await page.request.post("/api/nutrition/generate",{headers:{origin}})).ok()).toBeTruthy();
  expect((await page.request.post("/api/nutrition/log",{headers:{origin},data:{mealType:"lunch",foodName:"Rice and lentils",calories:500}})).ok()).toBeTruthy();
  expect((await page.request.post("/api/progress",{headers:{origin},data:{weight:70,notes:"Test progress"}})).ok()).toBeTruthy();
  expect((await page.request.post("/api/recovery/checkin",{headers:{origin},data:{sleepHours:7,energy:3,soreness:2}})).ok()).toBeTruthy();
  expect((await page.request.put("/api/settings",{headers:{origin},data:{units:"imperial",theme:"dark"}})).ok()).toBeTruthy();
  expect((await page.request.put("/api/settings",{headers:{origin},data:{theme:"light"}})).ok()).toBeTruthy();
  expect((await(await page.request.get("/api/settings")).json()).settings.units).toBe("imperial");
  expect((await page.request.post("/api/chat",{headers:{origin},data:{message:"Explain my recorded squat session"}})).ok()).toBeTruthy();
  for(const route of ["/api/dashboard","/api/achievements","/api/dance/course","/api/dance/routine","/api/review-lab/sessions"]){expect((await page.request.get(route)).ok(),route).toBeTruthy();}
  const other=await browser.newContext({baseURL:origin});
  try{
   const signup2=await other.request.post("/api/auth/sign-up/email",{headers:{origin},data:{email:`other-${Date.now()}@example.test`,password:"Test-only-fitness-123!",name:"Other Test"}});expect(signup2.ok()).toBeTruthy();
   expect((await other.request.get(`/api/review-lab/sessions/${sessionId}`)).status()).toBe(404);
   expect((await other.request.post("/api/coach/summarize",{headers:{origin},data:{sessionId}})).status()).toBe(404);
   expect((await other.request.delete("/api/account",{headers:{origin},data:{confirmation:"DELETE"}})).ok()).toBeTruthy();
  }finally{await other.close();}
  const exported=await page.request.get("/api/account/export");expect(exported.ok()).toBeTruthy();const data=await exported.json();expect(data.workouts).toHaveLength(1);expect(data.settings[0].units).toBe("imperial");expect(data).not.toHaveProperty("accounts");
  expect((await page.request.delete("/api/profile",{headers:{origin}})).ok()).toBeTruthy();expect((await(await page.request.get("/api/workouts")).json()).workouts).toHaveLength(1);
  expect((await page.request.delete("/api/account",{headers:{origin},data:{confirmation:"DELETE"}})).ok()).toBeTruthy();expect((await page.request.get("/api/session")).status()).toBe(401);
 });
 test("sign-out revokes the local session",async({page,baseURL})=>{
  const origin=new URL(baseURL || "http://127.0.0.1:3100").origin;
  const credentials={email:`logout-${crypto.randomUUID()}@example.test`,password:"Test-only-fitness-123!"};
  expect((await page.request.post("/api/auth/sign-up/email",{headers:{origin},data:{...credentials,name:"Logout Test"}})).ok()).toBeTruthy();
  try {
   await page.goto("/sign-out",{waitUntil:"domcontentloaded"});await expect(page).toHaveURL(origin+"/",{timeout:30000});
   expect((await page.request.get("/api/session")).status()).toBe(401);
  } finally {
   await page.request.post("/api/auth/sign-in/email",{headers:{origin},data:credentials});
   expect((await page.request.delete("/api/account",{headers:{origin},data:{confirmation:"DELETE"}})).ok()).toBeTruthy();
  }
 });

 for (const route of ["/dashboard","/coach/workout","/coach/dance","/workouts","/workout-plans","/nutrition","/progress","/achievements","/settings","/review-lab"]) {
  test(`authenticated page ${route}`, async ({page,baseURL}) => {
   const origin=new URL(baseURL || "http://127.0.0.1:3100").origin;
   const signup=await page.request.post("/api/auth/sign-up/email",{headers:{origin},data:{email:`page-${crypto.randomUUID()}@example.test`,password:"Test-only-fitness-123!",name:"Page Test"}});
   expect(signup.ok()).toBeTruthy();
   try {
    const response=await page.goto(route,{waitUntil:"domcontentloaded"});
    expect(response?.ok()).toBeTruthy();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("main")).toBeVisible();
   } finally {
    const cleanup=page.request;await page.close();
    expect((await cleanup.delete("/api/account",{headers:{origin},data:{confirmation:"DELETE"}})).ok()).toBeTruthy();
   }
  });
 }

});
