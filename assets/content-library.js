(function(){
  'use strict';

  const cfg = window.FIELD_SERVICES_SHARED_CONTENT || {};
  const dialog=document.getElementById('add-content-dialog');
  const openBtn=document.getElementById('add-content-btn');
  const closeBtn=document.getElementById('close-add-content');
  const refreshBtn=document.getElementById('refresh-shared-content');
  const grid=document.getElementById('user-content-grid');
  const count=document.getElementById('added-content-count');
  const status=document.getElementById('shared-content-status');
  const form=document.getElementById('link-content-form');

  let pollTimer=null;

  function configured(){
    return /^https:\/\/.+\.supabase\.co\/?$/i.test(String(cfg.supabaseUrl||'')) &&
      String(cfg.supabaseAnonKey||'').length > 20 &&
      !String(cfg.supabaseAnonKey||'').includes('PASTE_YOUR_');
  }

  function apiUrl(query=''){
    const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
    const table=encodeURIComponent(cfg.table||'portal_content');
    return `${base}/rest/v1/${table}${query}`;
  }

  function headers(extra={}){
    return Object.assign({
      'apikey': cfg.supabaseAnonKey,
      'Authorization': `Bearer ${cfg.supabaseAnonKey}`,
      'Content-Type': 'application/json'
    }, extra);
  }

  function setStatus(text, state='ok'){
    if(!status) return;
    status.textContent=text;
    status.dataset.state=state;
  }

  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function host(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch(e){return 'Link';}}
  function safeExternalUrl(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:'#';}catch(e){return '#';}}
  function normalizeKind(item){return ['video','photo','file'].includes(item.kind)?item.kind:'file';}
  function iconFor(kind){return kind==='video'?'▶':kind==='photo'?'▧':'↗';}
  function tagFor(kind){return kind==='video'?'Video Link':kind==='photo'?'Photo Link':'File Link';}
  function openText(kind){return kind==='video'?'Open Video':kind==='photo'?'Open Photo':'Open File';}

  async function getItems(){
    const r=await fetch(apiUrl('?select=id,kind,title,url,description,created_at&order=created_at.desc'),{
      method:'GET', headers:headers({'Accept':'application/json'}), cache:'no-store'
    });
    if(!r.ok) throw new Error(`Load failed (${r.status})`);
    return await r.json();
  }

  async function putItem(item){
    const r=await fetch(apiUrl(),{
      method:'POST',
      headers:headers({'Prefer':'return=representation'}),
      body:JSON.stringify(item)
    });
    if(!r.ok){
      const detail=await r.text().catch(()=> '');
      throw new Error(`Add failed (${r.status}) ${detail}`);
    }
    return await r.json();
  }

  async function removeItem(id){
    const r=await fetch(apiUrl(`?id=eq.${encodeURIComponent(id)}`),{
      method:'DELETE', headers:headers({'Prefer':'return=minimal'})
    });
    if(!r.ok) throw new Error(`Remove failed (${r.status})`);
  }

  async function renderContent(silent=false){
    if(!configured()){
      if(count) count.textContent='—';
      setStatus('Shared content setup required','warn');
      grid.innerHTML='<div class="empty">Shared content is ready but not connected yet. Configure <b>data/shared_content_config.js</b> using the included <b>SHARED_CONTENT_SETUP.txt</b> instructions.</div>';
      return;
    }

    if(!silent) setStatus('Refreshing…','busy');
    try{
      const items=await getItems();
      if(count) count.textContent=items.length;
      if(!items.length){
        grid.innerHTML='<div class="empty" id="user-content-empty">No shared content has been added yet. Use <b>＋ Add New Content</b> to add a video, photo, or file link for everyone.</div>';
      } else {
        grid.innerHTML='';
        for(const item of items){
          const kind=normalizeKind(item);
          const href=safeExternalUrl(item.url);
          const card=document.createElement('article');
          card.className='card user-content-card';
          card.innerHTML=`<div class="cardtop"><div class="icon content-icon">${iconFor(kind)}</div><span class="tag">${tagFor(kind)}</span></div><h4>${esc(item.title)}</h4><p>${esc(item.description||'')}</p><div class="meta">${esc(host(item.url))}</div><div class="actions"><a class="btn primary" href="${esc(href)}" target="_blank" rel="noopener">${openText(kind)}</a><button class="btn danger-btn" type="button" data-delete="${esc(item.id)}">Remove</button></div>`;
          grid.appendChild(card);
        }
        grid.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',async()=>{
          if(!confirm('Remove this link from the shared portal for everyone? The original video, photo, or file will not be deleted.')) return;
          btn.disabled=true;
          setStatus('Removing…','busy');
          try{
            await removeItem(btn.dataset.delete);
            await renderContent(true);
            setStatus('Shared content updated','ok');
          }catch(err){
            console.error(err);
            btn.disabled=false;
            setStatus('Remove failed','error');
            alert('The shared link could not be removed. Check the shared-content database configuration and permissions.');
          }
        }));
      }
      setStatus('Shared content synced','ok');
    }catch(err){
      console.error(err);
      setStatus('Shared content unavailable','error');
      grid.innerHTML='<div class="empty">The shared content list could not be loaded. Check your internet connection and <b>data/shared_content_config.js</b>.</div>';
    }
  }

  function closeDialog(){if(dialog&&dialog.open)dialog.close();}
  if(openBtn&&dialog) openBtn.addEventListener('click',()=>{
    if(!configured()){
      alert('Shared content is not connected yet. Configure data/shared_content_config.js first.');
      return;
    }
    dialog.showModal();
  });
  if(closeBtn) closeBtn.addEventListener('click',closeDialog);
  document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',closeDialog));
  dialog?.addEventListener('click',e=>{if(e.target===dialog)closeDialog();});
  refreshBtn?.addEventListener('click',()=>renderContent(false));

  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!configured()) return;
    const type=document.getElementById('content-type').value;
    const title=document.getElementById('content-title').value.trim();
    const url=document.getElementById('content-url').value.trim();
    const description=document.getElementById('content-description').value.trim();
    let parsed;
    try{parsed=new URL(url);}catch(err){alert('Enter a valid link that starts with https:// or http://');return;}
    if(!['http:','https:'].includes(parsed.protocol)){alert('Only http:// or https:// links are supported.');return;}
    const submit=form.querySelector('[type="submit"]');
    if(submit) submit.disabled=true;
    setStatus('Adding…','busy');
    try{
      await putItem({kind:type,title,description,url:parsed.href});
      form.reset();
      closeDialog();
      await renderContent(true);
      setStatus('Shared content updated','ok');
    }catch(err){
      console.error(err);
      setStatus('Add failed','error');
      alert('The portal could not add this shared link. Check the Supabase setup and Row Level Security policies.');
    }finally{
      if(submit) submit.disabled=false;
    }
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') renderContent(true);
  });
  window.addEventListener('focus',()=>renderContent(true));

  renderContent(false);
  const seconds=Math.max(10,Number(cfg.refreshSeconds||30));
  pollTimer=setInterval(()=>renderContent(true),seconds*1000);
})();
