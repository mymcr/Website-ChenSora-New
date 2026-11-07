(() => {
  const root = document.getElementById('beranda');
  const text = document.getElementById('hero-slide-text');
  const dots = document.getElementById('hero-dots');
  const previous = document.getElementById('hero-prev');
  const next = document.getElementById('hero-next');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let slides = [], images = [], buttons = [], index = 0, timer, hovering = false;
  function schedule() {
    clearInterval(timer);
    if (slides.length > 1 && !document.hidden && !reduced.matches && !hovering && !root.contains(document.activeElement)) timer = setInterval(() => show(index + 1), 5000);
  }
  function show(position) {
    if (!slides.length) return;
    index = (position + slides.length) % slides.length;
    images.forEach((image,i) => image.classList.toggle('active',i === index));
    buttons.forEach((button,i) => { button.classList.toggle('active',i === index); button.setAttribute('aria-current',String(i === index)); });
    const item = slides[index];
    const heading = document.createElement('h1');
    heading.className = 'text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight';
    heading.style.textAlign = 'left'; heading.textContent = item.name;
    if (item.accent) { const accent = document.createElement('span'); accent.style.color = '#7cd0ef'; accent.textContent = item.accent; heading.append(document.createElement('br'),accent); }
    const description = document.createElement('p');
    description.className = 'mt-6 text-lg md:text-xl text-slate-200 max-w-2xl leading-relaxed';
    description.style.textAlign = 'left'; description.textContent = item.description || '';
    text.replaceChildren(heading,description);
  }
  function render(items) {
    clearInterval(timer); slides = items || []; index = 0;
    root.querySelectorAll('.hero-slide').forEach(node => node.remove()); dots.replaceChildren();
    images = slides.map((item,i) => {
      const slide = document.createElement('div'); slide.className = 'hero-slide';
      if (/^(https?:\/\/|asset\/|uploads\/content\/)/i.test(item.image || '') && !item.image.includes('..')) {
        const image = document.createElement('img'); image.src = item.image; image.alt = item.name;
        if (i) image.loading = 'lazy'; else image.fetchPriority = 'high'; slide.append(image);
      }
      const overlay = document.createElement('div'); overlay.className = 'absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-800/50'; slide.append(overlay); root.prepend(slide); return slide;
    });
    buttons = slides.map((item,i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hero-dot';
      button.setAttribute('aria-label','Slide ' + (i+1) + ': ' + item.name);
      button.addEventListener('click',()=>{show(i);schedule();}); dots.append(button); return button;
    });
    previous.hidden = next.hidden = dots.hidden = slides.length < 2;
    root.hidden = slides.length === 0;
    show(0); schedule();
  }
  previous.addEventListener('click',()=>{show(index-1);schedule();}); next.addEventListener('click',()=>{show(index+1);schedule();});
  root.addEventListener('mouseenter',()=>{hovering=true;schedule();}); root.addEventListener('mouseleave',()=>{hovering=false;schedule();});
  root.addEventListener('focusin',schedule); root.addEventListener('focusout',()=>setTimeout(schedule,0));
  reduced.addEventListener('change',schedule); document.addEventListener('visibilitychange',schedule);
  window.ChenSoraHero = {render};
})();
