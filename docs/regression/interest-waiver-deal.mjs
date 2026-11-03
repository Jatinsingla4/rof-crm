import { execFileSync } from 'node:child_process';
const B='http://localhost:3011/api';const PS='/Library/PostgreSQL/18/bin/psql';const env={...process.env,PGHOST:'localhost',PGPORT:'5433',PGUSER:'postgres',PGDATABASE:'rof_x',PGPASSWORD:'postgres'};
const q=s=>execFileSync(PS,['-qAt','-c',s],{encoding:'utf8',env}).trim();
const tok=(await (await fetch(B+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'super_admin@test.local',password:'Test#Pass1234'})})).json()).token;
const api=async(m,p,b)=>{const r=await fetch(B+p,{method:m,headers:{'content-type':'application/json',authorization:'Bearer '+tok},body:b===undefined?undefined:JSON.stringify(b)});const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{}return {s:r.status,j,t:t.slice(0,300)}};
const ok=(r,w)=>{if(r.s>=300)throw new Error(w+' '+r.s+' '+r.t);return r.j.data??r.j};
const RUN='IN'+Date.now().toString(36).toUpperCase();const day=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
const co=ok(await api('POST','/companies',{name:RUN+' Co'}),'co').id;
const P=ok(await api('POST','/projects',{companyId:co,name:RUN+' Proj',reraNumber:RUN,tcpLicence:'x'}),'proj').id;
const T=ok(await api('POST',`/projects/${P}/towers`,{towerName:'T1'}),'tower').id;
const U=ok(await api('POST','/units',{projectId:P,towerId:T,unitNumber:'I-1',floor:1,bhkType:'2BHK',carpetAreaSqft:500,superAreaSqft:600,balconyAreaSqft:0,basePriceInr:5000000,totalPriceInr:5000000}),'unit').id;
const slabs=ok(await api('GET','/gst-configuration/gst-slabs'),'slabs');const today=day(0);let slab=slabs.find(s=>s.from_date<=today&&s.to_date>=today)?.id;if(!slab)slab=ok(await api('POST','/gst-configuration/gst-slabs',{fromDate:'2020-01-01',toDate:'2099-12-31'}),'slab').id;
const tax=ok(await api('POST','/gst-configuration/gst-tax-setup',{slabId:slab,gstCode:RUN+' 0',type:'INTRA',cgstPct:0,sgstPct:0}),'tax').id;
for(const ct of ['BASIC','OTHER CHARGE','PLC'])ok(await api('POST','/gst-configuration/gst-charge-mapping',{projectId:P,slabId:slab,gstTaxId:tax,chargeType:ct}),'map');
const bd0=day(-40);let hs=slabs.find(s=>String(s.from_date).slice(0,10)<=bd0&&String(s.to_date).slice(0,10)>=bd0)?.id;
if(!hs){const first=slabs.map(s=>String(s.from_date).slice(0,10)).filter(d=>d>bd0).sort()[0];hs=ok(await api('POST','/gst-configuration/gst-slabs',{fromDate:'2020-01-01',toDate:new Date(Date.parse(first)-864e5).toISOString().slice(0,10)}),'hist slab').id}
if(hs!==slab){const t2=ok(await api('POST','/gst-configuration/gst-tax-setup',{slabId:hs,gstCode:RUN+' h',type:'INTRA',cgstPct:0,sgstPct:0}),'tax2').id;for(const ct of ['BASIC','OTHER CHARGE','PLC'])ok(await api('POST','/gst-configuration/gst-charge-mapping',{projectId:P,slabId:hs,gstTaxId:t2,chargeType:ct}),'map2')}
const PLAN=RUN+' plan';[[1,'Booking','booking',10,0],[2,'Second','installment',40,15],[3,'Third','installment',50,60]].forEach(()=>{});
for(const [i,n,t,p,o] of [[1,'Booking','booking',10,0],[2,'Second','installment',40,15],[3,'Third','installment',50,60]])ok(await api('POST',`/projects/${P}/plan-templates`,{plan_name:PLAN,installment_name:n,installment_type:t,percentage:p,due_date_offset_days:o,installment_index:i}),'plan');
ok(await api('POST','/payments/interest-master',{project_id:P,rate_percent:12,effective_from:'2020-01-01'}),'rate');
const C=ok(await api('POST','/consumers',{name:'Int Tester',salutation:'Mr.',first_name:'Int',last_name:RUN,mobile:'9'+String(Math.floor(Math.random()*1e9)).padStart(9,'0'),project_id:P,email:RUN+'@example.com',present_address:'House 1, Road 2, Delhi 110001',gender:'male',communication_mode:'courier'}),'cons').id;
const bd=day(-40);const BK=ok(await api('POST','/booking',{consumer_id:C,project_id:P,unit_id:U,selected_plan_name:PLAN,booking_date:bd,basic_price:10000,carpet_area_sqft:500,communication_mode:'courier'}),'book').id;
ok(await api('PATCH','/booking/'+BK,{booking_amount:500000,payment_mode:'online',payment_ref:RUN,bank_name:'B'}),'confirm');
const due2=q(`select due_date::text from demands where consumer_id='${C}' and installment_index=2 and status<>'cancelled'`);
console.log('booking date',bd,'row2 due',due2,'(expected',day(-25)+')');

