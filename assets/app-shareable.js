const manifest=window.PORTAL_MANIFEST||[];
const excelLinks=window.EXCEL_ONLINE_LINKS||{};
const SHAREPOINT_SEARCH='https://stefaninilatam.sharepoint.com/sites/BaptistHealthSouthFlorida/_layouts/15/search.aspx/siteall?q=';
const grid=document.querySelector('#grid');
const search=document.querySelector('#search');
const title=document.querySelector('#section-title');
const resultCount=document.querySelector('#result-count');
let category='All';
const icons={'Performance & Reporting':'▦','Team & Staffing':'♟','Operations & Scheduling':'◫','Onboarding & Offboarding':'✓','Resources & Inventory':'⌘'};
const embeddedSharedCfg={
  supabaseUrl:'https://uneifqxmhoyrlqqomshj.supabase.co',
  supabaseAnonKey:'sb_publishable_RO9YoOAHT51b-2V1Rs4pSA_o9cNEv1G',
  workbookLinksTable:'portal_workbook_links'
};
const sharedCfg={...embeddedSharedCfg,...(window.FIELD_SERVICES_SHARED_CONTENT||window.SHARED_CONTENT_CONFIG||{})};
let sharedWorkbookLinks={};
let workbookLinksReady=false;
let workbookPollTimer=null;

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function searchTerm(x){return (x.title||x.file||'').replace(/\(\d+\)(?=\.[^.]+$)/,'').replace(/\.[^.]+$/,'').trim();}
function sharedConfigured(){const u=String(sharedCfg.supabaseUrl||'').trim().replace(/\/$/,'');const k=String(sharedCfg.supabaseAnonKey||'').trim();return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(u)&&k.length>20;}
function sharedHeaders(extra={}){return Object.assign({'apikey':sharedCfg.supabaseAnonKey,'Authorization':`Bearer ${sharedCfg.supabaseAnonKey}`,'Content-Type':'application/json'},extra);}
function workbookApiUrl(query=''){const base=String(sharedCfg.supabaseUrl||'').replace(/\/$/,'');const table=encodeURIComponent(sharedCfg.workbookLinksTable||'portal_workbook_links');return `${base}/rest/v1/${table}${query}`;}
function exactLink(file){return sharedWorkbookLinks[file]||'';}
function workbookHref(x){return exactLink(x.file)||excelLinks[x.file]||SHAREPOINT_SEARCH+encodeURIComponent(searchTerm(x));}
function workbookLabel(x){return (exactLink(x.file)||excelLinks[x.file])?'Open in Excel Online':'Find in SharePoint';}

async function loadSharedWorkbookLinks(silent=true){
  if(!sharedConfigured()){workbookLinksReady=false;return;}
  try{
    const r=await fetch(workbookApiUrl('?select=file,url,updated_at&order=updated_at.desc'),{headers:sharedHeaders({'Accept':'application/json'}),cache:'no-store'});
    if(!r.ok){
      const detail=await r.text().catch(()=> '');
      if(r.status===404||/portal_workbook_links|relation .* does not exist/i.test(detail)) throw new Error('WORKBOOK_TABLE_MISSING');
      throw new Error(`Workbook links load failed (${r.status}) ${detail}`);
    }
    const rows=await r.json();
    const next={};
    for(const row of rows){if(row.file&&row.url&&!next[row.file])next[row.file]=row.url;}
    const changed=JSON.stringify(next)!==JSON.stringify(sharedWorkbookLinks);
    sharedWorkbookLinks=next;workbookLinksReady=true;
    if(changed||!silent)render();
  }catch(err){
    console.error(err);workbookLinksReady=false;
    if(!silent&&err.message==='WORKBOOK_TABLE_MISSING') alert('One-time setup required: run SUPABASE_WORKBOOK_LINKS.sql in Supabase, then refresh the website.');
  }
}

