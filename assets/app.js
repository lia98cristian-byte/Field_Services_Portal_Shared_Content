const manifest=window.PORTAL_MANIFEST||[];
const excelLinks=window.EXCEL_ONLINE_LINKS||{};
const SHAREPOINT_FOLDER='https://stefaninilatam.sharepoint.com/sites/BaptistHealthSouthFlorida/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FBaptistHealthSouthFlorida%2FShared%20Documents%2FManagement&viewid=3ea48ea4%2D4da6%2D4dbc%2D8ff9%2D6e5d309eaa47&newTargetListUrl=%2Fsites%2FBaptistHealthSouthFlorida%2FShared%20Documents&viewpath=%2Fsites%2FBaptistHealthSouthFlorida%2FShared%20Documents%2FForms%2FAllItems%2Easpx';
const SHAREPOINT_SEARCH='https://stefaninilatam.sharepoint.com/sites/BaptistHealthSouthFlorida/_layouts/15/search.aspx/siteall?q=';
function storageKey(file){return 'sp-link:'+file;}
function exactLink(file){try{return localStorage.getItem(storageKey(file))||''}catch(e){return ''}}
function searchTerm(x){return (x.title||x.file||'').replace(/\(\d+\)(?=\.[^.]+$)/,'').replace(/\.[^.]+$/,'').trim();}
function workbookHref(x){return exactLink(x.file)||SHAREPOINT_SEARCH+encodeURIComponent(searchTerm(x));}
function workbookLabel(x){return exactLink(x.file)?'Open in Excel Online':'Find in SharePoint';}
function setWorkbookLink(file,title){const current=exactLink(file);const value=prompt('Paste the SharePoint “Copy link” URL for '+title+'.\n\nOnce saved, this workbook will open directly from the portal.', current||'');if(value===null)return;const v=value.trim();try{if(v)localStorage.setItem(storageKey(file),v);else localStorage.removeItem(storageKey(file));}catch(e){}render();}
window.setWorkbookLink=setWorkbookLink;
const isStatic=location.protocol==='file:';
const grid=document.querySelector('#grid');
const search=document.querySelector('#search');
const title=document.querySelector('#section-title');
const resultCount=document.querySelector('#result-count');
const libraryGrid=document.querySelector('#library-grid');
const libraryCount=document.querySelector('#library-count');
const uploadCount=document.querySelector('#upload-count');
let category='All';
let library=[];

const icons={'Performance & Reporting':'▦','Team & Staffing':'♟','Operations & Scheduling':'◫','Onboarding & Offboarding':'✓','Resources & Inventory':'⌘','Uploaded Content':'⬆'};
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fileIcon(type,name){const n=(name||'').toLowerCase();if((type||'').startsWith('image/'))return '▣';if((type||'').startsWith('video/'))return '▶';if(n.endsWith('.xlsx')||n.endsWith('.xls')||n.endsWith('.xlsm')||n.endsWith('.csv'))return '▦';if(n.endsWith('.pdf'))return 'PDF';return '◫'}

function renderWorkbooks(){
  const q=search.value.trim().toLowerCase();
  if(category==='Uploaded Content'){grid.innerHTML='';title.textContent='Uploaded Content';resultCount.textContent=`${library.length} item${library.length===1?'':'s'}`;return;}
  const items=manifest.filter(x=>(category==='All'||x.category===category)&&(!q||[x.title,x.description,x.file,x.category,...x.sheets.map(s=>s.name)].join(' ').toLowerCase().includes(q)));
  title.textContent=category==='All'?'All Workbooks':category;
  resultCount.textContent=`${items.length} workbook${items.length===1?'':'s'}`;
  grid.innerHTML=items.map(x=>`<article class="card"><div class="cardtop"><div class="icon">${icons[x.category]||'▦'}</div><span class="tag">${esc(x.category)}</span></div><h4>${esc(x.title)}</h4><p>${esc(x.description)}</p><div class="sheetlist">${x.sheets.slice(0,4).map(s=>`<span class="sheetpill" title="${esc(s.name)}">${esc(s.name)}</span>`).join('')}${x.sheets.length>4?`<span class="sheetpill">+${x.sheets.length-4} more</span>`:''}</div><div class="actions"><a class="btn primary" href="${esc(workbookHref(x))}" target="_blank" rel="noopener">${workbookLabel(x)}</a><button class="btn" type="button" onclick="setWorkbookLink('${esc(x.file).replace(/'/g,'&#39;')}','${esc(x.title).replace(/'/g,'&#39;')}')">${exactLink(x.file)?'Change link':'Set exact link'}</button></div></article>`).join('')||`<div class="empty">No workbooks match your search.</div>`;
}

function renderLibrary(){
  const q=search.value.trim().toLowerCase();
  const items=library.filter(x=>!q||[x.title,x.description,x.filename,x.category].join(' ').toLowerCase().includes(q));
  libraryCount.textContent=`${items.length} item${items.length===1?'':'s'}`;
  uploadCount.textContent=library.length;
  libraryGrid.innerHTML=items.map(x=>`<article class="card library-card"><div class="cardtop"><div class="icon file-icon">${fileIcon(x.mime,x.filename)}</div><span class="tag">${esc(x.category||'General')}</span></div><h4>${esc(x.title||x.filename)}</h4><p>${esc(x.description||'Shared portal resource')}</p><div class="meta">${esc(x.filename)}${x.uploaded_at?` • ${new Date(x.uploaded_at).toLocaleDateString()}`:''}</div><div class="actions">${/\.(xlsx|xls|xlsm)$/i.test(x.filename||'')?`<a class="btn primary" href="${esc(x.excel_online_url||x.url||'#')}" target="_blank" rel="noopener">Open in Excel Online</a>`:`<a class="btn primary" href="${esc(x.url)}" target="_blank" rel="noopener">Open file</a>`}</div></article>`).join('')||`<div class="empty">No uploaded content yet. Use <b>Add content</b> to add future Excel files, documents, photos, or videos.</div>`;
}

function render(){renderWorkbooks();renderLibrary();}
search.addEventListener('input',render);
document.querySelectorAll('.category-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.category-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');category=b.dataset.category;render()}));

async function loadLibrary(){
  if(isStatic){library=[];render();return;}
  try{const r=await fetch('/api/library',{cache:'no-store'});if(!r.ok)throw new Error();library=await r.json();}
  catch(e){library=[];}
  render();
}

const modal=document.querySelector('#upload-modal');
const form=document.querySelector('#upload-form');
const trigger=document.querySelector('#upload-trigger');
const closeBtn=document.querySelector('#upload-close');
const cancelBtn=document.querySelector('#upload-cancel');
function openModal(){modal.classList.add('open');modal.setAttribute('aria-hidden','false')}
function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true')}
trigger.onclick=()=>{if(isStatic){alert('The portal is open in simple browser mode. Excel links work normally.\n\nTo upload and permanently add future files, run START_PORTAL.bat on a computer with Python installed or deploy the portal to an approved web server.');return;}openModal();};closeBtn.onclick=closeModal;cancelBtn.onclick=closeModal;modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
form.addEventListener('submit',async e=>{
  e.preventDefault();
  const submit=form.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Uploading…';
  try{
    const r=await fetch('/api/upload',{method:'POST',body:new FormData(form)});
    if(!r.ok){const t=await r.text();throw new Error(t||'Upload failed');}
    form.reset();closeModal();await loadLibrary();
  }catch(err){alert('Upload is available when the portal is running with the included server.py.\n\n'+err.message)}
  finally{submit.disabled=false;submit.textContent='Upload'}
});

document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
loadLibrary();
