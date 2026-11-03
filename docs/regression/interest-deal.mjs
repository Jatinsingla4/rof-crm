import { execFileSync } from 'node:child_process';
const B='http://localhost:3010/api';const PS='/Library/PostgreSQL/18/bin/psql';const env={...process.env,PGHOST:'localhost',PGPORT:'5433',PGUSER:'postgres',PGDATABASE:'rof_sec'};
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
const sched=await api('POST','/payments/interest-scheduler',{project_id:P,persist:false});
const mine=(sched.j.data?.rows||sched.j.data?.consumers||sched.j.data||[]);const arr=Array.isArray(mine)?mine:Object.values(mine);
console.log('scheduler status',sched.s,JSON.stringify(arr.filter(x=>JSON.stringify(x).includes(C)).slice(0,3)).slice(0,700));
const late=Math.round((Date.parse(day(0))-Date.parse(due2))/864e5);const amt2=Number(q(`select amount_due_inr from demands where consumer_id='${C}' and installment_index=2 and status<>'cancelled'`));console.log('late days',late,'row2 amount',amt2,'model interest',Math.round(amt2*0.12*late/365));
console.log('RAW',JSON.stringify(sched.j).slice(0,500));
console.log('demand2',q(`select status, delivery_status, due_date::text, raised_at is not null from demands where consumer_id='${C}' and installment_index=2 and status<>'cancelled'`));
// pay row 2 today (25 days late) in two parts, then ask the scheduler again: interest stops growing on the paid part
const pay=await api('POST','/payments/receipts',{consumerId:C,amountReceivedInr:1500000,paymentDate:day(0),paymentMode:'online',referenceNumber:RUN+'A',bankName:'B',installmentIndex:2});
const pay2=await api('POST','/payments/receipts',{consumerId:C,amountReceivedInr:500000,paymentDate:day(-5),paymentMode:'online',referenceNumber:RUN+'B',bankName:'B',installmentIndex:2});
console.log('pay',pay.s,pay2.s,pay2.t.slice(0,120));
const rs=await api('GET','/payments/receipts?consumerId='+C);const l=rs.j.data.receipts||rs.j.data;for(const r of l){if(r.status==='pending')await api('PATCH','/payments/receipts/'+r.id+'/clear',{clearing_date:day(0)})}
const s2=await api('POST','/payments/interest-scheduler',{project_id:P,persist:false});const d=(s2.j.details||[]).find(x=>x.consumer_id===C);
console.log('after payment total interest',d&&d.total_interest,'rows',JSON.stringify((d&&d.rows||[]).map(r=>[r.installment_index,r.due_amount,r.amount_received,String(r.date_received||'').slice(0,10),r.delay_days,r.interest||r.interest_amount||r.delay_amount])).slice(0,500));
console.log('model: 500000 paid 5 days ago -> 20 days late: ',Math.round(500000*0.12*20/365),' + 1500000 paid today 25 days late:',Math.round(1500000*0.12*25/365),' = ',Math.round(500000*0.12*20/365)+Math.round(1500000*0.12*25/365));
// destructive: cancel the 500000 part paid 5 days ago; the instalment is short again and interest runs on the full amount for 25 days
const rs2=await api('GET','/payments/receipts?consumerId='+C);const l2=rs2.j.data.receipts||rs2.j.data;const part=l2.find(r=>Number(r.amount_received_inr)===500000);
const cn=await api('POST','/payments/receipts/'+part.id+'/cancel',{reason:'audit cancel'});console.log('cancel receipt',cn.s,cn.t.slice(0,120));
const s3=await api('POST','/payments/interest-scheduler',{project_id:P,persist:false});const d3=(s3.j.details||[]).find(x=>x.consumer_id===C);
console.log('after cancel total interest',d3&&d3.total_interest,'model',Math.round(2000000*0.12*25/365*100)/100,'| demand2 status',q(`select status,delivery_status from demands where consumer_id='${C}' and installment_index=2 and status<>'cancelled'`));
const form=await (await fetch(B+'/payments/receipt-form/'+C,{headers:{authorization:'Bearer '+tok}})).text();const txt=form.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');console.log('form',(txt.match(/Unit Cost:.{0,150}/)||[])[0]);
console.log('real receipts left',q(`select coalesce(sum(amount_received_inr),0) from receipts where consumer_id='${C}' and status not in ('cancelled','bounced') and not coalesce(is_advance,false)`),'model 500000 booking + 1500000 =',2000000);
