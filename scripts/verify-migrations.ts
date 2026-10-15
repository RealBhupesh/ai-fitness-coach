import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,unlinkSync,rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
async function main() {
const connection=process.env.TEST_DATABASE_URL;
if(!connection)throw new Error("TEST_DATABASE_URL required");
const parsed=new URL(connection);
if(!["localhost","127.0.0.1"].includes(parsed.hostname)||!parsed.pathname.includes("test"))throw new Error("Only isolated local test databases permitted");
const admin=new Pool({connectionString:connection});
const journal=JSON.parse(readFileSync("drizzle/meta/_journal.json","utf8"));
const prefix=`fitcoach_migration_${Date.now()}_`;
for(const scenario of ["fresh","upgrade"]){
 const databaseName=prefix+scenario;
 if(!/^fitcoach_migration_[0-9]+_(fresh|upgrade)$/.test(databaseName))throw new Error("Invalid test database name");
 await admin.query(`CREATE DATABASE "${databaseName}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
 const url=new URL(connection);url.pathname=`/${databaseName}`;
 const pool=new Pool({connectionString:url.toString()});
 let folder:string|null=null;
 try{
  if(scenario==="upgrade"){
   folder=mkdtempSync(path.join(tmpdir(),"fitcoach-migration-"));mkdirSync(path.join(folder,"meta"));
   const entries=journal.entries.filter((e:{idx:number})=>e.idx<5);
   writeFileSync(path.join(folder,"meta/_journal.json"),JSON.stringify({...journal,entries}));
   for(const entry of entries)copyFileSync(`drizzle/${entry.tag}.sql`,path.join(folder,`${entry.tag}.sql`));
   await migrate(drizzle(pool),{migrationsFolder:folder});
   await pool.query("insert into users(id,email,name) values('legacy-proof','legacy@example.test','Preserved legacy account')");
  }
  await migrate(drizzle(pool),{migrationsFolder:"drizzle"});
  await migrate(drizzle(pool),{migrationsFolder:"drizzle"});
  const result=await pool.query("select count(*)::int as n from information_schema.tables where table_schema='public'");
  if(result.rows[0].n!==27)throw new Error("Unexpected schema table count");
  if(scenario==="upgrade" && !(await pool.query("select id from users where id='legacy-proof'")).rowCount)throw new Error("Legacy user lost");
  console.log(`${scenario}: migrations and repeat migration passed; ${result.rows[0].n} tables`);
 } finally {
  await pool.end();await admin.query(`DROP DATABASE "${databaseName}"`);
  if(folder){for(const entry of journal.entries.filter((e:{idx:number})=>e.idx<5))unlinkSync(path.join(folder,`${entry.tag}.sql`));unlinkSync(path.join(folder,"meta/_journal.json"));rmdirSync(path.join(folder,"meta"));rmdirSync(folder);}
 }
}
await admin.end();

}
void main().catch(() => { console.error("Migration verification failed"); process.exit(1); });
