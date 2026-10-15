import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";
import type { Pool } from "pg";
import * as schema from "@/db/schema";
export function backupTableOrder() {
 const tables=Object.values(schema).filter(value=>is(value,PgTable));
 const pending=new Map(tables.map(table=>{const config=getTableConfig(table);return [config.name,{name:config.name,parents:config.foreignKeys.map(fk=>getTableConfig(fk.reference().foreignTable).name)}];}));
 const ordered:string[]=[];
 while(pending.size){const ready=[...pending.values()].filter(t=>t.parents.every(p=>ordered.includes(p))).sort((a,b)=>a.name.localeCompare(b.name));if(!ready.length)throw new Error("Backup dependency cycle");for(const table of ready){ordered.push(table.name);pending.delete(table.name);}}
 return ordered;
}
export function encryptBackup(payload: unknown, key: Buffer) {
 if(key.length!==32)throw new Error("BACKUP_ENCRYPTION_KEY must decode to 32 bytes");
 const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",key,iv);const plain=Buffer.from(JSON.stringify(payload));
 if(plain.length>256*1024*1024)throw new Error("Backup exceeds beta backup size limit; use managed database backups");
 const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
 return JSON.stringify({format:"fitcoach-backup-v1",iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),ciphertext:ciphertext.toString("base64")});
}
export function decryptBackup(envelope:string,key:Buffer):unknown {
 const data=JSON.parse(envelope);if(data.format!=="fitcoach-backup-v1"||key.length!==32)throw new Error("Invalid backup format/key");
 const cipher=createDecipheriv("aes-256-gcm",key,Buffer.from(data.iv,"base64"));cipher.setAuthTag(Buffer.from(data.tag,"base64"));
 return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data.ciphertext,"base64")),cipher.final()]).toString("utf8"));
}
export async function captureBackup(pool:Pool, schemaHash:string) {
 const client=await pool.connect();
 try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const rows:Record<string,Record<string,unknown>[]>={};
  for(const table of backupTableOrder()) rows[table]=(await client.query(`select coalesce(json_agg(t),'[]'::json) as rows from "${table}" t`)).rows[0].rows;
  await client.query("COMMIT");
  return {format:"fitcoach-data-v1",schemaHash,createdAt:new Date().toISOString(),tables:rows};
 } catch(error) {await client.query("ROLLBACK");throw error;} finally {client.release();}
}
export async function restoreRows(pool:Pool,payload:unknown,schemaHash:string) {
 const snapshot=payload as {format?:string;schemaHash?:string;tables?:Record<string,Record<string,unknown>[]>};
 const names=backupTableOrder();if(snapshot.format!=="fitcoach-data-v1"||snapshot.schemaHash!==schemaHash||!snapshot.tables||names.some(n=>!Array.isArray(snapshot.tables![n]))||Object.keys(snapshot.tables).length!==names.length)throw new Error("Backup schema mismatch");
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  for(const table of names){
   if(Number((await client.query(`select count(*) as n from "${table}"`)).rows[0].n)!==0)throw new Error("Restore only permitted into empty app tables");
   const columnTypes=(await client.query("select column_name, data_type from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",[table])).rows;
   const columns=columnTypes.map(r=>r.column_name as string);
   for(const row of snapshot.tables[table]){
    if(Object.keys(row).some(k=>!columns.includes(k)))throw new Error("Unknown backup column");
    await client.query(`insert into "${table}" (${columns.map(c=>`"${c}"`).join(",")}) values (${columns.map((_,i)=>`$${i+1}`).join(",")})`,columnTypes.map(c=>row[c.column_name] == null ? null : ["json", "jsonb"].includes(c.data_type) ? JSON.stringify(row[c.column_name]) : row[c.column_name]));
   }
  }
  await client.query("COMMIT");
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
