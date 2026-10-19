const B = process.env.BASE || 'http://localhost:3002/api';
let pass=0, fail=0; const fails=[];
const t=(n,ok,x='')=>{ok?pass++:(fail++,fails.push(n+' -> '+x));console.log((ok?'PASS ':'FAIL ')+n+(ok?'':' -> '+x));};
async function login(role){const r=await fetch(B+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:role+'@test.local',password:'Test#Pass1234'})});const j=await r.json();return j.token||j.data?.token;}
const call=tok=>async(m,p,b)=>{const r=await fetch(B+p,{method:m,headers:{'content-type':'application/json',authorization:'Bearer '+tok},body:b===undefined?undefined:JSON.stringify(b)});let j=null,txt='';try{txt=await r.text();j=JSON.parse(txt)}catch{}return{s:r.status,j,txt:txt.slice(0,160)};};
const R={};for(const r of['super_admin','project_manager','sales_executive','read_only_viewer'])R[r]=call(await login(r));
const A=R.super_admin,PM=R.project_manager,SE=R.sales_executive,RO=R.read_only_viewer;
const U=Date.now().toString(36).slice(-6);
const CO=(await A('POST','/companies',{name:'PS Co '+U})).j.data.id; // every project needs a company
const no500=(r)=>r.s>=400&&r.s<500;

// ---------- Create / Edit Project
let r=await A('POST','/projects',{companyId:CO,name:'P-'+U,reraNumber:'RERA-'+U,tcpLicence:'TCP-'+U,location:'Gurugram',totalUnits:10});
t('project: create',r.s===201,r.txt); const pid=r.j?.data?.id;
r=await A('POST','/projects',{companyId:CO,name:'P2-'+U}); t('project: missing rera/tcp -> 400',r.s===400,r.s);
r=await A('POST','/projects',{companyId:CO,name:'P3-'+U,reraNumber:'RERA-'+U,tcpLicence:'x'}); t('project: duplicate RERA -> 409/400 (not 500)',no500(r),r.s+' '+r.txt);
r=await A('POST','/projects',{companyId:CO,name:'  ',reraNumber:'R-b'+U,tcpLicence:'x'}); t('project: blank name rejected',r.s===400,r.s+' '+r.txt);
r=await A('POST','/projects',{companyId:CO,name:'<b>x</b>',reraNumber:'R-m'+U,tcpLicence:'x'}); t('project: markup in name rejected',r.s===400,r.s);
r=await A('POST','/projects',{companyId:CO,name:'P-'+U,reraNumber:'R-dn'+U,tcpLicence:'x'}); t('project: duplicate NAME rejected (409)',r.s===409,r.s);
r=await A('POST','/projects',{companyId:CO,name:'Pn-'+U,reraNumber:'R-n'+U,tcpLicence:'x',totalUnits:'abc'}); t('project: totalUnits="abc" -> 4xx not 500',no500(r),r.s+' '+r.txt);
r=await A('POST','/projects',{companyId:CO,name:'Pc-'+U,reraNumber:'R-c'+U,tcpLicence:'x',companyId:'00000000-0000-0000-0000-000000000000'}); t('project: unknown companyId -> 4xx not 500',no500(r),r.s+' '+r.txt);
r=await PM('POST','/projects',{companyId:CO,name:'Ppm-'+U,reraNumber:'R-pm'+U,tcpLicence:'x'}); t('project: project_manager can create',r.s===201,r.s);
r=await SE('POST','/projects',{companyId:CO,name:'Pse-'+U,reraNumber:'R-se'+U,tcpLicence:'x'}); t('project: sales_executive cannot create',r.s===403,r.s);
r=await RO('POST','/projects',{companyId:CO,name:'Pro-'+U,reraNumber:'R-ro'+U,tcpLicence:'x'}); t('project: read_only cannot create',r.s===403,r.s);
r=await RO('GET','/projects'); t('project: read_only can list',r.s===200,r.s);
r=await A('PATCH','/projects/'+pid,{location:'Sector 70'}); t('project: edit location',r.s===200,r.s+' '+r.txt);
r=await A('GET','/projects/'+pid); t('project: edit saved & other fields kept',r.j?.data?.location==='Sector 70'&&r.j?.data?.rera_number==='RERA-'+U,r.txt);
r=await RO('PATCH','/projects/'+pid,{location:'Hacked'}); t('project: read_only cannot edit',r.s===403,r.s);
r=await A('PATCH','/projects/00000000-0000-0000-0000-000000000000',{location:'x'}); t('project: edit unknown id -> 404',r.s===404,r.s);
r=await A('GET','/projects/not-a-uuid'); t('project: get bad uuid -> 4xx not 500',no500(r),r.s);
r=await A('PATCH','/projects/'+pid,{totalUnits:'abc'}); t('project: edit totalUnits="abc" -> 4xx not 500',no500(r),r.s+' '+r.txt);

