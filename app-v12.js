
// JIMOWAN ACTUAL MAP VERSION v8 - direct map tile renderer
window.JIMOWAN_APP_VERSION = 'v12-map-photo-link';
window.addEventListener('error', function(e) {
  const map = document.getElementById('map');
  if (map && !map.textContent.trim()) {
    map.innerHTML = '<div class="stable-map-empty"><strong>実地図タイル版 v12</strong><br>表示処理でエラーが発生しました。Ctrl+F5で再読み込みしてください。</div>';
  }
});
const state = {
  wonderlands: [],
  currentId: null,
  selectedLocality: localStorage.getItem('jimowanLocality') || '練馬区'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error('ログインが必要です。');
  }
  if (!response.ok) throw new Error(data.error || '通信に失敗しました。');
  return data;
}

function showNotice(message, type = 'ok') {
  const notice = $('#notice');
  notice.textContent = message;
  notice.className = `notice show ${type === 'error' ? 'error' : ''}`;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    notice.className = 'notice';
  }, 4000);
}

function yenLike(n) {
  return Number(n || 0).toLocaleString('ja-JP');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildPlaceQuery(spot, wonderland) {
  return [spot?.name || '', wonderland?.area || '', '日本'].filter(Boolean).join(' ');
}

function buildMapSearchUrl(spot, wonderland) {
  const q = buildPlaceQuery(spot, wonderland);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const LOCALITY_RULES = [
  { label: '練馬区', regex: /練馬|光が丘|石神井|江古田|豊島園|春日町|平和台|氷川台|桜台|大泉|上石神井|武蔵関|高野台|北町|中村橋|富士見台|小竹向原/ },
  { label: '宇都宮市', regex: /宇都宮|大谷資料館|LRT|餃子|ジャズバー|兜焼き/ },
  { label: '茂木町', regex: /茂木|もてぎ|ホンダコレクション|レース場/ },
  { label: '真岡市', regex: /真岡/ },
  { label: '調布市', regex: /調布|仙川|武者小路実篤|Sengawa/ },
  { label: '川越市', regex: /川越|COEDO|蔵造り|喜多院/ },
  { label: '中央区', regex: /東京都中央区|中央区新川|新川|茅場町|八丁堀/ },
  { label: '朝霞市', regex: /朝霞/ },
  { label: '北九州市八幡西区', regex: /北九州|八幡西|黒崎/ },
  { label: '堺市北区', regex: /堺|白鷺|百舌鳥|ため池|古墳/ },
  { label: '札幌市中央区', regex: /札幌市中央区|札幌駅|時計台|NEIGHBOUR|ススキノ|中央ローン/ },
  { label: '札幌市北区', regex: /札幌市北区|北大|北海道大学|北大博物館|北大生協|ポプラ並木/ },
  { label: '高浜市', regex: /高浜|三河高浜|瓦|鬼|土管/ },
  { label: '三鷹市', regex: /三鷹|国立天文台|STAYFUL|NTT技術史料館/ },
  { label: '武蔵野市', regex: /武蔵野/ },
  { label: '船橋市', regex: /船橋|船橋日大前|坪井|北習志野/ },
  { label: '世田谷区', regex: /世田谷|下北沢|北沢|代田/ },
  { label: '豊島区', regex: /豊島区|トキワ荘|南長崎/ }
];

function rawWonderlandText(w) {
  return [
    w?.title, w?.area, w?.locality, ...(w?.localities || []),
    ...(w?.tags || []), ...((w?.spots || []).flatMap((s) => [s.name, s.notes]))
  ].filter(Boolean).join(' ');
}

function inferLocalityFromText(text) {
  const hit = LOCALITY_RULES.find((rule) => rule.regex.test(String(text || '')));
  return hit ? hit.label : '';
}

function getWonderlandLocalities(w) {
  if (Array.isArray(w.localities) && w.localities.length) return [...new Set(w.localities.filter(Boolean))];
  if (w.locality) return [w.locality];
  const text = rawWonderlandText(w);
  const hits = LOCALITY_RULES.filter((rule) => rule.regex.test(text)).map((rule) => rule.label);
  return hits.length ? [...new Set(hits)] : ['その他'];
}

function getLocalityOptions() {
  const order = ['練馬区', '宇都宮市', '茂木町', '真岡市', '調布市', '川越市', '中央区', '朝霞市', '北九州市八幡西区', '堺市北区', '札幌市中央区', '札幌市北区', '高浜市', '三鷹市', '武蔵野市', '船橋市', '世田谷区', '豊島区'];
  const set = new Set();
  state.wonderlands.forEach((w) => getWonderlandLocalities(w).forEach((loc) => set.add(loc)));
  const known = order.filter((loc) => set.has(loc));
  const rest = [...set].filter((loc) => !order.includes(loc)).sort((a, b) => a.localeCompare(b, 'ja'));
  return ['すべて', ...known, ...rest];
}

function matchesLocality(w, locality = state.selectedLocality) {
  if (!locality || locality === 'すべて') return true;
  return getWonderlandLocalities(w).includes(locality);
}

function availableWonderlands() {
  return state.wonderlands.filter((w) => matchesLocality(w));
}

function setSelectedLocality(locality) {
  const options = getLocalityOptions();
  state.selectedLocality = options.includes(locality) ? locality : (options.includes('練馬区') ? '練馬区' : options[0]);
  localStorage.setItem('jimowanLocality', state.selectedLocality);
}

function renderLocalitySelector() {
  const select = $('#localitySelect');
  if (!select) return;
  const options = getLocalityOptions();
  if (!options.includes(state.selectedLocality)) setSelectedLocality(options.includes('練馬区') ? '練馬区' : options[0]);
  select.innerHTML = options.map((loc) => `<option value="${escapeHtml(loc)}">${escapeHtml(loc === 'すべて' ? 'すべての区・市町' : loc)}</option>`).join('');
  select.value = state.selectedLocality;
  const list = availableWonderlands();
  const count = $('#localityCount');
  if (count) count.textContent = `${state.selectedLocality === 'すべて' ? '全地域' : state.selectedLocality}：${list.length}件のワンダーランド`;
}


function setActiveTab(tabName) {
  $$('.tab-button, .plain-button').forEach((button) => {
    if (!button.dataset.tabTarget) return;
    button.classList.toggle('active', button.dataset.tabTarget === tabName);
  });
  $$('.tab-panel').forEach((panel) => panel.classList.remove('active'));
  $(`#tab-${tabName}`)?.classList.add('active');
  if (tabName === 'map') {
    setTimeout(() => renderMap(), 80);
  }
}

async function loadWonderlands() {
  const data = await api('/api/wonderlands');
  state.wonderlands = data.wonderlands || [];
  if (state.wonderlands[0]) {
    setSelectedLocality(state.selectedLocality);
    const firstInLocality = availableWonderlands()[0];
    if (!state.currentId || !matchesLocality(state.wonderlands.find((w) => w.id === state.currentId) || {})) {
      state.currentId = (firstInLocality || state.wonderlands[0]).id;
    }
  }
  renderAll();
}

function renderAll() {
  renderLocalitySelector();
  renderSelects();
  renderDiscover();
  renderSearchResults();
  renderLocalitySpotBank();
  renderRanking();
  renderMap();
}

function renderSelects() {
  const list = availableWonderlands();
  const options = list.map((w) => `<option value="${escapeHtml(w.id)}">${w.rank}位：${escapeHtml(w.title)}</option>`).join('');
  ['discoverSelect', 'voteWonderland', 'mapSelect'].forEach((id) => {
    const select = $(`#${id}`);
    if (!select) return;
    const previous = select.value || state.currentId;
    select.innerHTML = options;
    select.value = list.some((w) => w.id === previous) ? previous : (list[0]?.id || state.currentId || '');
  });
}

function getSelectedWonderland(selectId = 'discoverSelect') {
  const id = $(`#${selectId}`)?.value || state.currentId || state.wonderlands[0]?.id;
  const list = availableWonderlands();
  return list.find((w) => w.id === id) || list[0] || state.wonderlands[0];
}

function textOfWonderland(w) {
  return [
    w.title, w.area, w.creator, w.catchCopy, w.description,
    ...(w.tags || []),
    ...((w.spots || []).flatMap((s) => [s.name, s.notes]))
  ].join(' ').toLowerCase();
}

function isNerimaWonderland(w) {
  const text = textOfWonderland(w);
  return /(練馬|江古田|石神井|光が丘|大泉|豊島園|春日町|平和台|氷川台|桜台|北町|早宮|上石神井|武蔵関|高野台|中村橋|富士見台|小竹向原)/.test(text);
}

function isTokyoNearbyWonderland(w) {
  const text = textOfWonderland(w);
  return /(東京都|練馬|江古田|石神井|光が丘|大泉|調布|仙川|中央区|新川|三鷹|世田谷|下北沢|豊島区|トキワ荘)/.test(text);
}

function normalizeQuery(value) {
  return String(value || '').trim().toLowerCase();
}

function queryTokens(query) {
  return normalizeQuery(query)
    .split(/[\s　,、。・/／]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

const SEARCH_INTENTS = [
  { keys: ['疲れ','疲れて','癒し','温泉','銭湯','休み','まったり','リラックス','雨'], boost: ['温泉','銭湯','庭園','公園','癒し','まったり','自然'] },
  { keys: ['親子','子供','子ども','キッズ','家族','無料'], boost: ['親子','子供','ファミリー','無料','乗り物','公園'] },
  { keys: ['夜','酒','飲み','一杯','バー','ジャズ','部室'], boost: ['夜','酒場','ジャズ','バー','部室','音楽','珈琲'] },
  { keys: ['昭和','レトロ','サブカル','マンガ','アニメ','喫茶'], boost: ['昭和レトロ','サブカル','マンガ','アニメ','喫茶','江古田'] },
  { keys: ['畑','農','野菜','ファーム','大根','収穫'], boost: ['都市農業','野菜','ファーム','体験','練馬'] },
  { keys: ['食','ランチ','麺','ラーメン','うどん','グルメ','安い'], boost: ['グルメ','麺','食','高コスパ','酒場'] },
  { keys: ['静か','文学','文化','歴史','自然','池','公園'], boost: ['文化','歴史','自然','文学','公園','石神井'] },
  { keys: ['意外','知らない','ドキドキ','初体験','変わった'], boost: ['意外','どきどき','初体験','サブカル','都市農業','昭和レトロ'] }
];

function recommendationScore(w, query) {
  const text = textOfWonderland(w);
  const tokens = queryTokens(query);
  const ranking = w.ranking || { avgUnknown: 0, avgSurprise: 0, avgTry: 0, total: 0 };
  let score = (Number(ranking.avgUnknown || 0) * 2.2) + (Number(ranking.avgSurprise || 0) * 2.8) + (Number(ranking.avgTry || 0) * 1.6);
  if (isNerimaWonderland(w)) score += 12;
  if (!tokens.length) {
    score += isNerimaWonderland(w) ? 10 : 0;
    return score;
  }
  tokens.forEach((token) => {
    if (text.includes(token)) score += 22;
    if ((w.title || '').toLowerCase().includes(token)) score += 18;
    if ((w.tags || []).some((tag) => String(tag).toLowerCase().includes(token))) score += 14;
  });
  SEARCH_INTENTS.forEach((intent) => {
    if (intent.keys.some((key) => query.includes(key))) {
      intent.boost.forEach((b) => {
        if (text.includes(String(b).toLowerCase())) score += 12;
      });
    }
  });
  return score;
}

function explainRecommendation(w, query) {
  const text = textOfWonderland(w);
  const reasons = [];
  if (isNerimaWonderland(w)) reasons.push('練馬文脈');
  SEARCH_INTENTS.forEach((intent) => {
    if (intent.keys.some((key) => query.includes(key))) {
      const hit = intent.boost.find((b) => text.includes(String(b).toLowerCase()));
      if (hit) reasons.push(hit);
    }
  });
  (w.tags || []).slice(0, 3).forEach((tag) => {
    if (!reasons.includes(tag)) reasons.push(tag);
  });
  const ranking = w.ranking || {};
  if (Number(ranking.avgSurprise || 0) >= 4.8) reasons.push('予想外度高め');
  if (Number(ranking.avgUnknown || 0) >= 4.8) reasons.push('知らなかった度高め');
  return reasons.slice(0, 5).join(' / ');
}


function renderLocalitySpotBank() {
  const target = $('#localitySpotBank');
  if (!target) return;
  const list = availableWonderlands();
  const rows = [];
  list.forEach((w) => {
    (w.spots || []).forEach((spot, index) => {
      rows.push({ w, spot, index });
    });
  });
  const label = state.selectedLocality === 'すべて' ? '全地域' : state.selectedLocality;
  target.innerHTML = `
    <div class="spot-bank-header">
      <div>
        <p class="eyebrow">Local Spots</p>
        <h3>${escapeHtml(label)}のスポット一覧</h3>
        <p>${escapeHtml(label)}に紐づくワンダーランドだけからスポットを選べます。</p>
      </div>
      <strong>${rows.length}スポット</strong>
    </div>
    <div class="local-spot-grid">
      ${rows.map(({ w, spot, index }) => `
        <button type="button" class="local-spot-button" data-id="${escapeHtml(w.id)}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(spot.name)}</strong>
          <small>${escapeHtml(w.title)}</small>
        </button>
      `).join('') || '<p class="empty-row">この区・市町のスポットはまだありません。</p>'}
    </div>`;
  $$('.local-spot-button', target).forEach((button) => {
    button.addEventListener('click', () => {
      state.currentId = button.dataset.id;
      ['discoverSelect', 'mapSelect', 'voteWonderland'].forEach((id) => { const el = $(`#${id}`); if (el) el.value = state.currentId; });
      renderDiscover();
      renderMap();
      showNotice(`${label}のスポットからワンダーランドを表示しました。`);
    });
  });
}

function renderSearchResults() {
  const target = $('#searchResults');
  if (!target) return;
  const query = normalizeQuery($('#freeSearchInput')?.value || '');
  const list = availableWonderlands()
    .map((w) => ({ ...w, recommendScore: recommendationScore(w, query) }))
    .sort((a, b) => b.recommendScore - a.recommendScore)
    .slice(0, 5);
  const areaLabel = state.selectedLocality === 'すべて' ? '全地域' : state.selectedLocality;
  const title = query ? `${escapeHtml(areaLabel)}で「${escapeHtml(query)}」から見つけた意外な候補` : `${escapeHtml(areaLabel)}の意外性の高い候補`;
  target.innerHTML = `
    <h3>${title}</h3>
    <div class="recommend-grid">
      ${list.map((w, index) => `
        <article class="recommend-card">
          <span class="recommend-rank">${index + 1}</span>
          <strong>${escapeHtml(w.title)}</strong>
          <p>${escapeHtml(w.catchCopy || w.description || '')}</p>
          <small>${escapeHtml(explainRecommendation(w, query))}</small>
          <button class="button secondary small choose-recommend" type="button" data-id="${escapeHtml(w.id)}">このジモワンを見る</button>
        </article>
      `).join('')}
    </div>`;
  $$('.choose-recommend', target).forEach((button) => {
    button.addEventListener('click', () => {
      state.currentId = button.dataset.id;
      ['discoverSelect','mapSelect','voteWonderland'].forEach((id) => { const el = $(`#${id}`); if (el) el.value = state.currentId; });
      renderDiscover();
      renderMap();
      showNotice('検索結果からワンダーランドを表示しました。');
    });
  });
}

function filteredRankingList() {
  const scope = $('#rankingScope')?.value || 'nerima';
  const filter = normalizeQuery($('#rankingFilter')?.value || '');
  let list = [...state.wonderlands];
  if (state.selectedLocality && state.selectedLocality !== 'すべて') {
    list = list.filter((w) => matchesLocality(w));
  } else {
    if (scope === 'nerima') list = list.filter(isNerimaWonderland);
    if (scope === 'tokyo') list = list.filter(isTokyoNearbyWonderland);
  }
  if (filter) {
    const tokens = queryTokens(filter);
    list = list.filter((w) => tokens.every((token) => textOfWonderland(w).includes(token)));
  }
  return list.sort((a, b) => {
    if (b.ranking.total !== a.ranking.total) return b.ranking.total - a.ranking.total;
    return b.ranking.avgTotal - a.ranking.avgTotal;
  });
}

function renderDiscover() {
  const w = getSelectedWonderland('discoverSelect');
  const container = $('#discoverDetail');
  if (!w) {
    container.innerHTML = '<p>まだワンダーランドが登録されていません。</p>';
    return;
  }
  state.currentId = w.id;
  const tags = (w.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
  const cover = w.coverImage ? `<img src="${escapeHtml(w.coverImage)}" alt="${escapeHtml(w.title)}のマッププレビュー">` : `<div class="generated-cover"><strong>${escapeHtml(w.area)}</strong><span>${escapeHtml(w.title)}</span></div>`;
  const spots = (w.spots || []).map((spot, index) => `
    <article class="spot-card">
      <strong>${index + 1}. ${escapeHtml(spot.name)}</strong>
      <span>${escapeHtml(spot.arrive || '')}${spot.depart ? ` - ${escapeHtml(spot.depart)}` : ''} / 滞在${Number(spot.stayMin || 0)}分</span>
      <p>${escapeHtml(spot.notes || '')}</p>
      <div class="spot-links">
        <a class="mini-link" href="${escapeHtml(buildMapSearchUrl(spot, w))}" target="_blank" rel="noopener">地図/写真</a>
      </div>
    </article>
  `).join('');

  container.innerHTML = `
    <div class="detail-hero">
      <div>
        <p class="eyebrow">現在 ${w.rank}位 / ${escapeHtml(w.creator || '匿名')} / ${escapeHtml(getWonderlandLocalities(w).join('・'))}</p>
        <h2>${escapeHtml(w.title)}</h2>
        <p class="leadish">${escapeHtml(w.catchCopy || '')}</p>
        <p>${escapeHtml(w.description || '')}</p>
        <div class="tag-list">${tags}</div>
        <div class="photo-link-panel">
          <p class="photo-link-title">場所がわかる地図/写真リンク</p>
          <small>各スポット欄の「地図/写真」から、Googleマップ上で場所と写真を確認できます。</small>
        </div>
        ${w.sourcePdf ? `<p class="source-pdf-link"><a class="button secondary" href="/${escapeHtml(w.sourcePdf)}" target="_blank" rel="noopener">原本PDFを開く</a></p>` : ''}
        ${w.sourceUrl ? `<p class="source-pdf-link"><a class="button secondary" href="${escapeHtml(w.sourceUrl)}" target="_blank" rel="noopener">参照ページを開く</a></p>` : ''}
        ${w.sourceNote ? `<p class="source-note">出典メモ：${escapeHtml(w.sourceNote)}</p>` : ''}
      </div>
      ${cover}
    </div>
    <div class="kpi-row">
      <div class="kpi"><strong>${yenLike(w.ranking.total)}P</strong><span>総合点</span></div>
      <div class="kpi"><strong>${yenLike(w.ranking.voters)}人</strong><span>投票者</span></div>
      <div class="kpi"><strong>${escapeHtml(w.duration || '-')}</strong><span>所要時間</span></div>
      <div class="kpi"><strong>${Number(w.totalDistanceKm || 0).toFixed(2)}km</strong><span>総距離</span></div>
    </div>
    <div class="kpi-row">
      <div class="kpi"><strong>${w.ranking.avgUnknown}</strong><span>知らなかった平均</span></div>
      <div class="kpi"><strong>${w.ranking.avgSurprise}</strong><span>予想外平均</span></div>
      <div class="kpi"><strong>${w.ranking.avgTry}</strong><span>初体験平均</span></div>
      <div class="kpi"><strong>${w.ranking.avgTotal}</strong><span>合計平均</span></div>
    </div>
    <h3 style="margin-top:24px">スポット</h3>
    <div class="spot-cards">${spots}</div>
  `;
}

function renderRanking() {
  const body = $('#rankingBody');
  if (!body) return;
  const list = filteredRankingList();
  const scope = $('#rankingScope')?.value || 'nerima';
  const label = state.selectedLocality && state.selectedLocality !== 'すべて' ? `${state.selectedLocality}ランキング` : (scope === 'nerima' ? '練馬ランキング' : scope === 'tokyo' ? '東京・近隣ランキング' : '全国ランキング');
  body.innerHTML = list.length ? list.map((w, index) => `
    <tr>
      <td class="rank-cell">${index === 0 ? '<span class="rank-1">1</span>' : index + 1}</td>
      <td><strong>${escapeHtml(w.title)}</strong><br><span class="muted">${escapeHtml(w.area)} / ${label}</span></td>
      <td>${escapeHtml(w.creator || '')}</td>
      <td>${yenLike(w.ranking.unknown)}<br><span class="muted">平均 ${w.ranking.avgUnknown}</span></td>
      <td>${yenLike(w.ranking.surprise)}<br><span class="muted">平均 ${w.ranking.avgSurprise}</span></td>
      <td>${yenLike(w.ranking.try)}<br><span class="muted">平均 ${w.ranking.avgTry}</span></td>
      <td><strong>${yenLike(w.ranking.total)}</strong><br><span class="muted">平均 ${w.ranking.avgTotal}</span></td>
      <td>${yenLike(w.ranking.voters)}</td>
    </tr>
  `).join('') : `<tr><td colspan="8" class="empty-row">該当するワンダーランドがありません。検索条件を変えてください。</td></tr>`;
}

function renderActualTileWonderlandMap(w, spots) {
  const width = 1000;
  const height = 610;
  const tileSize = 256;

  if (!spots.length) {
    return '<div class="stable-map-empty"><strong>実地図タイル版 v12</strong><br>緯度経度が登録されたスポットがありません。登録画面で各スポットの緯度・経度を入れてください。</div>';
  }

  const validSpots = spots.map((spot) => ({
    ...spot,
    lat: Math.max(-85.05112878, Math.min(85.05112878, Number(spot.lat))),
    lng: Number(spot.lng)
  }));

  const lonToX = (lng, z) => ((lng + 180) / 360) * tileSize * Math.pow(2, z);
  const latToY = (lat, z) => {
    const rad = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * tileSize * Math.pow(2, z);
  };
  const xToTile = (x) => Math.floor(x / tileSize);
  const yToTile = (y) => Math.floor(y / tileSize);

  const lats = validSpots.map((s) => s.lat);
  const lngs = validSpots.map((s) => s.lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  let zoom = 15;
  if (validSpots.length > 1) {
    for (let z = 17; z >= 10; z -= 1) {
      const xs = validSpots.map((s) => lonToX(s.lng, z));
      const ys = validSpots.map((s) => latToY(s.lat, z));
      const spanX = Math.max(...xs) - Math.min(...xs);
      const spanY = Math.max(...ys) - Math.min(...ys);
      if (spanX <= width * 0.72 && spanY <= height * 0.72) {
        zoom = z;
        break;
      }
    }
  }

  const centerX = lonToX(centerLng, zoom);
  const centerY = latToY(centerLat, zoom);
  const viewLeft = centerX - width / 2;
  const viewTop = centerY - height / 2;
  const minTileX = xToTile(viewLeft) - 1;
  const maxTileX = xToTile(viewLeft + width) + 1;
  const minTileY = yToTile(viewTop) - 1;
  const maxTileY = yToTile(viewTop + height) + 1;
  const maxTileIndex = Math.pow(2, zoom) - 1;

  const tileProvider = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
  let tiles = '';
  for (let tx = minTileX; tx <= maxTileX; tx += 1) {
    for (let ty = minTileY; ty <= maxTileY; ty += 1) {
      if (ty < 0 || ty > maxTileIndex) continue;
      const wrappedX = ((tx % (maxTileIndex + 1)) + (maxTileIndex + 1)) % (maxTileIndex + 1);
      const left = Math.round(tx * tileSize - viewLeft);
      const top = Math.round(ty * tileSize - viewTop);
      const src = tileProvider
        .replace('{z}', String(zoom))
        .replace('{x}', String(wrappedX))
        .replace('{y}', String(ty));
      tiles += `<img class="actual-map-tile" src="${src}" alt="" loading="eager" decoding="async" style="left:${left}px;top:${top}px;width:${tileSize}px;height:${tileSize}px" onerror="this.style.opacity='0.08';this.removeAttribute('src');this.classList.add('tile-error')">`;
    }
  }

  const pts = validSpots.map((spot, index) => {
    const x = lonToX(spot.lng, zoom) - viewLeft;
    const y = latToY(spot.lat, zoom) - viewTop;
    return { x, y, spot, index };
  });

  const pct = (v, max) => (v / max * 100).toFixed(3) + '%';
  const segments = pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    return `<div class="actual-route-segment" style="left:${p.x.toFixed(2)}px;top:${p.y.toFixed(2)}px;width:${len.toFixed(2)}px;transform:rotate(${angle.toFixed(2)}deg)"></div>`;
  }).join('');

  const markers = pts.map((p) => {
    const labelLeft = p.x < width * 0.72 ? `${Math.round(p.x + 23)}px` : `${Math.round(p.x - 180)}px`;
    const labelTop = p.y < height * 0.82 ? `${Math.round(p.y + 10)}px` : `${Math.round(p.y - 28)}px`;
    return `
      <div class="actual-map-marker" style="left:${p.x.toFixed(2)}px;top:${p.y.toFixed(2)}px">${p.index + 1}</div>
      <div class="actual-map-label" style="left:${labelLeft};top:${labelTop}">${p.index + 1}. ${escapeHtml(p.spot.name)}</div>
    `;
  }).join('');

  return `
    <div class="actual-map-canvas" role="img" aria-label="${escapeHtml(w.title || 'Wonderland Map')}の実地図マップ">
      <div class="actual-map-tiles">${tiles}</div>
      <div class="actual-map-overlay actual-map-loading">実地図を読み込み中...</div>
      ${segments}
      ${markers}
      <div class="actual-map-version">実地図タイル版 v12</div>
      <div class="actual-map-caption">
        <strong>${escapeHtml(w.title || 'Wonderland Map')}</strong>
        <span>${escapeHtml(w.area || '')} / 国土地理院地図タイル / Zoom ${zoom}</span>
      </div>
      <div class="actual-map-credit">地図: 国土地理院 / JIMOWAN Local Map</div>
    </div>
  `;
}


function renderMap() {
  const mapEl = $('#map');
  if (!mapEl) return;
  const w = getSelectedWonderland('mapSelect');
  if (!w) return;
  state.currentId = w.id;
  $('#mapTitleBlock').innerHTML = `
    <div>
      <p class="eyebrow">Wonderland Map</p>
      <h3>${escapeHtml(w.title)}</h3>
      <p>${escapeHtml(w.area)} / ${escapeHtml(w.creator || '')}</p>
    </div>
    <div class="map-rank"><strong>${w.rank}位</strong><span>${yenLike(w.ranking.total)}P</span></div>
  `;
  const spots = (w.spots || []).filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));
  $('#timetableBody').innerHTML = (w.spots || []).map((spot, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(spot.name)}</strong></td>
      <td>${escapeHtml(spot.arrive || '')}</td>
      <td>${escapeHtml(spot.depart || '')}</td>
      <td>${Number(spot.stayMin || 0)}分</td>
      <td>${Number(spot.walkMin || 0)}分</td>
      <td>${Number(spot.distanceKm || 0).toFixed(2)}km</td>
      <td>${escapeHtml(spot.notes || '')}</td>
      <td><div class="map-link-stack"><a class="mini-link" href="${escapeHtml(buildMapSearchUrl(spot, w))}" target="_blank" rel="noopener">地図/写真</a></div></td>
    </tr>
  `).join('');
  $('#mapSummary').textContent = `合計距離 ${Number(w.totalDistanceKm || 0).toFixed(2)}km / 徒歩 ${Number(w.totalWalkingMin || 0)}分 / 滞在 ${Number(w.totalStayMin || 0)}分 / 総時間目安 ${Number(w.totalWalkingMin || 0) + Number(w.totalStayMin || 0)}分`;
  const mapHtml = renderActualTileWonderlandMap(w, spots);
  mapEl.innerHTML = mapHtml || '<div class="stable-map-empty"><strong>実地図タイル版 v12</strong><br>マップ生成結果が空です。</div>';
  if (!mapEl.textContent.trim()) {
    mapEl.innerHTML = '<div class="stable-map-empty"><strong>実地図タイル版 v12</strong><br>マップを再描画しました。</div>';
  }
}


function renumberSpots() {
  $$('.spot-item').forEach((item, index) => {
    $('.spot-number', item).textContent = String(index + 1);
    const remove = $('.remove-spot', item);
    remove.disabled = $$('.spot-item').length <= 2;
    remove.style.opacity = remove.disabled ? '0.35' : '1';
  });
}

function addSpot(values = {}) {
  const template = $('#spotTemplate');
  const clone = template.content.cloneNode(true);
  const item = $('.spot-item', clone);
  const defaults = {
    spotName: '', arrive: '', depart: '', stayMin: 10, walkMin: 5, distanceKm: 0.3, lat: 35.681236, lng: 139.767125, notes: ''
  };
  const data = { ...defaults, ...values };
  Object.entries(data).forEach(([name, value]) => {
    const input = item.querySelector(`[name="${name}"]`);
    if (input) input.value = value;
  });
  $('.remove-spot', item).addEventListener('click', () => {
    item.remove();
    renumberSpots();
  });
  $('#spotList').appendChild(clone);
  renumberSpots();
}

function collectFormData(form) {
  const fd = new FormData(form);
  const spotItems = $$('.spot-item');
  const spots = spotItems.map((item) => ({
    name: $('[name="spotName"]', item).value,
    arrive: $('[name="arrive"]', item).value,
    depart: $('[name="depart"]', item).value,
    stayMin: Number($('[name="stayMin"]', item).value || 0),
    walkMin: Number($('[name="walkMin"]', item).value || 0),
    distanceKm: Number($('[name="distanceKm"]', item).value || 0),
    lat: Number($('[name="lat"]', item).value || 0),
    lng: Number($('[name="lng"]', item).value || 0),
    notes: $('[name="notes"]', item).value
  }));
  const autoDistance = spots.reduce((sum, s) => sum + Number(s.distanceKm || 0), 0);
  const autoWalk = spots.reduce((sum, s) => sum + Number(s.walkMin || 0), 0);
  const autoStay = spots.reduce((sum, s) => sum + Number(s.stayMin || 0), 0);
  return {
    title: fd.get('title'),
    area: fd.get('area'),
    locality: fd.get('locality') || inferLocalityFromText(`${fd.get('title')} ${fd.get('area')}`),
    localities: [fd.get('locality') || inferLocalityFromText(`${fd.get('title')} ${fd.get('area')}`)].filter(Boolean),
    creator: fd.get('creator'),
    catchCopy: fd.get('catchCopy'),
    description: fd.get('description'),
    duration: fd.get('duration'),
    tags: fd.get('tags'),
    totalDistanceKm: fd.get('totalDistanceKm') || autoDistance,
    totalWalkingMin: fd.get('totalWalkingMin') || autoWalk,
    totalStayMin: fd.get('totalStayMin') || autoStay,
    spots
  };
}

function fillExample() {
  const form = $('#wonderlandForm');
  form.title.value = '練馬 大根とアニメの路地裏ワンダーランド';
  form.area.value = '東京都練馬区';
  if (form.locality) form.locality.value = '練馬区';
  form.creator.value = 'ジモワン登録者';
  form.duration.value = '2時間半';
  form.catchCopy.value = '大根、アニメ、商店街。地味に見える街ほど奥が深い。';
  form.description.value = '駅前の有名スポットではなく、地元の生活の中にある小さな発見をつなぐ練馬らしいコース。';
  form.tags.value = '練馬, アニメ, 野菜, 商店街, 路地裏';
  form.totalDistanceKm.value = '2.4';
  form.totalWalkingMin.value = '36';
  form.totalStayMin.value = '90';
  $('#spotList').innerHTML = '';
  addSpot({ spotName: '練馬駅', arrive: '13:00', depart: '13:05', stayMin: 5, walkMin: 0, distanceKm: 0, lat: 35.7377, lng: 139.6548, notes: '集合。まずは練馬のイメージを確認。' });
  addSpot({ spotName: '平成つつじ公園', arrive: '13:08', depart: '13:25', stayMin: 17, walkMin: 3, distanceKm: 0.2, lat: 35.7387, lng: 139.6535, notes: '駅前にある季節の静かな見どころ。' });
  addSpot({ spotName: 'アニメ関連スポット', arrive: '13:40', depart: '14:10', stayMin: 30, walkMin: 15, distanceKm: 1.0, lat: 35.7432, lng: 139.6505, notes: '練馬のアニメ文化を深掘り。' });
  addSpot({ spotName: '地元商店街の休憩所', arrive: '14:25', depart: '15:03', stayMin: 38, walkMin: 12, distanceKm: 0.9, lat: 35.7395, lng: 139.6600, notes: '観光ではなく生活の地元感を味わう。' });
  showNotice('入力例を入れました。内容を編集して登録できます。');
}

function bindEvents() {
  $$('[data-tab-target]').forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget));
  });
  $('#localitySelect')?.addEventListener('change', (event) => {
    setSelectedLocality(event.target.value);
    state.currentId = availableWonderlands()[0]?.id || state.wonderlands[0]?.id || null;
    renderAll();
    showNotice(`${state.selectedLocality === 'すべて' ? '全地域' : state.selectedLocality}だけの表示に切り替えました。`);
  });
  $('#discoverSelect').addEventListener('change', (event) => {
    state.currentId = event.target.value;
    $('#mapSelect').value = event.target.value;
    $('#voteWonderland').value = event.target.value;
    renderDiscover();
    renderMap();
  });
  $('#mapSelect').addEventListener('change', (event) => {
    state.currentId = event.target.value;
    renderMap();
  });
  $('#voteWonderland').addEventListener('change', (event) => {
    state.currentId = event.target.value;
  });
  $('#reloadRanking').addEventListener('click', loadWonderlands);
  $('#rankingScope')?.addEventListener('change', renderRanking);
  $('#rankingFilter')?.addEventListener('input', renderRanking);
  $('#runFreeSearch')?.addEventListener('click', renderSearchResults);
  $('#freeSearchInput')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      renderSearchResults();
    }
  });
  $('#freeSearchInput')?.addEventListener('input', () => {
    window.clearTimeout(renderSearchResults.timer);
    renderSearchResults.timer = window.setTimeout(renderSearchResults, 250);
  });
  $('#printMap').addEventListener('click', () => {
    renderMap();
    setTimeout(() => window.print(), 200);
  });
  $('#addSpot').addEventListener('click', () => addSpot());
  $('#fillExample').addEventListener('click', fillExample);

  const voteForm = $('#voteForm');
  ['unknown', 'surprise', 'try'].forEach((name) => {
    const input = voteForm.elements[name];
    const output = $(`#${name === 'try' ? 'try' : name}Value`);
    input.addEventListener('input', () => { output.textContent = input.value; });
  });
  voteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = $('#voteWonderland').value;
    try {
      const payload = {
        unknown: Number(voteForm.elements.unknown.value),
        surprise: Number(voteForm.elements.surprise.value),
        try: Number(voteForm.elements.try.value)
      };
      const data = await api(`/api/wonderlands/${encodeURIComponent(id)}/vote`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      state.wonderlands = data.wonderlands || [];
      state.currentId = id;
      renderAll();
      $('#voteWonderland').value = id;
      showNotice('投票しました。ランキングを更新しました。');
    } catch (error) {
      showNotice(error.message, 'error');
    }
  });

  $('#wonderlandForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = collectFormData(event.currentTarget);
      const result = await api('/api/wonderlands', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (payload.locality) setSelectedLocality(payload.locality);
      await loadWonderlands();
      state.currentId = result.wonderland.id;
      renderSelects();
      $('#discoverSelect').value = state.currentId;
      $('#mapSelect').value = state.currentId;
      $('#voteWonderland').value = state.currentId;
      renderDiscover();
      renderMap();
      setActiveTab('map');
      showNotice('ワンダーランドを登録しました。マップに反映しました。');
      event.currentTarget.reset();
      $('#spotList').innerHTML = '';
      addSpot();
      addSpot();
    } catch (error) {
      showNotice(error.message, 'error');
    }
  });
}

function boot() {
  addSpot({ spotName: 'スタート地点', arrive: '13:00', depart: '13:05', stayMin: 5, walkMin: 0, distanceKm: 0, lat: 35.681236, lng: 139.767125, notes: '集合場所' });
  addSpot({ spotName: '発見スポット', arrive: '13:15', depart: '13:35', stayMin: 20, walkMin: 10, distanceKm: 0.8, lat: 35.6845, lng: 139.7708, notes: '知られていない地元ネタ' });
  bindEvents();
  loadWonderlands().catch((error) => showNotice(error.message, 'error'));
}

document.addEventListener('DOMContentLoaded', boot);