async function saveSharedWorkbookLink(file,title,url){
  if(!sharedConfigured())throw new Error('SHARED_CONFIG_MISSING');
  const payload={file,title,url,updated_at:new Date().toISOString()};
  const r=await fetch(workbookApiUrl('?on_conflict=file'),{method:'POST',headers:sharedHeaders({'Prefer':'resolution=merge-duplicates,return=representation'}),body:JSON.stringify(payload)});
  if(!r.ok){const detail=await r.text().catch(()=> '');if(r.status===404||/portal_workbook_links|relation .* does not exist/i.test(detail))throw new Error('WORKBOOK_TABLE_MISSING');throw new Error(`Workbook link save failed (${r.status}) ${detail}`);}
}
async function removeSharedWorkbookLink(file){
  const r=await fetch(workbookApiUrl(`?file=eq.${encodeURIComponent(file)}`),{method:'DELETE',headers:sharedHeaders({'Prefer':'return=minimal'})});
  if(!r.ok)throw new Error(`Workbook link remove failed (${r.status})`);
}

async function setWorkbookLink(file,title){
  const current=exactLink(file)||excelLinks[file]||'';
  const value=prompt('Paste the SharePoint “Copy link” URL for '+title+'.\n\nThis link will be shared with everyone using the portal.',current);
  if(value===null)return;
  const v=value.trim();
  if(v){try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol))throw new Error();}catch(e){alert('Enter a valid link that starts with https:// or http://');return;}}
  try{
    if(v) await saveSharedWorkbookLink(file,title,v); else await removeSharedWorkbookLink(file);
    await loadSharedWorkbookLinks(false);
    alert(v?'Workbook link updated for everyone.':'Shared workbook link removed for everyone.');
  }catch(err){
    console.error(err);
    if(err.message==='WORKBOOK_TABLE_MISSING') alert('One-time setup required: run SUPABASE_WORKBOOK_LINKS.sql in Supabase, then refresh the website.');
    else if(err.message==='SHARED_CONFIG_MISSING') alert('Shared content is not configured yet.');
    else alert('The workbook link could not be saved for everyone. Check the Supabase workbook-links setup and permissions.');
  }
}
window.setWorkbookLink=setWorkbookLink;

function render(){
 const q=search.value.trim().toLowerCase();
 const items=manifest.filter(x=>(category==='All'||x.category===category)&&(!q||[x.title,x.description,x.file,x.category,...x.sheets.map(s=>s.name)].join(' ').toLowerCase().includes(q)));
 title.textContent=category==='All'?'All Workbooks':category;
 resultCount.textContent=`${items.length} workbook${items.length===1?'':'s'}`;
 grid.innerHTML=items.map(x=>`<article class="card"><div class="cardtop"><div class="icon">${icons[x.category]||'▦'}</div><span class="tag">${esc(x.category)}</span></div><h4>${esc(x.title)}</h4><p>${esc(x.description)}</p><div class="sheetlist">${x.sheets.slice(0,4).map(s=>`<span class="sheetpill" title="${esc(s.name)}">${esc(s.name)}</span>`).join('')}${x.sheets.length>4?`<span class="sheetpill">+${x.sheets.length-4} more</span>`:''}</div><div class="actions"><a class="btn primary" href="${esc(workbookHref(x))}" target="_blank" rel="noopener">${workbookLabel(x)}</a><button class="btn" type="button" onclick="setWorkbookLink('${esc(x.file).replace(/'/g,'&#39;')}','${esc(x.title).replace(/'/g,'&#39;')}')">${exactLink(x.file)?'Change link':'Add link'}</button></div></article>`).join('')||`<div class="empty">No workbooks match your search.</div>`;
}
search.addEventListener('input',render);
document.querySelectorAll('.category-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.category-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');category=b.dataset.category;render()}));
document.querySelector('#share-btn').addEventListener('click',async e=>{e.preventDefault();const url=location.href;if(location.protocol==='file:'){alert('This copy is running from your computer. To share one clickable web address with other people, upload this folder to an approved web host such as Azure Static Web Apps, your company web server, GitHub Pages, Netlify, or Cloudflare Pages. See DEPLOY_SHAREABLE_WEBSITE.txt in the package.');return;}try{if(navigator.share){await navigator.share({title:document.title,url});}else{await navigator.clipboard.writeText(url);alert('Website link copied to your clipboard.');}}catch(err){}});
render();
loadSharedWorkbookLinks(false);
workbookPollTimer=setInterval(()=>loadSharedWorkbookLinks(true),10000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadSharedWorkbookLinks(true);});
window.addEventListener('focus',()=>loadSharedWorkbookLinks(true));