// ---------- Add Tower / Plot
r=await A('POST',`/projects/${pid}/towers`,{towerName:'T1'}); t('tower: add',r.s===201,r.txt); const tid=r.j?.data?.id;
r=await A('POST',`/projects/${pid}/towers`,{towerName:'T1'}); t('tower: duplicate name is refused (not silently 201)',r.s===409||r.s===400,r.s+' '+r.txt);
r=await A('POST',`/projects/${pid}/towers`,{towerName:'t1'}); t('tower: same name other case refused',r.s===409||r.s===400,r.s);
r=await A('POST',`/projects/${pid}/towers`,{towerName:'   '}); t('tower: blank name -> 400',r.s===400,r.s);
r=await A('POST',`/projects/${pid}/towers`,{towerName:'<i>x</i>'}); t('tower: markup rejected',r.s===400,r.s);
r=await A('POST',`/projects/00000000-0000-0000-0000-000000000000/towers`,{towerName:'Tz'}); t('tower: unknown project -> 4xx not 500',no500(r),r.s+' '+r.txt);
r=await A('POST',`/projects/not-a-uuid/towers`,{towerName:'Tz'}); t('tower: bad project uuid -> 4xx not 500',no500(r),r.s);
r=await A('POST',`/projects/${pid}/towers`,{towerName:'x'.repeat(300)}); t('tower: 300-char name -> 4xx not 500',no500(r),r.s);
r=await SE('POST',`/projects/${pid}/towers`,{towerName:'Tse'}); t('tower: sales_executive cannot add',r.s===403,r.s);
r=await PM('POST',`/projects/${pid}/towers`,{towerName:'T2'}); t('tower: project_manager can add',r.s===201,r.s); const t2=r.j?.data?.id;
r=await PM('DELETE',`/projects/${pid}/towers/${t2}`); t('tower: project_manager cannot delete (needs delete permission)',r.s===403,r.s);
r=await A('GET',`/projects/${pid}/towers`); t('tower: list shows 2 with unit_count',r.j?.data?.length===2&&r.j.data[0].unit_count!==undefined,r.txt);

