const manifest=window.PORTAL_MANIFEST||[];
const excelLinks=window.EXCEL_ONLINE_LINKS||{};
const SHAREPOINT_SEARCH='https://stefaninilatam.sharepoint.com/sites/BaptistHealthSouthFlorida/_layouts/15/search.aspx/siteall?q=';
const grid=document.querySelector('#grid');
const search=document.querySelector('#search');
const title=document.querySelector('#section-title');
const resultCount=document.querySelector('#result-count');
let category='All';
const icons={'Performance & Reporting':'▦','Team & Staffing':'♟','Operations & Scheduling':'◫','Onboarding & Offboarding':'✓','Resources & Inventory':'⌘'};
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function searchTerm(x){return (x.title||x.file||'').replace(/\(\d+\)(?=\.[^.]+$)/,'').replace(/\.[^.]+$/,'').trim();}
function storageKey(file){return 'sp-link:'+file;}
function exactLink(file){try{return localStorage.getItem(storageKey(file))||''}catch(e){return ''}}
function workbookHref(x){return exactLink(x.file)||excelLinks[x.file]||SHAREPOINT_SEARCH+encodeURIComponent(searchTerm(x));}
function workbookLabel(x){return (exactLink(x.file)||excelLinks[x.file])?'Open in Excel Online':'Find in SharePoint';}
function setWorkbookLink(file,title){const current=exactLink(file)||excelLinks[file]||'';const value=prompt('Paste the SharePoint “Copy link” URL for '+title+'.\n\nThis saves the link in this browser.',current);if(value===null)return;const v=value.trim();try{if(v)localStorage.setItem(storageKey(file),v);else localStorage.removeItem(storageKey(file));}catch(e){}render();}
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
