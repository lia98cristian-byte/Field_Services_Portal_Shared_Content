(function(){
  'use strict';

  const embeddedCfg = {
    supabaseUrl: "https://uneifqxmhoyrlqqomshj.supabase.co",
    supabaseAnonKey: "sb_publishable_RO9YoOAHT51b-2V1Rs4pSA_o9cNEv1G",
    table: "portal_content",
    refreshSeconds: 30
  };
  const externalCfg = window.FIELD_SERVICES_SHARED_CONTENT || window.SHARED_CONTENT_CONFIG || {};
  const cfg = { ...embeddedCfg, ...externalCfg };

  const dialog=document.getElementById('add-content-dialog');
  const openBtn=document.getElementById('add-content-btn');
  const closeBtn=document.getElementById('close-add-content');
  const refreshBtn=document.getElementById('refresh-shared-content');
  const grid=document.getElementById('user-content-grid');
  const count=document.getElementById('added-content-count');
  const status=document.getElementById('shared-content-status');
  const form=document.getElementById('link-content-form');
  const workspaceNav=document.getElementById('content-workspace-nav');
  const workspaceSelect=document.getElementById('content-workspace');
  const newWorkspaceLabel=document.getElementById('new-workspace-label');
  const newWorkspaceInput=document.getElementById('new-workspace-name');
  const heading=document.getElementById('added-content-heading');
  const workspaceLabel=document.getElementById('added-content-workspace-label');

  let currentWorkspace='__all__';
  let allItems=[];
  let pollTimer=null;

  function configured(){
    const url=String(cfg.supabaseUrl||'').trim().replace(/\/$/,'');
    const key=String(cfg.supabaseAnonKey||'').trim();
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.length>20 && !key.includes('PASTE_YOUR_');
  }
  function apiUrl(query=''){
    const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
    const table=encodeURIComponent(cfg.table||'portal_content');
    return `${base}/rest/v1/${table}${query}`;
  }
  function headers(extra={}){
    return Object.assign({'apikey':cfg.supabaseAnonKey,'Authorization':`Bearer ${cfg.supabaseAnonKey}`,'Content-Type':'application/json'},extra);
  }
  function setStatus(text,state='ok'){if(status){status.textContent=text;status.dataset.state=state;}}
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function host(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch(e){return 'Link';}}
  function safeExternalUrl(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:'#';}catch(e){return '#';}}
  function normalizeKind(item){return ['video','photo','file'].includes(item.kind)?item.kind:'file';}
  function normalizeWorkspace(v){const s=String(v||'General').trim();return s||'General';}
  function iconFor(kind){return kind==='video'?'▶':kind==='photo'?'▧':'↗';}
  function tagFor(kind){return kind==='video'?'Video Link':kind==='photo'?'Photo Link':'File Link';}
  function openText(kind){return kind==='video'?'Open Video':kind==='photo'?'Open Photo':'Open File';}

  async function getItems(){
    const r=await fetch(apiUrl('?select=id,kind,title,url,description,workspace,created_at&order=created_at.desc'),{method:'GET',headers:headers({'Accept':'application/json'}),cache:'no-store'});
    if(!r.ok){
      const detail=await r.text().catch(()=> '');
      if(r.status===400 && /workspace/i.test(detail)) throw new Error('WORKSPACE_COLUMN_MISSING');
      throw new Error(`Load failed (${r.status}) ${detail}`);
    }
    return await r.json();
  }
  async function putItem(item){
    const r=await fetch(apiUrl(),{method:'POST',headers:headers({'Prefer':'return=representation'}),body:JSON.stringify(item)});
    if(!r.ok){const detail=await r.text().catch(()=> '');if(r.status===400&&/workspace/i.test(detail))throw new Error('WORKSPACE_COLUMN_MISSING');throw new Error(`Add failed (${r.status}) ${detail}`);}
    return await r.json();
  }
  async function removeItem(id){
    const r=await fetch(apiUrl(`?id=eq.${encodeURIComponent(id)}`),{method:'DELETE',headers:headers({'Prefer':'return=minimal'})});
    if(!r.ok) throw new Error(`Remove failed (${r.status})`);
  }

  function workspaceCounts(items){
    const map=new Map();
    for(const item of items){const w=normalizeWorkspace(item.workspace);map.set(w,(map.get(w)||0)+1);}
    return map;
  }
  function sortedWorkspaces(items){return [...workspaceCounts(items).keys()].sort((a,b)=>a.localeCompare(b));}

  function updateWorkspaceSelect(items){
    if(!workspaceSelect) return;
    const selected=workspaceSelect.value;
    const names=sortedWorkspaces(items);
    workspaceSelect.innerHTML='';
    const general=document.createElement('option');general.value='General';general.textContent='General';workspaceSelect.appendChild(general);
    for(const name of names){if(name==='General')continue;const o=document.createElement('option');o.value=name;o.textContent=name;workspaceSelect.appendChild(o);}
    const newOpt=document.createElement('option');newOpt.value='__new__';newOpt.textContent='＋ Create new workspace…';workspaceSelect.appendChild(newOpt);
    if([...workspaceSelect.options].some(o=>o.value===selected)) workspaceSelect.value=selected;
  }

  function renderWorkspaceNav(items){
    if(!workspaceNav) return;
    const counts=workspaceCounts(items);
    const names=[...counts.keys()].sort((a,b)=>a.localeCompare(b));
    workspaceNav.innerHTML='';
    const all=document.createElement('button');
    all.className='content-workspace-btn'+(currentWorkspace==='__all__'?' active':'');all.type='button';all.dataset.workspace='__all__';
    all.innerHTML=`<span>All Added Content</span><span class="count">${items.length}</span>`;workspaceNav.appendChild(all);
    for(const name of names){
      const b=document.createElement('button');b.className='content-workspace-btn'+(currentWorkspace===name?' active':'');b.type='button';b.dataset.workspace=name;
      b.innerHTML=`<span>${esc(name)}</span><span class="count">${counts.get(name)}</span>`;workspaceNav.appendChild(b);
    }
    workspaceNav.querySelectorAll('[data-workspace]').forEach(btn=>btn.addEventListener('click',()=>{
      currentWorkspace=btn.dataset.workspace;
      renderWorkspaceNav(allItems);
      renderCards();
      document.getElementById('added-content-heading')?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }

  function renderCards(){
    const items=currentWorkspace==='__all__'?allItems:allItems.filter(i=>normalizeWorkspace(i.workspace)===currentWorkspace);
    if(heading) heading.textContent=currentWorkspace==='__all__'?'Added Content':currentWorkspace;
    if(workspaceLabel) workspaceLabel.textContent=currentWorkspace==='__all__'?'All workspaces • Photos • files • video links':`${items.length} item${items.length===1?'':'s'} • Photos • files • video links`;
    if(!items.length){
      grid.innerHTML=`<div class="empty">${currentWorkspace==='__all__'?'No shared content has been added yet.':'No content is currently saved in this workspace.'} Use <b>＋ Add New Content</b> to add a video, photo, or file link.</div>`;
      return;
    }
    grid.innerHTML='';
    for(const item of items){
      const kind=normalizeKind(item), href=safeExternalUrl(item.url), workspace=normalizeWorkspace(item.workspace);
      const card=document.createElement('article');card.className='card user-content-card';
      card.innerHTML=`<div class="cardtop"><div class="icon content-icon">${iconFor(kind)}</div><div class="content-tags"><span class="tag">${tagFor(kind)}</span><span class="tag workspace-tag">${esc(workspace)}</span></div></div><h4>${esc(item.title)}</h4><p>${esc(item.description||'')}</p><div class="meta">${esc(host(item.url))}</div><div class="actions"><a class="btn primary" href="${esc(href)}" target="_blank" rel="noopener">${openText(kind)}</a><button class="btn danger-btn" type="button" data-delete="${esc(item.id)}">Remove</button></div>`;
      grid.appendChild(card);
    }
    grid.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',async()=>{
      if(!confirm('Remove this link from the shared portal for everyone? The original video, photo, or file will not be deleted.'))return;
      btn.disabled=true;setStatus('Removing…','busy');
      try{await removeItem(btn.dataset.delete);await renderContent(true);setStatus('Shared content updated','ok');}
      catch(err){console.error(err);btn.disabled=false;setStatus('Remove failed','error');alert('The shared link could not be removed. Check the shared-content database permissions.');}
    }));
  }

  async function renderContent(silent=false){
    if(!configured()){
      if(count)count.textContent='—';setStatus('Shared content setup required','warn');
      grid.innerHTML='<div class="empty">Shared content is ready but not connected yet. Configure <b>data/shared_content_config.js</b>.</div>';return;
    }
    if(!silent)setStatus('Refreshing…','busy');
    try{
      allItems=await getItems();
      if(count)count.textContent=allItems.length;
      const names=sortedWorkspaces(allItems);
      if(currentWorkspace!=='__all__' && !names.includes(currentWorkspace)) currentWorkspace='__all__';
      updateWorkspaceSelect(allItems);renderWorkspaceNav(allItems);renderCards();setStatus('Shared content synced','ok');
    }catch(err){
      console.error(err);setStatus('Shared content unavailable','error');
      if(err.message==='WORKSPACE_COLUMN_MISSING'){
        grid.innerHTML='<div class="empty"><b>Workspace setup required.</b><br>Run <b>SUPABASE_WORKSPACE_MIGRATION.sql</b> once in the Supabase SQL Editor, then refresh this page.</div>';
        alert('One-time workspace database update required. Run SUPABASE_WORKSPACE_MIGRATION.sql in Supabase, then refresh the website.');
      } else grid.innerHTML='<div class="empty">The shared content list could not be loaded. Check your internet connection and Supabase configuration.</div>';
    }
  }

  function closeDialog(){if(dialog&&dialog.open)dialog.close();}
  function syncNewWorkspaceVisibility(){
    const isNew=workspaceSelect?.value==='__new__';
    newWorkspaceLabel?.classList.toggle('hidden',!isNew);
    if(newWorkspaceInput){newWorkspaceInput.required=!!isNew;if(!isNew)newWorkspaceInput.value='';}
  }
  workspaceSelect?.addEventListener('change',syncNewWorkspaceVisibility);

  if(openBtn&&dialog)openBtn.addEventListener('click',()=>{
    if(!configured()){alert('Shared content configuration did not load. Refresh with Ctrl+F5 and verify data/shared_content_config.js.');return;}
    updateWorkspaceSelect(allItems);
    if(currentWorkspace!=='__all__' && [...workspaceSelect.options].some(o=>o.value===currentWorkspace)) workspaceSelect.value=currentWorkspace;
    else workspaceSelect.value='General';
    syncNewWorkspaceVisibility();dialog.showModal();
  });
  if(closeBtn)closeBtn.addEventListener('click',closeDialog);
  document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',closeDialog));
  dialog?.addEventListener('click',e=>{if(e.target===dialog)closeDialog();});
  refreshBtn?.addEventListener('click',()=>renderContent(false));

  form?.addEventListener('submit',async e=>{
    e.preventDefault();if(!configured())return;
    let workspace=workspaceSelect?.value||'General';
    if(workspace==='__new__'){
      workspace=String(newWorkspaceInput?.value||'').trim();
      if(!workspace){alert('Enter a name for the new workspace.');newWorkspaceInput?.focus();return;}
      if(workspace.length>60){alert('Workspace names must be 60 characters or fewer.');return;}
    }
    const type=document.getElementById('content-type').value;
    const title=document.getElementById('content-title').value.trim();
    const url=document.getElementById('content-url').value.trim();
    const description=document.getElementById('content-description').value.trim();
    let parsed;try{parsed=new URL(url);}catch(err){alert('Enter a valid link that starts with https:// or http://');return;}
    if(!['http:','https:'].includes(parsed.protocol)){alert('Only http:// or https:// links are supported.');return;}
    const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;setStatus('Adding…','busy');
    try{
      await putItem({kind:type,title,description,url:parsed.href,workspace});
      form.reset();currentWorkspace=workspace;syncNewWorkspaceVisibility();closeDialog();await renderContent(true);setStatus('Shared content updated','ok');
      document.getElementById('added-content-heading')?.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){
      console.error(err);setStatus('Add failed','error');
      if(err.message==='WORKSPACE_COLUMN_MISSING') alert('Run SUPABASE_WORKSPACE_MIGRATION.sql in Supabase once, then refresh the website.');
      else alert('The portal could not add this shared link. Check the Supabase setup and Row Level Security policies.');
    }finally{if(submit)submit.disabled=false;}
  });

  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')renderContent(true);});
  window.addEventListener('focus',()=>renderContent(true));
  renderContent(false);
  const seconds=Math.max(10,Number(cfg.refreshSeconds||30));
  pollTimer=setInterval(()=>renderContent(true),seconds*1000);
})();