// ---------- Add Unit
const unit=(o={})=>({projectId:pid,towerId:tid,floor:1,unitNumber:'101',bhkType:'2BHK',carpetAreaSqft:500,superAreaSqft:700,...o});
r=await A('POST','/units',unit()); t('unit: add',r.s===201&&r.j.data.status==='available',r.txt); const uid=r.j?.data?.id;
r=await A('POST','/units',unit()); t('unit: duplicate number in same tower -> 409',r.s===409,r.s);
r=await A('POST','/units',unit({unitNumber:'101',towerId:t2})); t('unit: same number in another tower ok',r.s===201,r.s+' '+r.txt);
r=await A('POST','/units',unit({unitNumber:'102',floor:undefined})); t('unit: floor required -> 400',r.s===400,r.s);
r=await A('POST','/units',unit({unitNumber:'103',floor:'abc'})); t('unit: floor="abc" -> 4xx not 500',no500(r),r.s+' '+r.txt);
r=await A('POST','/units',unit({unitNumber:'104',carpetAreaSqft:'abc'})); t('unit: carpet area "abc" -> 4xx not 500',no500(r),r.s+' '+r.txt);
r=await A('POST','/units',unit({unitNumber:'105',carpetAreaSqft:-5})); t('unit: negative area rejected',no500(r),r.s+' (201 means accepted)');
r=await A('POST','/units',unit({unitNumber:'106',totalPriceInr:-1})); t('unit: negative price rejected',no500(r),r.s+' (201 means accepted)');
r=await A('POST','/units',unit({unitNumber:'  ',})); t('unit: blank number rejected',r.s===400,r.s+' '+r.txt);
r=await A('POST','/units',unit({unitNumber:'<b>'})); t('unit: markup in number rejected',r.s===400,r.s+' '+r.txt);
r=await A('POST','/units',unit({unitNumber:'107',projectId:'00000000-0000-0000-0000-000000000000'})); t('unit: unknown project -> 4xx not 500',no500(r),r.s+' '+r.txt);
// tower belongs to another project?
const other=(await A('POST','/projects',{companyId:CO,name:'Other-'+U,reraNumber:'R-o'+U,tcpLicence:'x'})).j?.data?.id;
r=await A('POST','/units',unit({unitNumber:'108',projectId:other})); t('unit: tower from a DIFFERENT project is refused',no500(r),r.s+' (201 = unit saved under project A tower B)');
r=await SE('POST','/units',unit({unitNumber:'109'})); t('unit: sales_executive cannot add',r.s===403,r.s);
r=await RO('POST','/units',unit({unitNumber:'110'})); t('unit: read_only cannot add',r.s===403,r.s);
r=await PM('POST','/units',unit({unitNumber:'111'})); t('unit: project_manager can add',r.s===201,r.s);
r=await A('PATCH','/units/'+uid,{facing:'East'}); t('unit: edit',r.s===200,r.s+' '+r.txt);
r=await RO('PATCH','/units/'+uid,{facing:'West'}); t('unit: read_only cannot edit',r.s===403,r.s);
r=await A('DELETE',`/projects/${pid}/towers/${tid}`); t('tower: delete blocked while it has units',r.s===400||r.s===409,r.s);
r=await A('GET','/units?projectId='+pid); t('unit: list by project',r.s===200&&(r.j?.data?.length>=2||r.j?.data?.units?.length>=2),r.txt);
// bulk import
r=await A('POST','/units/bulk-import',{}); t('unit: bulk-import empty body -> 4xx not 500',no500(r),r.s+' '+r.txt);

// ---------- Unit Address = unit types
r=await A('POST','/master/unit-types',{project_id:pid,name:'Type-A-'+U,carpet_area_sqft:500,base_rate_sqft:4000}); t('unit type: add',r.s===201,r.txt); const utid=r.j?.data?.id;
r=await A('POST','/master/unit-types',{project_id:pid,name:'Type-A-'+U}); t('unit type: duplicate in project -> 409/400',r.s===409||r.s===400,r.s+' '+r.txt);
r=await A('POST','/master/unit-types',{name:'NoProj-'+U}); t('unit type: no project -> 4xx not 500',no500(r),r.s+' '+r.txt);
r=await A('POST','/master/unit-types',{project_id:pid,name:'Neg-'+U,base_rate_sqft:-1}); t('unit type: negative rate rejected',no500(r),r.s+' (201 = accepted)');
r=await A('POST','/master/unit-types',{project_id:pid,name:'Txt-'+U,carpet_area_sqft:'abc'}); t('unit type: carpet "abc" -> 4xx not 500',no500(r),r.s+' '+r.txt);
r=await RO('POST','/master/unit-types',{project_id:pid,name:'RO-'+U}); t('unit type: read_only cannot add',r.s===403,r.s);
r=await SE('POST','/master/unit-types',{project_id:pid,name:'SE-'+U}); t('unit type: sales_executive cannot add',r.s===403,r.s);
r=await RO('DELETE','/master/unit-types/'+utid); t('unit type: read_only cannot delete',r.s===403,r.s);
r=await A('PUT','/master/unit-types/'+utid,{description:'d'}); t('unit type: edit',r.s===200,r.s+' '+r.txt);
r=await A('POST','/units',unit({unitNumber:'201',unit_type_id:utid})); 
r=await A('DELETE','/master/unit-types/'+utid); t('unit type: delete when units reference it -> clean 4xx (not 500)',r.s===200||no500(r),r.s+' '+r.txt);

