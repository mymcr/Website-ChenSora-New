(() => {
  const $ = id => document.getElementById(id);
  const api = new URL('../content-api.php', location.href);
  const labels = {products:'Katalog Produk',experts:'Expert Medis',merchants:'Merchant Populer',news:'Latest News'};
  let data, csrf, version, group = 'products', dirty = false;
  function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
  function imageUrl(value) { return /^(https?:\/\/|asset\/|uploads\/content\/)/i.test(value || '') && !value.includes('..') ? new URL(value, new URL('../', location.href)).href : ''; }
  async function request(url, options = {}) {
    const response = await fetch(url, {credentials:'same-origin',...options});
    let result;
    try { result = await response.json(); } catch { throw Error('API PHP belum berjalan. Buka dashboard melalui server PHP, bukan server statis.'); }
    if (!response.ok || result.status !== 'success') { const error = Error(result.message || 'Permintaan gagal.'); error.status = response.status; throw error; }
    return result;
  }
  async function load() {
    try {
      const result = await request(api + '?admin=1'); data = result.data; csrf = result.csrf; version = result.version;
      $('workspace').hidden = false; $('login-panel').hidden = true; $('logout').hidden = false; render(); return true;
    } catch (error) { if (error.status === 401) { $('login-panel').hidden = false; $('workspace').hidden = true; $('logout').hidden = true; } else message(error.message,true); return false; }
  }
  function render() {
    $('list-title').textContent = labels[group]; $('items').replaceChildren();
    const rows = [...(data[group] || [])].sort((a,b) => a.order - b.order);
    if (!rows.length) $('items').textContent = 'Belum ada konten. Klik Tambah konten untuk memulai.';
    rows.forEach(item => {
      const article = document.createElement('article'); article.className = 'content-item';
      if (imageUrl(item.image)) { const image = document.createElement('img'); image.src = imageUrl(item.image); image.alt = item.name; article.append(image); }
      const text = document.createElement('div'); const name = document.createElement('h3'); name.textContent = item.name;
      const meta = document.createElement('p'); meta.textContent = `${item.published ? 'Tayang' : 'Draft'} · Urutan ${item.order}${item.date ? ' · '+item.date : ''}`; text.append(name,meta); article.append(text);
      const actions = document.createElement('span'); actions.className = 'item-actions';
      const edit = document.createElement('button'); edit.textContent = 'Edit'; edit.addEventListener('click',()=>editItem(item));
      const remove = document.createElement('button'); remove.textContent = 'Hapus'; remove.className = 'delete'; remove.addEventListener('click',async()=>{
        if (!confirm(`Hapus “${item.name}” dari ${labels[group]}?`)) return;
        remove.disabled = true;
        try { await mutate({action:'delete',group,item:{id:item.id}}); await load(); message('Konten dihapus.'); } catch(error){message(error.message,true);} finally{remove.disabled=false;}
      }); actions.append(edit,remove); article.append(actions); $('items').append(article);
    });
  }
  function editItem(item = {}) {
    if (dirty && !confirm('Abaikan perubahan yang belum disimpan?')) return;
    $('editor').reset(); $('item-id').value = item.id || '';
    for(const key of ['name','description','image','url','date','source','body','order']) $(key).value = item[key] ?? (key === 'order' ? (data[group] || []).length : '');
    $('image-caption').value = item.image_caption || ''; $('published').checked = item.published ?? true;
    document.querySelector('.news-fields').hidden = group !== 'news'; $('date').required = group === 'news';
    if(group==='news' && !item.date) $('date').value = new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
    $('editor-title').textContent = (item.id ? 'Edit ' : 'Tambah ') + labels[group]; $('editor').hidden = false; dirty = false;
    preview(item.image); $('name').focus();
  }
  function preview(value) { const src = imageUrl(value); $('image-preview').hidden = !src; if(src) $('image-preview').src = src; }
  async function mutate(payload) { return request(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,csrf,version})}); }
  $('login-form').addEventListener('submit',async event=>{
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try {
      const payload = JSON.stringify({email:$('email').value,password:$('password').value});
      try { await request(api+'?action=login',{method:'POST',headers:{'Content-Type':'application/json'},body:payload}); }
      catch(error) { if(error.status!==409) throw error; await request('../api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',email:$('email').value,password:$('password').value})}); }
      $('password').value=''; if(await load()) message('Login berhasil.');
    } catch(error){message(error.message,true);}finally{button.disabled=false;}
  });
  document.querySelectorAll('#tabs button').forEach(button=>button.addEventListener('click',()=>{
    if(dirty&&!confirm('Abaikan perubahan yang belum disimpan?'))return;
    dirty=false; group=button.dataset.group; $('editor').hidden=true;
    document.querySelectorAll('#tabs button').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button))); render();
  }));
  $('add').addEventListener('click',()=>editItem()); $('refresh').addEventListener('click',async()=>{if(dirty&&!confirm('Abaikan perubahan yang belum disimpan?'))return;dirty=false;$('editor').hidden=true;await load();});
  $('cancel').addEventListener('click',()=>{if(dirty&&!confirm('Abaikan perubahan yang belum disimpan?'))return;dirty=false;$('editor').hidden=true;});
  $('editor').addEventListener('input',()=>dirty=true); $('image').addEventListener('input',()=>preview($('image').value));
  $('file').addEventListener('change',()=>{const file=$('file').files[0];if(file){const temporary=URL.createObjectURL(file);$('image-preview').src=temporary;$('image-preview').hidden=false;$('image-preview').onload=()=>URL.revokeObjectURL(temporary);}});
  $('editor').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.submitter;button.disabled=true;
    try{
      const item={id:$('item-id').value,published:$('published').checked,order:Number($('order').value),image_caption:$('image-caption').value};
      for(const key of ['name','description','image','url','date','source','body'])item[key]=$(key).value;
      let file;const selected=$('file').files[0];if(selected){if(selected.size>5000000)throw Error('Gambar maksimum 5 MB.');const dataURL=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(selected);});file={base64:dataURL.split(',')[1]};}
      await mutate({action:'save',group,item,file});dirty=false;$('editor').hidden=true;await load();message('Konten tersimpan. Perubahan dapat dilihat di website.');
    }catch(error){message(error.message,true);}finally{button.disabled=false;}
  });
  $('logout').addEventListener('click',async()=>{try{await mutate({action:'logout'});dirty=false;$('editor').hidden=true;await load();message('Anda telah keluar.');}catch(error){message(error.message,true);}});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  load();
})();
