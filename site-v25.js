
(function(){
  const dict = {
    ja: {
      langButton: 'EN',
      navConcept: 'コンセプト', navFeatures: '機能', navRanking: 'ランキング', navApp: 'アプリを開く', navLogout: 'ログアウト',
      searchEyebrow: 'Wonderland Search',
      searchTitle: '今日はどんなワンダーランドに行こうかな？',
      searchPlaceholder: '例：親子で、夜に一杯、疲れている、昭和レトロ、練馬の畑',
      searchButton: '探す',
      searchHint: '気分や目的を入れると、意外な地元ワンダーランド＝ジモワンを提案します。',
      heroEyebrow: '知られていないことに価値がある',
      heroTitle: '遊園地がなくてもいい。<br>つなげば、そこは夢の場所になる。',
      heroLead: '地元ファンしか知らない、コアなドキドキを体験しよう。検索できない地元推しネタを、マップとランキングで遊ぶワンダーランドアプリです。',
      heroCta: 'ワンダーランドを体験する', heroMap: 'マップ例を見る', whatIsJimowan: 'ジモワンって何？'
    },
    en: {
      langButton: '日本語',
      navConcept: 'Concept', navFeatures: 'Features', navRanking: 'Ranking', navApp: 'Open App', navLogout: 'Logout',
      searchEyebrow: 'Wonderland Search',
      searchTitle: 'What kind of Wonderland shall we visit today?',
      searchPlaceholder: 'Try: family, a quiet night drink, retro town, local farms, feeling tired',
      searchButton: 'Search',
      searchHint: 'Enter your mood or purpose, and Jimowan will suggest unexpected local Wonderlands.',
      heroEyebrow: 'Hidden places have hidden value',
      heroTitle: 'You do not need an amusement park.<br>Connect what is already there, and it becomes a dream place.',
      heroLead: 'Experience the hidden thrills only local fans know. This app turns hard-to-search local discoveries into Wonderland maps and rankings.',
      heroCta: 'Try Wonderland', heroMap: 'View sample maps', whatIsJimowan: 'What is Jimowan?'
    }
  };
  function lang(){ return localStorage.getItem('jimowanLang') || 'ja'; }
  function apply(){
    const l = lang();
    document.documentElement.lang = l === 'en' ? 'en' : 'ja';
    document.querySelectorAll('[data-i18n]').forEach((el)=>{ const k=el.dataset.i18n; if(dict[l][k]) el.textContent = dict[l][k]; });
    document.querySelectorAll('[data-i18n-html]').forEach((el)=>{ const k=el.dataset.i18nHtml; if(dict[l][k]) el.innerHTML = dict[l][k]; });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el)=>{ const k=el.dataset.i18nPlaceholder; if(dict[l][k]) el.placeholder = dict[l][k]; });
    const btn = document.getElementById('langToggle'); if(btn) btn.textContent = dict[l].langButton;
  }
  function bindSearch(){
    const form = document.getElementById('landingSearchForm');
    if(!form) return;
    form.addEventListener('submit', (event)=>{
      event.preventDefault();
      const q = document.getElementById('landingSearchInput')?.value || '';
      localStorage.setItem('jimowanQuery', q);
      window.location.href = `/app?version=v25&q=${encodeURIComponent(q)}`;
    });
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('langToggle');
    btn?.addEventListener('click', ()=>{ localStorage.setItem('jimowanLang', lang()==='ja' ? 'en' : 'ja'); apply(); });
    apply(); bindSearch();
  });
})();
