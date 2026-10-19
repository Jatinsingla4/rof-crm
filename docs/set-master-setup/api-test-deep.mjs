import { execSync } from 'child_process';
const B='http://localhost:3002/api', PW='Test#Pass1234';
const sql = q => execSync(`/Library/PostgreSQL/18/bin/psql -h localhost -p 5433 -U postgres -d rof_crm_test -Atq -c "${q.replace(/"/g,'\\"')}"`).toString().trim();
const tok=(await (await fetch(B+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'super_admin@test.local',password:PW})})).json()).token;
const A=async(m,p,b)=>{const r=await fetch(B+p,{method:m,headers:{'content-type':'application/json',authorization:'Bearer '+tok},body:b===undefined?undefined:JSON.stringify(b)});let j=null;try{j=await r.json()}catch{}return{s:r.status,j}};
const ok=(n,c,x='')=>console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+x));
const U=Date.now().toString(36);
const cid=sql("select id from consumers limit 1");
// in-use guards for the 4 text lists + source
for (const [path,col,tbl] of [['salutations','salutation',null],['professions','profession',null],['nationalities','nationality',null],['sources-of-enquiry','source_of_enquiry',null]]) {
  const n=`U${path.slice(0,3)}${U}`; const r=await A('POST','/master/'+path,{name:n}); const id=r.j.data.id;
  const old=sql(`select coalesce(${col},'') from consumers where id='${cid}'`);
  sql(`update consumers set ${col}='${n}' where id='${cid}'`);
  let d=await A('DELETE','/master/'+path+'/'+id); ok(`${path}: delete blocked while a consumer uses it`, d.s===409, d.s+JSON.stringify(d.j));
  let p=await A('PUT','/master/'+path+'/'+id,{name:n+'x'}); ok(`${path}: rename blocked while in use`, p.s===409, p.s);
  sql(`update consumers set ${col}=${old===''?'NULL':`'${old}'`} where id='${cid}'`);
  d=await A('DELETE','/master/'+path+'/'+id); ok(`${path}: delete works after consumer released`, d.s===200, d.s);
}
// bank in use on receipt: need a receipt row -> check column exists only
ok('banks: receipts.clearing_bank_id exists (guard target)', sql("select count(*) from information_schema.columns where table_name='receipts' and column_name='clearing_bank_id'")==='1');
// audit rows
const n=`Audit-${U}`; let r=await A('POST','/master/professions',{name:n}); const id=r.j.data.id; await A('PUT','/master/professions/'+id,{name:n+'2'}); await A('DELETE','/master/professions/'+id);
const rows=sql(`select action||':'||resource_type from audit_logs where resource_id='${id}' order by timestamp`).split('\n');
ok('audit: create, update, delete each logged exactly once', JSON.stringify(rows)===JSON.stringify(['create:master.professions','update:master.professions','delete:master.professions']), JSON.stringify(rows));
// race: 10 parallel same-name creates
const nm=`Race-${U}`; const res=await Promise.all(Array.from({length:10},()=>A('POST','/master/professions',{name:nm})));
const cnt=sql(`select count(*) from professions where lower(name)=lower('${nm}')`);
ok(`race: 10 parallel identical creates leave exactly 1 row (got ${cnt}; statuses ${res.map(x=>x.s).join(',')})`, cnt==='1');
sql(`delete from professions where lower(name)=lower('${nm}')`);
// SQL-injection style input in names/filters
r=await A('POST','/master/professions',{name:`x'; DROP TABLE professions;--`}); ok('name with quote/SQL stored as plain text (201) and table intact', r.s===201 && sql("select count(*)>0 from information_schema.tables where table_name='professions'")==='t', r.s);
await A('DELETE','/master/professions/'+r.j?.data?.id);
r=await A('GET',"/master/states?country_id=' OR '1'='1"); ok('filter with injection string -> 4xx/empty not 500', r.s!==500, r.s);
// unauthenticated
const un=await fetch(B+'/master/countries'); ok('no token -> 401/403', [401,403].includes(un.status), un.status);
// logo endpoint guards
const lg=await fetch(B+'/companies/not-a-uuid/logo',{method:'POST',headers:{authorization:'Bearer '+tok}}); ok('logo: bad company id -> 400', lg.status===400, lg.status);
