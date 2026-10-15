import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { captureBackup,encryptBackup,decryptBackup,restoreRows } from "../src/lib/server/backup";
async function main(){
 const restore=process.argv[2]==="restore";const file=process.argv[3];
 if(!file)throw new Error("Usage: tsx scripts/backup-db.ts backup|restore file.json.enc");
 const connection=restore?process.env.RESTORE_DATABASE_URL:process.env.DATABASE_URL;
 if(!connection||!process.env.BACKUP_ENCRYPTION_KEY)throw new Error("Database URL and BACKUP_ENCRYPTION_KEY required");
 const url=new URL(connection);
 if(restore&&(!url.pathname.endsWith("_restore")||connection===process.env.DATABASE_URL))throw new Error("Restore target must be a different database ending in _restore");
 const remote=!["localhost","127.0.0.1"].includes(url.hostname);for(const key of ["sslmode","sslcert","sslkey","sslrootcert"])url.searchParams.delete(key);
 const pool=new Pool({connectionString:url.toString(),ssl:remote?{rejectUnauthorized:true}:undefined});
 const journal=JSON.parse(readFileSync("drizzle/meta/_journal.json","utf8"));
 const schemaHash=createHash("sha256").update(journal.entries.map((e:{tag:string})=>readFileSync(`drizzle/${e.tag}.sql`,"utf8")).join("\n")).digest("hex");
 const key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY,"base64");
 try{
  if(restore){
   if(statSync(file).size>360*1024*1024)throw new Error("Backup size limit exceeded");
   // Authenticate before creating schema or writing any rows.
   const payload=decryptBackup(readFileSync(file,"utf8"),key);
   if((payload as {schemaHash?:string}).schemaHash!==schemaHash)throw new Error("Restore using the same source revision as the backup");
   if((await pool.query("select count(*)::int as n from information_schema.tables where table_schema='public'")).rows[0].n!==0)throw new Error("Restore database must be empty");
   if ((await pool.query("show server_encoding")).rows[0].server_encoding !== "UTF8") throw new Error("Restore target must use UTF8 encoding");
   await migrate(drizzle(pool),{migrationsFolder:"drizzle"});await restoreRows(pool,payload,schemaHash);
   console.log("Authenticated backup restored into empty target database");
  }else{
   const payload=await captureBackup(pool,schemaHash);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,encryptBackup(payload,key),{flag:"wx",mode:0o600});console.log("Encrypted app backup written");
  }
 }finally{await pool.end();}
}
void main().catch(()=>{console.error("Backup/restore failed; check target, schema revision, and encryption key");process.exit(1);});
