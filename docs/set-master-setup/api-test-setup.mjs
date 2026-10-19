const B = process.env.BASE || 'http://localhost:3002/api';
const PW = 'Test#Pass1234';
let pass = 0, fail = 0; const fails = [];
const t = (name, ok, extra='') => { ok ? pass++ : (fail++, fails.push(name + ' ' + extra)); console.log((ok?'PASS ':'FAIL ') + name + (ok?'':' -> '+extra)); };
async function login(role){ const r = await fetch(B+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:role+'@test.local',password:PW})}); const j = await r.json(); return j.token || j.data?.token; }
const call = (tok) => async (m, p, body) => { const r = await fetch(B+p,{method:m,headers:{'content-type':'application/json',authorization:'Bearer '+tok},body:body===undefined?undefined:JSON.stringify(body)}); let j=null; try{ j=await r.json(); }catch{} return {s:r.status,j}; };
const roles = {}; for (const r of ['super_admin','project_manager','sales_executive','read_only_viewer']) roles[r] = call(await login(r));
const A = roles.super_admin, PM = roles.project_manager, SE = roles.sales_executive, RO = roles.read_only_viewer;
t('logins work', !!(await A('GET','/master/countries')).j?.success);
const U = Date.now().toString(36);

// ---- Simple lists: salutations, professions, nationalities, sources, banks
for (const [path, extra] of [['salutations',{}],['professions',{}],['nationalities',{}],['sources-of-enquiry',{description:'d'}],['banks',{ifsc_prefix:'HDFC',branch:'Main'}]]) {
  const n = path === 'salutations' ? 'T' + U : `T-${path}-${U}`; // salutations are limited to 20 characters
  let r = await A('POST','/master/'+path,{name:'  '+n+'  ',...extra});
  t(`${path}: add (trimmed)`, r.s===201 && r.j.data.name===n, JSON.stringify(r.j));
  const id = r.j?.data?.id;
  r = await A('POST','/master/'+path,{name:n.toUpperCase(),...extra}); t(`${path}: duplicate other case -> 409`, r.s===409, r.s);
  r = await A('POST','/master/'+path,{name:'   '}); t(`${path}: blank -> 400`, r.s===400, r.s);
  r = await A('POST','/master/'+path,{name:'a<b>'}); t(`${path}: markup -> 400`, r.s===400, r.s);
  r = await A('POST','/master/'+path,{name:'x'.repeat(300),...extra}); t(`${path}: 300-char name rejected (not 500)`, r.s>=400&&r.s<500, r.s);
  r = await PM('POST','/master/'+path,{name:n+'-pm',...extra}); t(`${path}: project_manager can add`, r.s===201, r.s); const pmid=r.j?.data?.id;
  r = await PM('DELETE','/master/'+path+'/'+pmid); t(`${path}: project_manager cannot delete`, r.s===403, r.s);
  r = await SE('POST','/master/'+path,{name:n+'-se'}); t(`${path}: sales_executive cannot add`, r.s===403, r.s);
  r = await RO('POST','/master/'+path,{name:n+'-ro'}); t(`${path}: read_only cannot add`, r.s===403, r.s);
  r = await RO('GET','/master/'+path); t(`${path}: read_only can list`, r.s===200, r.s);
  r = await A('PUT','/master/'+path+'/'+id,{name:n+'-renamed'}); t(`${path}: rename unused`, r.s===200 && r.j.data.name===n+'-renamed', JSON.stringify(r.j));
  r = await A('PUT','/master/'+path+'/'+id,{}); t(`${path}: empty update -> 400`, r.s===400, r.s);
  r = await A('PUT','/master/'+path+'/00000000-0000-0000-0000-000000000000',{name:'q'}); t(`${path}: update unknown id -> 404`, r.s===404, r.s);
  r = await A('DELETE','/master/'+path+'/not-a-uuid'); t(`${path}: delete bad uuid -> 400/404 not 500`, r.s===400||r.s===404, r.s);
  r = await A('DELETE','/master/'+path+'/'+id); t(`${path}: delete`, r.s===200, r.s);
  r = await A('DELETE','/master/'+path+'/'+id); t(`${path}: delete again -> 404`, r.s===404, r.s);
  r = await A('DELETE','/master/'+path+'/'+pmid); await 0;
  r = await A('GET','/master/'+path.replace(/^/,'')+'/../'+path); 
  r = await A('POST','/master/'+path.replace(/^(.)/, c=>c.toUpperCase()),{name:n+'-case'}); t(`${path}: URL upper-case does not bypass role guard (admin ok)`, [201,404,409].includes(r.s), r.s);
  r = await RO('POST','/master/'+path.replace(/^(.)/, c=>c.toUpperCase()),{name:n+'-case2'}); t(`${path}: URL upper-case blocked for read_only`, r.s===403||r.s===404, r.s);
}
// In-use guards are tested for real in api-test-deep.mjs
// ---- Locations
const c = `Country-${U}`; let r = await A('POST','/master/countries',{name:c,code:'TC'}); t('country: add', r.s===201, JSON.stringify(r.j)); const cid=r.j?.data?.id;
r = await A('POST','/master/states',{name:'S-'+U}); t('state: no country -> 400', r.s===400, r.s);
r = await A('POST','/master/states',{name:'S-'+U,country_id:'00000000-0000-0000-0000-000000000000'}); t('state: unknown country -> 4xx not 500', r.s>=400&&r.s<500, r.s);
r = await A('POST','/master/states',{name:'S-'+U,country_id:cid}); t('state: add', r.s===201, JSON.stringify(r.j)); const sid=r.j?.data?.id;
r = await A('POST','/master/states',{name:('S-'+U).toLowerCase(),country_id:cid}); t('state: duplicate in same country -> 409', r.s===409, r.s);
r = await A('POST','/master/countries',{name:c+'2'}); const c2=r.j?.data?.id;
r = await A('POST','/master/states',{name:'S-'+U,country_id:c2}); t('state: same name in another country allowed', r.s===201, r.s); const s2=r.j?.data?.id;
r = await A('POST','/master/cities',{name:'Ci-'+U}); t('city: no state -> 400', r.s===400, r.s);
r = await A('POST','/master/cities',{name:'Ci-'+U,state_id:sid}); t('city: add', r.s===201, JSON.stringify(r.j)); const ciid=r.j?.data?.id;
r = await A('GET','/master/cities?state_id='+sid); t('city: filter by state', r.j?.data?.length===1 && r.j.data[0].state_name, JSON.stringify(r.j).slice(0,150));
r = await A('GET','/master/states?country_id='+cid); t('state: filter by country', r.j?.data?.length===1 && r.j.data[0].country_name===c, '');
r = await A('DELETE','/master/countries/'+cid); t('country with states cannot be deleted -> 409', r.s===409, r.s);
r = await A('DELETE','/master/states/'+sid); t('state with cities cannot be deleted -> 409', r.s===409, r.s);
r = await A('PUT','/master/cities/'+ciid,{state_id:null}); t('city: update to blank state -> 400', r.s===400, r.s);
r = await A('DELETE','/master/cities/'+ciid); t('city: delete', r.s===200, r.s);
r = await A('DELETE','/master/states/'+sid); t('state: delete once empty', r.s===200, r.s);
r = await A('DELETE','/master/states/'+s2); r = await A('DELETE','/master/countries/'+cid); t('country: delete once empty', r.s===200, r.s); await A('DELETE','/master/countries/'+c2);
r = await A('GET','/master/usage'); t('usage endpoint responds', r.s===200, r.s);

