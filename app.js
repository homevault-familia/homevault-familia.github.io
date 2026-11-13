/* HomeVault 2 — app.js
 * Mesmo desenho e mesmas regras do "Gastos da Casa", com categorias e subcategorias
 * definidas por cada família. Dados criptografados no aparelho (AES-GCM 256, chave
 * derivada da senha da casa com PBKDF2-SHA256) antes de irem ao Firebase.
 */
(function () {
'use strict';

var VERSAO = '2.2.0';
var PBKDF2_ITER = 310000;
var VERIF_TEXTO = 'HOMEVAULT-OK';
var PARC = 'parcelados';
var PALETA = ['#e53935', '#fb8c00', '#43a047', '#0284c7', '#00897b', '#d81b60', '#6d4c41', '#3949ab', '#f4511e', '#8e24aa', '#546e7a', '#c0a000'];
var EMOJIS = ['🚗', '⛽', '🛒', '🛍️', '🏠', '💡', '✈️', '🍽️', '☕', '🩺', '💊', '🐾', '👕', '📚', '🎓', '🎉', '🎮', '💳', '🏦', '📱', '🔧', '👶', '🏋️', '💇', '🎁', '🍺', '🧾', '📦', '⚽', '🏖️'];
var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
var MESES_C = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ═════════════════════════ utilitários ═════════════════════════
function $(id) { return document.getElementById(id); }
function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
var ALFA = 'abcdefghijkmnpqrstuvwxyz23456789';
function rid(n) {
  var b = new Uint8Array(n), s = '';
  crypto.getRandomValues(b);
  for (var i = 0; i < n; i++) s += ALFA[b[i] % ALFA.length];
  return s;
}
function isoDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function hoje() { return isoDe(new Date()); }
function mesAtual() { return hoje().slice(0, 7); }
function dataObj(s) { return new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12); }
function proxDia(s) { var d = dataObj(s); d.setDate(d.getDate() + 1); return isoDe(d); }
function diasEntre(a, b) { return Math.round((dataObj(b) - dataObj(a)) / 86400000); }
function ultimoDiaMes(ym) { return isoDe(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0)); }
function addMeses(dataStr, meses) {
  var ano = +dataStr.slice(0, 4), mes = +dataStr.slice(5, 7) - 1, dia = +dataStr.slice(8, 10);
  var nm = mes + meses, na = ano + Math.floor(nm / 12);
  nm = ((nm % 12) + 12) % 12;
  dia = Math.min(dia, new Date(na, nm + 1, 0).getDate());
  return na + '-' + String(nm + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}
function formatarData(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; }
function nomeMes(k) { return MESES[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4); }
var SIMB = { CAD: 'CA$', USD: 'US$', BRL: 'R$', EUR: '€' };
function moeda() { return (S.cfg && S.cfg.moeda) || 'CAD'; }
function formatar(n) {
  n = +n || 0;
  var neg = n < 0; n = Math.abs(n);
  var br = moeda() === 'BRL' || moeda() === 'EUR';
  var s = n.toFixed(2), int = s.slice(0, -3), dec = s.slice(-2);
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, br ? '.' : ',');
  return (neg ? '-' : '') + SIMB[moeda()] + ' ' + int + (br ? ',' : '.') + dec;
}
// Aceita "12,50", "12.50", "1.234,56", "1,234.56" → número (2 casas)
function lerValor(txt) {
  var s = String(txt == null ? '' : txt).replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  var dec = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (dec >= 0 && s.length - dec - 1 <= 2) s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1);
  else s = s.replace(/[.,]/g, '');
  var n = parseFloat(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
function numTxt(v) { return v ? String(v).replace('.', moeda() === 'BRL' || moeda() === 'EUR' ? ',' : '.') : ''; }
var _tmr = null;
function mostrarToast(ic, msg, ms) {
  $('ti').textContent = ic; $('tm').textContent = msg;
  var t = $('toast'); t.classList.add('visivel');
  clearTimeout(_tmr); _tmr = setTimeout(function () { t.classList.remove('visivel'); }, ms || 2400);
}
function alfa(cor, a) { return cor + a; } // cor "#rrggbb" + alfa hex "22"

// ═════════════════════════ criptografia ═════════════════════════
var enc = new TextEncoder(), dec = new TextDecoder();
function b64(buf) {
  var bytes = new Uint8Array(buf), s = '';
  for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(str) { var s = atob(str), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
function derivarChave(senha, saltB64) {
  return crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveKey']).then(function (base) {
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: PBKDF2_ITER, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  });
}
function cifrar(chave, obj) {
  var iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, chave, enc.encode(JSON.stringify(obj)))
    .then(function (ct) { return { iv: b64(iv), d: b64(ct) }; });
}
function decifrar(chave, pac) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(pac.iv) }, chave, unb64(pac.d))
    .then(function (pt) { return JSON.parse(dec.decode(pt)); });
}
var IDB = {
  abrir: function () {
    return new Promise(function (ok, erro) {
      var r = indexedDB.open('homevault', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('chaves'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { erro(r.error); };
    });
  },
  op: function (modo, fn) {
    return IDB.abrir().then(function (db) {
      return new Promise(function (ok, erro) {
        var tx = db.transaction('chaves', modo), req = fn(tx.objectStore('chaves'));
        tx.oncomplete = function () { ok(req && req.result); };
        tx.onerror = function () { erro(tx.error); };
      });
    });
  },
  get: function (k) { return IDB.op('readonly', function (s) { return s.get(k); }).catch(function () { return null; }); },
  set: function (k, v) { return IDB.op('readwrite', function (s) { return s.put(v, k); }).catch(function () {}); },
  del: function (k) { return IDB.op('readwrite', function (s) { return s.delete(k); }).catch(function () {}); }
};

// ═════════════════════════ estado ═════════════════════════
var S = {
  user: null, casa: null, chave: null, meta: null,
  cfg: null, raw: {}, perfis: {}, membros: {}, refs: [],
  tela: 'inicio', per: { hist: 'periodo', rel: 'periodo', relcat: 'periodo', proj: 'periodo' },
  mesHist: mesAtual(), rcCat: null,
  add: { cat: null, sub: null, nParc: 1, parcIni: 1, editId: null }
};
var db, auth;

// ═════════════════════════ categorias ═════════════════════════
function catsPadrao() {
  function c(emoji, nome, cor, subs) { return { id: rid(8), emoji: emoji, nome: nome, cor: cor, orc: 0, subs: subs.map(function (n) { return { id: rid(8), nome: n }; }) }; }
  return [
    c('🚗', 'Carro', '#e53935', ['Combustível', 'Manutenção', 'Seguro', 'Estacionamento', 'Outros']),
    c('🛒', 'Supermercado', '#43a047', ['Supermercado', 'Feira', 'Padaria', 'Farmácia']),
    c('🛍️', 'Diversos', '#fb8c00', ['Roupas', 'Restaurantes', 'Lazer', 'Assinaturas', 'Saúde', 'Pets', 'Outros']),
    c('🏠', 'Casa', '#00897b', ['Aluguel / Financiamento', 'Luz', 'Água', 'Internet / Telefone', 'Manutenção']),
    c('✈️', 'Viagens', '#0284c7', ['Hospedagem', 'Alimentação', 'Transporte', 'Passeios'])
  ];
}
function periodoMesAtual() { var m = mesAtual(); return { inicio: m + '-01', fim: ultimoDiaMes(m) }; }
// Garante o formato v2 (também converte casas criadas na versão 1)
function normalizarCfg(c) {
  var mudou = false;
  c = c || {};
  if (c.v !== 2) {
    c.cats = (c.cats || []).filter(function (x) { return x.tipo !== 'receita'; }).map(function (x, i) {
      return { id: x.id, emoji: x.emoji || '📦', nome: x.nome, cor: x.cor || PALETA[i % PALETA.length], orc: +x.orc || 0, subs: x.subs || [] };
    });
    if (c.limite == null) c.limite = 0;
    if (!c.alertaPct) c.alertaPct = 80;
    if (!c.periodo) c.periodo = periodoMesAtual();
    if (c.orcParc == null) c.orcParc = 0;
    c.v = 2; mudou = true;
  }
  return { cfg: c, mudou: mudou };
}
function catsComuns() { return (S.cfg && S.cfg.cats) || []; }
function catParc() { return { id: PARC, emoji: '📦', nome: 'Parcelados', cor: '#7c3aed', orc: (S.cfg && +S.cfg.orcParc) || 0, subs: [] }; }
function todasCats() { return catsComuns().concat([catParc()]); }
function catPorId(id) {
  if (id === PARC) return catParc();
  var cs = catsComuns();
  for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
  return null;
}
function NOME(id) { var c = catPorId(id); return c ? c.nome : 'Sem categoria'; }
function COR(id) { var c = catPorId(id); return c ? c.cor : '#9ca3af'; }
function EMO(id) { var c = catPorId(id); return c ? c.emoji : '❔'; }
function nomeSub(catId, subId) {
  if (!subId) return '';
  var c = catPorId(catId); if (!c) return '';
  for (var i = 0; i < c.subs.length; i++) if (c.subs[i].id === subId) return c.subs[i].nome;
  return '';
}
function orcDe(id) { var c = catPorId(id); return c ? (+c.orc || 0) : 0; }

// ═════════════════════════ lançamentos (visão) ═════════════════════════
// Registro guardado (cifrado): { v: centavos, dt, c, s, d, por, ts, p?: { n, total, g, vt } }
function lancamentos() {
  return Object.keys(S.raw).map(function (id) {
    var r = S.raw[id];
    if (!r || r.t === 'receita') return null;
    return {
      id: id, data: r.dt, valor: (r.v || 0) / 100, cat: r.p ? PARC : r.c, sub: r.s || null, desc: r.d || '',
      por: r.por, ts: r.ts || 0,
      parcela: r.p ? { n: r.p.n, total: r.p.total, grupoId: r.p.g, valorTotal: (r.p.vt || 0) / 100 } : null
    };
  }).filter(Boolean);
}
function lancamentosPeriodo(lista, p) { return lista.filter(function (l) { return l.data && l.data >= p.inicio && l.data <= p.fim; }); }
function descLanc(l) { return l.desc || nomeSub(l.cat, l.sub) || NOME(l.cat); }
function metaLanc(l, comData) {
  var s = (comData ? formatarData(l.data) + ' · ' : '') + NOME(l.cat);
  var sb = nomeSub(l.cat, l.sub);
  if (sb && l.desc) s += ' · ' + sb;
  if (Object.keys(S.membros).length > 1 && S.perfis[l.por]) s += ' · ' + S.perfis[l.por].nome;
  return esc(s);
}

// Parcelamentos (mesma lógica do app original)
function resolverGrupos(lista) {
  var grupos = {};
  lista.forEach(function (l) {
    if (!l.parcela) return;
    var gid = l.parcela.grupoId;
    if (!grupos[gid]) grupos[gid] = { total: l.parcela.total, valorParc: l.valor, desc: l.desc || '', lancs: {}, valorTotal: l.parcela.valorTotal };
    grupos[gid].lancs[l.parcela.n] = l;
    if (!grupos[gid].desc && l.desc) grupos[gid].desc = l.desc;
  });
  return grupos;
}
function planosAtivos(lista) {
  var hj = hoje(), grupos = resolverGrupos(lista), planos = [];
  Object.keys(grupos).forEach(function (gid) {
    var g = grupos[gid], pagas = 0;
    Object.keys(g.lancs).forEach(function (n) { if (g.lancs[n].data <= hj && +n > pagas) pagas = +n; });
    planos.push({ gid: gid, desc: g.desc || 'Parcelado', valorParc: g.valorParc, total: g.total, pagas: pagas, quitado: pagas >= g.total, valorTotal: g.valorTotal, lancs: g.lancs });
  });
  return planos;
}
function calcularMensalParcelados(lista) {
  return planosAtivos(lista).reduce(function (s, p) { return s + (p.quitado ? 0 : p.valorParc); }, 0);
}
function buildPagasMap(lista) {
  var hj = hoje(), map = {};
  lista.forEach(function (l) {
    if (!l.parcela) return;
    var g = l.parcela.grupoId;
    if (!(g in map)) map[g] = 0;
    if (l.data < hj && l.parcela.n > map[g]) map[g] = l.parcela.n;
  });
  return map;
}
function parcelaBadgeHtml(l, pagasMap) {
  if (!l.parcela) return '';
  var pagas = (pagasMap && l.parcela.grupoId in pagasMap) ? pagasMap[l.parcela.grupoId] : 0;
  return '<span class="lanc-parcela">' + Math.min(pagas + 1, l.parcela.total) + '/' + l.parcela.total + '</span>';
}

// Totais do período: gastos comuns por categoria + parcelados (compromisso mensal ativo)
function totaisPeriodo(p) {
  var todos = lancamentos(), lista = lancamentosPeriodo(todos, p);
  var tots = {}, qtds = {}, porDia = {}, porDiaCat = {}, comum = 0, nComuns = 0;
  todasCats().forEach(function (c) { tots[c.id] = 0; qtds[c.id] = 0; porDiaCat[c.id] = {}; });
  lista.forEach(function (l) {
    var k = l.cat;
    if (!(k in tots)) { tots[k] = 0; qtds[k] = 0; porDiaCat[k] = {}; }
    qtds[k]++;
    if (k === PARC) return;
    tots[k] += l.valor; comum += l.valor; nComuns++;
    porDia[l.data] = (porDia[l.data] || 0) + l.valor;
    porDiaCat[k][l.data] = (porDiaCat[k][l.data] || 0) + l.valor;
  });
  tots[PARC] = calcularMensalParcelados(todos);
  return { todos: todos, lista: lista, tots: tots, qtds: qtds, comum: comum, nComuns: nComuns, porDia: porDia, porDiaCat: porDiaCat };
}
function orcComum() { return catsComuns().reduce(function (s, c) { return s + (+c.orc || 0); }, 0); }
// Valor-base para "Disponível": o valor para gastar no período; sem ele, a soma dos orçamentos
function baseDisponivel() { var lim = +S.cfg.limite || 0; return lim > 0 ? lim : orcComum(); }

// ═════════════════════════ telas ═════════════════════════
function mostrarEntrada(card) {
  ['card-semconfig', 'card-auth', 'card-casa', 'card-unlock'].forEach(function (id) { $(id).style.display = id === card ? '' : 'none'; });
  $('tela-login').classList.add('ativa');
  $('nav').style.display = 'none';
  qsa('.tela').forEach(function (t) { t.classList.remove('ativa'); });
  $('app-loading').style.display = 'none';
}
function carregando(txt) { $('ld-txt').textContent = txt || 'Carregando…'; $('app-loading').style.display = ''; }

function irPara(tela) {
  if (!S.chave) return;
  $('tela-login').classList.remove('ativa');
  $('app-loading').style.display = 'none';
  $('nav').style.display = '';
  qsa('.tela').forEach(function (t) { t.classList.remove('ativa'); });
  $('tela-' + tela).classList.add('ativa');
  S.tela = tela;
  var navMap = { categoria: 'relcat', semana: 'relatorio' };
  if (tela === 'semana') S.semOff = 0;
  qsa('.nav button').forEach(function (b) { b.classList.remove('active'); });
  var nb = $('nb-' + (navMap[tela] || tela)); if (nb) nb.classList.add('active');
  if (tela === 'add' && !S.add.editId) novoLancamento();
  renderTela();
  window.scrollTo(0, 0);
}
function renderTela() {
  if (!S.chave || !S.cfg) return;
  var t = S.tela;
  if (t === 'inicio') renderizar();
  else if (t === 'add') renderAdd();
  else if (t === 'historico') renderizarHistorico();
  else if (t === 'relatorio') renderizarRelatorio();
  else if (t === 'relcat') renderizarRelcat();
  else if (t === 'categoria') irParaCategoria(S.catAberta, true);
  else if (t === 'projecao') atualizarProjecao();
  else if (t === 'ajustes') renderAjustes();
  else if (t === 'semana') renderizarSemana();
}
var _rt;
function renderLogo() { clearTimeout(_rt); _rt = setTimeout(renderTela, 60); }

// ═════════════════════════ INÍCIO ═════════════════════════
function renderizar() {
  var c = S.cfg, p = c.periodo, T = totaisPeriodo(p);
  var hj = hoje();
  var totalHoje = T.todos.filter(function (l) { return l.data === hj; }).reduce(function (s, l) { return s + l.valor; }, 0);
  $('txt-casa').textContent = '🏠 ' + (c.nome || 'HomeVault');
  $('txt-total').textContent = formatar(T.comum);
  var parc = T.tots[PARC] || 0;
  $('hero-parc-wrap').style.display = parc > 0 ? '' : 'none';
  $('txt-total-parc').textContent = formatar(parc);
  var i = p.inicio.split('-'), f = p.fim.split('-'), MC = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  $('hero-periodo').textContent = (+i[2]) + ' ' + MC[+i[1] - 1] + ' – ' + (+f[2]) + ' ' + MC[+f[1] - 1];

  var base = baseDisponivel(), rest = base - T.comum;
  $('txt-disponivel').textContent = base > 0 ? formatar(rest) : formatar(0);
  $('txt-disponivel').style.color = (base > 0 && rest < 0) ? '#ff6b6b' : 'white';
  $('txt-restante').textContent = (+c.limite > 0) ? 'Limite: ' + formatar(c.limite) : (base > 0 ? 'Soma dos orçamentos: ' + formatar(base) : 'Defina o valor em ⚙️ Config');
  $('txt-hoje').textContent = 'Hoje: ' + formatar(totalHoje);
  var pct = base > 0 ? Math.min(T.comum / base * 100, 100) : 0;
  var excedeu = base > 0 && T.comum > base;
  $('barra').style.width = pct + '%';
  $('barra').style.background = excedeu ? '#f44336' : pct >= c.alertaPct ? '#ff9800' : '#4caf50';
  $('txt-pct').textContent = pct.toFixed(1) + '% utilizado';
  var al = $('alerta');
  if (excedeu) { al.className = 'alerta excedido'; al.textContent = '🚨 LIMITE EXCEDIDO! Você gastou ' + formatar(T.comum - base) + ' além do disponível.'; }
  else if (base > 0 && pct >= c.alertaPct) { al.className = 'alerta atencao'; al.textContent = '⚠️ Atenção: ' + pct.toFixed(0) + '% do disponível utilizado. Restam ' + formatar(rest) + '.'; }
  else { al.className = 'alerta'; al.textContent = ''; }

  // Cards de categoria
  $('grid-cat').innerHTML = todasCats().map(function (cat) {
    var gasto = T.tots[cat.id] || 0, orc = +cat.orc || 0, qtd = T.qtds[cat.id] || 0;
    var corpo;
    if (orc > 0) {
      var pC = Math.min(gasto / orc * 100, 100), restC = orc - gasto;
      var corB = gasto > orc ? '#f44336' : pC >= 80 ? '#ff9800' : cat.cor;
      corpo = '<div class="cat-linha-vals"><div><div class="cat-rotulo">Gasto</div><div class="cat-valor" style="color:' + cat.cor + '">' + formatar(gasto) + '</div>' +
        '<div class="cat-sub-orc">Orç: ' + formatar(orc) + '</div></div>' +
        '<div style="text-align:right"><div class="cat-rotulo">Disponível</div><div class="cat-valor" style="color:' + (restC < 0 ? '#f44336' : '#43a047') + '">' + formatar(restC) + '</div></div></div>' +
        '<div class="cat-barra-fundo" style="display:block"><div class="cat-barra-fill" style="width:' + pC + '%;background:' + corB + '"></div></div>' +
        '<div class="cat-orc" style="color:' + (restC < 0 ? '#f44336' : '#bbb') + '">' + pC.toFixed(0) + '% utilizado</div>';
    } else {
      corpo = '<div class="cat-linha-vals"><div><div class="cat-rotulo">Gasto</div><div class="cat-valor" style="color:' + cat.cor + '">' + formatar(gasto) + '</div><div class="cat-sub-orc"></div></div>' +
        '<div style="text-align:right"><div class="cat-rotulo">Disponível</div><div class="cat-valor" style="color:#ccc">—</div></div></div>';
    }
    return '<div class="card-cat" data-cat="' + cat.id + '">' +
      '<div class="cat-header"><span class="cat-icon" style="background:' + alfa(cat.cor, '22') + '">' + esc(cat.emoji) + '</span><span class="cat-nome">' + esc(cat.nome) + '</span><span class="cat-qtd">' + qtd + ' lanç.</span></div>' +
      corpo + '</div>';
  }).join('');

  renderizarPizza(T.tots, T.comum);
  renderizarBarras(T.lista, p);
  renderizarRecentes(T.todos);
  pintarCartaoSemana();
  if (!$('topo-config').classList.contains('editando')) preencherConfig();
}

function renderizarPizza(tots, total) {
  $('pizza-wrap').innerHTML = '<div class="pizza-legenda">' + todasCats().map(function (c) {
    var v = tots[c.id] || 0, orc = +c.orc || 0;
    var pct = orc > 0 ? (v / orc * 100).toFixed(0) : (total > 0 ? (v / total * 100).toFixed(0) : 0);
    var cor = v > orc && orc > 0 ? '#f44336' : c.cor;
    return '<div class="pizza-item"><div class="pizza-cor" style="background:' + cor + '"></div>' +
      '<div class="pizza-txt">' + esc(c.nome) + ' <span style="color:#aaa;font-size:11px">(' + pct + '% ' + (orc > 0 ? 'do orç.' : 'do total') + ')</span></div>' +
      '<div class="pizza-val" style="color:' + cor + '">' + formatar(v) + '</div></div>';
  }).join('') + '</div>';
}

function renderizarBarras(lista, p) {
  var el = $('barras-div'), porDia = {}, hj = hoje();
  lista.forEach(function (l) {
    if (!porDia[l.data]) porDia[l.data] = { total: 0 };
    porDia[l.data][l.cat] = (porDia[l.data][l.cat] || 0) + l.valor;
    porDia[l.data].total += l.valor;
  });
  var dias = [];
  for (var d = p.inicio; d <= p.fim && d <= hj; d = proxDia(d)) { dias.push(d); if (dias.length > 400) break; }
  if (!dias.length) { el.innerHTML = '<div class="vazio">Nenhum dado no período</div>'; return; }
  var maxVal = 0;
  dias.forEach(function (d) { if ((porDia[d] || {}).total > maxVal) maxVal = porDia[d].total; });
  if (maxVal === 0) maxVal = 1;
  var diasCom = dias.filter(function (d) { return porDia[d] && porDia[d].total > 0; });
  var totalGeral = diasCom.reduce(function (s, d) { return s + porDia[d].total; }, 0);
  var media = diasCom.length ? totalGeral / diasCom.length : 0;
  function fmtY(v) { return v >= 1000 ? SIMB[moeda()] + (v / 1000).toFixed(1) + 'k' : SIMB[moeda()] + Math.round(v); }
  var melhorDia = '', melhorVal = 0;
  dias.forEach(function (d) { if ((porDia[d] || {}).total > melhorVal) { melhorVal = porDia[d].total; melhorDia = d; } });
  var stats = '<div class="chart-stats">' +
    '<div class="chart-stat"><div class="chart-stat-val">' + fmtY(media) + '</div><div class="chart-stat-label">Média/dia</div></div>' +
    '<div class="chart-stat"><div class="chart-stat-val">' + diasCom.length + '</div><div class="chart-stat-label">Dias c/ gasto</div></div>' +
    '<div class="chart-stat"><div class="chart-stat-val">' + (melhorDia ? (+melhorDia.slice(8, 10)) + '/' + (+melhorDia.slice(5, 7)) : '—') + '</div><div class="chart-stat-label">Maior gasto</div></div></div>';
  var CHART_H = 160, barW = Math.max(12, Math.floor((300 - 38 - 3 * dias.length) / dias.length));
  var cats = todasCats();
  var bars = dias.map(function (d) {
    var data = porDia[d] || { total: 0 }, total = data.total;
    var totalH = total > 0 ? Math.max(6, Math.round(total / maxVal * CHART_H)) : 0;
    var segs = '';
    if (total > 0) {
      var usado = 0, partes = [];
      cats.concat([{ id: '_x', cor: '#9ca3af' }]).forEach(function (c) {
        var v = c.id === '_x' ? Object.keys(data).filter(function (k) { return k !== 'total' && !catPorId(k); }).reduce(function (s, k) { return s + data[k]; }, 0) : (data[c.id] || 0);
        if (v > 0) partes.push({ h: Math.round(v / total * totalH), cor: c.cor });
      });
      partes.forEach(function (pt) { usado += pt.h; });
      if (partes.length) partes[0].h += totalH - usado;
      segs = partes.reverse().map(function (pt) { return pt.h > 0 ? '<div class="bar-seg" style="height:' + pt.h + 'px;background:' + pt.cor + '"></div>' : ''; }).join('');
    } else segs = '<div class="bar-empty"></div>';
    var lbl = (total > 0 && totalH > 20 && barW >= 14) ? (total >= 1000 ? (total / 1000).toFixed(1) + 'k' : Math.round(total) + '') : '';
    return '<div class="bar-col' + (d === hj ? ' bar-hoje' : '') + '" style="width:' + barW + 'px"><div class="bar-val">' + lbl + '</div>' +
      '<div class="bar-stack" style="height:' + CHART_H + 'px">' + segs + '</div><div class="bar-dia">' + (+d.slice(8, 10)) + '</div></div>';
  }).join('');
  var mediaPos = Math.round(media / maxVal * CHART_H);
  el.innerHTML = stats +
    '<div class="chart-wrap"><div class="chart-inner">' +
    '<div class="chart-yaxis"><div class="chart-ylabel">' + fmtY(maxVal) + '</div><div class="chart-ylabel">' + fmtY(maxVal / 2) + '</div><div class="chart-ylabel">' + fmtY(0) + '</div></div>' +
    '<div class="chart-body"><div class="chart-grid"><div class="chart-gridline"></div><div class="chart-gridline"></div><div class="chart-gridline"></div></div>' +
    (media > 0 ? '<div class="chart-media-line" style="bottom:' + (26 + mediaPos) + 'px"><span class="chart-media-label">méd ' + fmtY(media) + '</span></div>' : '') +
    '<div class="chart-bars" style="height:' + (CHART_H + 26) + 'px">' + bars + '</div></div></div></div>' +
    '<div class="chart-legenda">' + cats.map(function (c) { return '<div class="chart-leg-item"><div class="chart-leg-cor" style="background:' + c.cor + '"></div>' + esc(c.nome) + '</div>'; }).join('') +
    '<div class="chart-leg-item"><div style="width:14px;border-top:2px dashed rgba(29,78,216,.6)"></div>Média</div></div>';
}

function linhaLanc(l, pagasMap, comData, classe) {
  return '<div class="' + (classe || 'lancamento') + '">' +
    '<div class="lanc-ponto" style="background:' + COR(l.cat) + ';flex-shrink:0"></div>' +
    '<div class="lanc-info"><div class="lanc-desc">' + esc(descLanc(l)) + parcelaBadgeHtml(l, pagasMap) + '</div>' +
    '<div class="lanc-meta">' + metaLanc(l, comData) + '</div></div>' +
    '<div class="lanc-valor" style="color:' + COR(l.cat) + '">' + formatar(l.valor) + '</div>' +
    '<button class="lanc-edit" data-editar="' + l.id + '">✏️</button>' +
    '<button class="lanc-del" data-excluir="' + l.id + '">🗑️</button></div>';
}
function renderizarRecentes(todos) {
  var hj = hoje();
  var rec = todos.filter(function (l) { return l.data <= hj; }).sort(function (a, b) {
    return a.data < b.data ? 1 : a.data > b.data ? -1 : b.ts - a.ts;
  }).slice(0, 8);
  if (!rec.length) { $('lista-recentes').innerHTML = '<div class="vazio">📭 Nenhum lançamento ainda.<br>Toque em <b>Registrar</b> para começar.</div>'; return; }
  var pm = buildPagasMap(todos);
  $('lista-recentes').innerHTML = rec.map(function (l) { return linhaLanc(l, pm, true); }).join('');
}

// Configurações (limite, alerta, período, orçamentos)
function preencherConfig() {
  var c = S.cfg;
  $('inp-limite').value = numTxt(c.limite);
  $('inp-alerta').value = c.alertaPct || 80;
  $('inp-inicio').value = c.periodo.inicio;
  $('inp-fim').value = c.periodo.fim;
  $('grid-orc').innerHTML = todasCats().map(function (cat) {
    return '<div class="campo-orc"><label>' + esc(cat.emoji + ' ' + cat.nome) + '</label>' +
      '<input type="text" inputmode="decimal" data-orc="' + cat.id + '" placeholder="0" value="' + esc(numTxt(cat.orc)) + '"></div>';
  }).join('');
}
function salvarConfigTopo() {
  var c = S.cfg;
  var lim = lerValor($('inp-limite').value);
  c.limite = isFinite(lim) && lim > 0 ? lim : 0;
  var pct = parseInt($('inp-alerta').value, 10);
  c.alertaPct = pct > 0 && pct <= 100 ? pct : 80;
  var ini = $('inp-inicio').value, fim = $('inp-fim').value;
  if (ini && fim) {
    if (ini > fim) mostrarToast('⚠️', 'Início deve ser antes do fim');
    else c.periodo = { inicio: ini, fim: fim };
  }
  qsa('[data-orc]').forEach(function (inp) {
    var v = lerValor(inp.value); v = isFinite(v) && v > 0 ? v : 0;
    if (inp.dataset.orc === PARC) c.orcParc = v;
    else { var cat = catPorId(inp.dataset.orc); if (cat) cat.orc = v; }
  });
  salvarCfg();
  renderizar();
}
function toggleConfig() {
  var cfg = $('topo-config'), tg = $('cfg-toggle'), abrir = cfg.style.display !== 'block';
  cfg.style.display = abrir ? 'block' : 'none';
  tg.classList.toggle('aberto', abrir);
  if (abrir) preencherConfig();
}
// Avança o período automaticamente quando ele termina (mesma duração, meses seguintes)
function verificarAvancoPeriodo() {
  var c = S.cfg, hj = hoje();
  if (!c.periodo || hj <= c.periodo.fim) return;
  var meses = 0, it = 60;
  while (hj > addMeses(c.periodo.fim, meses) && it-- > 0) meses++;
  c.periodo = { inicio: addMeses(c.periodo.inicio, meses), fim: addMeses(c.periodo.fim, meses) };
  salvarCfg();
  mostrarToast('📅', 'Período avançado: ' + formatarData(c.periodo.inicio) + ' → ' + formatarData(c.periodo.fim));
}

// ═════════════════════════ DETALHE CATEGORIA ═════════════════════════
function irParaCategoria(cat, soRender) {
  S.catAberta = cat;
  var p = S.cfg.periodo, todos = lancamentos(), lista, total;
  var c = catPorId(cat) || { nome: 'Sem categoria', emoji: '❔', cor: '#9ca3af' };
  if (cat === PARC) {
    var ultimos = {};
    todos.forEach(function (l) { if (l.parcela) { var g = l.parcela.grupoId; if (!ultimos[g] || l.data > ultimos[g].data) ultimos[g] = l; } });
    lista = Object.keys(ultimos).map(function (g) { return ultimos[g]; });
    total = calcularMensalParcelados(todos);
  } else {
    lista = lancamentosPeriodo(todos, p).filter(function (l) { return l.cat === cat; });
    total = lista.reduce(function (s, l) { return s + l.valor; }, 0);
  }
  lista.sort(function (a, b) { return b.data.localeCompare(a.data); });
  $('topo-categoria').style.background = 'linear-gradient(160deg,' + c.cor + 'cc,' + c.cor + ')';
  $('titulo-categoria').textContent = c.emoji + ' ' + c.nome;
  $('resumo-categoria').innerHTML = '<div style="text-align:center;padding:8px 0 12px"><div style="font-size:11px;color:#aaa;text-transform:uppercase;margin-bottom:4px">' +
    (cat === PARC ? 'Total Mensal Ativo' : 'Total do Período') + '</div><div style="font-size:32px;font-weight:900;color:' + c.cor + '">' + formatar(total) + '</div></div>';
  var pm = buildPagasMap(todos);
  $('lista-categoria').innerHTML = lista.length ? lista.map(function (l) { return linhaLanc(l, pm, true); }).join('') : '<div class="vazio">📭 Sem lançamentos neste período</div>';
  if (!soRender) irPara('categoria');
}

// ═════════════════════════ REGISTRAR / EDITAR ═════════════════════════
function novoLancamento() {
  S.add = { cat: S.add.cat && catPorId(S.add.cat) && S.add.cat !== PARC ? S.add.cat : (catsComuns()[0] ? catsComuns()[0].id : null), sub: null, nParc: 1, parcIni: 1, editId: null };
  $('inp-valor').value = ''; $('inp-desc').value = ''; $('inp-data').value = hoje();
  $('valor-pre').textContent = SIMB[moeda()];
  $('add-hdr-title').textContent = 'Registrar Gasto';
  $('btn-salvar-pro').textContent = '💾 Salvar Lançamento';
  $('add-edit-extra').style.display = 'none';
  $('card-parc').style.display = '';
  atualizarParcUI();
}
function editarLancamento(id) {
  var l = lancamentos().filter(function (x) { return x.id === id; })[0];
  if (!l) return;
  S.add = { cat: l.cat, sub: l.sub, nParc: 1, parcIni: 1, editId: id };
  $('inp-valor').value = numTxt(l.valor.toFixed(2));
  $('inp-data').value = l.data; $('inp-desc').value = l.desc || '';
  $('valor-pre').textContent = SIMB[moeda()];
  $('add-hdr-title').textContent = l.parcela ? 'Editar parcela ' + l.parcela.n + '/' + l.parcela.total : 'Editar Lançamento';
  $('btn-salvar-pro').textContent = '💾 Salvar Alterações';
  $('add-edit-extra').style.display = '';
  $('card-parc').style.display = 'none';
  irPara('add');
}
function renderAdd() {
  var a = S.add, editParc = a.editId && a.cat === PARC;
  var tiles = (editParc ? [catParc()] : catsComuns());
  $('add-cats').innerHTML = tiles.length ? tiles.map(function (c) {
    var on = c.id === a.cat;
    return '<div class="cat-tile" data-addcat="' + c.id + '"' + (on ? ' style="border-color:' + c.cor + ';background:' + alfa(c.cor, '12') + ';box-shadow:0 0 0 3px ' + alfa(c.cor, '26') + '"' : '') + '>' +
      '<div class="cat-tile-ic">' + esc(c.emoji) + '</div><div class="cat-tile-nm"' + (on ? ' style="color:' + c.cor + '"' : '') + '>' + esc(c.nome) + '</div></div>';
  }).join('') : '<div class="vazio">Nenhuma categoria. Crie em Ajustes.</div>';
  var cat = catPorId(a.cat);
  var hdr = $('add-header');
  if (cat) {
    hdr.style.background = 'linear-gradient(150deg,' + cat.cor + 'aa,' + cat.cor + ')';
    $('add-hdr-icon').textContent = cat.emoji;
    $('add-hdr-sub').textContent = cat.nome + (cat.subs.length ? ' · subcategoria e valor' : ' · valor e data');
    $('btn-salvar-pro').style.background = 'linear-gradient(135deg,' + cat.cor + 'dd,' + cat.cor + ')';
    $('btn-salvar-pro').style.boxShadow = '0 4px 14px ' + alfa(cat.cor, '55');
  } else {
    hdr.style.background = ''; $('add-hdr-icon').textContent = '➕'; $('add-hdr-sub').textContent = 'Selecione a categoria';
    $('btn-salvar-pro').style.background = ''; $('btn-salvar-pro').style.boxShadow = '';
  }
  if (cat && cat.subs.length && cat.id !== PARC) {
    $('grupo-sub').style.display = '';
    $('sub-titulo').textContent = 'Subcategoria — ' + cat.nome;
    $('sub-step').style.background = cat.cor;
    $('sel-sub').innerHTML = '<option value="">— Selecione —</option>' + cat.subs.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === a.sub ? ' selected' : '') + '>' + esc(s.nome) + '</option>';
    }).join('');
  } else $('grupo-sub').style.display = 'none';
}
function atualizarParcUI() {
  var a = S.add, on = a.nParc > 1;
  var btn = $('btn-parcela-toggle');
  btn.textContent = on ? '📦 Parcelado em ' + a.nParc + 'x' : '💳 À vista';
  btn.classList.toggle('ativo', on);
  $('sel-parcelas').style.display = on ? '' : 'none';
  $('grupo-parc-ini').style.display = on ? '' : 'none';
  if (on) {
    var opts = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 24, 36, 48];
    $('sel-parcelas').innerHTML = opts.map(function (n) { return '<option value="' + n + '"' + (n === a.nParc ? ' selected' : '') + '>' + n + 'x</option>'; }).join('');
    var ini = '';
    for (var i = 1; i <= a.nParc; i++) ini += '<option value="' + i + '"' + (i === a.parcIni ? ' selected' : '') + '>' + i + 'ª parcela' + (i === 1 ? ' (nova compra)' : '') + '</option>';
    $('sel-parcela-ini').innerHTML = ini;
  }
  atualizarPreviewParcela();
}
function atualizarPreviewParcela() {
  var a = S.add, v = lerValor($('inp-valor').value), pv = $('parcela-preview');
  if (a.nParc > 1 && v > 0) {
    var restantes = a.nParc - a.parcIni + 1;
    pv.textContent = a.nParc + 'x de ' + formatar(Math.round(v / a.nParc * 100) / 100) + ' · ' + restantes + ' parcela(s) serão lançadas, uma por mês, na categoria Parcelados';
  } else pv.textContent = a.nParc > 1 ? 'Informe o valor TOTAL da compra' : '';
}
function salvarLancamento() {
  var a = S.add, valor = lerValor($('inp-valor').value), data = $('inp-data').value, desc = $('inp-desc').value.trim();
  if (!(valor > 0)) { mostrarToast('⚠️', 'Informe o valor gasto'); return; }
  if (!data) { mostrarToast('⚠️', 'Selecione a data'); return; }
  if (!a.cat || !catPorId(a.cat)) { mostrarToast('⚠️', 'Escolha uma categoria'); return; }
  var cat = catPorId(a.cat);
  if (cat.subs.length && cat.id !== PARC && !a.sub) { mostrarToast('⚠️', 'Escolha a subcategoria'); return; }
  var ps = [];
  if (a.editId) {
    var r = Object.assign({}, S.raw[a.editId]);
    r.v = Math.round(valor * 100); r.dt = data; r.d = desc;
    if (!r.p) { r.c = a.cat; r.s = a.sub || null; }
    ps.push(gravarLanc(a.editId, r));
    mostrarToast('✅', 'Lançamento atualizado');
  } else if (a.nParc > 1) {
    var gid = Date.now().toString(36) + rid(4), parcV = Math.round(valor / a.nParc * 100);
    for (var i = a.parcIni - 1, off = 0; i < a.nParc; i++, off++) {
      ps.push(gravarLanc(gid + '-' + (i + 1), {
        v: parcV, dt: addMeses(data, off), c: PARC, s: null, d: desc || cat.nome, por: S.user.uid, ts: Date.now(),
        p: { n: i + 1, total: a.nParc, g: gid, vt: Math.round(valor * 100), origem: a.cat }
      }));
    }
    mostrarToast('📦', 'Parcelamento salvo: ' + a.nParc + 'x de ' + formatar(parcV / 100));
  } else {
    ps.push(gravarLanc(Date.now().toString(36) + rid(6), { v: Math.round(valor * 100), dt: data, c: a.cat, s: a.sub || null, d: desc, por: S.user.uid, ts: Date.now() }));
    mostrarToast('✅', 'Salvo: ' + formatar(valor) + ' em ' + cat.nome);
  }
  Promise.all(ps).catch(function () { mostrarToast('⚠️', 'Erro ao salvar. Verifique a conexão.'); });
  var voltar = a.editId ? (S.voltarPara || 'inicio') : 'inicio';
  S.add.editId = null;
  irPara(voltar);
}