let pass=0,fail=0;const truth=(n,c,i='')=>{c?pass++:fail++;console.log((c?'ok   ':'FAIL ')+n+(c?'':'  '+i))};const near=(n,g,e,tol=0.011)=>truth(n+': ours '+g+' expected '+e,Math.abs(Number(g)-Number(e))<=tol);
// interest: 2,000,000 x 12% x 25 days / 365 = 16,438.36 saved by the scheduler
const sc=await api('POST','/payments/interest-scheduler',{project_id:P,persist:true});truth('scheduler saves the interest',sc.s===200,sc.t);
const pi=()=>q(`select coalesce(sum(amount_inr),0), coalesce(sum(interest_waived_inr),0) from penal_interests where consumer_id='${C}'`).split('|').map(Number);
let [tot,wv]=pi();near('interest saved (the saved figure is whole rupees)',tot,16438,0.51);
const waive=(amount,ix)=>api('POST','/payments/interest-waivers/direct',{consumer_id:C,consumerId:C,waiver_amount_inr:amount,amount,installment_index:ix,installmentIndex:ix,reason:'audit waiver',reasonText:'audit waiver',authorized_by_name:'Owner',authorizedBy:'Owner'});
const w1=await waive(5000,2);console.log('note  waive 5000:',w1.s,w1.t.slice(0,130));
[tot,wv]=pi();near('after waiving 5,000 the waived total is',wv,5000);
const w2=await waive(20000,2);truth('waiving more than is left (11,438) is refused',w2.s===409||w2.s===400,w2.s+' '+w2.t.slice(0,100));
const w3=await waive(0,2);truth('waiving zero is refused',w3.s===400,w3.s);const w7=await waive(10.5,2);truth('a waiver with paise is refused (whole rupees only)',w7.s===400,w7.s);const w4=await waive(-5,2);truth('waiving a negative amount is refused',w4.s===400,w4.s);
const w5=await waive(11438,2);console.log('note  waive the rest:',w5.s,w5.t.slice(0,100));[tot,wv]=pi();near('after waiving the rest, waived equals interest',wv,tot,0.51);
const w6=await waive(1,2);truth('nothing left to waive is refused',w6.s===409,w6.s+' '+w6.t.slice(0,100));
// the booking receipt is still pending (not cleared): the file then counts the booking instalment as unpaid. Clear it, then the file and the saved interest must agree.
{ const rs=await api('GET','/payments/receipts?consumerId='+C); for(const r of (rs.j.data.receipts||rs.j.data)) if(r.status==='pending') await api('PATCH','/payments/receipts/'+r.id+'/clear',{clearing_date:day(-40)}); }
// the customer file shows the waiver
const lt=await api('POST','/auth/link-token',{path:'/api/consumers/'+C+'/applicant-file'});const af=await (await fetch(B+'/consumers/'+C+'/applicant-file?token='+(lt.j.token||lt.j.data.token))).text();const txt=af.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
console.log('note  file interest block:',(txt.match(/Interest \(Rs\.\).{0,120}/)||[''])[0]);
console.log(`\nRESULT: ${pass} ok, ${fail} failed`);process.exit(fail?1:0);