// ---------- Unit Location
r=await A('POST',`/projects/${pid}/unit-locations`,{name:'Park Facing'}); t('location: add',r.s===201,r.txt); const lid=r.j?.data?.id;
r=await A('POST',`/projects/${pid}/unit-locations`,{name:'Park Facing'}); t('location: duplicate name refused',r.s===409||r.s===400,r.s+' (201 = duplicates allowed)');
r=await A('POST',`/projects/${pid}/unit-locations`,{name:'  '}); t('location: blank -> 400',r.s===400,r.s);
r=await A('POST',`/projects/${pid}/unit-locations`,{name:'<b>x'}); t('location: markup rejected',r.s===400,r.s);
r=await A('POST',`/projects/00000000-0000-0000-0000-000000000000/unit-locations`,{name:'Z'}); t('location: unknown project -> 4xx not 500',no500(r),r.s+' '+r.txt);
r=await RO('POST',`/projects/${pid}/unit-locations`,{name:'RO'}); t('location: read_only cannot add',r.s===403,r.s);
r=await PM('DELETE',`/projects/${pid}/unit-locations/${lid}`); t('location: project_manager cannot delete',r.s===403,r.s);
r=await A('DELETE',`/projects/${pid}/unit-locations/${lid}`); t('location: delete',r.s===200,r.s);
r=await A('DELETE',`/projects/${pid}/unit-locations/${lid}`); t('location: delete again -> 404 (not silent success)',r.s===404,r.s);
r=await A('DELETE',`/projects/${pid}/unit-locations/not-a-uuid`); t('location: delete bad uuid -> 4xx not 500',no500(r),r.s);

// ---------- Reminder Master
r=await A('POST','/master/reminder-master',{name:'Rem-'+U,days_before:7,channel:'sms'}); t('reminder: add',r.s===201,r.txt); const rid=r.j?.data?.id;
r=await A('POST','/master/reminder-master',{name:'Rem0-'+U,days_before:0}); t('reminder: 0 days allowed (same-day reminder)',r.s===201,r.s+' '+r.txt);
r=await A('POST','/master/reminder-master',{name:'RemN-'+U,days_before:-3}); t('reminder: negative days rejected',no500(r),r.s+' (201 = accepted)');
r=await A('POST','/master/reminder-master',{name:'RemX-'+U,days_before:'abc'}); t('reminder: days "abc" -> 4xx not 500',no500(r),r.s+' '+r.txt);
r=await A('POST','/master/reminder-master',{name:'Rem-'+U,days_before:7}); t('reminder: duplicate name+days refused',r.s===409||r.s===400,r.s+' (201 = duplicates allowed)');
r=await A('POST','/master/reminder-master',{name:'<b>',days_before:3}); t('reminder: markup rejected',r.s===400,r.s);
r=await RO('POST','/master/reminder-master',{name:'RO-'+U,days_before:3}); t('reminder: read_only cannot add',r.s===403,r.s);
r=await SE('POST','/master/reminder-master',{name:'SE-'+U,days_before:3}); t('reminder: sales_executive cannot add',r.s===403,r.s);
r=await RO('DELETE','/master/reminder-master/'+rid); t('reminder: read_only cannot delete',r.s===403,r.s);
r=await A('DELETE','/master/reminder-master/'+rid); t('reminder: delete',r.s===200,r.s);
r=await A('DELETE','/master/reminder-master/'+rid); t('reminder: delete again -> 404',r.s===404,r.s);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if(fails.length)console.log('FAILED:\n'+fails.join('\n'));
