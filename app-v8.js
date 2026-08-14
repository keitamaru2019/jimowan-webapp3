
// JIMOWAN ACTUAL MAP VERSION v8 - direct map tile renderer
window.JIMOWAN_APP_VERSION = 'v8-actual-map-expanded-data';
window.addEventListener('error', function(e) {
  const map = document.getElementById('map');
  if (map && !map.textContent.trim()) {
    map.innerHTML = '<div class="stable-map-empty"><strong>実地図タイル版 v8</strong><br>表示処理でエラーが発生しました。Ctrl+F5で再読み込みしてください。</div>';
  }
});
const state = {
  wonderlands: [],
  currentId: null
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
  if (!state.currentId && state.wonderlands[0]) state.currentId = state.wonderlands[0].id;
  renderAll();
}

function renderAll() {
  renderSelects();
  renderDiscover();
  renderRanking();
  renderMap();
}

function renderSelects() {
  const options = state.wonderlands.map((w) => `<option value="${escapeHtml(w.id)}">${w.rank}位：${escapeHtml(w.title)}</option>`).join('');
  ['discoverSelect', 'voteWonderland', 'mapSelect'].forEach((id) => {
    const select = $(`#${id}`);
    if (!select) return;
    const previous = select.value || state.currentId;
    select.innerHTML = options;
    select.value = state.wonderlands.some((w) => w.id === previous) ? previous : (state.currentId || '');
  });
}

function getSelectedWonderland(selectId = 'discoverSelect') {
  const id = $(`#${selectId}`)?.value || state.currentId || state.wonderlands[0]?.id;
  return state.wonderlands.find((w) => w.id === id) || state.wonderlands[0];
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
    </article>
  `).join('');

  container.innerHTML = `
    <div class="detail-hero">
      <div>
        <p class="eyebrow">現在 ${w.rank}位 / ${escapeHtml(w.creator || '匿名')}</p>
        <h2>${escapeHtml(w.title)}</h2>
        <p class="leadish">${escapeHtml(w.catchCopy || '')}</p>
        <p>${escapeHtml(w.description || '')}</p>
        <div class="tag-list">${tags}</div>
        ${w.sourcePdf ? `<p class="source-pdf-link"><a class="button secondary" href="/${escapeHtml(w.sourcePdf)}" target="_blank" rel="noopener">原本PDFを開く</a></p>` : ''}
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
  body.innerHTML = state.wonderlands.map((w) => `
    <tr>
      <td class="rank-cell">${w.rank === 1 ? '<span class="rank-1">1</span>' : w.rank}</td>
      <td><strong>${escapeHtml(w.title)}</strong><br><span class="muted">${escapeHtml(w.area)}</span></td>
      <td>${escapeHtml(w.creator || '')}</td>
      <td>${yenLike(w.ranking.unknown)}<br><span class="muted">平均 ${w.ranking.avgUnknown}</span></td>
      <td>${yenLike(w.ranking.surprise)}<br><span class="muted">平均 ${w.ranking.avgSurprise}</span></td>
      <td>${yenLike(w.ranking.try)}<br><span class="muted">平均 ${w.ranking.avgTry}</span></td>
      <td><strong>${yenLike(w.ranking.total)}</strong><br><span class="muted">平均 ${w.ranking.avgTotal}</span></td>
      <td>${yenLike(w.ranking.voters)}</td>
    </tr>
  `).join('');
}

function renderActualTileWonderlandMap(w, spots) {
  const width = 1000;
  const height = 610;
  const tileSize = 256;

  if (!spots.length) {
    return '<div class="stable-map-empty"><strong>実地図タイル版 v8</strong><br>緯度経度が登録されたスポットがありません。登録画面で各スポットの緯度・経度を入れてください。</div>';
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
      <div class="actual-map-version">実地図タイル版 v8</div>
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
    </tr>
  `).join('');
  $('#mapSummary').textContent = `合計距離 ${Number(w.totalDistanceKm || 0).toFixed(2)}km / 徒歩 ${Number(w.totalWalkingMin || 0)}分 / 滞在 ${Number(w.totalStayMin || 0)}分 / 総時間目安 ${Number(w.totalWalkingMin || 0) + Number(w.totalStayMin || 0)}分`;
  const mapHtml = renderActualTileWonderlandMap(w, spots);
  mapEl.innerHTML = mapHtml || '<div class="stable-map-empty"><strong>実地図タイル版 v8</strong><br>マップ生成結果が空です。</div>';
  if (!mapEl.textContent.trim()) {
    mapEl.innerHTML = '<div class="stable-map-empty"><strong>実地図タイル版 v8</strong><br>マップを再描画しました。</div>';
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