// Exclusão (com opção de apagar o plano inteiro de parcelas)
function excluir(id) {
  var l = lancamentos().filter(function (x) { return x.id === id; })[0];
  if (!l) return;
  if (l.parcela) {
    var g = l.parcela.grupoId;
    var irmas = lancamentos().filter(function (x) { return x.parcela && x.parcela.grupoId === g; });
    abrirSheet('<h3>🗑️ Excluir parcela</h3><p style="color:#6b7280;font-size:14px">"' + esc(descLanc(l)) + '" faz parte de um parcelamento (' + irmas.length + ' parcela(s) lançadas).</p>' +
      '<button class="aj-btn aj-full" id="ex-uma">Excluir só esta parcela (' + l.parcela.n + '/' + l.parcela.total + ')</button>' +
      '<button class="aj-btn perigo aj-full" id="ex-todas">Excluir o plano inteiro</button>' +
      '<button class="aj-btn aj-full" data-fechar>Cancelar</button>');
    $('ex-uma').onclick = function () { fecharSheet(); apagar([id]); };
    $('ex-todas').onclick = function () { fecharSheet(); apagar(irmas.map(function (x) { return x.id; })); };
    return;
  }
  if (!confirm('Excluir "' + descLanc(l) + '" (' + formatar(l.valor) + ')?')) return;
  apagar([id]);
}
function apagar(ids) {
  ids.forEach(function (id) { delete S.raw[id]; });
  renderLogo();
  Promise.all(ids.map(function (id) { return db.ref('casas/' + S.casa + '/dados/lanc/' + id).remove(); }))
    .then(function () { mostrarToast('🗑️', ids.length > 1 ? ids.length + ' lançamentos excluídos' : 'Lançamento excluído'); },
      function () { mostrarToast('⚠️', 'Erro ao excluir'); });
  if (S.tela === 'add') { S.add.editId = null; irPara(S.voltarPara || 'inicio'); }
}

