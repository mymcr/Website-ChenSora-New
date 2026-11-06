(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const url = value => {
    const text = String(value || '').trim();
    return /^(https?:\/\/|asset\/|uploads\/content\/)/i.test(text) && !text.includes('..') ? escape(text) : '';
  };
  const visible = list => (list || []).filter(row => row.published).sort((a,b) => (a.order || 0) - (b.order || 0));
  const newsMobile = window.matchMedia('(max-width: 767px)');
  let newsIndex = 0;
  function showNews(index) {
    const cards = [...document.querySelectorAll('.news-card')];
    newsIndex = cards.length ? (index + cards.length) % cards.length : 0;
    cards.forEach((card, i) => { card.hidden = newsMobile.matches && i !== newsIndex; });
  }
  newsMobile.addEventListener('change', () => showNews(newsIndex));
  function render(data) {
    const products = document.querySelector('.product-showcase');
    products.innerHTML = visible(data.products).map(item => `<article class="product-showcase-card">
      ${url(item.image) ? `<img class="product-showcase-image clickable-image" src="${url(item.image)}" alt="${escape(item.name)}" loading="lazy" />` : `<div class="product-showcase-image soca-guard-art"><i class="fas fa-shield-halved" aria-hidden="true"></i><span>${escape(item.name)}</span></div>`}
      <h3>${escape(item.name)}</h3><p>${escape(item.description)}</p>
      ${url(item.url) ? `<a class="product-showcase-link" href="${url(item.url)}" target="_blank" rel="noopener noreferrer">Pelajari Lebih Lanjut <span aria-hidden="true">&#8594;</span></a>` : ''}</article>`).join('');
    const experts = document.querySelector('.expert-collage');
    document.getElementById('expert-medis').classList.toggle('expert-grid-expanded', visible(data.experts).length > 11);
    experts.innerHTML = visible(data.experts).map((item,i) => `<figure class="expert-portrait expert-portrait-${i+1}" tabindex="0"><img src="${url(item.image)}" alt="${escape(item.name)}" loading="lazy" width="160" height="200" /><figcaption>${escape(item.name)}<small>${escape(item.description)}</small></figcaption></figure>`).join('');
    const merchants = document.querySelector('.merchant-grid');
    merchants.innerHTML = visible(data.merchants).map(item => `<div class="merchant-card"><div class="merchant-logo"><img src="${url(item.image)}" alt="Logo ${escape(item.name)}" loading="lazy" width="80" height="80" /></div><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p></div>`).join('');
    const news = visible(data.news).sort((a,b) => String(b.date).localeCompare(String(a.date)));
    document.getElementById('event-list-container').innerHTML = news.length ? news.map(item => `<article class="news-card">
      <div class="news-media">${url(item.image) ? `<img src="${url(item.image)}" alt="${escape(item.name)}" class="clickable-image" loading="lazy" />` : '<div class="news-image-empty" aria-hidden="true"></div>'}
      <div class="news-slide-controls"><button type="button" data-news-direction="-1" aria-label="Berita sebelumnya" ${news.length < 2 ? 'disabled' : ''}>&#8249;</button><button type="button" data-news-direction="1" aria-label="Berita berikutnya" ${news.length < 2 ? 'disabled' : ''}>&#8250;</button></div></div>
      ${item.image_caption ? `<p class="news-image-caption">${escape(item.image_caption)}</p>` : ''}
      <p class="news-date">${escape(item.date)}${item.source ? ' · ' + escape(item.source) : ''}</p><h3>${escape(item.name)}</h3><p class="news-excerpt">${escape(item.description)}</p>
      <a class="news-read-more" href="news.html?id=${encodeURIComponent(item.id)}">SELENGKAPNYA <span aria-hidden="true">&#8250;</span></a></article>`).join('') : '<p>Belum ada berita terbaru.</p>';
    showNews(0);
    window.AOS?.refresh();
  }
  // Delegation also handles images added by the content API.
  document.addEventListener('click', event => {
    const arrow = event.target.closest('[data-news-direction]');
    if (arrow) {
      showNews(newsIndex + Number(arrow.dataset.newsDirection));
      document.querySelector('.news-card:not([hidden]) [data-news-direction="' + arrow.dataset.newsDirection + '"]')?.focus({preventScroll:true});
      return;
    }
    if (!event.target.matches('.product-showcase .clickable-image, .news-card .clickable-image')) return;
    const modal = document.getElementById('image-modal');
    const image = document.getElementById('modal-img');
    image.src = event.target.src; image.alt = event.target.alt; modal.classList.remove('hidden');
  });
  async function load() {
    try {
      const response = await fetch('content-api.php', {cache:'no-store'});
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw Error('Content unavailable');
      render(result.data);
    } catch {
      // A static preview still shows the reviewed initial content.
      try { const response = await fetch('asset/content-seed.json'); if (response.ok) render(await response.json()); }
      catch { document.getElementById('event-list-container').textContent = 'Berita belum dapat dimuat. Silakan coba kembali.'; }
    }
  }
  load();
})();
