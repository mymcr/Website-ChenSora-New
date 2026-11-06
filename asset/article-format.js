(function(root) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function safeLink(value) {
    try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  }
  // Content remains plain text; only explicit HTTP(S) links become markup.
  function inline(value) {
    const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>]+/g;
    let result = '', offset = 0;
    for (const match of String(value).matchAll(pattern)) {
      result += escape(value.slice(offset, match.index));
      const raw = match[2] || match[0].replace(/[.,;!?]+$/, '');
      const link = safeLink(raw);
      result += link ? `<a href="${escape(link)}" target="_blank" rel="noopener noreferrer">${escape(match[1] || raw)}</a>` : escape(match[0]);
      if (!match[2]) result += escape(match[0].slice(raw.length));
      offset = match.index + match[0].length;
    }
    return result + escape(value.slice(offset));
  }
  function body(value) { return String(value || '').split(/\n\s*\n/).filter(text => text.trim()).map(text => '<p>' + inline(text).replace(/\n/g,'<br />') + '</p>').join(''); }
  const api = {escape,safeLink,inline,body};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChenSoraArticle = api;
})(globalThis);
