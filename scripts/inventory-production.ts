import { Pool } from "pg";
import { writeFileSync } from "node:fs";
async function main(){
 if(!process.env.INVENTORY_DATABASE_URL)throw new Error("INVENTORY_DATABASE_URL required");
 const pool=new Pool({connectionString:process.env.INVENTORY_DATABASE_URL,ssl:!['localhost','127.0.0.1'].includes(new URL(process.env.INVENTORY_DATABASE_URL).hostname)?{rejectUnauthorized:true}:undefined});
 const client=await pool.connect();
 try{
  await client.query("BEGIN READ ONLY");
  const tables=(await client.query("select table_name from information_schema.tables where table_schema='public' order by table_name")).rows.map(r=>r.table_name as string);
  const counts:Record<string,number>={};
  for(const name of tables){if(!/^[a-z_]+$/.test(name))continue;counts[name]=Number((await client.query(`select count(*) as n from "${name}"`)).rows[0].n);}
  const inventory={capturedAt:new Date().toISOString(),tables:counts,hasAccounts:(counts.users??0)>0,identityMappingAvailable:tables.includes("provider_identities"),migrationRequired:(counts.users??0)>0,notes:["No account identifiers or credentials included.","Inventory does not authorize automatic email linking or data deletion."]};
  const output=process.argv[2];if(output)writeFileSync(output,JSON.stringify(inventory,null,2));else console.log(JSON.stringify(inventory,null,2));
  await client.query("COMMIT");
 }finally{client.release();await pool.end();}
}
void main().catch(()=>{console.error("Inventory failed; check connection and read-only permissions");process.exit(1);});
