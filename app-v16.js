
// JIMOWAN ACTUAL MAP VERSION v8 - direct map tile renderer
window.JIMOWAN_APP_VERSION = 'v16-prefecture-locality';
window.addEventListener('error', function(e) {
  const map = document.getElementById('map');
  if (map && !map.textContent.trim()) {
    map.innerHTML = '<div class="stable-map-empty"><strong>練馬グリーン版 v16</strong><br>表示処理でエラーが発生しました。Ctrl+F5で再読み込みしてください。</div>';
  }
});
const state = {
  wonderlands: [],
  currentId: null,
  selectedLocality: localStorage.getItem('jimowanLocality') || '練馬区',
  lang: localStorage.getItem('jimowanLang') || 'ja'
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


const UI = {
  ja: {
    langButton: 'EN', navLp: 'LPへ', navRanking: 'ランキング', navRegister: '登録', navMap: 'マップ', navKml: 'KML取込', navLogout: 'ログアウト',
    entryEyebrow: 'Jimowan Search', entryTitle: '今日はどんなワンダーランドに行こうかな？', entryPlaceholder: '例：親子で、夜に一杯、疲れている、昭和レトロ、練馬の畑', entryButton: '探す', entryHint: '左の区・市町で地域を絞ってから検索すると、その地域の意外なワンダーランドを提案します。',
    portalTitle: '今回の地元ワンダーランド', portalDesc: '登録・投票・マップ生成ができるMVPです。データはこのサーバー内のJSONに保存されます。', localityLabel: '区・市町で選ぶ', allAreas: 'すべての区・市町', allAreaShort: '全地域',
    tabDiscover: '探す', tabRanking: 'ランキング', tabRegister: 'ワンダーランド登録', tabMap: 'マップ作成・PDF', tabKml: 'KML取込', rankingFormulaTitle: 'ランキング式', discoverTitle: 'ワンダーランドを探す', freeSearchLabel: '自由検索欄', freeSearchPlaceholder: '例：疲れてる、親子で、夜に一杯、昭和レトロ、練馬の畑、雨でも楽しめる', freeSearchButton: '意外なワンダーランドを探す',
    rankingTitle: 'ジモワンランキング', voteTitle: '投票して順位を更新', voteButton: '投票する', registerTitle: 'ワンダーランドを登録する', spotRegisterTitle: 'スポット登録', registerButton: '登録してランキングへ反映', fillExample: '入力例を入れる', mapTitle: 'ワンダーランドマップ作成・PDF保存', printMap: 'PDF保存 / 印刷',
    rankSuffix: '位', spots: 'スポット', current: '現在', duration: '所要時間', totalDistance: '総距離', totalScore: '総合点', voters: '投票者', unknownAvg: '知らなかった平均', surpriseAvg: '予想外平均', tryAvg: '初体験平均', totalAvg: '合計平均', unknownP: '知らなかったP', surpriseP: '予想外P', tryP: '初体験P', totalP: '合計点', creator: '作者', jimowan: 'ジモワン', mapPhoto: '地図/写真', stay: '滞在', minutes: '分',
    pdf: '原本PDFを開く', sourcePage: '参照ページを開く', sourceNote: '出典メモ', locationMapPhotoTitle: '場所がわかる地図/写真リンク', mapPhotoHint: '各スポット欄の「地図/写真」から、Googleマップ上で場所と写真を確認できます。', chooseThis: 'このジモワンを見る', noWonderlands: 'まだワンダーランドが登録されていません。', kmlTitle: '東京ウォーキングマップ KML取込', kmlSubtitle: 'KMLをジモワン形式に変換して、区・市町ランキングとマップに追加します。', kmlFileLabel: 'KMLファイルを選択', kmlLimitLabel: '取り込み上限件数', kmlSourceLabel: '取込元メモ', kmlButton: 'KMLを取り込む', kmlHint: 'KML内のコース名、Point、LineStringを読み取り、地元ワンダーランド用のタイトル・スポット・ルート線・仮ランキング点に変換します。'
  },
  en: {
    langButton: '日本語', navLp: 'LP', navRanking: 'Ranking', navRegister: 'Register', navMap: 'Map', navKml: 'KML Import', navLogout: 'Logout',
    entryEyebrow: 'Jimowan Search', entryTitle: 'What kind of Wonderland shall we visit today?', entryPlaceholder: 'Try: family, a quiet night drink, feeling tired, retro town, Nerima farms', entryButton: 'Search', entryHint: 'Choose a ward/city first, then search by mood or purpose to find unexpected local Wonderlands.',
    portalTitle: 'Today’s Local Wonderland', portalDesc: 'A working MVP for registration, voting, ranking, and map generation. Data is stored as JSON on this server.', localityLabel: 'Choose ward/city', allAreas: 'All wards/cities', allAreaShort: 'All areas',
    tabDiscover: 'Discover', tabRanking: 'Ranking', tabRegister: 'Register Wonderland', tabMap: 'Map & PDF', tabKml: 'KML Import', rankingFormulaTitle: 'Ranking formula', discoverTitle: 'Find a Wonderland', freeSearchLabel: 'Free search', freeSearchPlaceholder: 'Try: tired, family, a drink at night, retro town, Nerima farms, rainy day', freeSearchButton: 'Find an unexpected Wonderland',
    rankingTitle: 'Jimowan Ranking', voteTitle: 'Vote and update the ranking', voteButton: 'Vote', registerTitle: 'Register a Wonderland', spotRegisterTitle: 'Register spots', registerButton: 'Register and update ranking', fillExample: 'Fill sample', mapTitle: 'Wonderland Map / PDF', printMap: 'Save PDF / Print',
    rankSuffix: '', spots: 'spots', current: 'Current', duration: 'Duration', totalDistance: 'Distance', totalScore: 'Total score', voters: 'Voters', unknownAvg: 'Unknown avg.', surpriseAvg: 'Surprise avg.', tryAvg: 'Want-to-try avg.', totalAvg: 'Total avg.', unknownP: 'Unknown P', surpriseP: 'Surprise P', tryP: 'Want-to-try P', totalP: 'Total', creator: 'Creator', jimowan: 'Wonderland', mapPhoto: 'Map/Photos', stay: 'Stay', minutes: 'min',
    pdf: 'Open source PDF', sourcePage: 'Open reference page', sourceNote: 'Source note', locationMapPhotoTitle: 'Map/Photo links for each place', mapPhotoHint: 'Use “Map/Photos” in each spot card to confirm the place and photos on Google Maps.', chooseThis: 'View this Wonderland', noWonderlands: 'No Wonderlands registered yet.', kmlTitle: 'Import TOKYO WALKING MAP KML', kmlSubtitle: 'Convert KML into Jimowan Wonderlands and add them to ward/city rankings and maps.', kmlFileLabel: 'Choose KML file', kmlLimitLabel: 'Import limit', kmlSourceLabel: 'Source memo', kmlButton: 'Import KML', kmlHint: 'Reads course names, Points, and LineStrings from KML, then creates titles, spots, route lines, and temporary ranking points.'
  }
};

const JP_EN = [
  ['練馬区','Nerima City'], ['宇都宮市','Utsunomiya City'], ['茂木町','Motegi Town'], ['真岡市','Mooka City'], ['調布市','Chofu City'], ['川越市','Kawagoe City'], ['中央区','Chuo City'], ['朝霞市','Asaka City'], ['北九州市八幡西区','Yahatanishi, Kitakyushu'], ['堺市北区','Kita-ku, Sakai'], ['札幌市中央区','Chuo-ku, Sapporo'], ['札幌市北区','Kita-ku, Sapporo'], ['高浜市','Takahama City'], ['三鷹市','Mitaka City'], ['武蔵野市','Musashino City'], ['船橋市','Funabashi City'], ['世田谷区','Setagaya City'], ['豊島区','Toshima City'],
    ['千代田区','Chiyoda City'], ['港区','Minato City'], ['新宿区','Shinjuku City'], ['文京区','Bunkyo City'], ['台東区','Taito City'], ['墨田区','Sumida City'], ['江東区','Koto City'], ['品川区','Shinagawa City'], ['目黒区','Meguro City'], ['大田区','Ota City'], ['渋谷区','Shibuya City'], ['中野区','Nakano City'], ['杉並区','Suginami City'], ['北区','Kita City'], ['荒川区','Arakawa City'], ['板橋区','Itabashi City'], ['足立区','Adachi City'], ['葛飾区','Katsushika City'], ['江戸川区','Edogawa City'], ['八王子市','Hachioji City'], ['立川市','Tachikawa City'], ['府中市','Fuchu City'], ['町田市','Machida City'], ['小金井市','Koganei City'], ['小平市','Kodaira City'], ['日野市','Hino City'], ['東村山市','Higashimurayama City'], ['国分寺市','Kokubunji City'], ['国立市','Kunitachi City'], ['福生市','Fussa City'], ['狛江市','Komae City'], ['東大和市','Higashiyamato City'], ['清瀬市','Kiyose City'], ['東久留米市','Higashikurume City'], ['武蔵村山市','Musashimurayama City'], ['多摩市','Tama City'], ['稲城市','Inagi City'], ['羽村市','Hamura City'], ['あきる野市','Akiruno City'], ['西東京市','Nishitokyo City'], ['利島村','Toshima Village'], ['大島町','Oshima Town'], ['新島村','Niijima Village'], ['神津島村','Kozushima Village'],
  ['東京都','Tokyo'], ['栃木県','Tochigi'], ['埼玉県','Saitama'], ['福岡県','Fukuoka'], ['大阪府','Osaka'], ['北海道','Hokkaido'], ['愛知県','Aichi'], ['千葉県','Chiba'],
  ['ワンダーランド','Wonderland'], ['地元','local'], ['寄り道','Detour'], ['さんぽ','Walk'], ['散歩','Walk'], ['巡り','Tour'], ['めぐり','Tour'], ['マップ','Map'], ['コース','Course'], ['ランキング','Ranking'],
  ['練馬','Nerima'], ['光が丘','Hikarigaoka'], ['石神井公園','Shakujii Park'], ['石神井','Shakujii'], ['久松湯','Hisamatsuyu'], ['庭の湯','Niwa-no-Yu'], ['豊島園','Toshimaen'], ['江古田','Ekoda'], ['春日町','Kasugacho'], ['平和台','Heiwadai'], ['氷川台','Hikawadai'], ['桜台','Sakuradai'], ['大泉学園','Oizumi-gakuen'], ['武蔵関','Musashi-seki'], ['高野台','Takanodai'], ['上石神井','Kami-shakujii'],
  ['宇都宮','Utsunomiya'], ['ジャズバー','Jazz bars'], ['ビートルズレストラン','Beatles restaurant'], ['源泉かけ流し温泉','free-flowing hot springs'], ['幻想洞窟','fantasy cave'], ['餃子','gyoza'], ['ソウルフード','soul food'], ['兜焼き','kabutoyaki'], ['真岡鐵道','Moka Railway'], ['プロバスケ','pro basketball'],
  ['仙川','Sengawa'], ['文学','literary'], ['やすらぎ','relaxing'], ['川越','Kawagoe'], ['渋み','deep local flavor'], ['再発見','rediscovery'], ['新川','Shinkawa'], ['朝霞','Asaka'], ['黒崎駅','Kurosaki Station'], ['堺','Sakai'], ['古墳','ancient tombs'], ['ため池','reservoirs'], ['札幌','Sapporo'], ['北大','Hokkaido University'], ['三河高浜','Mikawa Takahama'], ['鬼','oni'], ['土管','clay pipes'], ['瓦','roof tiles'], ['三鷹','Mitaka'], ['知と静寂','knowledge and quiet'], ['船橋日大前駅','Funabashi-Nichidaimae Station'], ['下北沢','Shimokitazawa'], ['世田谷代田','Setagaya-Daita'],
  ['公園','park'], ['温泉','hot spring'], ['銭湯','public bath'], ['珈琲','coffee'], ['喫茶','café'], ['ジャズ','jazz'], ['大人部室','adult clubhouse'], ['親子','family'], ['無料','free'], ['都市農業','urban farming'], ['昭和','Showa-era'], ['レトロ','retro'], ['サブカル','subculture'], ['マンガ','manga'], ['アニメ','anime'], ['文化','culture'], ['歴史','history'], ['自然','nature'], ['畑','farms'], ['たい焼き','taiyaki'], ['ときどき','and sometimes'], ['夜','night'], ['一杯','drink']
];

function ui(key) { return (UI[state.lang] && UI[state.lang][key]) || UI.ja[key] || key; }
function isEnglish() { return state.lang === 'en'; }
function localText(value) {
  let text = String(value ?? '');
  if (!isEnglish() || !text) return text;
  const list = [...JP_EN].sort((a,b)=>b[0].length-a[0].length);
  list.forEach(([jp,en]) => { text = text.split(jp).join(en); });
  text = text.replaceAll('＋', ' + ').replaceAll('〜', ' to ').replaceAll('・', ' / ').replaceAll('。', '. ').replaceAll('、', ', ');
  return text;
}
function rankText(n) { return isEnglish() ? `#${n}` : `${n}位`; }
function minText(n) { return isEnglish() ? `${Number(n||0)} min` : `${Number(n||0)}分`; }
function applyStaticLanguage() {
  document.documentElement.lang = isEnglish() ? 'en' : 'ja';
  $$('[data-i18n]').forEach((el) => { const k = el.dataset.i18n; if (ui(k)) el.textContent = ui(k); });
  $$('[data-i18n-placeholder]').forEach((el) => { const k = el.dataset.i18nPlaceholder; if (ui(k)) el.placeholder = ui(k); });
  const toggle = $('#langToggle'); if (toggle) toggle.textContent = ui('langButton');
}
function setLanguage(lang) {
  state.lang = lang === 'en' ? 'en' : 'ja';
  localStorage.setItem('jimowanLang', state.lang);
  applyStaticLanguage();
  renderAll();
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

function stripPrefecture(locality) {
  return String(locality || '').trim().replace(/^(東京都|北海道|大阪府|京都府|.{2,3}県)/, '');
}

const LOCALITY_PREFECTURES = {
  // Tokyo 23 wards
  '千代田区':'東京都','中央区':'東京都','港区':'東京都','新宿区':'東京都','文京区':'東京都','台東区':'東京都','墨田区':'東京都','江東区':'東京都','品川区':'東京都','目黒区':'東京都','大田区':'東京都','世田谷区':'東京都','渋谷区':'東京都','中野区':'東京都','杉並区':'東京都','豊島区':'東京都','北区':'東京都','荒川区':'東京都','板橋区':'東京都','練馬区':'東京都','足立区':'東京都','葛飾区':'東京都','江戸川区':'東京都',
  // Tokyo cities, towns, and villages that appear in the walking-map data
  '八王子市':'東京都','立川市':'東京都','武蔵野市':'東京都','三鷹市':'東京都','青梅市':'東京都','府中市':'東京都','昭島市':'東京都','調布市':'東京都','町田市':'東京都','小金井市':'東京都','小平市':'東京都','日野市':'東京都','東村山市':'東京都','国分寺市':'東京都','国立市':'東京都','福生市':'東京都','狛江市':'東京都','東大和市':'東京都','清瀬市':'東京都','東久留米市':'東京都','武蔵村山市':'東京都','多摩市':'東京都','稲城市':'東京都','羽村市':'東京都','あきる野市':'東京都','西東京市':'東京都','瑞穂町':'東京都','日の出町':'東京都','檜原村':'東京都','奥多摩町':'東京都','大島町':'東京都','利島村':'東京都','新島村':'東京都','神津島村':'東京都','三宅村':'東京都','御蔵島村':'東京都','八丈町':'東京都','青ヶ島村':'東京都','小笠原村':'東京都',
  // Other sample areas
  '宇都宮市':'栃木県','茂木町':'栃木県','真岡市':'栃木県','川越市':'埼玉県','朝霞市':'埼玉県','北九州市八幡西区':'福岡県','堺市北区':'大阪府','札幌市中央区':'北海道','札幌市北区':'北海道','高浜市':'愛知県','船橋市':'千葉県'
};

function inferPrefectureForLocality(locality) {
  const loc = stripPrefecture(locality);
  if (!loc || loc === 'すべて' || loc === 'その他') return '';
  if (/^(東京都|北海道|大阪府|京都府|.{2,3}県)/.test(String(locality || ''))) {
    return String(locality).match(/^(東京都|北海道|大阪府|京都府|.{2,3}県)/)?.[0] || '';
  }
  if (LOCALITY_PREFECTURES[loc]) return LOCALITY_PREFECTURES[loc];
  const hit = state.wonderlands.find((w) => getWonderlandLocalities(w).map(stripPrefecture).includes(loc) && /^(東京都|北海道|大阪府|京都府|.{2,3}県)/.test(String(w.area || '')));
  if (hit) return String(hit.area).match(/^(東京都|北海道|大阪府|京都府|.{2,3}県)/)?.[0] || '';
  return '';
}

function localityDisplayName(locality) {
  const raw = String(locality || '').trim();
  if (!raw || raw === 'すべて') return ui('allAreas');
  if (raw === 'その他') return isEnglish() ? 'Other areas' : 'その他';
  const loc = stripPrefecture(raw);
  const pref = inferPrefectureForLocality(raw);
  const jp = pref && !raw.startsWith(pref) ? `${pref}${loc}` : raw;
  if (!isEnglish()) return jp;
  const enLoc = localText(loc);
  const enPref = pref ? localText(pref) : '';
  return enPref && enPref !== pref ? `${enPref} ${enLoc}` : enLoc;
}

function normalizeLocalityInput(locality) {
  const raw = String(locality || '').trim();
  const stripped = stripPrefecture(raw);
  return stripped || raw;
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
  select.innerHTML = options.map((loc) => `<option value="${escapeHtml(loc)}">${escapeHtml(localityDisplayName(loc))}</option>`).join('');
  select.value = state.selectedLocality;
  const list = availableWonderlands();
  const count = $('#localityCount');
  if (count) count.textContent = `${state.selectedLocality === 'すべて' ? ui('allAreaShort') : localityDisplayName(state.selectedLocality)}：${list.length}${isEnglish() ? ' Wonderlands' : '件のワンダーランド'}`;
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
  const options = list.map((w) => `<option value="${escapeHtml(w.id)}">${rankText(w.rank)}：${escapeHtml(localText(w.title))}</option>`).join('');
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
  const label = state.selectedLocality === 'すべて' ? ui('allAreaShort') : localityDisplayName(state.selectedLocality);
  const emptySpotMessage = isEnglish() ? 'No spots in this ward/city yet.' : 'この区・市町のスポットはまだありません。';
  target.innerHTML = `
    <div class="spot-bank-header">
      <div>
        <p class="eyebrow">Local Spots</p>
        <h3>${escapeHtml(label)}${isEnglish() ? ' spot list' : 'のスポット一覧'}</h3>
        <p>${isEnglish() ? `Choose spots only from Wonderlands linked to ${escapeHtml(label)}.` : `${escapeHtml(label)}に紐づくワンダーランドだけからスポットを選べます。`}</p>
      </div>
      <strong>${rows.length}${isEnglish() ? ' spots' : 'スポット'}</strong>
    </div>
    <div class="local-spot-grid">
      ${rows.map(({ w, spot, index }) => `
        <button type="button" class="local-spot-button" data-id="${escapeHtml(w.id)}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(localText(spot.name))}</strong>
          <small>${escapeHtml(localText(w.title))}</small>
        </button>
      `).join('') || `<p class="empty-row">${emptySpotMessage}</p>`}
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
  const areaLabel = state.selectedLocality === 'すべて' ? ui('allAreaShort') : localityDisplayName(state.selectedLocality);
  const title = query ? (isEnglish() ? `Unexpected results in ${escapeHtml(localText(areaLabel))} for “${escapeHtml(query)}”` : `${escapeHtml(areaLabel)}で「${escapeHtml(query)}」から見つけた意外な候補`) : (isEnglish() ? `Unexpected candidates in ${escapeHtml(localText(areaLabel))}` : `${escapeHtml(areaLabel)}の意外性の高い候補`);
  target.innerHTML = `
    <h3>${title}</h3>
    <div class="recommend-grid">
      ${list.map((w, index) => `
        <article class="recommend-card">
          <span class="recommend-rank">${index + 1}</span>
          <strong>${escapeHtml(localText(w.title))}</strong>
          <p>${escapeHtml(localText(w.catchCopy || w.description || ''))}</p>
          <small>${escapeHtml(localText(explainRecommendation(w, query)))}</small>
          <button class="button secondary small choose-recommend" type="button" data-id="${escapeHtml(w.id)}">${ui('chooseThis')}</button>
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
    container.innerHTML = `<p>${ui('noWonderlands')}</p>`;
    return;
  }
  state.currentId = w.id;
  const tags = (w.tags || []).map((tag) => `<span>${escapeHtml(localText(tag))}</span>`).join('');
  const cover = w.coverImage ? `<img src="${escapeHtml(w.coverImage)}" alt="${escapeHtml(localText(w.title))}${isEnglish() ? ' map preview' : 'のマッププレビュー'}">` : `<div class="generated-cover"><strong>${escapeHtml(localText(w.area))}</strong><span>${escapeHtml(localText(w.title))}</span></div>`;
  const spots = (w.spots || []).map((spot, index) => `
    <article class="spot-card">
      <strong>${index + 1}. ${escapeHtml(localText(spot.name))}</strong>
      <span>${escapeHtml(spot.arrive || '')}${spot.depart ? ` - ${escapeHtml(spot.depart)}` : ''} / ${ui('stay')}${minText(spot.stayMin || 0)}</span>
      <p>${escapeHtml(localText(spot.notes || ''))}</p>
      <div class="spot-links">
        <a class="mini-link" href="${escapeHtml(buildMapSearchUrl(spot, w))}" target="_blank" rel="noopener">${ui('mapPhoto')}</a>
      </div>
    </article>
  `).join('');

  container.innerHTML = `
    <div class="detail-hero">
      <div>
        <p class="eyebrow">${ui('current')} ${rankText(w.rank)} / ${escapeHtml(w.creator || (isEnglish() ? 'Anonymous' : '匿名'))} / ${escapeHtml(getWonderlandLocalities(w).map(localText).join(' / '))}</p>
        <h2>${escapeHtml(localText(w.title))}</h2>
        <p class="leadish">${escapeHtml(localText(w.catchCopy || ''))}</p>
        <p>${escapeHtml(localText(w.description || ''))}</p>
        <div class="tag-list">${tags}</div>
        <div class="photo-link-panel">
          <p class="photo-link-title">${ui('locationMapPhotoTitle')}</p>
          <small>${ui('mapPhotoHint')}</small>
        </div>
        ${w.sourcePdf ? `<p class="source-pdf-link"><a class="button secondary" href="/${escapeHtml(w.sourcePdf)}" target="_blank" rel="noopener">${ui('pdf')}</a></p>` : ''}
        ${w.sourceUrl ? `<p class="source-pdf-link"><a class="button secondary" href="${escapeHtml(w.sourceUrl)}" target="_blank" rel="noopener">${ui('sourcePage')}</a></p>` : ''}
        ${w.sourceNote ? `<p class="source-note">${ui('sourceNote')}：${escapeHtml(localText(w.sourceNote))}</p>` : ''}
      </div>
      ${cover}
    </div>
    <div class="kpi-row">
      <div class="kpi"><strong>${yenLike(w.ranking.total)}P</strong><span>${ui('totalScore')}</span></div>
      <div class="kpi"><strong>${yenLike(w.ranking.voters)}人</strong><span>${ui('voters')}</span></div>
      <div class="kpi"><strong>${escapeHtml(localText(w.duration || '-'))}</strong><span>${ui('duration')}</span></div>
      <div class="kpi"><strong>${Number(w.totalDistanceKm || 0).toFixed(2)}km</strong><span>${ui('totalDistance')}</span></div>
    </div>
    <div class="kpi-row">
      <div class="kpi"><strong>${w.ranking.avgUnknown}</strong><span>${ui('unknownAvg')}</span></div>
      <div class="kpi"><strong>${w.ranking.avgSurprise}</strong><span>${ui('surpriseAvg')}</span></div>
      <div class="kpi"><strong>${w.ranking.avgTry}</strong><span>${ui('tryAvg')}</span></div>
      <div class="kpi"><strong>${w.ranking.avgTotal}</strong><span>${ui('totalAvg')}</span></div>
    </div>
    <h3 style="margin-top:24px">${ui('spots')}</h3>
    <div class="spot-cards">${spots}</div>
  `;
}

function renderRanking() {
  const body = $('#rankingBody');

  const headers = document.querySelectorAll('.ranking-table thead th');
  if (headers.length >= 8) {
    const labels = isEnglish() ? ['Rank','Wonderland','Creator','Unknown P','Surprise P','Want-to-try P','Total','Voters'] : ['順位','ジモワン','作者','知らなかったP','予想外P','初体験P','合計点','投票者'];
    headers.forEach((h,i)=>{ if(labels[i]) h.textContent = labels[i]; });
  }

  if (!body) return;
  const list = filteredRankingList();
  const scope = $('#rankingScope')?.value || 'nerima';
  const label = state.selectedLocality && state.selectedLocality !== 'すべて' ? `${state.selectedLocality}ランキング` : (scope === 'nerima' ? '練馬ランキング' : scope === 'tokyo' ? '東京・近隣ランキング' : '全国ランキング');
  body.innerHTML = list.length ? list.map((w, index) => `
    <tr>
      <td class="rank-cell">${index === 0 ? '<span class="rank-1">1</span>' : index + 1}</td>
      <td><strong>${escapeHtml(localText(w.title))}</strong><br><span class="muted">${escapeHtml(localText(w.area))} / ${label}</span></td>
      <td>${escapeHtml(w.creator || '')}</td>
      <td>${yenLike(w.ranking.unknown)}<br><span class="muted">${isEnglish() ? 'avg ' : '平均 '}${w.ranking.avgUnknown}</span></td>
      <td>${yenLike(w.ranking.surprise)}<br><span class="muted">${isEnglish() ? 'avg ' : '平均 '}${w.ranking.avgSurprise}</span></td>
      <td>${yenLike(w.ranking.try)}<br><span class="muted">${isEnglish() ? 'avg ' : '平均 '}${w.ranking.avgTry}</span></td>
      <td><strong>${yenLike(w.ranking.total)}</strong><br><span class="muted">${isEnglish() ? 'avg ' : '平均 '}${w.ranking.avgTotal}</span></td>
      <td>${yenLike(w.ranking.voters)}</td>
    </tr>
  `).join('') : `<tr><td colspan="8" class="empty-row">${isEnglish() ? 'No matching Wonderlands. Try changing the filter.' : '該当するワンダーランドがありません。検索条件を変えてください。'}</td></tr>`;
}

function renderActualTileWonderlandMap(w, spots) {
  const width = 1000;
  const height = 610;
  const tileSize = 256;

  if (!spots.length) {
    return '<div class="stable-map-empty"><strong>練馬グリーン版 v16</strong><br>緯度経度が登録されたスポットがありません。登録画面で各スポットの緯度・経度を入れてください。</div>';
  }

  const markerSpots = spots.map((spot) => ({
    ...spot,
    lat: Math.max(-85.05112878, Math.min(85.05112878, Number(spot.lat))),
    lng: Number(spot.lng)
  }));
  const routePoints = Array.isArray(w.routeLine) && w.routeLine.length > 1
    ? w.routeLine.map((p) => ({ lat: Math.max(-85.05112878, Math.min(85.05112878, Number(p.lat))), lng: Number(p.lng) })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    : markerSpots;
  const validSpots = routePoints.length ? routePoints : markerSpots;

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

  const routePts = validSpots.map((spot, index) => {
    const x = lonToX(spot.lng, zoom) - viewLeft;
    const y = latToY(spot.lat, zoom) - viewTop;
    return { x, y, spot, index };
  });
  const pts = markerSpots.map((spot, index) => {
    const x = lonToX(spot.lng, zoom) - viewLeft;
    const y = latToY(spot.lat, zoom) - viewTop;
    return { x, y, spot, index };
  });

  const pct = (v, max) => (v / max * 100).toFixed(3) + '%';
  const segments = routePts.slice(0, -1).map((p, i) => {
    const q = routePts[i + 1];
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
      <div class="actual-map-label" style="left:${labelLeft};top:${labelTop}">${p.index + 1}. ${escapeHtml(localText(p.spot.name))}</div>
    `;
  }).join('');

  return `
    <div class="actual-map-canvas" role="img" aria-label="${escapeHtml(localText(w.title || 'Wonderland Map'))}${isEnglish() ? ' actual map' : 'の実地図マップ'}">
      <div class="actual-map-tiles">${tiles}</div>
      <div class="actual-map-overlay actual-map-loading">${isEnglish() ? 'Loading actual map...' : '実地図を読み込み中...'}</div>
      ${segments}
      ${markers}
      <div class="actual-map-version">練馬グリーン版 v16</div>
      <div class="actual-map-caption">
        <strong>${escapeHtml(localText(w.title || 'Wonderland Map'))}</strong>
        <span>${escapeHtml(localText(w.area || ''))} / ${isEnglish() ? 'GSI map tiles' : '国土地理院地図タイル'} / Zoom ${zoom}</span>
      </div>
      <div class="actual-map-credit">${isEnglish() ? 'Map: GSI / JIMOWAN Local Map' : '地図: 国土地理院 / JIMOWAN Local Map'}</div>
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
      <h3>${escapeHtml(localText(w.title))}</h3>
      <p>${escapeHtml(localText(w.area))} / ${escapeHtml(w.creator || '')}</p>
    </div>
    <div class="map-rank"><strong>${rankText(w.rank)}</strong><span>${yenLike(w.ranking.total)}P</span></div>
  `;
  const spots = (w.spots || []).filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));
  $('#timetableBody').innerHTML = (w.spots || []).map((spot, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(localText(spot.name))}</strong></td>
      <td>${escapeHtml(spot.arrive || '')}</td>
      <td>${escapeHtml(spot.depart || '')}</td>
      <td>${minText(spot.stayMin || 0)}</td>
      <td>${minText(spot.walkMin || 0)}</td>
      <td>${Number(spot.distanceKm || 0).toFixed(2)}km</td>
      <td>${escapeHtml(localText(spot.notes || ''))}</td>
      <td><div class="map-link-stack"><a class="mini-link" href="${escapeHtml(buildMapSearchUrl(spot, w))}" target="_blank" rel="noopener">${ui('mapPhoto')}</a></div></td>
    </tr>
  `).join('');
  $('#mapSummary').textContent = `${isEnglish() ? `Distance ${Number(w.totalDistanceKm || 0).toFixed(2)}km / Walk ${Number(w.totalWalkingMin || 0)} min / Stay ${Number(w.totalStayMin || 0)} min / Total ${Number(w.totalWalkingMin || 0) + Number(w.totalStayMin || 0)} min` : `合計距離 ${Number(w.totalDistanceKm || 0).toFixed(2)}km / 徒歩 ${Number(w.totalWalkingMin || 0)}分 / 滞在 ${Number(w.totalStayMin || 0)}分 / 総時間目安 ${Number(w.totalWalkingMin || 0) + Number(w.totalStayMin || 0)}分`}`;
  const mapHtml = renderActualTileWonderlandMap(w, spots);
  mapEl.innerHTML = mapHtml || `<div class="stable-map-empty"><strong>練馬グリーン版 v16</strong><br>${isEnglish() ? 'Map generation returned no result.' : 'マップ生成結果が空です。'}</div>`;
  if (!mapEl.textContent.trim()) {
    mapEl.innerHTML = `<div class="stable-map-empty"><strong>練馬グリーン版 v16</strong><br>${isEnglish() ? 'The map was redrawn.' : 'マップを再描画しました。'}</div>`;
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
    locality: normalizeLocalityInput(fd.get('locality') || inferLocalityFromText(`${fd.get('title')} ${fd.get('area')}`)),
    localities: [normalizeLocalityInput(fd.get('locality') || inferLocalityFromText(`${fd.get('title')} ${fd.get('area')}`))].filter(Boolean),
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
  if (form.locality) form.locality.value = '東京都練馬区';
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



const KML_LOCALITY_CENTERS = {
  '千代田区':[35.6940,139.7536], '中央区':[35.6706,139.7720], '港区':[35.6581,139.7516], '新宿区':[35.6938,139.7036], '文京区':[35.7080,139.7520], '台東区':[35.7126,139.7802], '墨田区':[35.7107,139.8015], '江東区':[35.6728,139.8174], '品川区':[35.6092,139.7301], '目黒区':[35.6415,139.6982], '大田区':[35.5614,139.7161], '世田谷区':[35.6466,139.6532], '渋谷区':[35.6640,139.6982], '中野区':[35.7074,139.6638], '杉並区':[35.6995,139.6364], '豊島区':[35.7261,139.7166], '北区':[35.7528,139.7336], '荒川区':[35.7361,139.7834], '板橋区':[35.7512,139.7093], '練馬区':[35.7356,139.6517], '足立区':[35.7750,139.8048], '葛飾区':[35.7433,139.8472], '江戸川区':[35.7067,139.8683],
  '八王子市':[35.6663,139.3158], '立川市':[35.7139,139.4079], '武蔵野市':[35.7177,139.5661], '三鷹市':[35.6835,139.5596], '青梅市':[35.7882,139.2759], '府中市':[35.6689,139.4776], '昭島市':[35.7057,139.3537], '調布市':[35.6506,139.5407], '町田市':[35.5467,139.4386], '小金井市':[35.6994,139.5030], '小平市':[35.7285,139.4774], '日野市':[35.6713,139.3949], '東村山市':[35.7546,139.4686], '国分寺市':[35.7109,139.4622], '国立市':[35.6839,139.4414], '福生市':[35.7386,139.3267], '狛江市':[35.6348,139.5787], '東大和市':[35.7455,139.4265], '清瀬市':[35.7857,139.5263], '東久留米市':[35.7581,139.5298], '武蔵村山市':[35.7548,139.3875], '多摩市':[35.6372,139.4463], '稲城市':[35.6380,139.5046], '羽村市':[35.7672,139.3111], 'あきる野市':[35.7288,139.2942], '西東京市':[35.7256,139.5384], '利島村':[34.5293,139.2823], '大島町':[34.7500,139.3550]
};

function nearestLocalityFromPoints(points) {
  if (!points || !points.length) return '';
  const lat = points.reduce((s,p)=>s+Number(p.lat||0),0) / points.length;
  const lng = points.reduce((s,p)=>s+Number(p.lng||0),0) / points.length;
  let best = ''; let bestD = Infinity;
  Object.entries(KML_LOCALITY_CENTERS).forEach(([loc, pair]) => {
    const d = Math.pow(lat - pair[0], 2) + Math.pow((lng - pair[1]) * Math.cos(lat * Math.PI / 180), 2);
    if (d < bestD) { bestD = d; best = loc; }
  });
  return best;
}

function parseKmlCoordinates(text) {
  return String(text || '').trim().split(/\s+/).map((part) => {
    const [lng, lat] = part.split(',').map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }).filter(Boolean);
}

function downsamplePoints(points, max = 650) {
  if (!Array.isArray(points) || points.length <= max) return points || [];
  const out = [];
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * (points.length - 1) / (max - 1))]);
  return out;
}

function haversineKm(a, b) {
  const R = 6371.0088;
  const toRad = (v) => Number(v) * Math.PI / 180;
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const dLat = lat2 - lat1, dLng = toRad(b.lng) - toRad(a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function routeDistanceKm(points) {
  return (points || []).slice(1).reduce((sum, p, i) => sum + haversineKm(points[i], p), 0);
}

function nearRoute(point, route, thresholdKm = 0.7) {
  if (!route || !route.length) return true;
  const step = Math.max(1, Math.floor(route.length / 220));
  let min = Infinity;
  for (let i = 0; i < route.length; i += step) {
    min = Math.min(min, haversineKm(point, route[i]));
    if (min < thresholdKm) return true;
  }
  return false;
}

function directChildText(el, tagName) {
  const child = Array.from(el.children || []).find((c) => c.localName === tagName);
  return child ? child.textContent.trim().replace(/\s+/g, ' ') : '';
}

function splitJapaneseTitle(name) {
  return String(name || '').split(/[／/]/)[0].trim() || String(name || '').trim();
}

function kmlWonderlandId(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return `twm-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

function parseKmlTextToWonderlands(kmlText, options = {}) {
  const doc = new DOMParser().parseFromString(kmlText, 'application/xml');
  const error = doc.querySelector('parsererror');
  if (error) throw new Error('KMLを解析できませんでした。XML形式を確認してください。');
  const rootDoc = Array.from(doc.documentElement.children || []).find((c) => c.localName === 'Document');
  const folders = Array.from((rootDoc || doc).children || []).filter((c) => c.localName === 'Folder');
  const limit = Math.max(1, Math.min(600, Number(options.limit || 300)));
  const source = options.source || 'TOKYO WALKING MAP KML';
  return folders.slice(0, limit).map((folder) => {
    const rawName = directChildText(folder, 'name') || 'KMLウォーキングコース';
    const placemarks = Array.from(folder.getElementsByTagNameNS('*', 'Placemark'));
    const linePlacemark = placemarks.find((pm) => pm.getElementsByTagNameNS('*', 'LineString').length);
    const route = linePlacemark ? parseKmlCoordinates(linePlacemark.getElementsByTagNameNS('*', 'coordinates')[0]?.textContent || '') : [];
    const pointCandidates = placemarks.map((pm) => {
      const point = pm.getElementsByTagNameNS('*', 'Point')[0];
      if (!point) return null;
      const c = parseKmlCoordinates(point.getElementsByTagNameNS('*', 'coordinates')[0]?.textContent || '')[0];
      if (!c) return null;
      const name = directChildText(pm, 'name') || '地点';
      const style = directChildText(pm, 'styleUrl');
      const desc = directChildText(pm, 'description');
      if (!style.includes('nodesc') && !/^スタート|^ゴール|^Start|^Goal/.test(name)) return null;
      if (!nearRoute(c, route)) return null;
      return { name, coord: c, notes: desc };
    }).filter(Boolean);
    const selected = pointCandidates.length ? downsamplePoints(pointCandidates, 24) : [{ name: 'スタート地点', coord: route[0] }, { name: 'ゴール地点', coord: route[route.length - 1] }].filter((s)=>s.coord);
    const locality = inferLocalityFromText([rawName, ...selected.map((s)=>s.name)].join(' ')) || nearestLocalityFromPoints(route.length ? route : selected.map((s)=>s.coord)) || '東京都';
    const area = locality === '東京都' ? '東京都' : `東京都${locality}`;
    const distance = Number(routeDistanceKm(route.length ? route : selected.map((s)=>s.coord)).toFixed(2));
    const walking = Math.max(5, Math.round(distance * 12));
    let elapsed = 0;
    let prev = null;
    const spots = selected.map((s, index) => {
      const walk = prev ? Math.round(haversineKm(prev, s.coord) * 12) : 0;
      elapsed += walk;
      const stay = index === 0 || index === selected.length - 1 ? 10 : 5;
      const arrive = `${String(10 + Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
      const departTotal = elapsed + stay;
      const depart = `${String(10 + Math.floor(departTotal/60)).padStart(2,'0')}:${String(departTotal%60).padStart(2,'0')}`;
      const item = { name: s.name, arrive, depart, stayMin: stay, walkMin: walk, distanceKm: prev ? Number(haversineKm(prev, s.coord).toFixed(2)) : 0, lat: s.coord.lat, lng: s.coord.lng, notes: s.notes || 'KMLから取り込んだ通過ポイント。' };
      elapsed = departTotal; prev = s.coord; return item;
    });
    const titleCore = splitJapaneseTitle(rawName);
    return {
      id: kmlWonderlandId(rawName), title: locality && !titleCore.includes(locality) ? `${locality}＋${titleCore} ワンダーランド` : `${titleCore} ワンダーランド`, area, locality, localities: [locality], creator: '東京都オープンデータ / TOKYO WALKING MAP KML',
      catchCopy: `${locality}の道を歩くと、ふだん見過ごす地元の表情が立ち上がる。`,
      description: `KMLから取り込んだウォーキングコースです。元コース名：${rawName}`,
      duration: `約${walking}分`, totalDistanceKm: distance, totalWalkingMin: walking, totalStayMin: spots.reduce((sum,s)=>sum+s.stayMin,0),
      tags: ['東京ウォーキングマップ','KML取込','ウォーキング',locality].filter(Boolean), coverImage: '', createdAt: new Date().toISOString(), spots, routeLine: downsamplePoints(route, 650),
      votes: { unknown: 360, surprise: 360, try: 400, voters: 100 }, sourceNote: `${source} / ${rawName}`, importSource: source
    };
  }).filter((w) => w.spots.length >= 2);
}

async function handleKmlImport(event) {
  event.preventDefault();
  const file = $('#kmlFile')?.files?.[0];
  const resultEl = $('#kmlImportResult');
  if (!file) { showNotice(isEnglish() ? 'Choose a KML file first.' : 'KMLファイルを選択してください。', 'error'); return; }
  resultEl.innerHTML = `<div class="notice show">${isEnglish() ? 'Reading KML...' : 'KMLを読み込んでいます...'}</div>`;
  try {
    const text = await file.text();
    const wonderlands = parseKmlTextToWonderlands(text, { limit: $('#kmlLimit')?.value || 300, source: $('#kmlSource')?.value || file.name });
    if (!wonderlands.length) throw new Error('取り込めるワンダーランドが見つかりませんでした。');
    resultEl.innerHTML = `<div class="notice show">${wonderlands.length}${isEnglish() ? ' Wonderlands parsed. Uploading...' : '件を変換しました。登録中...'}</div>`;
    const result = await api('/api/wonderlands/bulk', { method: 'POST', body: JSON.stringify({ wonderlands }) });
    state.wonderlands = result.wonderlands || state.wonderlands;
    renderAll();
    resultEl.innerHTML = `<div class="kml-result-card"><strong>${isEnglish() ? 'Import complete' : '取込完了'}</strong><p>${isEnglish() ? 'Imported' : '追加'}: ${result.importedCount} / ${isEnglish() ? 'Skipped' : '重複スキップ'}: ${result.skippedCount}</p></div>`;
    showNotice(`${result.importedCount}${isEnglish() ? ' Wonderlands imported.' : '件のワンダーランドを取り込みました。'}`);
  } catch (error) {
    resultEl.innerHTML = `<div class="notice show error">${escapeHtml(error.message)}</div>`;
    showNotice(error.message, 'error');
  }
}

function bindEvents() {

  $('#langToggle')?.addEventListener('click', () => setLanguage(isEnglish() ? 'ja' : 'en'));
  $('#kmlImportForm')?.addEventListener('submit', handleKmlImport);
  $('#topSearchForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = $('#topSearchInput')?.value || '';
    const free = $('#freeSearchInput');
    if (free) free.value = q;
    setActiveTab('discover');
    renderSearchResults();
  });
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


function applyInitialQuery() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || localStorage.getItem('jimowanQuery') || '';
  if (!q) return;
  const top = $('#topSearchInput');
  const free = $('#freeSearchInput');
  if (top) top.value = q;
  if (free) free.value = q;
  setActiveTab('discover');
  renderSearchResults();
  localStorage.removeItem('jimowanQuery');
}

function boot() {
  addSpot({ spotName: 'スタート地点', arrive: '13:00', depart: '13:05', stayMin: 5, walkMin: 0, distanceKm: 0, lat: 35.681236, lng: 139.767125, notes: '集合場所' });
  addSpot({ spotName: '発見スポット', arrive: '13:15', depart: '13:35', stayMin: 20, walkMin: 10, distanceKm: 0.8, lat: 35.6845, lng: 139.7708, notes: '知られていない地元ネタ' });
  applyStaticLanguage();
  bindEvents();
  loadWonderlands().then(applyInitialQuery).catch((error) => showNotice(error.message, 'error'));
}

document.addEventListener('DOMContentLoaded', boot);