// ---- Companies
const cn = `Co-${U}`; r = await A('POST','/companies',{name:cn,code:'C'+U.slice(-4).toUpperCase()}); t('company: create', r.s===201||r.s===200, JSON.stringify(r.j).slice(0,200)); const coid=r.j?.data?.id||r.j?.id;
r = await A('POST','/companies',{name:cn}); t('company: duplicate name rejected', r.s===409||r.s===400, r.s);
r = await PM('POST','/companies',{name:cn+'pm'}); t('company: project_manager cannot create', r.s===403, r.s);
r = await SE('GET','/companies'); t('company: signed-in can list', r.s===200, r.s);
for (const [f,bad] of [['gstin','123'],['pan_no','BAD'],['cin','x'],['pin_code','12'],['email','nope'],['phone','ab']]) { r = await A('PUT','/companies/'+coid,{[f]:bad}); t(`company: bad ${f} -> 400`, r.s===400, r.s+' '+JSON.stringify(r.j).slice(0,100)); }
r = await A('PUT','/companies/'+coid,{gstin:'06abcde1234f1z5',pan_no:'abcde1234f'}); t('company: valid GSTIN/PAN saved in capitals', r.s===200, r.s+JSON.stringify(r.j).slice(0,120));
r = await A('GET','/companies/'+coid); t('company: stored upper-case', JSON.stringify(r.j).includes('06ABCDE1234F1Z5'), JSON.stringify(r.j).slice(0,200));
r = await A('PUT','/companies/'+coid,{address1:'<script>x</script>'}); t('company: markup rejected', r.s===400, r.s);
r = await A('PUT','/companies/'+coid,{address1:'Line 1'}); r = await A('PUT','/companies/'+coid,{address1:''}); r = await A('GET','/companies/'+coid); t('company: field can be cleared', !JSON.stringify(r.j).includes('Line 1'), '');
r = await A('PUT','/companies/'+coid,{name:''}); t('company: blank name -> 400', r.s===400, r.s);
r = await A('GET','/companies/not-a-uuid'); t('company: bad id -> 400/404', r.s===400||r.s===404, r.s);
// bank accounts
r = await A('POST',`/companies/${coid}/bank-accounts`,{bankName:'HDFC',accountNumber:'123456789012',ifscCode:'HDFC0001234'}); t('bank acct: add (first is primary)', r.s===201||r.s===200, JSON.stringify(r.j).slice(0,200)); const b1=r.j?.data?.id;
r = await A('POST',`/companies/${coid}/bank-accounts`,{bankName:'ICICI',accountNumber:'999988887777',ifscCode:'bad'}); t('bank acct: bad IFSC -> 400', r.s===400, r.s);
r = await A('POST',`/companies/${coid}/bank-accounts`,{bankName:'',accountNumber:''}); t('bank acct: required fields -> 400', r.s===400, r.s);
r = await PM('POST',`/companies/${coid}/bank-accounts`,{bankName:'X',accountNumber:'1'}); t('bank acct: project_manager blocked', r.s===403, r.s);
r = await A('POST',`/companies/${coid}/bank-accounts`,{bankName:'ICICI',accountNumber:'999988887777',ifscCode:'ICIC0000001'}); const b2=r.j?.data?.id;
r = await A('GET',`/companies/${coid}/bank-accounts`); t('bank acct: list has 2, exactly 1 primary', r.j?.data?.length===2 && r.j.data.filter(x=>x.is_primary).length===1, JSON.stringify(r.j).slice(0,250));
r = await A('DELETE',`/companies/${coid}/bank-accounts/${b1}`); t('bank acct: primary cannot be deleted while others exist', r.s>=400&&r.s<500, r.s);
r = await A('PATCH',`/companies/${coid}/bank-accounts/${b2}`,{isPrimary:true}); t('bank acct: switch primary', r.s===200, r.s);
r = await A('GET',`/companies/${coid}/bank-accounts`); t('bank acct: still exactly 1 primary after switch', r.j.data.filter(x=>x.is_primary).length===1, '');
r = await A('PATCH',`/companies/${coid}/bank-accounts/${b2}`,{isPrimary:'false'}); t('bank acct: is_primary text "false" rejected', r.s===400, r.s);
r = await A('DELETE',`/companies/${coid}/bank-accounts/${b1}`); t('bank acct: non-primary delete', r.s===200, r.s);
// ---- audit
r = await A('GET','/master/countries'); 
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if (fails.length) console.log('FAILED:\n' + fails.join('\n'));