// ═════════════════════════ PERÍODOS (Histórico, Relatório, Cat., Projeção) ═════════════════════════
function setPer(qual, tipo) {
  S.per[qual] = tipo;
  qsa('[data-per="' + qual + '"] .rel-per-btn').forEach(function (b) { b.classList.toggle('ativo', b.dataset.tipo === tipo); });
  var cd = $(qual + '-custom-datas'); if (cd) cd.style.display = tipo === 'custom' ? 'block' : 'none';
  if (qual === 'hist') $('hist-nav-mes').style.display = tipo === 'mes' ? 'block' : 'none';
  renderTela();
}
function getPer(qual) {
  var t = S.per[qual];
  if (t === 'periodo') return { inicio: S.cfg.periodo.inicio, fim: S.cfg.periodo.fim };
  if (t === 'mes') { var m = qual === 'hist' ? S.mesHist : mesAtual(); return { inicio: m + '-01', fim: ultimoDiaMes(m) }; }
  var ini = $(qual + '-ini').value, fim = $(qual + '-fim').value;
  if (!ini || !fim) return null;
  return ini <= fim ? { inicio: ini, fim: fim } : { inicio: fim, fim: ini };
}

// ═════════════════════════ HISTÓRICO ═════════════════════════
function listaHistorico(per) {
  return lancamentosPeriodo(lancamentos(), per).filter(function (l) { return l.cat !== PARC; })
    .sort(function (a, b) { return b.data.localeCompare(a.data) || b.ts - a.ts; });
}
function renderizarHistorico() {
  $('label-hist').textContent = nomeMes(S.mesHist);
  var per = getPer('hist'), el = $('corpo-historico');
  if (!per) { el.innerHTML = '<div class="vazio">Selecione as datas do período</div>'; return; }
  var lista = listaHistorico(per);
  if (!lista.length) { el.innerHTML = '<div class="vazio">📭 Sem lançamentos neste período</div>'; return; }
  var pm = buildPagasMap(lancamentos()), porDia = {};
  lista.forEach(function (l) { (porDia[l.data] = porDia[l.data] || []).push(l); });
  var total = lista.reduce(function (s, l) { return s + l.valor; }, 0);
  el.innerHTML = '<div class="hist-dia-header" style="background:#eef2ff"><span class="hist-dia-data">Total · ' + lista.length + ' lançamentos</span><span class="hist-dia-total">' + formatar(total) + '</span></div>' +
    Object.keys(porDia).sort(function (a, b) { return b.localeCompare(a); }).map(function (data) {
      var tot = porDia[data].reduce(function (s, l) { return s + l.valor; }, 0);
      return '<div class="hist-dia-header"><span class="hist-dia-data">' + formatarData(data) + '</span><span class="hist-dia-total">' + formatar(tot) + '</span></div>' +
        porDia[data].map(function (l) { return linhaLanc(l, pm, false, 'hist-linha'); }).join('');
    }).join('');
}
function compartilharTexto(msg) {
  if (navigator.share) navigator.share({ text: msg }).catch(function () {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}
function compartilharHistorico() {
  var per = getPer('hist'), lista = per ? listaHistorico(per) : [];
  if (!lista.length) { mostrarToast('⚠️', 'Sem lançamentos neste período'); return; }
  var total = lista.reduce(function (s, l) { return s + l.valor; }, 0), porDia = {};
  var msg = '📋 *HISTÓRICO — ' + formatarData(per.inicio) + ' → ' + formatarData(per.fim) + '*\n━━━━━━━━━━━━━━━━\n';
  lista.forEach(function (l) { (porDia[l.data] = porDia[l.data] || []).push(l); });
  Object.keys(porDia).sort(function (a, b) { return b.localeCompare(a); }).forEach(function (d) {
    msg += '\n📅 *' + formatarData(d) + '* — ' + formatar(porDia[d].reduce(function (s, l) { return s + l.valor; }, 0)) + '\n';
    porDia[d].forEach(function (l) { var sb = nomeSub(l.cat, l.sub); msg += '  • ' + NOME(l.cat) + (sb ? ' (' + sb + ')' : '') + ': ' + formatar(l.valor) + (l.desc ? ' — ' + l.desc : '') + '\n'; });
  });
  msg += '\n━━━━━━━━━━━━━━━━\n💰 *Total: ' + formatar(total) + '*\n\n_Enviado via HomeVault_';
  compartilharTexto(msg);
}
function abrirImpressao(titulo, corpo) {
  var w = window.open('', '_blank');
  if (!w) { mostrarToast('⚠️', 'Permita pop-ups para gerar o PDF'); return; }
  w.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(titulo) + '</title><style>' +
    'body{margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:#111827}h1{font-size:20px;margin:0 0 4px}.sub{color:#6b7280;font-size:13px;margin-bottom:16px}' +
    'table{width:100%;border-collapse:collapse}td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:13px}.dia td{background:#f8fafc;font-weight:800;color:#475569;font-size:12px;text-transform:uppercase}' +
    '.v{text-align:right;font-weight:700;white-space:nowrap}.tot{margin-top:14px;font-size:16px;font-weight:800;text-align:right}.pill{display:inline-block;margin:0 8px 8px 0;padding:5px 12px;border-radius:20px;font-size:12.5px;font-weight:700;border:1.5px solid}' +
    '@media print{.np{display:none}}</style></head><body>' + corpo +
    '<p class="np" style="margin-top:24px"><button onclick="window.print()" style="padding:10px 18px;font-size:15px;border-radius:10px;border:0;background:#1d4ed8;color:#fff">🖨️ Imprimir / Salvar PDF</button></p>' +
    '<script>setTimeout(function(){window.print()},400)<\/script></body></html>');
  w.document.close();
}
function exportarPDFHistorico() {
  var per = getPer('hist'), lista = per ? listaHistorico(per) : [];
  if (!lista.length) { mostrarToast('⚠️', 'Sem lançamentos neste período'); return; }
  var porDia = {}, totCat = {}, total = 0;
  lista.forEach(function (l) { (porDia[l.data] = porDia[l.data] || []).push(l); totCat[l.cat] = (totCat[l.cat] || 0) + l.valor; total += l.valor; });
  var pills = Object.keys(totCat).map(function (c) { return '<span class="pill" style="color:' + COR(c) + ';border-color:' + COR(c) + ';background:' + alfa(COR(c), '12') + '">' + esc(EMO(c) + ' ' + NOME(c)) + ': ' + formatar(totCat[c]) + '</span>'; }).join('');
  var linhas = Object.keys(porDia).sort(function (a, b) { return b.localeCompare(a); }).map(function (d) {
    return '<tr class="dia"><td colspan="2">' + formatarData(d) + '</td><td class="v">' + formatar(porDia[d].reduce(function (s, l) { return s + l.valor; }, 0)) + '</td></tr>' +
      porDia[d].map(function (l) { return '<tr><td>' + esc(descLanc(l)) + '</td><td style="color:#6b7280">' + esc(NOME(l.cat) + (nomeSub(l.cat, l.sub) ? ' · ' + nomeSub(l.cat, l.sub) : '')) + '</td><td class="v" style="color:' + COR(l.cat) + '">' + formatar(l.valor) + '</td></tr>'; }).join('');
  }).join('');
  abrirImpressao('HomeVault — Histórico', '<h1>📋 ' + esc(S.cfg.nome || 'HomeVault') + ' — Histórico</h1><div class="sub">' + formatarData(per.inicio) + ' → ' + formatarData(per.fim) + ' · ' + lista.length + ' lançamentos</div>' +
    pills + '<table>' + linhas + '</table><div class="tot">Total: ' + formatar(total) + '</div>');
}

// ═════════════════════════ RELATÓRIO ═════════════════════════
function renderizarRelatorio() {
  var per = getPer('rel'), el = $('corpo-relatorio');
  if (!per) { el.innerHTML = '<div class="vazio">Selecione as datas do período</div>'; return; }
  var T = totaisPeriodo(per), grand = T.comum, lim = baseDisponivel();
  var disp = lim - grand, pctLim = lim > 0 ? grand / lim * 100 : 0;
  var dias = Object.keys(T.porDia), diasCom = dias.length, mediaDia = diasCom ? grand / diasCom : 0;
  var maiorDia = '', maiorVal = 0;
  dias.forEach(function (d) { if (T.porDia[d] > maiorVal) { maiorVal = T.porDia[d]; maiorDia = d; } });
  var diasPeriodo = diasEntre(per.inicio, per.fim) + 1;
  var projecao = diasCom ? (grand / diasCom) * diasPeriodo : 0;
  var corLim = pctLim > 100 ? '#f44336' : pctLim >= 80 ? '#ff9800' : '#1565c0';
  var excede = projecao > 0 && lim > 0 && projecao > lim, dentro = projecao > 0 && lim > 0 && !excede;
  var met = '<div class="rel-metricas">' +
    '<div class="rel-met-card"><div class="rel-met-val" style="color:#1565c0">' + formatar(grand) + '</div><div class="rel-met-lbl">Total Gasto</div><div class="rel-met-sub">' + diasCom + ' dias c/ gasto</div></div>' +
    '<div class="rel-met-card"><div class="rel-met-val" style="color:' + (disp < 0 ? '#f44336' : '#43a047') + '">' + formatar(disp) + '</div><div class="rel-met-lbl">Disponível</div><div class="rel-met-sub">Limite: ' + formatar(lim) + '</div></div>' +
    '<div class="rel-met-card"><div class="rel-met-val" style="color:' + corLim + '">' + pctLim.toFixed(1) + '%</div><div class="rel-met-lbl">% do Limite</div><div class="rel-met-sub">' + T.nComuns + ' lançamentos</div></div>' +
    '<div class="rel-met-card" style="background:' + (excede ? '#fef2f2' : dentro ? '#f0fdf4' : 'white') + ';border:' + (excede ? '2px solid #ef4444' : dentro ? '2px solid #22c55e' : 'none') + '">' +
    '<div class="rel-met-val" style="color:' + (excede ? '#ef4444' : dentro ? '#16a34a' : '#555') + '">' + formatar(mediaDia) + '</div><div class="rel-met-lbl">Média / dia</div>' +
    '<div class="rel-met-sub" style="color:' + (excede ? '#ef4444' : dentro ? '#16a34a' : '#9ca3af') + ';font-weight:700">Projeção: ' + formatar(projecao) + '</div></div>' +
    (maiorDia ? '<div class="rel-met-card" style="grid-column:1/-1"><div class="rel-met-val" style="color:#e53935;font-size:15px">' + formatar(maiorVal) + '</div><div class="rel-met-lbl">Maior gasto — ' + formatarData(maiorDia) + '</div></div>' : '') +
    '</div>';

  // Subtotais por subcategoria
  var subTot = {};
  T.lista.forEach(function (l) { if (l.cat === PARC || !l.sub) return; var k = l.cat + '|' + l.sub; subTot[k] = (subTot[k] || 0) + l.valor; });
  var cats = '<div style="font-size:11px;font-weight:800;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin:12px 0 8px">Por Categoria</div>' +
    todasCats().map(function (c) {
      var g = T.tots[c.id] || 0, o = +c.orc || 0, pC = o > 0 ? Math.min(g / o * 100, 100) : 0, pTot = grand > 0 ? g / grand * 100 : 0;
      var corB = g > o && o > 0 ? '#f44336' : pC >= 80 ? '#ff9800' : c.cor, restC = o - g;
      var barra = o > 0 ? '<div class="orc-barra-fundo"><div class="orc-barra-fill" style="width:' + pC.toFixed(1) + '%;background:' + corB + '"></div></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:10px;margin-top:3px"><span style="color:#aaa">' + pC.toFixed(0) + '% do orçado ' + formatar(o) + '</span>' +
        '<span style="color:' + (restC < 0 ? '#f44336' : '#43a047') + ';font-weight:700">' + (restC >= 0 ? 'sobra ' : 'excedeu ') + formatar(Math.abs(restC)) + '</span></div>' : '';
      var subs = c.subs.map(function (s) {
        var v = subTot[c.id + '|' + s.id]; if (!v) return '';
        return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-top:1px solid #f5f5f5"><span style="color:#888">' + esc(s.nome) + '</span><span style="font-weight:700;color:' + c.cor + '">' + formatar(v) + '</span></div>';
      }).join('');
      return '<div class="rel-cat-bloco" style="border-color:' + c.cor + '"><div class="rel-cat-header"><span class="rel-cat-nome">' + esc(c.emoji + ' ' + c.nome) + '</span><span class="rel-cat-pct-total">' + (c.id === PARC ? 'compromisso mensal' : pTot.toFixed(1) + '% do total') + '</span></div>' +
        '<div class="rel-cat-nums"><div class="rel-cat-num"><div class="rel-cat-num-val" style="color:' + c.cor + '">' + formatar(g) + '</div><div class="rel-cat-num-lbl">Gasto</div></div>' +
        (o > 0 ? '<div class="rel-cat-num"><div class="rel-cat-num-val" style="color:#555">' + formatar(o) + '</div><div class="rel-cat-num-lbl">Orçado</div></div>' +
          '<div class="rel-cat-num"><div class="rel-cat-num-val" style="color:' + (restC < 0 ? '#f44336' : '#43a047') + '">' + formatar(Math.abs(restC)) + '</div><div class="rel-cat-num-lbl">' + (restC < 0 ? 'Excedeu' : 'Disponível') + '</div></div>' : '') +
        '</div>' + barra + subs + '</div>';
    }).join('');

  var top5 = T.lista.filter(function (l) { return l.cat !== PARC; }).sort(function (a, b) { return b.valor - a.valor; }).slice(0, 5);
  var top = top5.length ? '<div class="card" style="margin-bottom:8px"><div class="card-titulo">Top 5 Maiores Gastos</div>' + top5.map(function (l, i) {
    return '<div class="rel-top-item"><div class="rel-top-num">' + (i + 1) + '</div><div class="lanc-ponto" style="background:' + COR(l.cat) + ';flex-shrink:0;width:8px;height:8px;border-radius:50%"></div>' +
      '<div class="rel-top-info"><div class="rel-top-desc">' + esc(descLanc(l)) + '</div><div class="rel-top-meta">' + formatarData(l.data) + ' · ' + esc(NOME(l.cat)) + '</div></div>' +
      '<div class="rel-top-val" style="color:' + COR(l.cat) + '">' + formatar(l.valor) + '</div></div>';
  }).join('') + '</div>' : '';

  // Dias até o limite por categoria
  var linhasDias = catsComuns().filter(function (c) { return +c.orc > 0; }).map(function (c) {
    var o = +c.orc, g = T.tots[c.id] || 0, dispC = o - g, diasC = Object.keys(T.porDiaCat[c.id] || {}).length, media = diasC ? g / diasC : 0;
    var exc = dispC <= 0, semRitmo = media === 0, n = (!exc && media > 0) ? Math.floor(dispC / media) : 0;
    var corD = exc ? '#ef4444' : n <= 7 ? '#f97316' : n <= 15 ? '#eab308' : '#22c55e';
    var sub = exc ? 'Limite excedido em ' + formatar(Math.abs(dispC)) : semRitmo ? 'Sem gastos no período' : formatar(media) + '/dia · sobra ' + formatar(dispC);
    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f3f4f6"><div style="font-size:22px;width:32px;text-align:center;flex-shrink:0">' + esc(c.emoji) + '</div>' +
      '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:#111827">' + esc(c.nome) + '</div><div style="font-size:10px;color:#9ca3af;margin-top:1px">' + sub + '</div></div>' +
      '<div style="text-align:right;flex-shrink:0"><div style="font-size:26px;font-weight:900;color:' + corD + ';line-height:1;letter-spacing:-1px">' + (exc ? '—' : semRitmo ? '∞' : n) + '</div>' +
      '<div style="font-size:9px;font-weight:700;color:' + corD + ';text-transform:uppercase;letter-spacing:.4px">' + (exc || semRitmo ? '' : 'dias') + '</div></div></div>';
  }).join('');
  var diasLim = linhasDias ? '<div class="card" style="margin-bottom:8px;background:#fffde7;border:1px solid #fdd835"><div class="card-titulo">⏱️ Dias até o Limite — por Categoria</div>' + linhasDias + '</div>' : '';

  // Mapa de calor
  var maxDia = 0; dias.forEach(function (d) { if (T.porDia[d] > maxDia) maxDia = T.porDia[d]; });
  var heatDays = [];
  for (var d = per.inicio; d <= per.fim; d = proxDia(d)) { heatDays.push({ date: d, dow: dataObj(d).getDay(), day: +d.slice(8, 10), val: T.porDia[d] || 0 }); if (heatDays.length > 400) break; }
  var cells = '';
  for (var i = 0; i < (heatDays[0] ? heatDays[0].dow : 0); i++) cells += '<div class="heatmap-cell heatmap-empty"></div>';
  heatDays.forEach(function (h) { cells += '<div class="heatmap-cell ' + (!h.val ? 'heatmap-zero' : h.val <= maxDia * .33 ? 'heatmap-low' : h.val <= maxDia * .67 ? 'heatmap-mid' : 'heatmap-high') + '">' + h.day + '</div>'; });
  var heat = '<div class="heatmap-card"><div class="card-titulo">🗓️ Mapa de Calor — Gastos por Dia</div><div class="heatmap-dow-row">' +
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(function (l) { return '<div class="heatmap-dow-cell">' + l + '</div>'; }).join('') + '</div><div class="heatmap-grid">' + cells + '</div>' +
    '<div class="heatmap-leg"><div class="heatmap-leg-dot" style="background:#f3f4f6"></div><span class="heatmap-leg-lbl">Sem gasto</span><div class="heatmap-leg-dot" style="background:#bbf7d0"></div><span class="heatmap-leg-lbl">Baixo</span>' +
    '<div class="heatmap-leg-dot" style="background:#fde68a"></div><span class="heatmap-leg-lbl">Médio</span><div class="heatmap-leg-dot" style="background:#fca5a5"></div><span class="heatmap-leg-lbl">Alto</span></div></div>';

  // Semana a semana
  var semanas = [], st = 0, sd = 0;
  heatDays.forEach(function (h, i) { st += h.val; sd++; if ((i + 1) % 7 === 0 || i === heatDays.length - 1) { semanas.push({ lbl: 'Sem ' + (semanas.length + 1), total: st, dias: sd }); st = 0; sd = 0; } });
  var maxSem = semanas.reduce(function (m, s) { return Math.max(m, s.total); }, 0), orcDia = lim > 0 && heatDays.length ? lim / heatDays.length : 0;
  var sem = '<div class="card" style="margin-bottom:8px"><div class="card-titulo">📅 Semana a Semana</div>' + semanas.map(function (s) {
    var pct = maxSem > 0 ? (s.total / maxSem * 100).toFixed(1) : 0, orcSem = orcDia * s.dias, op = orcSem > 0 ? Math.round(s.total / orcSem * 100) : null;
    var cor = op === null ? '#1d4ed8' : op <= 50 ? '#22c55e' : op <= 85 ? '#f59e0b' : '#ef4444';
    return '<div class="semana-row"><div class="semana-lbl">' + s.lbl + (s.dias < 7 ? ' <span style="font-size:10px;color:#aaa">(' + s.dias + 'd)</span>' : '') + '</div>' +
      '<div class="semana-barra-bg"><div class="semana-barra-fill" style="width:' + pct + '%;background:' + cor + '"></div></div><div class="semana-val" style="color:' + cor + '">' + formatar(s.total) + '</div>' +
      (op !== null ? '<span style="font-size:11px;font-weight:700;color:' + cor + ';min-width:38px;text-align:right">' + op + '%</span>' : '') + '</div>';
  }).join('') + (orcDia > 0 ? '<div style="font-size:11px;color:#9ca3af;margin-top:6px;text-align:right">Limite: ' + formatar(lim) + ' ÷ ' + heatDays.length + ' dias</div>' : '') + '</div>';

  el.innerHTML = '<div style="font-size:12px;color:#aaa;font-weight:600;margin-bottom:10px;text-align:center">📅 ' + formatarData(per.inicio) + ' → ' + formatarData(per.fim) + '</div>' +
    met + cats + top + diasLim + heat + sem +
    '<div class="card"><button class="btn-whatsapp" id="rel-wa">📱 Enviar por WhatsApp</button></div>';
  $('rel-wa').onclick = function () {
    var msg = '📊 *RELATÓRIO — ' + formatarData(per.inicio) + ' → ' + formatarData(per.fim) + '*\n━━━━━━━━━━━━━━━━\n';
    todasCats().forEach(function (c) { var g = T.tots[c.id] || 0; if (g || +c.orc) msg += c.emoji + ' ' + c.nome + ': ' + formatar(g) + (+c.orc ? ' / ' + formatar(c.orc) : '') + '\n'; });
    msg += '━━━━━━━━━━━━━━━━\n💰 *Total gasto: ' + formatar(grand) + '*\n✅ Disponível: ' + formatar(disp) + (lim ? ' (' + pctLim.toFixed(0) + '% usado)' : '') + '\n\n_Enviado via HomeVault_';
    compartilharTexto(msg);
  };
}

// ═════════════════════════ POR CATEGORIA ═════════════════════════
function renderizarRelcat() {
  var abas = todasCats().concat([{ id: '_planos', emoji: '📊', nome: 'Planos', cor: '#7c3aed' }]);
  if (!S.rcCat || !abas.some(function (a) { return a.id === S.rcCat; })) S.rcCat = abas[0].id;
  $('relcat-tabs').innerHTML = abas.map(function (a) {
    var on = a.id === S.rcCat;
    return '<button class="relcat-tab" data-rc="' + a.id + '"' + (on ? ' style="border-color:' + a.cor + ';background:' + alfa(a.cor, '12') + ';color:' + a.cor + '"' : '') + '>' + esc(a.emoji) + '<br>' + esc(a.nome) + '</button>';
  }).join('');
  var el = $('corpo-relcat');
  $('relcat-per-card').style.display = S.rcCat === '_planos' ? 'none' : '';
  if (S.rcCat === '_planos') { el.innerHTML = renderizarPlanos(); return; }
  var per = getPer('relcat');
  if (!per) { el.innerHTML = '<div class="vazio">Selecione as datas do período</div>'; return; }
  var c = catPorId(S.rcCat), cor = c.cor, orc = +c.orc || 0, todos = lancamentos(), lista, total;
  if (c.id === PARC) {
    var ult = {};
    todos.forEach(function (l) { if (l.parcela) { var g = l.parcela.grupoId; if (!ult[g] || l.data > ult[g].data) ult[g] = l; } });
    lista = Object.keys(ult).map(function (g) { return ult[g]; });
    total = calcularMensalParcelados(todos);
  } else {
    lista = lancamentosPeriodo(todos, per).filter(function (l) { return l.cat === c.id; });
    total = lista.reduce(function (s, l) { return s + l.valor; }, 0);
  }
  lista.sort(function (a, b) { return b.data.localeCompare(a.data); });
  if (!lista.length) { el.innerHTML = '<div class="vazio">📭 Nenhum lançamento neste período</div>'; return; }
  var subTots = {};
  lista.forEach(function (l) { var k = c.id === PARC ? descLanc(l) : (nomeSub(l.cat, l.sub) || '—'); subTots[k] = (subTots[k] || 0) + l.valor; });
  var subKeys = Object.keys(subTots).sort(function (a, b) { return subTots[b] - subTots[a]; }), maxSub = subKeys.length ? subTots[subKeys[0]] : 1;
  var porDia = {};
  lista.forEach(function (l) { porDia[l.data] = (porDia[l.data] || 0) + l.valor; });
  var diasCom = Object.keys(porDia).length, mediaDia = diasCom ? total / diasCom : 0;
  var maior = lista.reduce(function (m, l) { return l.valor > (m.valor || 0) ? l : m; }, {});
  var pctOrc = orc > 0 ? Math.min(total / orc * 100, 100) : 0, corB = total > orc && orc > 0 ? '#f44336' : pctOrc >= 80 ? '#ff9800' : cor;
  var hero = '<div class="card" style="margin-bottom:10px"><div class="relcat-hero"><div class="relcat-hero-val" style="color:' + cor + '">' + formatar(total) + '</div>' +
    '<div class="relcat-hero-sub">' + (c.id === PARC ? lista.length + ' planos · compromisso mensal' : lista.length + ' lançamentos · ' + formatarData(per.inicio) + ' → ' + formatarData(per.fim)) + '</div></div>' +
    (orc > 0 ? '<div class="orc-barra-fundo" style="height:10px;margin-top:8px"><div class="orc-barra-fill" style="width:' + pctOrc.toFixed(1) + '%;background:' + corB + '"></div></div>' +
      '<div class="relcat-orc-row"><span style="color:#aaa">Orçado: ' + formatar(orc) + '</span><span style="color:' + corB + ';font-weight:800">' + pctOrc.toFixed(1) + '% utilizado</span>' +
      '<span style="color:' + (total > orc ? '#f44336' : '#43a047') + ';font-weight:700">' + (total > orc ? 'Excedeu ' : 'Sobra ') + formatar(Math.abs(orc - total)) + '</span></div>' : '') + '</div>';
  var stats = '<div class="relcat-stats">' +
    '<div class="relcat-stat"><div class="relcat-stat-val" style="color:' + cor + '">' + formatar(mediaDia) + '</div><div class="relcat-stat-lbl">Média por dia c/ gasto</div></div>' +
    '<div class="relcat-stat"><div class="relcat-stat-val" style="color:#374151">' + diasCom + '</div><div class="relcat-stat-lbl">Dias com gasto</div></div>' +
    (maior.valor ? '<div class="relcat-stat"><div class="relcat-stat-val" style="color:#e53935">' + formatar(maior.valor) + '</div><div class="relcat-stat-lbl">Maior gasto · ' + formatarData(maior.data) + '</div></div>' : '') +
    '<div class="relcat-stat"><div class="relcat-stat-val" style="color:#374151">' + formatar(total / lista.length) + '</div><div class="relcat-stat-lbl">Ticket médio</div></div></div>';
  var subs = '<div class="card" style="margin-bottom:10px"><div class="card-titulo">' + (c.id === PARC ? 'Por Plano' : 'Por Subcategoria') + '</div>' + subKeys.map(function (k) {
    var v = subTots[k];
    return '<div class="relcat-sub-row"><div class="relcat-sub-nome">' + esc(k) + '</div><div class="relcat-sub-bar-wrap"><div class="relcat-sub-bar-fill" style="width:' + (v / maxSub * 100).toFixed(1) + '%;background:' + cor + '"></div></div>' +
      '<div class="relcat-sub-val" style="color:' + cor + '">' + formatar(v) + '</div><div class="relcat-sub-pct">' + (total > 0 ? (v / total * 100).toFixed(0) : 0) + '%</div></div>';
  }).join('') + '</div>';
  var pm = buildPagasMap(todos);
  var acoes = '<div class="card" style="display:flex;gap:10px;margin-bottom:10px">' +
    '<button style="flex:1;padding:13px 8px;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;background:' + cor + ';color:#fff;font-family:inherit" id="rc-pdf">🖨️ PDF</button>' +
    '<button style="flex:1;padding:13px 8px;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;background:#25d366;color:#fff;font-family:inherit" id="rc-wa">📱 WhatsApp</button></div>';
  var lst = '<div class="card"><div class="card-titulo">Lançamentos (' + lista.length + ')</div>' + lista.map(function (l) { return linhaLanc(l, pm, true); }).join('') + '</div>';
  el.innerHTML = hero + stats + subs + acoes + lst;
  $('rc-wa').onclick = function () {
    var msg = c.emoji + ' *' + c.nome.toUpperCase() + '* — ' + formatarData(per.inicio) + ' → ' + formatarData(per.fim) + '\n━━━━━━━━━━━━━━━━\n';
    subKeys.forEach(function (k) { msg += '• ' + k + ': ' + formatar(subTots[k]) + '\n'; });
    msg += '━━━━━━━━━━━━━━━━\n💰 *Total: ' + formatar(total) + '*' + (orc ? ' / orçado ' + formatar(orc) : '') + '\n\n_Enviado via HomeVault_';
    compartilharTexto(msg);
  };
  $('rc-pdf').onclick = function () {
    abrirImpressao('HomeVault — ' + c.nome, '<h1>' + esc(c.emoji + ' ' + c.nome) + '</h1><div class="sub">' + formatarData(per.inicio) + ' → ' + formatarData(per.fim) + ' · ' + lista.length + ' lançamentos</div>' +
      '<table>' + subKeys.map(function (k) { return '<tr><td>' + esc(k) + '</td><td class="v">' + formatar(subTots[k]) + '</td></tr>'; }).join('') + '</table>' +
      '<h3 style="margin-top:20px">Lançamentos</h3><table>' + lista.map(function (l) { return '<tr><td>' + formatarData(l.data) + '</td><td>' + esc(descLanc(l)) + '</td><td class="v">' + formatar(l.valor) + '</td></tr>'; }).join('') + '</table>' +
      '<div class="tot">Total: ' + formatar(total) + (orc ? ' · Orçado: ' + formatar(orc) : '') + '</div>');
  };
}
function renderizarPlanos() {
  var planos = planosAtivos(lancamentos()).sort(function (a, b) { return (a.quitado - b.quitado) || b.valorParc - a.valorParc; });
  if (!planos.length) return '<div class="vazio">📦 Nenhum parcelamento.<br>Ao registrar um gasto, toque em <b>À vista</b> para parcelar.</div>';
  return planos.map(function (p) {
    var pct = p.total ? p.pagas / p.total * 100 : 0, restante = (p.total - p.pagas) * p.valorParc;
    var nums = '';
    for (var n = 1; n <= p.total; n++) nums += '<span class="parc-num ' + (n <= p.pagas ? 'parc-num-paga' : p.lancs[n] ? 'parc-num-futura' : 'parc-num-ausente') + '">' + n + '</span>';
    return '<div class="parc-grupo-card"><div class="parc-grupo-hdr"><div><div class="parc-grupo-desc">' + esc(p.desc) + (p.quitado ? ' ✅' : '') + '</div>' +
      '<div class="parc-grupo-sub">' + p.pagas + '/' + p.total + ' pagas · ' + formatar(p.valorParc) + '/mês' + (p.valorTotal ? ' · total ' + formatar(p.valorTotal) : '') + '</div></div>' +
      '<div class="parc-grupo-val">' + (p.quitado ? 'Quitado' : formatar(restante)) + '</div></div>' +
      '<div class="parc-barra-wrap"><div class="parc-barra-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
      '<div class="parc-numeros">' + nums + '</div>' +
      (!p.quitado ? '<button class="aj-btn perigo" style="margin-top:10px" data-cancelar-plano="' + p.gid + '">Cancelar parcelas futuras</button>' : '') + '</div>';
  }).join('');
}
function cancelarPlano(gid) {
  var hj = hoje(), fut = lancamentos().filter(function (l) { return l.parcela && l.parcela.grupoId === gid && l.data > hj; });
  if (!fut.length) { mostrarToast('ℹ️', 'Não há parcelas futuras'); return; }
  if (!confirm('Excluir ' + fut.length + ' parcela(s) futura(s) deste plano? As já pagas ficam no histórico.')) return;
  apagar(fut.map(function (l) { return l.id; }));
}

// ═════════════════════════ PROJEÇÃO ═════════════════════════
function atualizarProjecao() {
  var p = getPer('proj');
  renderizarTermometroDivida();
  renderizarProjecaoParcelados();
  var lim = baseDisponivel();
  $('proj-sem-limite').style.display = lim > 0 ? 'none' : '';
  $('proj-conteudo').style.display = lim > 0 && p ? '' : 'none';
  if (!p || lim <= 0) { $('proj-subtitle').textContent = '—'; $('proj-badge').textContent = ''; $('proj-badge').className = 'proj-badge'; return; }
  var T = totaisPeriodo(p), hj = hoje(), gasto = T.comum;
  var totalDias = Math.max(1, diasEntre(p.inicio, p.fim) + 1);
  var passados = Math.min(totalDias, Math.max(1, diasEntre(p.inicio, hj) + 1)), restantes = Math.max(0, totalDias - passados);
  var realDia = gasto / passados, projFinal = realDia * totalDias, orcRest = lim - gasto;
  var metaDia = restantes > 0 ? orcRest / restantes : 0, desvio = realDia - metaDia;
  var pctTempo = passados / totalDias * 100, pctGasto = Math.min(120, gasto / lim * 100);
  function fmtD(v) { return formatar(Math.abs(v)); }
  $('proj-subtitle').textContent = 'Limite ' + formatar(lim) + ' · Gasto: ' + formatar(gasto) + ' · Livre ' + formatar(lim - gasto);
  var badge = $('proj-badge');
  if (projFinal > lim) { badge.textContent = '⚠️ Vai exceder'; badge.className = 'proj-badge over'; }
  else if (desvio > metaDia * 0.15) { badge.textContent = '📈 Acima'; badge.className = 'proj-badge warn'; }
  else { badge.textContent = '✅ No controle'; badge.className = 'proj-badge ok'; }
  $('proj-padrao').textContent = fmtD(metaDia);
  $('proj-real').textContent = fmtD(realDia);
  $('proj-desvio').textContent = (desvio >= 0 ? '+' : '−') + fmtD(desvio);
  $('proj-desvio').style.color = desvio > 0 ? '#f87171' : '#4ade80';
  $('proj-desvio-sub').textContent = desvio > 0 ? 'acima/dia' : 'abaixo/dia';
  $('proj-btempo').style.width = pctTempo.toFixed(1) + '%';
  $('proj-ptempo').textContent = Math.round(pctTempo) + '%';
  var corG = pctGasto > 100 ? '#f87171' : pctGasto > 85 ? '#fbbf24' : '#4ade80';
  $('proj-bgasto').style.width = Math.min(100, pctGasto).toFixed(1) + '%'; $('proj-bgasto').style.background = corG;
  $('proj-pgasto').textContent = Math.round(pctGasto) + '%'; $('proj-pgasto').style.color = corG;
  var sa = lim - gasto;
  $('proj-saldo-atual').textContent = (sa >= 0 ? '+ ' : '− ') + formatar(Math.abs(sa)); $('proj-saldo-atual').style.color = sa >= 0 ? '#4ade80' : '#f87171';
  $('proj-saldo-atual-sub').textContent = sa >= 0 ? 'disponível' : 'acima do limite';
  var sf = lim - projFinal;
  $('proj-final').textContent = (sf >= 0 ? '+ ' : '− ') + formatar(Math.abs(sf)); $('proj-final').style.color = sf >= 0 ? '#4ade80' : '#f87171';
  $('proj-final-sub').textContent = sf >= 0 ? 'sobrando se mantiver o ritmo' : 'excedendo se mantiver o ritmo';
  renderizarGraficoProjecao(T, p, lim, hj);
}
function renderizarGraficoProjecao(T, p, lim, hj) {
  var dias = [];
  for (var d = p.inicio; d <= p.fim; d = proxDia(d)) { dias.push(d); if (dias.length > 400) break; }
  var N = dias.length, acum = 0;
  var cumReal = dias.map(function (dt) { if (dt <= hj) { acum += T.porDia[dt] || 0; return acum; } return null; });
  var cumOrc = dias.map(function (dt, i) { return lim * (i + 1) / N; });
  var maxY = Math.max(lim * 1.08, acum * 1.08, 1), todayIdx = dias.indexOf(hj);
  var W = 320, H = 190, pL = 46, pR = 14, pT = 14, pB = 28, cW = W - pL - pR, cH = H - pT - pB;
  function xp(i) { return pL + (N > 1 ? i / (N - 1) * cW : cW / 2); }
  function yp(v) { return pT + cH - (v / maxY * cH); }
  function fmtY(v) { return v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + Math.round(v); }
  var orcPath = dias.map(function (dt, i) { return (i ? 'L' : 'M') + xp(i).toFixed(1) + ',' + yp(cumOrc[i]).toFixed(1); }).join(' ');
  var pts = cumReal.map(function (v, i) { return v !== null ? { x: xp(i), y: yp(v) } : null; }).filter(Boolean);
  var realPath = pts.map(function (pt, i) { return (i ? 'L' : 'M') + pt.x.toFixed(1) + ',' + pt.y.toFixed(1); }).join(' ');
  var area = pts.length ? realPath + ' L' + pts[pts.length - 1].x.toFixed(1) + ',' + (pT + cH) + ' L' + pL + ',' + (pT + cH) + ' Z' : '';
  var corR = acum <= lim ? '#4ade80' : '#f87171', corA = acum <= lim ? 'rgba(74,222,128,.12)' : 'rgba(248,113,113,.12)';
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block">' +
    [0, lim / 2, lim].map(function (v) { var y = yp(v).toFixed(1); return '<line x1="' + pL + '" y1="' + y + '" x2="' + (W - pR) + '" y2="' + y + '" stroke="rgba(255,255,255,.08)"/><text x="' + (pL - 5) + '" y="' + (+y + 3.5) + '" text-anchor="end" font-size="8.5" fill="rgba(255,255,255,.4)" font-family="system-ui,sans-serif">' + fmtY(v) + '</text>'; }).join('') +
    '<line x1="' + pL + '" y1="' + yp(lim).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + yp(lim).toFixed(1) + '" stroke="#fbbf24" stroke-dasharray="3,3" opacity=".6"/>' +
    (area ? '<path d="' + area + '" fill="' + corA + '"/>' : '') +
    '<path d="' + orcPath + '" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5" stroke-dasharray="5,3"/>' +
    (realPath ? '<path d="' + realPath + '" fill="none" stroke="' + corR + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' : '') +
    (todayIdx >= 0 ? '<line x1="' + xp(todayIdx).toFixed(1) + '" y1="' + pT + '" x2="' + xp(todayIdx).toFixed(1) + '" y2="' + (pT + cH) + '" stroke="rgba(255,255,255,.2)" stroke-dasharray="3,3"/>' +
      '<circle cx="' + xp(todayIdx).toFixed(1) + '" cy="' + yp(cumReal[todayIdx]).toFixed(1) + '" r="4.5" fill="' + corR + '" stroke="#0f172a" stroke-width="2"/>' +
      '<text x="' + xp(todayIdx).toFixed(1) + '" y="' + (pT - 3) + '" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.5)" font-family="system-ui,sans-serif">hoje</text>' : '') +
    [0, Math.floor(N / 2), N - 1].map(function (i) { var dt = dias[i]; return '<text x="' + xp(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,.4)" font-family="system-ui,sans-serif">' + (+dt.slice(8, 10)) + '/' + (+dt.slice(5, 7)) + '</text>'; }).join('') +
    '</svg>';
  $('proj-grafico').innerHTML = svg;
}
function renderizarTermometroDivida() {
  var planos = planosAtivos(lancamentos()).filter(function (p) { return !p.quitado; }), el = $('proj-termometro');
  if (!planos.length) { el.innerHTML = ''; return; }
  var saldoHoje = planos.reduce(function (s, p) { return s + (p.total - p.pagas) * p.valorParc; }, 0);
  var totalOrig = planos.reduce(function (s, p) { return s + p.total * p.valorParc; }, 0), pctPago = totalOrig > 0 ? (totalOrig - saldoHoje) / totalOrig * 100 : 0;
  var base = new Date(); base.setDate(1);
  var html = '<div class="card" style="margin-bottom:14px;border-left:4px solid #dc2626"><div class="card-titulo" style="color:#7f1d1d">💳 Termômetro da Dívida</div>' +
    '<div style="font-size:.72rem;color:#aaa;margin-bottom:10px">Total ainda a pagar em todos os planos ativos</div>' +
    '<div class="termo-total-row"><div class="termo-total-val">' + formatar(saldoHoje) + '</div><div class="termo-total-pago"><span style="color:#16a34a;font-weight:800">' + pctPago.toFixed(0) + '%</span> já pago<br><span style="font-size:10px">Total original: ' + formatar(totalOrig) + '</span></div></div>' +
    '<div class="termo-prog-bg"><div class="termo-prog-fill" style="width:' + pctPago.toFixed(1) + '%"></div></div>';
  for (var i = 0; i < 48; i++) {
    var dt = new Date(base); dt.setMonth(base.getMonth() + i);
    var saldo = planos.reduce(function (s, p) { var r = p.total - p.pagas - i; return s + (r > 0 ? r * p.valorParc : 0); }, 0);
    var quit = planos.filter(function (p) { return p.pagas + i < p.total && p.pagas + i + 1 === p.total; }).map(function (p) { return p.desc; });
    var badge = (i === 0 ? '<span class="parc-proj-badge parc-proj-hoje">hoje</span> ' : '') + quit.map(function (d) { return '<span class="termo-badge-ok">✓ ' + esc(d) + '</span> '; }).join('');
    if (saldo > 0) html += '<div class="termo-row"><div class="termo-mes">' + MESES_C[dt.getMonth()] + '/' + String(dt.getFullYear()).slice(2) + '</div>' +
      '<div class="termo-barra-bg"><div class="termo-barra-fill" style="width:' + (saldoHoje > 0 ? saldo / saldoHoje * 100 : 0).toFixed(1) + '%"></div></div><div class="termo-val">' + formatar(saldo) + '</div>' +
      (badge ? '<div style="display:flex;gap:3px;flex-wrap:wrap">' + badge + '</div>' : '') + '</div>';
    if (saldo <= 0) break;
  }
  el.innerHTML = html + '</div>';
}
function renderizarProjecaoParcelados() {
  var planos = planosAtivos(lancamentos()).filter(function (p) { return !p.quitado; }), el = $('proj-parcelados');
  if (!planos.length) { el.innerHTML = ''; return; }
  var base = new Date(); base.setDate(1);
  var linhas = [], maxBar = 0;
  for (var i = 0; i < 24; i++) {
    var dt = new Date(base); dt.setMonth(base.getMonth() + i);
    var tot = 0, quit = [];
    planos.forEach(function (p) { if (p.pagas + i < p.total) { tot += p.valorParc; if (p.pagas + i + 1 === p.total) quit.push(p.desc); } });
    maxBar = Math.max(maxBar, tot);
    linhas.push({ m: dt.getMonth(), a: dt.getFullYear(), tot: tot, quit: quit, hoje: i === 0 });
  }
  el.innerHTML = '<div class="card" style="margin-bottom:14px"><div class="card-titulo" style="color:#5b21b6">📦 Projeção de Parcelados — 24 meses</div><div style="font-size:.72rem;color:#aaa;margin-bottom:10px">Compromisso mensal com planos ativos</div>' +
    linhas.filter(function (l) { return l.tot > 0 || l.hoje; }).map(function (l) {
      var badge = (l.hoje ? '<span class="parc-proj-badge parc-proj-hoje">hoje</span>' : '') + l.quit.map(function (d) { return ' <span class="parc-proj-badge parc-proj-fim">✓ ' + esc(d) + '</span>'; }).join('');
      return '<div class="parc-proj-row"><div class="parc-proj-mes">' + MESES_C[l.m] + '/' + String(l.a).slice(2) + '</div><div class="parc-proj-barra-bg"><div class="parc-proj-barra-fill" style="width:' + (maxBar ? l.tot / maxBar * 100 : 0).toFixed(1) + '%"></div></div>' +
        '<div class="parc-proj-val">' + formatar(l.tot) + '</div>' + (badge ? '<div style="display:flex;gap:3px;flex-wrap:wrap">' + badge + '</div>' : '') + '</div>';
    }).join('') + '</div>';
}

// ═════════════════════════ RELATÓRIO SEMANAL ═════════════════════════
// Mesma lógica do "Resumo da semana" do Gastos da Casa: compara a última semana fechada
// (segunda a domingo) com o SEU normal (média das 12 semanas anteriores) em cada
// subcategoria, aponta onde mais vazou e sugere até 4 ações para a semana que começa.
var SEM_BASE = 12, SEM_PEQ = 25, MESC = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function semAdd(s, n) { var d = dataObj(s); d.setDate(d.getDate() + n); return isoDe(d); }
function semND(a, b) { return diasEntre(a, b) + 1; }
function semFD(s) { var d = dataObj(s); return d.getDate() + ' ' + MESC[d.getMonth()]; }
function m0(n) { return formatar(Math.round(+n || 0)).replace(/[.,]00$/, ''); }
function semSub(l) { return nomeSub(l.cat, l.sub) || (l.desc ? String(l.desc).trim() : '') || NOME(l.cat) + ' sem tipo'; }
function semOutros(nome) { return /^outros?$|^outras( despesas)?$|sem (tipo|categoria)$/i.test(String(nome).trim()); }
function cicloDe(per, h) {
  var k = 0; while (h > addMeses(per.fim, k) && k < 36) k++;
  while (h < addMeses(per.inicio, k) && k > -36) k--;
  return { inicio: addMeses(per.inicio, k), fim: addMeses(per.fim, k) };
}
function analisarSemana(hojeRef, parcial) {
  var hj = parcial ? hoje() : (hojeRef || hoje());
  var L = lancamentos().filter(function (l) { return l.data && !l.parcela && l.cat !== PARC; });
  if (!L.length) return null;
  var w = dataObj(hj).getDay();
  var seg = semAdd(hj, -((w + 6) % 7) - (parcial ? 0 : 7)), dom = semAdd(seg, 6);
  // Semana atual (parcial): conta só até hoje e compara com a parte proporcional do normal e do alvo
  var ate = parcial ? hj : dom, diasDec = parcial ? semND(seg, hj) : 7, frac = diasDec / 7;
  var base0 = semAdd(seg, -7 * SEM_BASE), primeiro = L.reduce(function (a, l) { return l.data < a ? l.data : a; }, hj);
  var histDias = semND(primeiro < base0 ? base0 : primeiro, semAdd(seg, -1));
  var semBase = Math.max(1, Math.min(SEM_BASE, Math.floor(histDias / 7)));
  var iniBase = semAdd(seg, -7 * semBase);
  var cic = cicloDe(S.cfg.periodo, hj), diasCic = semND(cic.inicio, cic.fim);
  var lim = baseDisponivel(), alvoSem = lim * 7 / diasCic * frac;
  var Sx = L.filter(function (l) { return l.data >= seg && l.data <= ate; });
  var B = L.filter(function (l) { return l.data >= iniBase && l.data < seg; });
  var tot = Sx.reduce(function (s, l) { return s + l.valor; }, 0);
  var normalTot = B.reduce(function (s, l) { return s + l.valor; }, 0) / semBase * frac;
  var m = {};
  function k(l) { return l.cat + '|' + semSub(l).toLowerCase(); }
  Sx.forEach(function (l) { var x = m[k(l)] || (m[k(l)] = { nome: semSub(l), cat: l.cat, sem: 0, n: 0, base: 0, nb: 0 }); x.sem += l.valor; x.n++; });
  B.forEach(function (l) { var x = m[k(l)] || (m[k(l)] = { nome: semSub(l), cat: l.cat, sem: 0, n: 0, base: 0, nb: 0 }); x.base += l.valor; x.nb++; });
  var lugares = Object.keys(m).map(function (q) { var x = m[q]; x.normal = x.base / semBase * frac; x.nNormal = x.nb / semBase * frac; x.exc = x.sem - x.normal; return x; });
  var vaz = lugares.filter(function (x) { return x.exc > Math.max(10, x.normal * .15); }).sort(function (a, b) { return b.exc - a.exc; });
  var cats = catsComuns().map(function (c) {
    var sm = Sx.filter(function (l) { return l.cat === c.id; }).reduce(function (a, l) { return a + l.valor; }, 0);
    var o = (+c.orc || 0) * 7 / diasCic * frac;
    return { cat: c.id, nome: c.nome, emoji: c.emoji, cor: c.cor, sem: sm, orcSem: o, exc: o ? sm - o : 0 };
  }).filter(function (c) { return c.sem > 0 || c.orcSem > 0; });
  var peq = Sx.filter(function (l) { return l.valor < SEM_PEQ; }), peqT = peq.reduce(function (a, l) { return a + l.valor; }, 0);
  // "Mercado": a categoria com nome de mercado/supermercado, se existir
  var catMerc = catsComuns().filter(function (c) { return /mercad|grocer/i.test(c.nome); }).map(function (c) { return c.id; });
  var merc = Sx.filter(function (l) { return catMerc.indexOf(l.cat) >= 0; }).length;
  var mercNormal = B.filter(function (l) { return catMerc.indexOf(l.cat) >= 0; }).length / semBase * frac;
  var dias = {}; Sx.forEach(function (l) { dias[l.data] = 1; });
  var outros = Sx.filter(function (l) { return semOutros(semSub(l)) || / sem tipo$/.test(semSub(l)); }).reduce(function (a, l) { return a + l.valor; }, 0);
  var assin = lugares.filter(function (x) { return /subscri|assinat|netflix|spotify|disney|prime|apple|streaming/i.test(x.nome) && x.exc > 5; })[0];
  var hjReal = hoje() < cic.fim ? hoje() : cic.fim;
  var noCic = L.filter(function (l) { return l.data >= cic.inicio && l.data <= hjReal; }).reduce(function (a, l) { return a + l.valor; }, 0);
  var decor = semND(cic.inicio, hjReal), resta = Math.max(0, diasCic - decor);
  var ideal = lim * decor / diasCic, livre = lim - noCic, porDia = resta ? Math.max(0, livre) / resta : 0;

  var acoes = [];
  vaz.slice(0, 2).forEach(function (x) {
    var nome = x.nome;
    if (/restaur|lanche|caf[eé]|coffee|tim ?hortons|fast|pizza|delivery|ifood|uber ?eats|skip|bar\b|padaria/i.test(nome))
      acoes.push('<b>' + esc(nome) + '</b>: ' + x.n + ' vezes ' + (parcial ? 'nesta semana, até agora' : 'na semana passada') + ' (' + m0(x.sem) + '). O seu normal é ' + Math.max(1, Math.round(x.nNormal)) + (parcial ? ' até este dia da semana. Segure as próximas idas até domingo.' : ' por semana. Esta semana, no máximo <b>' + Math.max(1, Math.round(x.nNormal)) + '</b>, com teto de <b>' + m0(x.normal) + '</b>.'));
    else if (semOutros(x.nome) || / sem tipo$/.test(x.nome))
      acoes.push('<b>' + esc(nome) + ' (' + esc(NOME(x.cat)) + ')</b> subiu para ' + m0(x.sem) + '. Ao lançar, escolha a subcategoria certa: sem saber onde foi, não dá para cortar.');
    else
      acoes.push('<b>' + esc(nome) + '</b>: ' + m0(x.sem) + ' em ' + x.n + (x.n === 1 ? ' compra' : ' compras') + ', ' + m0(x.exc) + ' acima do seu normal. Teto para esta semana: <b>' + m0(Math.max(x.normal, 0)) + '</b>.');
  });
  if (lim > 0 && resta > 0) {
    if (noCic > ideal) acoes.push('Ciclo ' + semFD(cic.inicio) + ' – ' + semFD(cic.fim) + ': ' + m0(noCic - ideal) + ' adiantado. Para fechar no limite, gaste no máximo <b>' + m0(porDia) + ' por dia</b> nos próximos ' + resta + ' dias.');
    else acoes.push('Ciclo ' + semFD(cic.inicio) + ' – ' + semFD(cic.fim) + ': você tem ' + m0(ideal - noCic) + ' de folga. Dá para gastar até <b>' + m0(porDia) + ' por dia</b> até o fim do ciclo e ainda fechar no limite.');
  }
  if (catMerc.length && merc >= Math.round(mercNormal) + 2) acoes.push('Foram <b>' + merc + ' idas ao mercado</b> (normal: ' + Math.round(mercNormal) + '). Junte as compras: lista pronta e 1 ou 2 idas na semana.');
  if (peq.length >= 6 && (peqT >= 60 || peqT > tot * .15)) acoes.push('<b>' + peq.length + ' compras pequenas</b> (abaixo de ' + m0(SEM_PEQ) + ') somaram ' + m0(peqT) + '. Antes de uma compra pequena por impulso, espere um dia.');
  if (outros > tot * .2 && outros > 40 && !vaz.slice(0, 2).some(function (x) { return semOutros(x.nome) || / sem tipo$/.test(x.nome); }))
    acoes.push(m0(outros) + ' (' + Math.round(outros / tot * 100) + '% da semana) foram lançados como <b>"Outros"</b> ou sem subcategoria. Escolha a subcategoria ao lançar.');
  if (assin) acoes.push('<b>Assinaturas</b> subiram para ' + m0(assin.sem) + '. Revise se todas ainda valem a pena.');
  if (!parcial && Object.keys(dias).length >= 6) acoes.push('Houve gasto em <b>' + Object.keys(dias).length + ' dos 7 dias</b>. Marque 2 dias sem gasto nesta semana.');
  if (!acoes.length) acoes.push('Semana dentro do seu normal. Mantenha o ritmo.');
  return { parcial: !!parcial, ate: ate, diasDec: diasDec, seg: seg, dom: dom, semBase: semBase, poucoHist: histDias < 14, tot: tot, n: Sx.length, normalTot: normalTot, alvoSem: alvoSem, lim: lim,
    vaz: vaz.slice(0, 3), cats: cats, peq: peq.length, peqT: peqT, merc: merc, mercNormal: mercNormal, diasGasto: Object.keys(dias).length,
    outros: outros, ciclo: cic, noCic: noCic, ideal: ideal, resta: resta, porDia: porDia, acoes: acoes.slice(0, 4) };
}
function statusSemana(r) { var ref = r.alvoSem > 0 ? r.alvoSem : r.normalTot; return r.tot > ref * 1.05 ? 'bad' : r.tot < ref * .95 ? 'good' : 'mid'; }
function corStatus(st) { return st === 'bad' ? '#dc2626' : st === 'good' ? '#16a34a' : '#b26b00'; }
function chaveSemFechado() { return 'hv_sem_fechado_' + (S.casa || ''); }
function pintarCartaoSemana() {
  var wrap = $('sem-card-wrap'); if (!wrap) return;
  var r = null; try { r = analisarSemana(); } catch (e) { console.warn('semana:', e && e.message); }
  if (!r || !r.n) { wrap.innerHTML = ''; return; }
  try { if (localStorage.getItem(chaveSemFechado()) === r.seg) { wrap.innerHTML = ''; return; } } catch (e) {}
  var st = statusSemana(r), cor = corStatus(st), ref = r.alvoSem > 0 ? 'alvo ' + m0(r.alvoSem) : 'seu normal ' + m0(r.normalTot), v = r.vaz[0];
  wrap.innerHTML = '<div style="background:#fff;border-radius:16px;padding:14px 16px;margin:0 0 12px;box-shadow:0 2px 12px rgba(0,0,0,.06);border-left:5px solid ' + cor + ';position:relative">' +
    '<button type="button" id="sem-fechar" aria-label="Fechar" style="position:absolute;top:8px;right:8px;border:0;background:none;font-size:18px;color:#9ca3af;cursor:pointer;padding:4px 8px">×</button>' +
    '<div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:#6b7280;text-transform:uppercase">📌 Semana ' + semFD(r.seg) + ' – ' + semFD(r.dom) + '</div>' +
    '<div style="font-size:20px;font-weight:800;margin:4px 0 2px;color:' + cor + '">' + m0(r.tot) + ' <span style="font-size:13px;font-weight:600;color:#6b7280">· ' + ref + '</span></div>' +
    (v ? '<div style="font-size:13px;color:#374151;margin-top:4px">Maior vazamento: <b>' + esc(v.nome) + '</b>, ' + m0(v.sem) + ' (normal ' + m0(v.normal) + ')</div>'
      : '<div style="font-size:13px;color:#374151;margin-top:4px">Nenhum lugar fugiu do seu normal.</div>') +
    '<div style="font-size:13px;color:#374151;margin-top:6px">👉 ' + r.acoes[0] + '</div>' +
    '<button type="button" data-ir="semana" style="margin-top:8px;font-size:13px;font-weight:700;color:#1d4ed8;background:none;border:0;padding:0;cursor:pointer;font-family:inherit">Ver todas as ações ›</button></div>';
  $('sem-fechar').onclick = function () { try { localStorage.setItem(chaveSemFechado(), r.seg); } catch (e) {} wrap.innerHTML = ''; };
}
function renderizarSemana() {
  var off = S.semOff || 0, atual = off < 0;
  var hjRef = atual ? hoje() : semAdd(hoje(), -7 * off);
  var r = null; try { r = analisarSemana(hjRef, atual); } catch (e) { console.warn('semana:', e && e.message); }
  var w = dataObj(hjRef).getDay(), seg = semAdd(hjRef, -((w + 6) % 7) - (atual ? 0 : 7));
  $('sem-label').textContent = (atual ? 'Semana atual · ' : 'Semana ') + semFD(seg) + ' – ' + semFD(semAdd(seg, 6));
  $('sem-prox').style.visibility = off > -1 ? 'visible' : 'hidden';
  $('sem-prox').title = off === 0 ? 'Ver a semana atual (parcial)' : '';
  var el = $('corpo-semana');
  var dica = off === 0 ? '<div style="font-size:12px;color:#6b7280;text-align:center;margin:-2px 0 10px">Esta é a última semana fechada. Toque em <b>›</b> para ver a semana atual, até hoje.</div>' : '';
  if (!r || !r.n) { el.innerHTML = dica + '<div class="vazio">📭 Nenhum gasto ' + (atual ? 'nesta semana até agora' : 'nesta semana') + '.<br><span style="font-size:12px">' + (atual ? 'Os lançamentos de segunda até hoje aparecem aqui.' : 'Esta tela mostra a semana fechada (segunda a domingo).') + '</span></div>'; return; }
  var st = statusSemana(r), cor = corStatus(st);
  var ref = r.alvoSem > 0 ? (r.parcial ? 'Alvo até hoje pelo limite: <b>' : 'Alvo da semana pelo limite: <b>') + m0(r.alvoSem) + '</b>' : 'Sem limite definido (defina em Início → ⚙️ Config)';
  var resumo = '<div class="card sem-st" style="border-left-color:' + cor + '">' +
    '<div class="card-titulo">' + (r.parcial ? 'Semana em andamento · até hoje (' + r.diasDec + ' de 7 dias)' : 'Resumo da semana') + '</div>' +
    '<div style="font-size:30px;font-weight:900;color:' + cor + ';letter-spacing:-1px">' + m0(r.tot) + '</div>' +
    '<div style="font-size:13px;color:#6b7280;margin-top:2px">' + r.n + ' lançamentos · ' + r.diasGasto + ' de ' + r.diasDec + ' dias com gasto</div>' +
    '<div style="font-size:13px;color:#374151;margin-top:8px">' + ref + '<br>Seu normal: <b>' + m0(r.normalTot) + '</b> ' + (r.parcial ? 'até este dia da semana' : 'por semana') + ' <span style="color:#9ca3af">(média das ' + r.semBase + ' semana' + (r.semBase > 1 ? 's' : '') + ' anteriores)</span></div>' +
    (r.parcial ? '<div style="font-size:11.5px;color:#9ca3af;margin-top:8px">A semana ainda não terminou. Normal e alvo são proporcionais aos ' + r.diasDec + ' dias já passados. O relatório completo sai na segunda-feira.</div>' : '') +
    (r.poucoHist ? '<div class="alerta atencao" style="margin:10px 0 0">Ainda há pouco histórico. O "normal" fica mais preciso depois de algumas semanas de lançamentos.</div>' : '') + '</div>';
  var catsH = r.cats.filter(function (c) { return c.orcSem > 0; }).map(function (c) {
    var pct = Math.min(c.sem / c.orcSem * 100, 100), corB = c.exc > 0 ? '#f44336' : pct >= 80 ? '#ff9800' : c.cor;
    return '<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>' + esc(c.emoji + ' ' + c.nome) + '</span>' +
      '<span><b style="color:' + (c.exc > 0 ? '#dc2626' : '#16a34a') + '">' + m0(c.sem) + '</b> <span style="color:#9ca3af">/ ' + m0(c.orcSem) + '</span></span></div>' +
      '<div class="orc-barra-fundo" style="margin-top:4px"><div class="orc-barra-fill" style="width:' + pct.toFixed(1) + '%;background:' + corB + '"></div></div></div>';
  }).join('');
  var catsCard = catsH ? '<div class="card"><div class="card-titulo">Categorias × orçamento semanal</div>' + catsH +
    '<div style="font-size:11px;color:#9ca3af;margin-top:6px">Orçamento semanal = orçamento do período ÷ dias do período × 7' + (r.parcial ? ', proporcional aos dias já passados' : '') + '</div></div>' : '';
  var linhas = r.vaz.length ? r.vaz.map(function (x) {
    return '<tr><td><b>' + esc(x.nome) + '</b><br><span style="font-size:11px;color:#9ca3af">' + esc(NOME(x.cat)) + '</span></td><td>' + m0(x.sem) + '</td><td>' + m0(x.normal) + '</td><td style="color:#dc2626;font-weight:800">+' + m0(x.exc) + '</td><td>' + x.n + '</td></tr>';
  }).join('') : '<tr><td colspan="5" style="color:#16a34a">Nenhum lugar ficou acima do seu normal. 👏</td></tr>';
  var vazCard = '<div class="card"><div class="card-titulo">Onde mais vazou</div>' +
    '<div style="font-size:11.5px;color:#9ca3af;margin:-4px 0 8px">"Vazou" = gastou mais do que o seu normal naquele lugar</div>' +
    '<div style="overflow-x:auto"><table class="sem-tab"><thead><tr><th>Subcategoria</th><th>Semana</th><th>Normal</th><th>A mais</th><th>Qtd</th></tr></thead><tbody>' + linhas + '</tbody></table></div></div>';
  var acoesCard = '<div class="card" style="border-left:5px solid #7c3aed"><div class="card-titulo">✅ O que fazer nesta semana</div><ol class="sem-acoes">' +
    r.acoes.map(function (a) { return '<li>' + a + '</li>'; }).join('') + '</ol>' +
    '<button class="btn-whatsapp" id="sem-wa" style="margin-top:12px">📱 Enviar por WhatsApp</button></div>';
  el.innerHTML = dica + resumo + vazCard + acoesCard + catsCard;
  $('sem-wa').onclick = function () {
    var txt = function (h) { return h.replace(/<b>|<\/b>/g, '*').replace(/<[^>]+>/g, ''); };
    var msg = '📌 *' + (r.parcial ? 'SEMANA ATUAL (ATÉ ' + semFD(r.ate).toUpperCase() + ') ' : 'SEMANA ') + semFD(r.seg).toUpperCase() + ' – ' + semFD(r.dom).toUpperCase() + '*\n━━━━━━━━━━━━━━━━\n💰 Gasto: *' + m0(r.tot) + '*' + (r.alvoSem > 0 ? ' (alvo ' + m0(r.alvoSem) + ')' : '') + '\n📊 Seu normal: ' + m0(r.normalTot) + '\n';
    if (r.vaz.length) { msg += '\n🔻 *Onde mais vazou*\n'; r.vaz.forEach(function (x) { msg += '• ' + x.nome + ': ' + m0(x.sem) + ' (normal ' + m0(x.normal) + ', +' + m0(x.exc) + ')\n'; }); }
    msg += '\n✅ *O que fazer nesta semana*\n'; r.acoes.forEach(function (a, i) { msg += (i + 1) + '. ' + txt(a) + '\n'; });
    compartilharTexto(msg + '\n_Enviado via HomeVault_');
  };
}

// ═════════════════════════ AJUSTES ═════════════════════════
function codigoConvite() { return S.meta && S.meta.convite ? 'HV-' + S.casa + '-' + S.meta.convite : ''; }
function souDono() { return S.meta && S.user && S.meta.dono === S.user.uid; }
function renderAjustes() {
  if (document.activeElement !== $('aj-nome')) { $('aj-nome').value = S.cfg.nome || ''; $('aj-moeda').value = moeda(); }
  $('aj-cats').innerHTML = todasCats().map(function (c) {
    return '<div class="aj-linha"><div class="aj-ic" style="background:' + alfa(c.cor, '22') + '">' + esc(c.emoji) + '</div>' +
      '<div class="aj-nm">' + esc(c.nome) + '<small>' + (c.id === PARC ? 'Fixa · recebe as compras parceladas' : c.subs.length + ' subcategoria' + (c.subs.length === 1 ? '' : 's')) +
      ' · orçamento ' + (+c.orc ? formatar(c.orc) : '—') + '</small></div>' +
      (c.id === PARC ? '<button class="aj-btn" data-editcat="' + PARC + '">Orçamento</button>' :
        '<button class="aj-btn" data-subircat="' + c.id + '" aria-label="Subir">↑</button><button class="aj-btn" data-editcat="' + c.id + '">Editar</button>') + '</div>';
  }).join('');
  $('aj-codigo').textContent = codigoConvite();
  $('aj-novocod').style.display = souDono() ? '' : 'none';
  $('aj-membros').innerHTML = Object.keys(S.membros).map(function (uid) {
    var p = S.perfis[uid] || {}, eu = uid === S.user.uid, dono = S.meta && S.meta.dono === uid;
    return '<div class="aj-linha"><div class="aj-ic" style="background:#eef2ff">👤</div><div class="aj-nm">' + esc(p.nome || 'Membro') + (eu ? ' (você)' : '') +
      '<small>' + esc(p.email || '') + (dono ? ' · criou a casa' : '') + '</small></div>' +
      (souDono() && !eu ? '<button class="aj-btn perigo" data-remover="' + uid + '">Remover</button>' : '') + '</div>';
  }).join('');
  $('aj-conta').textContent = 'Conectado como ' + (S.user.email || '') + '.';
  $('aj-versao').textContent = VERSAO;
}
function salvarCasaAj() {
  var nome = $('aj-nome').value.trim();
  if (!nome) { mostrarToast('⚠️', 'Informe o nome da casa'); return; }
  S.cfg.nome = nome; S.cfg.moeda = $('aj-moeda').value;
  salvarCfg().then(function () { mostrarToast('✅', 'Salvo'); });
  renderTela();
}
function subirCat(id) {
  var cs = S.cfg.cats, i = -1;
  cs.forEach(function (c, k) { if (c.id === id) i = k; });
  if (i <= 0) return;
  var t = cs[i]; cs[i] = cs[i - 1]; cs[i - 1] = t;
  salvarCfg(); renderTela();
}

// Folha de edição de categoria
var _ed = null;
function abrirSheet(html) {
  $('sheet-box').innerHTML = html;
  $('sheet').classList.add('on');
}
function fecharSheet() { $('sheet').classList.remove('on'); _ed = null; }
function abrirCat(id) {
  if (id === PARC) {
    abrirSheet('<h3>📦 Parcelados</h3><p style="color:#6b7280;font-size:13.5px">Categoria fixa: recebe automaticamente as compras parceladas. Defina o orçamento mensal para parcelas.</p>' +
      '<label class="aj-label">Orçamento</label><input class="aj-input" id="ed-orc" inputmode="decimal" value="' + esc(numTxt(S.cfg.orcParc)) + '" placeholder="0">' +
      '<button class="aj-btn pri aj-full" id="ed-salvar">Salvar</button><button class="aj-btn aj-full" data-fechar>Cancelar</button>');
    $('ed-salvar').onclick = function () { var v = lerValor($('ed-orc').value); S.cfg.orcParc = v > 0 ? v : 0; salvarCfg(); fecharSheet(); renderTela(); };
    return;
  }
  var orig = id ? catPorId(id) : null;
  _ed = orig ? JSON.parse(JSON.stringify(orig)) : { id: rid(8), emoji: '📦', nome: '', cor: PALETA[catsComuns().length % PALETA.length], orc: 0, subs: [], nova: true };
  desenharCat();
}
function desenharCat() {
  var c = _ed;
  abrirSheet('<h3>' + (c.nova ? 'Nova categoria' : 'Editar categoria') + '</h3>' +
    '<label class="aj-label">Nome</label><input class="aj-input" id="ed-nome" maxlength="30" value="' + esc(c.nome) + '">' +
    '<label class="aj-label">Orçamento no período</label><input class="aj-input" id="ed-orc" inputmode="decimal" placeholder="0 = sem orçamento" value="' + esc(numTxt(c.orc)) + '">' +
    '<label class="aj-label">Ícone</label><div class="emo-grid">' + EMOJIS.map(function (e) { return '<button class="' + (e === c.emoji ? 'on' : '') + '" data-emo="' + e + '">' + e + '</button>'; }).join('') + '</div>' +
    '<label class="aj-label">Cor</label><div class="cor-grid">' + PALETA.map(function (k) { return '<button class="' + (k === c.cor ? 'on' : '') + '" data-cor="' + k + '" style="background:' + k + '"></button>'; }).join('') + '</div>' +
    '<label class="aj-label">Subcategorias</label>' +
    c.subs.map(function (s, i) { return '<div class="sub-ed"><input class="aj-input" data-subnome="' + i + '" maxlength="40" value="' + esc(s.nome) + '"><button class="aj-btn perigo" data-subdel="' + i + '">Excluir</button></div>'; }).join('') +
    '<div class="sub-ed"><input class="aj-input" id="ed-novasub" maxlength="40" placeholder="Nova subcategoria"><button class="aj-btn" id="ed-addsub">Adicionar</button></div>' +
    '<div class="hv-erro" id="ed-erro"></div>' +
    '<button class="aj-btn pri aj-full" id="ed-salvar">Salvar categoria</button>' +
    '<button class="aj-btn aj-full" data-fechar>Cancelar</button>' +
    (c.nova ? '' : '<button class="aj-btn perigo aj-full" id="ed-excluir">Excluir categoria</button>'));
}
function lerCatInputs() {
  if (!_ed || !$('ed-nome')) return;
  _ed.nome = $('ed-nome').value;
  var v = lerValor($('ed-orc').value); _ed.orc = v > 0 ? v : 0;
  qsa('[data-subnome]').forEach(function (inp) { _ed.subs[+inp.dataset.subnome].nome = inp.value; });
}
function salvarCat() {
  lerCatInputs();
  var c = _ed; c.nome = c.nome.trim();
  if (!c.nome) { $('ed-erro').textContent = 'Informe o nome da categoria.'; return; }
  var pend = $('ed-novasub').value.trim();
  if (pend) c.subs.push({ id: rid(8), nome: pend });
  c.subs = c.subs.map(function (s) { return { id: s.id, nome: s.nome.trim() }; }).filter(function (s) { return s.nome; });
  var nova = c.nova; delete c.nova;
  if (nova) S.cfg.cats.push(c);
  else S.cfg.cats = S.cfg.cats.map(function (x) { return x.id === c.id ? c : x; });
  fecharSheet(); renderTela();
  salvarCfg().then(function () { mostrarToast('✅', 'Categoria salva'); });
}
function excluirCat() {
  var c = _ed, usados = lancamentos().filter(function (l) { return l.cat === c.id; }).length;
  if (!confirm('Excluir a categoria "' + c.nome + '"?' + (usados ? '\n\n' + usados + ' lançamento(s) ficarão como "Sem categoria".' : ''))) return;
  S.cfg.cats = S.cfg.cats.filter(function (x) { return x.id !== c.id; });
  fecharSheet(); renderTela(); salvarCfg();
}

// Convite / membros
function copiar(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { mostrarToast('📋', 'Código copiado'); }, function () { mostrarToast('ℹ️', 'Toque e segure o código para copiar'); });
  else mostrarToast('ℹ️', 'Toque e segure o código para copiar');
}
function compartilharConvite() {
  var txt = 'Convite para a casa no HomeVault:\n' + codigoConvite() + '\n\nAbra ' + location.href.split('#')[0].split('?')[0] + ', crie sua conta e toque em "Tenho convite". Vou te passar a senha da casa separadamente.';
  if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else copiar(txt);
}
function novoCodigo() {
  if (!confirm('Gerar um novo código? O atual deixa de funcionar para novos convites. Quem já está na casa não é afetado.')) return;
  db.ref('casas/' + S.casa + '/convite').set(rid(24)).then(function () { mostrarToast('✅', 'Novo código gerado'); }, function () { mostrarToast('⚠️', 'Erro'); });
}
function removerMembro(uid) {
  var p = S.perfis[uid] || {};
  if (!confirm('Remover ' + (p.nome || 'este membro') + ' da casa? A pessoa perde o acesso aos dados.\n\nDica: depois, gere um novo código de convite.')) return;
  Promise.all([db.ref('casas/' + S.casa + '/membros/' + uid).remove(), db.ref('casas/' + S.casa + '/dados/perfis/' + uid).remove()])
    .then(function () { mostrarToast('✅', 'Membro removido'); }, function () { mostrarToast('⚠️', 'Erro ao remover'); });
}

// Backup
function baixar(nome, tipo, conteudo) {
  var blob = new Blob([conteudo], { type: tipo });
  try {
    var arq = new File([blob], nome, { type: tipo });
    if (navigator.canShare && navigator.canShare({ files: [arq] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) { navigator.share({ files: [arq], title: nome }).catch(function () {}); return; }
  } catch (e) {}
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportarJSON() {
  baixar('homevault-backup-' + hoje() + '.json', 'application/json', JSON.stringify({ app: 'HomeVault', formato: 2, exportado: new Date().toISOString(), config: S.cfg, lancamentos: S.raw }, null, 1));
}
function exportarCSV() {
  var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
  var linhas = ['Data;Categoria;Subcategoria;Descrição;Parcela;Valor'];
  lancamentos().sort(function (a, b) { return a.data < b.data ? -1 : 1; }).forEach(function (l) {
    linhas.push([l.data, q(NOME(l.cat)), q(nomeSub(l.cat, l.sub)), q(l.desc), l.parcela ? l.parcela.n + '/' + l.parcela.total : '', l.valor.toFixed(2).replace('.', ',')].join(';'));
  });
  baixar('homevault-' + hoje() + '.csv', 'text/csv;charset=utf-8', '﻿' + linhas.join('\r\n'));
}
function importarJSON(arquivo) {
  var r = new FileReader();
  r.onload = function () {
    var d; try { d = JSON.parse(r.result); } catch (e) { mostrarToast('⚠️', 'Arquivo inválido'); return; }
    if (!d || d.app !== 'HomeVault' || !d.lancamentos) { mostrarToast('⚠️', 'Não é um backup do HomeVault'); return; }
    var regs = d.lancamentos;
    if (Array.isArray(regs)) { // formato 1
      var obj = {}; regs.forEach(function (l) { if (l && l.id && l.v) obj[l.id] = { v: l.v, dt: l.dt, c: l.c, s: l.s, d: l.d, por: l.por, ts: l.ts }; }); regs = obj;
    }
    var ids = Object.keys(regs);
    if (!confirm('Restaurar ' + ids.length + ' lançamento(s) deste backup?\n\nLançamentos com o mesmo identificador serão substituídos; os demais serão mantidos. Categorias que não existem serão adicionadas.')) return;
    var cfgB = d.config || { cats: d.categorias || [] }, existentes = {};
    S.cfg.cats.forEach(function (c) { existentes[c.id] = true; });
    (normalizarCfg(JSON.parse(JSON.stringify(cfgB))).cfg.cats || []).forEach(function (c) { if (c && c.id && !existentes[c.id]) S.cfg.cats.push(c); });
    var ps = [salvarCfg()];
    ids.forEach(function (id) { var x = regs[id]; if (x && x.v > 0 && /^\d{4}-\d{2}-\d{2}$/.test(x.dt)) ps.push(gravarLanc(id, x)); });
    Promise.all(ps).then(function () { mostrarToast('✅', 'Backup restaurado'); }, function () { mostrarToast('⚠️', 'Parte do backup não foi salva'); });
  };
  r.readAsText(arquivo);
}

// ═════════════════════════ gravação ═════════════════════════
function salvarCfg() {
  return cifrar(S.chave, S.cfg).then(function (c) { return db.ref('casas/' + S.casa + '/dados/config').set(c); })
    .catch(function () { mostrarToast('⚠️', 'Erro ao salvar configurações'); });
}
function gravarLanc(id, reg) {
  S.raw[id] = reg; renderLogo();
  return cifrar(S.chave, reg).then(function (c) { return db.ref('casas/' + S.casa + '/dados/lanc/' + id).set(c); });
}

// ═════════════════════════ entrada: conta, casa, chave ═════════════════════════
function iniciar() {
  var cfg = window.HOMEVAULT_FIREBASE;
  ligarEventos();
  if (!cfg || !cfg.apiKey || /COLE_AQUI/.test(cfg.apiKey) || typeof firebase === 'undefined') { mostrarEntrada('card-semconfig'); return; }
  firebase.initializeApp(cfg);
  auth = firebase.auth(); db = firebase.database();
  auth.onAuthStateChanged(function (u) {
    pararEscuta(); limparFormularios();
    S.user = u; S.casa = null; S.chave = null; S.cfg = null; S.raw = {}; S.perfis = {}; S.membros = {};
    if (!u) { mostrarEntrada('card-auth'); return; }
    carregarCasa();
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
}
function limparFormularios() {
  qsa('#tela-login input').forEach(function (i) { if (i.type === 'checkbox') i.checked = i.id === 'ul-lembrar'; else i.value = ''; });
  qsa('.login-erro').forEach(function (e) { e.textContent = ''; });
  setAbaCasa(false); setModoCriar(false);
  $('nc-moeda').value = 'CAD';
  fecharSheet();
  $('topo-config').style.display = 'none'; $('cfg-toggle').classList.remove('aberto');
  S.per = { hist: 'periodo', rel: 'periodo', relcat: 'periodo', proj: 'periodo' }; S.rcCat = null; S.mesHist = mesAtual();
  qsa('[data-per]').forEach(function (g) { qsa('.rel-per-btn', g).forEach(function (b) { b.classList.toggle('ativo', b.dataset.tipo === 'periodo'); }); });
  ['hist', 'rel', 'relcat', 'proj'].forEach(function (q) { $(q + '-custom-datas').style.display = 'none'; });
  $('hist-nav-mes').style.display = 'none';
}
function carregarCasa() {
  carregando();
  db.ref('usuarios/' + S.user.uid + '/casa').once('value').then(function (snap) {
    var casa = snap.val();
    if (!casa) { mostrarEntrada('card-casa'); return; }
    return db.ref('casas/' + casa).once('value').then(function (cs) {
      var m = cs.val();
      if (!m || !m.salt) throw { code: 'PERMISSION_DENIED' };
      S.casa = casa; S.meta = m;
      return IDB.get(S.user.uid + ':' + casa).then(function (k) {
        if (!k) { mostrarEntrada('card-unlock'); return; }
        return decifrar(k, m.verif).then(function () { abrirCasa(k); }, function () { mostrarEntrada('card-unlock'); });
      });
    });
  }).catch(function (e) {
    if (e && /PERMISSION_DENIED|permission/i.test(e.code || e.message || '')) {
      db.ref('usuarios/' + S.user.uid + '/casa').remove().catch(function () {});
      mostrarEntrada('card-casa');
      $('nc-erro').textContent = 'Você não tem mais acesso à casa anterior. Crie uma casa ou use um convite.';
    } else {
      carregando('Não foi possível conectar. Verifique a internet e abra o app de novo.');
    }
  });
}
function abrirCasa(chave) {
  S.chave = chave; S.cfg = null;
  carregando('Abrindo a casa…');
  escutar();
}
function pararEscuta() { S.refs.forEach(function (r) { r.off(); }); S.refs = []; }
function escutar() {
  pararEscuta();
  var base = 'casas/' + S.casa;
  var rCfg = db.ref(base + '/dados/config'), rLanc = db.ref(base + '/dados/lanc'), rPerf = db.ref(base + '/dados/perfis');
  var rMem = db.ref(base + '/membros'), rConv = db.ref(base + '/convite'), rCon = db.ref('.info/connected');
  S.refs = [rCfg, rLanc, rPerf, rMem, rConv, rCon];
  var negado = function () { carregarCasa(); };
  var primeiro = true;
  rCfg.on('value', function (s) {
    var v = s.val();
    var p = v ? decifrar(S.chave, v) : Promise.resolve(null);
    p.then(function (c) {
      var n = normalizarCfg(c || { cats: catsPadrao(), nome: 'Minha casa', moeda: 'CAD' });
      S.cfg = n.cfg;
      if (n.mudou || !c) salvarCfg();
      if (primeiro) { primeiro = false; verificarAvancoPeriodo(); irPara('inicio'); }
      else renderLogo();
    });
  }, negado);
  function addLanc(s) { var id = s.key; decifrar(S.chave, s.val()).then(function (l) { S.raw[id] = l; renderLogo(); }, function () {}); }
  rLanc.on('child_added', addLanc, negado);
  rLanc.on('child_changed', addLanc);
  rLanc.on('child_removed', function (s) { delete S.raw[s.key]; renderLogo(); });
  rPerf.on('value', function (s) {
    var v = s.val() || {}, out = {};
    Promise.all(Object.keys(v).map(function (uid) { return decifrar(S.chave, v[uid]).then(function (p) { out[uid] = p; }, function () {}); }))
      .then(function () { S.perfis = out; renderLogo(); });
  });
  rMem.on('value', function (s) { S.membros = s.val() || {}; renderLogo(); });
  rConv.on('value', function (s) { if (S.meta) S.meta.convite = s.val(); renderLogo(); });
  rCon.on('value', function (s) {
    var on = !!s.val();
    $('sync-dot').style.background = on ? '#43a047' : '#f59e0b';
    $('sync-txt').textContent = on ? 'sincronizado ✓' : 'offline';
  });
}

var modoCriar = false;
function msgAuth(e) {
  var c = (e && e.code) || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'E-mail ou senha incorretos.';
  if (/email-already-in-use/.test(c)) return 'Já existe uma conta com este e-mail. Use "Entrar".';
  if (/weak-password/.test(c)) return 'Senha fraca. Use pelo menos 8 caracteres.';
  if (/invalid-email/.test(c)) return 'E-mail inválido.';
  if (/too-many-requests/.test(c)) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (/network/.test(c)) return 'Sem conexão com a internet.';
  return 'Não foi possível concluir (' + (c || 'erro') + ').';
}
function setModoCriar(v) {
  modoCriar = v;
  $('tab-entrar').classList.toggle('on', !v); $('tab-criar').classList.toggle('on', v);
  $('campo-nome').style.display = v ? '' : 'none';
  $('au-btn').textContent = v ? 'Criar conta' : 'Entrar';
  $('au-esqueci').style.display = v ? 'none' : '';
  $('au-erro').textContent = '';
}
function setAbaCasa(convite) {
  $('tab-nova').classList.toggle('on', !convite); $('tab-convite').classList.toggle('on', convite);
  $('box-nova').style.display = convite ? 'none' : ''; $('box-convite').style.display = convite ? '' : 'none';
}
function enviarAuth() {
  var email = $('au-email').value.trim(), senha = $('au-senha').value, nome = $('au-nome').value.trim(), er = $('au-erro');
  er.textContent = '';
  if (!email || !senha) { er.textContent = 'Preencha e-mail e senha.'; return; }
  if (modoCriar && !nome) { er.textContent = 'Informe seu nome.'; return; }
  if (modoCriar && senha.length < 8) { er.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
  var btn = $('au-btn'); btn.disabled = true;
  var p = modoCriar ? auth.createUserWithEmailAndPassword(email, senha).then(function (r) { return r.user.updateProfile({ displayName: nome }); })
    : auth.signInWithEmailAndPassword(email, senha);
  p.catch(function (e) { er.textContent = msgAuth(e); }).then(function () { btn.disabled = false; });
}
function esqueci() {
  var email = $('au-email').value.trim();
  if (!email) { $('au-erro').textContent = 'Digite seu e-mail acima e toque de novo em "Esqueci minha senha".'; return; }
  auth.sendPasswordResetEmail(email).then(function () { $('au-erro').innerHTML = '<span style="color:#16a34a">Enviamos um e-mail para redefinir a senha.</span>'; },
    function (e) { $('au-erro').textContent = msgAuth(e); });
}
function nomeUsuario() { return (S.user && (S.user.displayName || (S.user.email || '').split('@')[0])) || 'Eu'; }
function criarCasa() {
  var nome = $('nc-nome').value.trim(), md = $('nc-moeda').value, s1 = $('nc-senha').value, s2 = $('nc-senha2').value, er = $('nc-erro');
  er.textContent = '';
  if (!nome) { er.textContent = 'Dê um nome para a casa.'; return; }
  if (s1.length < 8) { er.textContent = 'A senha da casa precisa ter pelo menos 8 caracteres.'; return; }
  if (s1 !== s2) { er.textContent = 'As senhas da casa não conferem.'; return; }
  if (!$('nc-ciente').checked) { er.textContent = 'Confirme que anotou a senha da casa.'; return; }
  var btn = $('nc-btn'); btn.disabled = true; btn.textContent = 'Criando…';
  var casa = rid(20), convite = rid(24), salt = b64(crypto.getRandomValues(new Uint8Array(16))), chave;
  derivarChave(s1, salt).then(function (k) { chave = k; return cifrar(k, VERIF_TEXTO); }).then(function (verif) {
    var m = {}; m[S.user.uid] = convite;
    return db.ref('casas/' + casa).set({ dono: S.user.uid, convite: convite, salt: salt, verif: verif, membros: m, criada: firebase.database.ServerValue.TIMESTAMP });
  }).then(function () {
    return cifrar(chave, { v: 2, nome: nome, moeda: md, cats: catsPadrao(), limite: 0, alertaPct: 80, periodo: periodoMesAtual(), orcParc: 0 });
  }).then(function (c) { return db.ref('casas/' + casa + '/dados/config').set(c); })
    .then(function () { return entrouNaCasa(casa, chave, true); })
    .catch(function (e) { er.textContent = 'Não foi possível criar a casa (' + ((e && e.code) || e) + ').'; })
    .then(function () { btn.disabled = false; btn.textContent = 'Criar casa'; });
}
function lerConvite(txt) {
  var m = String(txt || '').trim().toLowerCase().replace(/\s+/g, '').match(/^hv-([a-z0-9]{20})-([a-z0-9]{24})$/);
  return m ? { casa: m[1], convite: m[2] } : null;
}
function entrarConvite() {
  var cv = lerConvite($('cv-codigo').value), senha = $('cv-senha').value, er = $('cv-erro');
  er.textContent = '';
  if (!cv) { er.textContent = 'Código de convite inválido. Confira se copiou inteiro (começa com HV-).'; return; }
  if (!senha) { er.textContent = 'Digite a senha da casa.'; return; }
  var btn = $('cv-btn'); btn.disabled = true; btn.textContent = 'Entrando…';
  var memRef = db.ref('casas/' + cv.casa + '/membros/' + S.user.uid);
  memRef.set(cv.convite).then(function () { return db.ref('casas/' + cv.casa).once('value'); }, function () { throw { msg: 'Convite inválido ou expirado. Peça um código novo.' }; })
    .then(function (snap) {
      var m = snap.val();
      return derivarChave(senha, m.salt).then(function (k) {
        return decifrar(k, m.verif).then(function () { S.meta = m; return entrouNaCasa(cv.casa, k, false); },
          function () { return memRef.remove().then(function () { throw { msg: 'Senha da casa incorreta.' }; }); });
      });
    }).catch(function (e) { er.textContent = (e && e.msg) || 'Não foi possível entrar (' + ((e && e.code) || e) + ').'; })
    .then(function () { btn.disabled = false; btn.textContent = 'Entrar na casa'; });
}
function entrouNaCasa(casa, chave, criou) {
  return db.ref('usuarios/' + S.user.uid + '/casa').set(casa)
    .then(function () { return IDB.set(S.user.uid + ':' + casa, chave); })
    .then(function () { return cifrar(chave, { nome: nomeUsuario(), email: S.user.email || '' }); })
    .then(function (p) { return db.ref('casas/' + casa + '/dados/perfis/' + S.user.uid).set(p); })
    .then(function () { return db.ref('casas/' + casa).once('value'); })
    .then(function (snap) {
      S.casa = casa; S.meta = snap.val();
      abrirCasa(chave);
      mostrarToast(criou ? '🎉' : '👋', criou ? 'Casa criada!' : 'Bem-vindo(a) à casa!');
    });
}
function desbloquear() {
  var senha = $('ul-senha').value, er = $('ul-erro');
  er.textContent = '';
  if (!senha) { er.textContent = 'Digite a senha da casa.'; return; }
  var btn = $('ul-btn'); btn.disabled = true; btn.textContent = 'Verificando…';
  derivarChave(senha, S.meta.salt).then(function (k) {
    return decifrar(k, S.meta.verif).then(function () {
      return ($('ul-lembrar').checked ? IDB.set(S.user.uid + ':' + S.casa, k) : Promise.resolve()).then(function () { $('ul-senha').value = ''; abrirCasa(k); });
    }, function () { er.textContent = 'Senha da casa incorreta.'; });
  }).catch(function () { er.textContent = 'Não foi possível desbloquear.'; })
    .then(function () { btn.disabled = false; btn.textContent = 'Desbloquear'; });
}
function bloquear() {
  if (!confirm('Bloquear? Será preciso digitar a senha da casa para abrir de novo neste aparelho.')) return;
  IDB.del(S.user.uid + ':' + S.casa).then(function () { pararEscuta(); S.chave = null; S.raw = {}; S.cfg = null; mostrarEntrada('card-unlock'); });
}
function sair() {
  var p = (S.user && S.casa) ? IDB.del(S.user.uid + ':' + S.casa) : Promise.resolve();
  p.then(function () { pararEscuta(); S.chave = null; return auth.signOut(); });
}

// ═════════════════════════ eventos ═════════════════════════
function ligarEventos() {
  $('tab-entrar').onclick = function () { setModoCriar(false); };
  $('tab-criar').onclick = function () { setModoCriar(true); };
  $('au-btn').onclick = enviarAuth;
  $('au-senha').onkeydown = function (e) { if (e.key === 'Enter') enviarAuth(); };
  $('au-esqueci').onclick = esqueci;
  $('tab-nova').onclick = function () { setAbaCasa(false); };
  $('tab-convite').onclick = function () { setAbaCasa(true); };
  $('nc-btn').onclick = criarCasa;
  $('cv-btn').onclick = entrarConvite;
  $('ul-btn').onclick = desbloquear;
  $('ul-senha').onkeydown = function (e) { if (e.key === 'Enter') desbloquear(); };

  document.addEventListener('click', function (e) {
    var t = e.target, b;
    if ((b = t.closest('[data-acao="sair"]'))) { sair(); return; }
    if ((b = t.closest('[data-ir]'))) { if (b.dataset.ir === 'add') S.add.editId = null; irPara(b.dataset.ir); return; }
    if ((b = t.closest('[data-editar]'))) { S.voltarPara = S.tela === 'add' ? 'inicio' : S.tela; editarLancamento(b.dataset.editar); return; }
    if ((b = t.closest('[data-excluir]'))) { excluir(b.dataset.excluir); return; }
    if ((b = t.closest('.card-cat[data-cat]'))) { irParaCategoria(b.dataset.cat); return; }
    if ((b = t.closest('[data-addcat]'))) { if (S.add.cat !== b.dataset.addcat) S.add.sub = null; S.add.cat = b.dataset.addcat; renderAdd(); return; }
    if ((b = t.closest('[data-per] .rel-per-btn'))) { setPer(b.parentNode.dataset.per, b.dataset.tipo); return; }
    if ((b = t.closest('[data-rc]'))) { S.rcCat = b.dataset.rc; renderizarRelcat(); return; }
    if ((b = t.closest('[data-cancelar-plano]'))) { cancelarPlano(b.dataset.cancelarPlano); return; }
    if ((b = t.closest('[data-editcat]'))) { abrirCat(b.dataset.editcat); return; }
    if ((b = t.closest('[data-subircat]'))) { subirCat(b.dataset.subircat); return; }
    if ((b = t.closest('[data-remover]'))) { removerMembro(b.dataset.remover); return; }
    if ((b = t.closest('[data-fechar]'))) { fecharSheet(); return; }
    // dentro da folha de categoria
    if (_ed) {
      if ((b = t.closest('[data-emo]'))) { lerCatInputs(); _ed.emoji = b.dataset.emo; desenharCat(); return; }
      if ((b = t.closest('[data-cor]'))) { lerCatInputs(); _ed.cor = b.dataset.cor; desenharCat(); return; }
      if ((b = t.closest('[data-subdel]'))) { lerCatInputs(); _ed.subs.splice(+b.dataset.subdel, 1); desenharCat(); return; }
      if (t.id === 'ed-addsub') { lerCatInputs(); var n = $('ed-novasub').value.trim(); if (n) { _ed.subs.push({ id: rid(8), nome: n }); desenharCat(); $('ed-novasub').focus(); } return; }
      if (t.id === 'ed-salvar') { salvarCat(); return; }
      if (t.id === 'ed-excluir') { excluirCat(); return; }
    }
  });
  $('sheet').onclick = function (e) { if (e.target.id === 'sheet') fecharSheet(); };
  $('sheet').onkeydown = function (e) { if (e.key === 'Enter' && e.target.id === 'ed-novasub') { e.preventDefault(); $('ed-addsub').click(); } };

  // Início / config
  $('btn-config-top').onclick = toggleConfig;
  $('cfg-toggle').onclick = toggleConfig;
  $('topo-config').addEventListener('focusin', function () { $('topo-config').classList.add('editando'); });
  $('topo-config').addEventListener('focusout', function () { $('topo-config').classList.remove('editando'); });
  $('topo-config').addEventListener('change', function (e) { if (e.target.tagName === 'INPUT') salvarConfigTopo(); });
  $('cfg-cats').onclick = function () { irPara('ajustes'); };
  $('cfg-ajustes').onclick = function () { irPara('ajustes'); };
  $('cfg-backup').onclick = exportarJSON;
  $('cfg-restaurar').onclick = function () { $('inp-restaurar').click(); };
  $('inp-restaurar').onchange = function () { if (this.files[0]) importarJSON(this.files[0]); this.value = ''; };

  // Registrar
  $('sel-sub').onchange = function () { S.add.sub = this.value || null; };
  $('btn-hoje').onclick = function () { $('inp-data').value = hoje(); };
  $('inp-valor').oninput = atualizarPreviewParcela;
  $('btn-parcela-toggle').onclick = function () { S.add.nParc = S.add.nParc > 1 ? 1 : 2; S.add.parcIni = 1; atualizarParcUI(); };
  $('sel-parcelas').onchange = function () { S.add.nParc = +this.value; if (S.add.parcIni > S.add.nParc) S.add.parcIni = 1; atualizarParcUI(); };
  $('sel-parcela-ini').onchange = function () { S.add.parcIni = +this.value; atualizarPreviewParcela(); };
  $('btn-salvar-pro').onclick = salvarLancamento;
  $('btn-excluir-edit').onclick = function () { excluir(S.add.editId); };

  // Histórico
  $('hist-mes-ant').onclick = function () { S.mesHist = addMeses(S.mesHist + '-01', -1).slice(0, 7); renderizarHistorico(); };
  $('hist-mes-prox').onclick = function () { S.mesHist = addMeses(S.mesHist + '-01', 1).slice(0, 7); renderizarHistorico(); };
  ['hist', 'rel', 'relcat', 'proj'].forEach(function (q) { [q + '-ini', q + '-fim'].forEach(function (id) { $(id).onchange = renderTela; }); });
  $('hist-wa').onclick = compartilharHistorico;
  $('sem-ant').onclick = function () { S.semOff = (S.semOff || 0) + 1; renderizarSemana(); };
  $('sem-prox').onclick = function () { S.semOff = Math.max(-1, (S.semOff || 0) - 1); renderizarSemana(); };
  $('hist-pdf').onclick = exportarPDFHistorico;

  // Ajustes
  $('aj-salvar').onclick = salvarCasaAj;
  $('aj-novacat').onclick = function () { abrirCat(null); };
  $('aj-copiar').onclick = function () { copiar(codigoConvite()); };
  $('aj-compart').onclick = compartilharConvite;
  $('aj-novocod').onclick = novoCodigo;
  $('aj-exp-json').onclick = exportarJSON;
  $('aj-exp-csv').onclick = exportarCSV;
  $('aj-imp').onclick = function () { $('inp-restaurar').click(); };
  $('aj-bloquear').onclick = bloquear;
}

window.__HV = { gravarLanc: gravarLanc, analisarSemana: analisarSemana, S: S, lerValor: lerValor, formatar: formatar, lancamentos: lancamentos, totaisPeriodo: totaisPeriodo };
iniciar();
})();
