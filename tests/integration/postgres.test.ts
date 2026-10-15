import { loadPrimaryDanceRoutinePack } from "@/lib/dance/routine-pack";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { captureBackup, encryptBackup, decryptBackup, restoreRows } from "@/lib/server/backup";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq, inArray } from "drizzle-orm";
import { db, dbPool } from "@/db";
import { users, workoutSessions, workoutExercises, exerciseReps, providerIdentities, userSettings, danceCourseAttempts } from "@/db/schema";
import { saveWorkoutSession } from "@/lib/server/workout-persistence";
import { workoutSessionInputSchema } from "@/lib/validation/schemas";
const configured=Boolean(process.env.TEST_DATABASE_URL);
const ids=[`integration-a-${crypto.randomUUID()}`,`integration-b-${crypto.randomUUID()}`];
describe.skipIf(!configured)("PostgreSQL integrity",()=>{
 beforeAll(async()=>{
  if(process.env.DATABASE_URL!==process.env.TEST_DATABASE_URL)throw new Error("Integration tests require a separate test database");
  const url=new URL(process.env.TEST_DATABASE_URL!);if(!url.pathname.includes("test")||!["localhost","127.0.0.1"].includes(url.hostname))throw new Error("Only local test databases allowed");
  await migrate(db,{migrationsFolder:"drizzle"});
  await db.insert(users).values(ids.map((id,i)=>({id,email:`${id}@example.test`,name:`Test ${i}`})));
 });
 afterAll(async()=>{await db.delete(users).where(inArray(users.id,ids));await dbPool?.end();});
 it("deduplicates concurrent saves and rejects conflicting retries",async()=>{
  const payload=workoutSessionInputSchema.parse({clientSessionId:crypto.randomUUID(),type:"strength",exerciseType:"squat",totalReps:10,exercises:[{exerciseId:"squat",sets:1,reps:10}]});
  const results=await Promise.all([saveWorkoutSession(ids[0],payload),saveWorkoutSession(ids[0],payload)]);
  expect(results[0].sessionId).toBe(results[1].sessionId);expect(results.filter(r=>r.replayed)).toHaveLength(1);
  await expect(saveWorkoutSession(ids[0],{...payload,totalReps:11})).rejects.toMatchObject({status:409});
  const other=await saveWorkoutSession(ids[1],payload);expect(other.sessionId).not.toBe(results[0].sessionId);
 });
 it("rolls back a session when a child insert fails",async()=>{
  const payload=workoutSessionInputSchema.parse({clientSessionId:crypto.randomUUID(),type:"strength",exercises:[{exerciseId:"squat"}],repData:[{exerciseId:"squat",repNumber:1,phase:"top",durationMs:3000000000}]});
  await expect(saveWorkoutSession(ids[0],payload)).rejects.toThrow();
  expect(await db.query.workoutSessions.findFirst({where:eq(workoutSessions.clientSessionId,payload.clientSessionId)})).toBeUndefined();
 });
 it("saves packaged dance progress atomically and deduplicates the attempt",async()=>{
  const routine=await loadPrimaryDanceRoutinePack();const segment=routine.segments[0];
  const payload=workoutSessionInputSchema.parse({clientSessionId:crypto.randomUUID(),type:"dance",duration:1,exercises:[{exerciseId:"dance_basic"}],danceSegments:[{id:segment.id,label:segment.label,overall:80,timing:85,transition:75,reliability:90}]});
  const saved=await saveWorkoutSession(ids[0],payload);await saveWorkoutSession(ids[0],payload);
  const attempts=await db.select().from(danceCourseAttempts).where(eq(danceCourseAttempts.sourceSessionId,saved.sessionId));
  expect(attempts).toHaveLength(1);expect(attempts[0].routineId).toBe(routine.id);
 });
 it("authenticates backups before restoring and refuses overwriting populated tables",async()=>{
  const key=Buffer.alloc(32,4);const snapshot=await captureBackup(dbPool!,"test-schema");
  const envelope=encryptBackup(snapshot,key);expect(JSON.stringify(envelope)).not.toContain("example.test");
  const restored=decryptBackup(envelope,key);expect(restored).toMatchObject({schemaHash:"test-schema"});
  const corrupt=JSON.parse(envelope);corrupt.tag=Buffer.alloc(16).toString("base64");expect(()=>decryptBackup(JSON.stringify(corrupt),key)).toThrow();
  await expect(restoreRows(dbPool!,restored,"test-schema")).rejects.toThrow("empty");
 });
 it("restores an encrypted snapshot into a fresh PostgreSQL database",async()=>{
  const targetName=`fitcoach_roundtrip_${crypto.randomUUID().replaceAll("-", "")}_restore`;
  const sourceUrl=new URL(process.env.TEST_DATABASE_URL!);const adminUrl=new URL(sourceUrl);adminUrl.pathname="/postgres";
  const admin=new Pool({connectionString:adminUrl.toString()});
  const targetUrl=new URL(sourceUrl);targetUrl.pathname=`/${targetName}`;
  const target=new Pool({connectionString:targetUrl.toString()});
  try {
   await admin.query(`CREATE DATABASE "${targetName}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
   await migrate(drizzle(target),{migrationsFolder:"drizzle"});
   const source=await captureBackup(dbPool!,"test-schema");
   const restored=decryptBackup(encryptBackup(source,Buffer.alloc(32,7)),Buffer.alloc(32,7));
   await restoreRows(target,restored,"test-schema");
   const actual=await captureBackup(target,"test-schema");
   for(const name of Object.keys(source.tables)) {
    const canonical=(rows:Record<string,unknown>[])=>rows.map(row=>JSON.stringify(row)).sort();
    expect(canonical(actual.tables[name]),name).toEqual(canonical(source.tables[name]));
   }
  } finally {
   await target.end();await admin.query(`DROP DATABASE IF EXISTS "${targetName}"`);await admin.end();
  }
 },90000);
 it("enforces identity uniqueness and cascades deletion of owned activity",async()=>{
  await db.insert(providerIdentities).values({id:crypto.randomUUID(),userId:ids[0],provider:"clerk",subject:"integration-subject"});
  await expect(db.insert(providerIdentities).values({id:crypto.randomUUID(),userId:ids[1],provider:"clerk",subject:"integration-subject"})).rejects.toThrow();
  await db.insert(userSettings).values({userId:ids[0],units:"imperial"});
  const sessions=await db.query.workoutSessions.findMany({where:eq(workoutSessions.userId,ids[0])});
  await db.delete(users).where(eq(users.id,ids[0]));
  expect(await db.query.userSettings.findFirst({where:eq(userSettings.userId,ids[0])})).toBeUndefined();
  expect(await db.query.providerIdentities.findFirst({where:eq(providerIdentities.userId,ids[0])})).toBeUndefined();
  expect(await db.select().from(workoutExercises).where(inArray(workoutExercises.sessionId,sessions.map(s=>s.id)))).toHaveLength(0);
  expect(await db.query.workoutSessions.findMany({where:eq(workoutSessions.userId,ids[1])})).toHaveLength(1);
 });
});
