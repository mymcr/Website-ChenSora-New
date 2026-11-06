(async () => {
  const {escape, safeLink, body} = window.ChenSoraArticle;
  const article = document.getElementById('news-article');
  const recent = document.getElementById('recent-news');
  const id = new URLSearchParams(location.search).get('id');
  const image = value => /^(https?:\/\/|asset\/|uploads\/content\/)/i.test(value || '') && !value.includes('..') ? escape(value) : '';
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(value + 'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '';
  try {
    let data;
    try { const response = await fetch('content-api.php',{cache:'no-store'}); const result = await response.json(); if(!response.ok || result.status!=='success')throw Error(); data=result.data; }
    catch { const response=await fetch('asset/content-seed.json'); if(!response.ok)throw Error();data=await response.json(); }
    const news = (data.news || []).filter(item => item.published).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const current = news.find(item => item.id === id);
    if (!current) {
      document.title = 'Artikel tidak ditemukan — ChenSora';
      article.innerHTML = '<h1>Artikel tidak ditemukan</h1><p>Artikel ini belum tersedia atau tidak lagi dipublikasikan.</p><a href="index.html#jadwal-acara">Kembali ke Latest News</a>';
    } else {
      document.title = current.name + ' — ChenSora';
      document.querySelector('meta[name="description"]').content = current.description || current.name;
      article.innerHTML = `<a class="back-news" href="index.html#jadwal-acara">&#8592; Latest News</a>
        ${image(current.image) ? `<figure class="article-image"><img src="${image(current.image)}" alt="${escape(current.name)}" width="800" height="800" />${current.image_caption ? `<figcaption>${escape(current.image_caption)}</figcaption>` : ''}</figure>` : ''}
        <h1>${escape(current.name)}</h1><div class="article-meta"><time datetime="${escape(current.date || '')}">${escape(date(current.date))}</time>${current.source ? `<span>${escape(current.source)}</span>` : ''}</div>
        <div class="article-body">${body(current.description)}${body(current.body)}</div>
        ${safeLink(current.url) ? `<p class="article-source">Sumber / tautan terkait: <a href="${escape(safeLink(current.url))}" target="_blank" rel="noopener noreferrer">${escape(current.source || 'Baca selengkapnya')}</a></p>` : ''}`;
    }
    function renderRecent(query='') {
      const matching = news.filter(item => !query || (item.name+' '+item.description+' '+item.body).toLocaleLowerCase('id-ID').includes(query.toLocaleLowerCase('id-ID')));
      recent.innerHTML = matching.length ? matching.slice(0,8).map(item=>`<a class="recent-item" href="news.html?id=${encodeURIComponent(item.id)}">${image(item.image)?`<img src="${image(item.image)}" alt="" width="76" height="76" loading="lazy" />`:''}<span>${escape(item.name)}<small>${escape(date(item.date))}</small></span></a>`).join('') : '<p>Tidak ada berita yang cocok.</p>';
    }
    document.getElementById('article-search').addEventListener('submit',event=>{event.preventDefault();renderRecent(document.getElementById('search').value.trim());});
    document.getElementById('search').addEventListener('input',event=>renderRecent(event.target.value.trim()));
    renderRecent();
  } catch { article.innerHTML='<h1>Artikel belum dapat dimuat</h1><p>Silakan muat ulang halaman atau kembali ke <a href="index.html#jadwal-acara">Latest News</a>.</p>'; }
})();
