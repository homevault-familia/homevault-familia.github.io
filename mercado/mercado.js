// ═══════════════════════════════════════════════════════════════════
// MinhaCasa™ — Mercado (27/11/2026)
// Página pessoal, separada do app das famílias. Os dados ficam em mercado/<uid> no Firebase,
// e as regras (database.rules.json) só deixam a PRÓPRIA conta ler e gravar, e só se ela for
// administradora e tiver entrado com o Google. Esconder a página não é a proteção: é o servidor.
// Recibos: o texto vem do "Texto ao Vivo" do iPhone (copiar/colar) e é lido aqui no aparelho
// pelo leitor.js. Nada é enviado para fora, sem custo.
// Saudável: consulta o Open Food Facts (base aberta e gratuita, a mesma que o Nutri-Score usa).
// ═══════════════════════════════════════════════════════════════════
window.iniciarMercado = function (F) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var qsa = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  // Dinheiro sempre em dólar canadense, com 2 casas: CA$1,234.56
  var FMT_CAD = (function () { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 }); } catch (e) { return null; } })();
  var din = function (v) { if (v == null || v === '' || isNaN(v)) return '—'; v = Number(v); return FMT_CAD ? FMT_CAD.format(v) : (v < 0 ? '-' : '') + 'CA$' + Math.abs(v).toFixed(2); };
  // valor em campo de digitar: 2 casas (25.6 → 25.60)
  var dec2 = function (v) { return (v == null || v === '' || isNaN(v)) ? '' : Number(v).toFixed(2); };
  var chave = Leitor.chave;
  var hojeISO = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var mesDe = function (d) { return String(d || '').slice(0, 7); };
  var NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var mesBR = function (m) { var p = m.split('-'); return NOMES_MES[+p[1] - 1] + '/' + p[0].slice(2); };

  var LOJAS = [
    { id: 'superstore', n: 'Superstore', l: 'Atlantic Superstore · 168 Rothesay Ave e 680 Somerset St', busca: 'https://www.atlanticsuperstore.ca/search?search-bar=' },
    { id: 'nofrills', n: 'No Frills', l: 'No Frills · 621 Fairville Blvd', busca: 'https://www.nofrills.ca/search?search-bar=' },
    { id: 'walmart', n: 'Walmart', l: 'Walmart · 450 Westmorland Rd e 621 Fairville Blvd', busca: 'https://www.walmart.ca/search?q=' },
    { id: 'sobeys', n: 'Sobeys', l: 'Sobeys · Lansdowne, 1 Plaza Ave e East Point', busca: 'https://www.google.com/search?q=Sobeys+' },
    { id: 'costco', n: 'Costco', l: 'Costco · 300 Retail Dr (embalagens grandes)', busca: 'https://www.costco.ca/CatalogSearch?keyword=' },
    { id: 'gianttiger', n: 'Giant Tiger', l: 'Giant Tiger · 100 Prince Edward St e 88 Consumers Dr', busca: 'https://www.gianttiger.com/search?q=' },
    { id: 'outro', n: 'Outro', l: 'Foodland, Co-op, feira e outros' }
  ];
  var LN = {}; LOJAS.forEach(function (l) { LN[l.id] = l.n; });
  var COMPARA = LOJAS.filter(function (l) { return l.id !== 'outro'; });
  var CATS = ['Hortifruti', 'Carnes e peixes', 'Laticínios e ovos', 'Padaria', 'Mercearia', 'Congelados', 'Bebidas', 'Lanches e doces', 'Limpeza', 'Higiene', 'Bebê e pet', 'Outros'];
  var CAT_PT = [
    ['Hortifruti', /banana|maçã|maca|laranja|limão|limao|uva|morango|mirtilo|pera|pêssego|manga|abacate|abacaxi|melancia|melão|kiwi|batata|tomate|cebola|alho|alface|espinafre|cenoura|brócolis|brocolis|couve|pepino|pimentão|cogumelo|abobrinha|abóbora|milho|salada|fruta|legume|verdura|hortifruti/],
    ['Carnes e peixes', /frango|carne|boi|porco|peru|presunto|bacon|linguiça|linguica|salsicha|bife|picanha|costela|moída|moida|salmão|salmao|atum|peixe|camarão|camarao|bacalhau|frios|salame/],
    ['Laticínios e ovos', /leite|ovo|queijo|iogurte|manteiga|creme de leite|requeijão|requeijao|margarina|nata|kefir/],
    ['Padaria', /pão|pao|pães|bagel|tortilha|wrap|bolo|croissant|muffin|torrada/],
    ['Congelados', /congelad|sorvete|pizza|nugget|batata frita|picolé/],
    ['Bebidas', /café|cafe|chá|cha\b|suco|refrigerante|coca|água|agua|cerveja|vinho|bebida|energético/],
    ['Lanches e doces', /chocolate|biscoito|bolacha|bala|doce|salgadinho|pipoca|barra de cereal|chips|nutella|sobremesa/],
    ['Limpeza', /detergente|sabão|sabao|amaciante|água sanitária|agua sanitaria|desinfetante|esponja|saco de lixo|lixo|papel toalha|limpa|alvejante|lustra/],
    ['Higiene', /papel higiênico|papel higienico|shampoo|xampu|condicionador|sabonete|pasta de dente|creme dental|escova de dente|desodorante|absorvente|lâmina|fio dental|lenço|hidratante/],
    ['Bebê e pet', /fralda|lenço umedecido|bebê|bebe|ração|racao|cachorro|gato|areia/],
    ['Mercearia', /arroz|feijão|feijao|macarrão|macarrao|massa|molho|farinha|açúcar|acucar|sal\b|óleo|oleo|azeite|vinagre|cereal|aveia|sopa|lata|enlatado|ketchup|maionese|mostarda|tempero|mel\b|geleia|amendoim/]
  ];
  var CAT_PRIMEIRO = [['Higiene', /papel higi/], ['Bebê e pet', /lenço umedecido|lenco umedecido/], ['Congelados', /batata frita|congelad/], ['Laticínios e ovos', /creme de leite/], ['Limpeza', /água sanitária|agua sanitaria|papel toalha/], ['Lanches e doces', /barra de cereal|batata chips/]];
  function adivinharCat(nome) {
    var t = String(nome || '').toLowerCase(), i;
    for (i = 0; i < CAT_PRIMEIRO.length; i++) if (CAT_PRIMEIRO[i][1].test(t)) return CAT_PRIMEIRO[i][0];
    for (i = 0; i < CAT_PT.length; i++) if (CAT_PT[i][1].test(t)) return CAT_PT[i][0];
    var c = Leitor.categoria(Leitor.expandir(t.toUpperCase()));
    return c === 'Outros' ? 'Mercearia' : c;
  }
  var COMIDA = { 'Hortifruti': 1, 'Carnes e peixes': 1, 'Laticínios e ovos': 1, 'Padaria': 1, 'Mercearia': 1, 'Congelados': 1, 'Bebidas': 1, 'Lanches e doces': 1 };

  var app = F.initializeApp(window.HOMEVAULT_FIREBASE), A = F.getAuth(app), DB = F.getDatabase(app);
  A.languageCode = 'pt-BR';
  var U = null, base = '', dono = '', ehDono = true, parar = null;
  var M = { recibos: {}, produtos: {}, dic: {}, ajustes: {} };
  var UI = { aba: 'lista', rev: null, texto: '', off: {}, agrupar: 'cat' };

  if (window.MINHACASA_AMBIENTE !== 'producao') document.body.classList.add('teste');
  // Atalho do iPhone (Tirar foto → Extrair texto → abrir minhacasaapp.com/mercado/?texto=…): já chega com o recibo
  try {
    var qs = new URLSearchParams(location.search), vindo = qs.get('texto');
    // Atalho abre direto numa aba: minhacasaapp.com/mercado/#recibo ou ?aba=recibo
    var abaPedida = (qs.get('aba') || location.hash.replace('#', '')).toLowerCase();
    if (['lista', 'recibo', 'precos', 'saude', 'gastos', 'ajustes'].indexOf(abaPedida) >= 0) {
      UI.aba = abaPedida;
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      qsa('#abas button').forEach(function (x) { x.classList.toggle('on', x.dataset.aba === abaPedida); });
    }
    if (vindo && vindo.trim()) {
      UI.aba = 'recibo'; UI.texto = vindo; UI.doAtalho = true;
      history.replaceState(null, '', location.pathname + location.hash);
      qsa('#abas button').forEach(function (x) { x.classList.toggle('on', x.dataset.aba === 'recibo'); });
    }
  } catch (e) {}

  function toast(t) { var el = $('toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(function () { el.style.display = 'none'; }, 3200); }
  function mostrar(v) { ['v-login', 'v-negado', 'v-app'].forEach(function (x) { $(x).style.display = x === v ? '' : 'none'; }); }
  function erroTxt(e) { var c = (e && e.code) || String(e); try { console.log('Mercado erro:', c); } catch (x) {} return /PERMISSION/i.test(c) ? 'sem permissão. Peça ajuda a quem administra o Mercado.' : /network|unavailable|offline/i.test(c) ? 'sem internet. Confira a conexão e tente de novo.' : 'algo deu errado. Tente de novo.'; }
  function gravar(mudancas) { return F.update(F.ref(DB, base), mudancas).catch(function (e) { toast('Não salvou: ' + erroTxt(e)); throw e; }); }
  function abrirFolha(html) { marcarHistorico(); document.body.style.overflow = 'hidden'; abrirFolha0(html); }
  function abrirFolha0(html) { $('folha').innerHTML = '<button class="fechar-x" id="f-x" aria-label="Fechar">✕</button>' + html; $('fundo').classList.add('on'); $('f-x').onclick = function () { fecharFolha(); }; if ($('f-fechar')) $('f-fechar').addEventListener('click', function () { fecharFolha(); }); }
  // ── ajuda (?) ──
  var AJUDA = {
    resumo: ['Os 3 números do topo', '<p><b>Gasto este mês:</b> a soma dos recibos salvos com data deste mês.</p><p><b>Sobra do orçamento:</b> o orçamento mensal (definido na aba Gastos) menos o que já foi gasto. Fica vermelho se passar.</p><p><b>Economia possível:</b> quanto você economizaria comprando cada item da lista no mercado onde ele saiu mais barato.</p>'],
    incluir: ['Incluir na lista', '<p>Para pôr na lista algo que ainda não veio em nenhum recibo, como um produto novo.</p><p>Digite o nome, escolha <b>onde comprar</b> (ou deixe <b>Mais barato</b>), a quantidade, e toque em <b>Incluir</b>.</p>'],
    lista: ['Lista do mês', '<p>A lista se monta sozinha com o que você compra nos recibos. Com 3 meses de recibos, ela passa a mostrar só o que se repete.</p><p><b>Quadradinho:</b> marca o que você já pegou no mercado.<br><b>Editar:</b> muda a quantidade, o mercado onde comprar, ou tira o item da lista.<br><b>Por mercado:</b> separa a lista por loja, para fazer as compras em mais de um lugar.<br><b>Compartilhar:</b> manda a lista pelo WhatsApp, e-mail ou Mensagens.</p>'],
    novo: ['Como lançar um recibo', '<ol class="passos"><li>Toque em <b>1. Foto do recibo</b>. O iPhone abre o atalho <b>Mercado</b> e a câmera.</li><li>Fotografe o recibo inteiro, bem iluminado. A IA da Apple lê e o app volta sozinho para esta tela.</li><li>Toque em <b>2. Colar o recibo</b>.</li><li>Confira os itens e o total (deve aparecer <b>confere com o total ✓</b>) e toque em <b>Salvar recibo</b>.</li></ol><p><b>Digitar recibo à mão:</b> para quando não der para tirar foto.<br><b>Não tem a IA da Apple?</b> Use o ChatGPT ou o Gemini: o botão explica.</p><p>Se o atalho ainda não estiver no iPhone, instale em <b>⚙️ Configuração</b>.</p>'],
    salvos: ['Recibos salvos', '<p>Todos os recibos que você já lançou, do mais novo para o mais antigo.</p><p>Toque em <b>Ver</b> para conferir, corrigir ou apagar um recibo. Para sair sem mudar nada, toque em <b>← Voltar</b>.</p><p>O app não deixa salvar o mesmo recibo duas vezes (mesmo mercado, data e total).</p>'],
    nomes: ['Nomes aprendidos', '<p>Os recibos trazem nomes abreviados em inglês, como “RASPBERRIES” ou “PC BLK BEANS”. Quando você dá um nome a eles, o app guarda e usa o mesmo nome nas próximas compras.</p><p>Em <b>Ver e corrigir</b> você apaga um nome errado, e o app pergunta de novo da próxima vez.</p>'],
    conferir: ['Conferir o recibo', '<p>Antes de salvar, confira:</p><ul><li><b>Mercado</b> e <b>data</b>.</li><li><b>Total pago</b> igual ao do recibo.</li><li>Cada item com o <b>nome que você usa</b> (use sempre o mesmo nome em mercados diferentes, para comparar preços) e a <b>categoria</b>.</li></ul><p>Se aparecer <b>confere com o total ✓</b>, está tudo certo. Se aparecer uma diferença em vermelho, falta um item ou algum valor está errado.</p><p><b>×</b> tira um item, <b>+ Item</b> acrescenta. <b>← Voltar</b> sai sem salvar.</p>'],
    precos: ['Preços', '<p>Cada item da lista com o preço em cada mercado. Os preços vêm dos seus recibos e do que você anotar.</p><p>Toque no nome de um mercado (o quadrado com <b>+</b>) para anotar o preço que viu no folheto, no Flipp ou na prateleira. Compare sempre a mesma embalagem.</p><p><b>Em amarelo:</b> o mais barato. <b>Total da lista por mercado:</b> quanto sairia a lista inteira em cada loja.</p>'],
    saude: ['Mais saudável', '<p>Para cada alimento da lista:</p><ol class="passos"><li><b>Buscar no Open Food Facts</b> mostra o Nutri-Score (A é o melhor) e o NOVA (1 natural, 4 ultraprocessado). Escolha o produto certo da lista.</li><li><b>Opções melhores</b> mostra produtos parecidos com nota melhor, vendidos no Canadá.</li><li><b>Digitar a nota:</b> se a busca não achar o produto, toque em <b>Abrir no site do Open Food Facts</b>, veja o Nutri-Score e o NOVA lá, e escolha as notas nos campos do produto.</li><li><b>Yuka (opcional):</b> a busca por nome no Yuka é paga, mas <b>escanear o código de barras é grátis</b>. Quando estiver com o produto na mão, escaneie no Yuka e anote a nota aqui.</li></ol>'],
    gastos: ['Gastos', '<p><b>Orçamento mensal:</b> quanto você quer gastar por mês com mercado. Ele aparece nos números do topo.</p><p><b>Por mês:</b> o total de cada mês; em vermelho, os que passaram do orçamento.<br><b>Por categoria</b> e <b>por mercado:</b> onde o dinheiro está indo.</p>'],
    familia: ['Compartilhar com a família', '<ol class="passos"><li>A pessoa abre <b>minhacasaapp.com/mercado</b> no iPhone dela e entra com a conta dela.</li><li>Aparece um <b>código</b>. Ela te manda esse código.</li><li>Aqui, digite o nome dela, cole o código e toque em <b>Liberar acesso</b>.</li></ol><p>A partir daí, vocês veem e mexem na mesma lista, recibos e preços. <b>Remover</b> tira o acesso.</p>'],
    atalho: ['Instalar o atalho', '<p>O atalho <b>Mercado</b> é o que tira a foto e usa a IA da Apple para ler o recibo.</p><ol class="passos"><li>Toque em <b>Instalar o atalho Mercado</b>.</li><li>Toque em <b>Get Shortcut</b> e depois <b>Add Shortcut</b>.</li><li>Não mude o nome: tem que ser <b>Mercado</b>.</li></ol><p>Dica: para ir mais rápido, ponha o atalho na tela inicial (no app Atalhos, segure o <b>Mercado</b> → <b>Share</b> → <b>Add to Home Screen</b>).</p>']
  };
  function ajuda(k) { return '<button class="ajuda" data-ajuda="' + k + '" aria-label="Ajuda: ' + esc(AJUDA[k][0]) + '">?</button>'; }
  function abrirAjuda(k) { var a = AJUDA[k]; if (!a) return; abrirFolha('<h3>' + esc(a[0]) + '</h3><div class="nota" style="font-size:15px">' + a[1] + '</div><button class="btn pri cheio" id="f-fechar" style="margin-top:8px">Entendi</button>'); }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-ajuda]'); if (b) { e.preventDefault(); e.stopPropagation(); abrirAjuda(b.dataset.ajuda); } }, true);
  function fecharFolha(doHistorico) { var aberta = $('fundo').classList.contains('on'); $('fundo').classList.remove('on'); $('folha').innerHTML = ''; document.body.style.overflow = ''; if (aberta && !doHistorico) { UI.ignorarPop = true; try { history.back(); } catch (e) {} } }
  $('fundo').addEventListener('click', function (e) { if (e.target === $('fundo')) fecharFolha(); });

  // ── login ──
  function provGoogle() { var p = new F.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; }
  $('l-google').onclick = function () {
    $('l-erro').textContent = '';
    F.signInWithPopup(A, provGoogle()).catch(function (e) {
      var c = (e && e.code) || String(e);
      if (/popup-closed|cancelled-popup/.test(c)) return;
      $('l-erro').textContent = /popup-blocked/.test(c) ? 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.' : 'Não foi possível entrar (' + c + ').';
    });
  };
  $('l-entrar').onclick = function () {
    var em = $('l-email').value.trim(), se = $('l-senha').value; $('l-erro2').textContent = '';
    if (!em || !se) { $('l-erro2').textContent = 'Digite o e-mail e a senha do MinhaCasa.'; return; }
    $('l-entrar').disabled = true;
    F.signInWithEmailAndPassword(A, em, se).catch(function (e) {
      var c = (e && e.code) || String(e);
      $('l-erro2').textContent = /wrong-password|invalid-credential|user-not-found|invalid-login|invalid-email/.test(c) ? 'E-mail ou senha incorretos.' : /multi-factor/.test(c) ? 'Esta conta usa verificação em duas etapas: entre com o Google.' : 'Não foi possível entrar (' + c + ').';
    }).then(function () { $('l-entrar').disabled = false; });
  };
  $('l-senha').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('l-entrar').click(); });
  $('p-sair').onclick = function () { if (window.confirm('Sair do Mercado? Para voltar, você vai precisar entrar com o Google de novo.')) F.signOut(A); };
  $('n-sair').onclick = function () { F.signOut(A); };
  $('n-copiar').onclick = function () { compartilharTexto('Código do Mercado (MinhaCasa) de ' + ((U && U.email) || '') + ':\n' + (U ? U.uid : ''), 'Código do Mercado'); };

  function semAcesso(u, e) {
    var negado = /PERMISSION/i.test((e && e.code) || String(e || 'PERMISSION'));
    $('n-msg').innerHTML = negado
      ? 'A conta <b>' + esc(u.email || '') + '</b> ainda não tem acesso ao Mercado.<br>Para liberar, mande o código abaixo para quem administra o Mercado da casa.'
      : 'Não foi possível ler os dados (' + esc(erroTxt(e)) + ').';
    $('n-cod').textContent = negado ? u.uid : '';
    $('n-codbox').style.display = negado ? '' : 'none';
    mostrar('v-negado');
  }
  F.onAuthStateChanged(A, function (u) {
    if (parar) { parar(); parar = null; }
    U = u;
    if (!u) { mostrar('v-login'); return; }
    $('p-quem').textContent = u.email || '';
    // Membro da família? mercadoDe/<uid> diz de quem é o Mercado que esta conta pode usar.
    F.get(F.ref(DB, 'mercadoDe/' + u.uid)).then(function (s) { return s.val(); }, function () { return null; }).then(function (d) {
      if (U !== u) return;
      dono = (typeof d === 'string' && d) ? d : u.uid; ehDono = dono === u.uid; base = 'mercado/' + dono;
      var primeira = true;
      parar = F.onValue(F.ref(DB, base), function (s) {
        var v = s.val() || {};
        M = { recibos: v.recibos || {}, produtos: v.produtos || {}, dic: v.dic || {}, ajustes: v.ajustes || {}, membros: v.membros || {} };
        if (primeira) { primeira = false; mostrar('v-app'); if (UI.doAtalho) { UI.doAtalho = false; desenhar(); lerTexto(); return; } }
        var foco = document.activeElement;
        if (foco && $('conteudo').contains(foco) && /INPUT|TEXTAREA|SELECT/.test(foco.tagName)) { UI.pendente = true; return; }
        desenhar();
      }, function (e) { semAcesso(u, e); });
    });
  });

  // ── abas ──
  // setas ‹ › nas abas: aparecem quando há mais abas para os lados
  (function () {
    var nav = $('abas'), e = $('seta-esq'), d = $('seta-dir'); if (!nav || !e || !d) return;
    var ver = function () { var max = nav.scrollWidth - nav.clientWidth; e.style.display = nav.scrollLeft > 4 ? 'flex' : 'none'; d.style.display = nav.scrollLeft < max - 4 ? 'flex' : 'none'; };
    e.onclick = function () { nav.scrollBy({ left: -160, behavior: 'smooth' }); };
    d.onclick = function () { nav.scrollBy({ left: 160, behavior: 'smooth' }); };
    nav.addEventListener('scroll', ver, { passive: true }); window.addEventListener('resize', ver); if (window.ResizeObserver) new ResizeObserver(ver).observe(nav); setTimeout(ver, 50); ver();
  })();
  $('conteudo').addEventListener('focusout', function () { setTimeout(function () { var f = document.activeElement; if (UI.pendente && !(f && $('conteudo').contains(f) && /INPUT|TEXTAREA|SELECT/.test(f.tagName))) { UI.pendente = false; desenhar(); } }, 300); });
  // gesto de voltar do iPhone fecha a folha ou o recibo aberto, em vez de sair do app
  function marcarHistorico() { try { history.pushState({ mercado: 1 }, ''); } catch (e) {} }
  window.addEventListener('popstate', function () {
    if (UI.ignorarPop) { UI.ignorarPop = false; return; }
    if ($('fundo').classList.contains('on')) { fecharFolha(true); return; }
    if (UI.rev) { if (!fecharRevisao(false, true)) marcarHistorico(); }
  });
  qsa('#abas button').forEach(function (b) { b.onclick = function () { fecharFolha(); if (UI.rev && b.dataset.aba !== UI.aba && UI.rev.id && !UI.rev._mudou) UI.rev = null; if (b.dataset.aba === 'recibo' && UI.aba === 'recibo' && UI.rev && !fecharRevisao()) return; UI.aba = b.dataset.aba; try { b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) {} qsa('#abas button').forEach(function (x) { x.classList.toggle('on', x === b); }); desenhar(); window.scrollTo(0, 0); }; });

  // ── dados derivados ──
  function recibos() { return Object.keys(M.recibos).map(function (id) { var r = M.recibos[id]; return Object.assign({ id: id }, r, { itens: [].concat(r.itens || []).filter(Boolean) }); }); }
  function ultimosMeses(n) { var s = {}; recibos().forEach(function (r) { s[mesDe(r.data)] = 1; }); return Object.keys(s).sort().reverse().slice(0, n); }
  function catalogo() {
    var c = {};
    recibos().forEach(function (r) {
      r.itens.forEach(function (it) {
        var k = chave(it.pt || it.raw); var p = c[k] || (c[k] = { k: k, pt: it.pt || it.raw, cat: it.cat || 'Outros', compras: [] });
        p.compras.push({ data: r.data, loja: r.loja, p: +it.un || (+it.total / (+it.qtd || 1)), qtd: +it.qtd || 1, total: +it.total || 0 });
      });
    });
    Object.keys(M.produtos).forEach(function (k) { var p = M.produtos[k]; if (!c[k] && (p.fixo === true || p.fixo === false)) c[k] = { k: k, pt: p.pt || k, cat: p.cat || 'Outros', compras: [] }; if (c[k] && p.cat) c[k].cat = p.cat; });
    return c;
  }
  function precoEm(k, loja, cat) {
    var m = null;
    ((cat[k] && cat[k].compras) || []).forEach(function (b) { if (b.loja === loja && (!m || b.data > m.data)) m = { p: b.p, data: b.data, fonte: 'recibo' }; });
    var r = M.produtos[k] && M.produtos[k].precos && M.produtos[k].precos[loja];
    if (r && r.p > 0 && (!m || (r.data || '') >= m.data)) m = { p: +r.p, data: r.data, fonte: r.fonte || 'anotado' };
    return m;
  }
  function listaDoMes() {
    var cat = catalogo(), meses = ultimosMeses(3), nm = Math.max(meses.length, 1), out = [];
    Object.keys(cat).forEach(function (k) {
      var c = cat[k], fixo = M.produtos[k] && M.produtos[k].fixo;
      if (fixo === false) return;
      var jan = c.compras.filter(function (b) { return meses.indexOf(mesDe(b.data)) >= 0; });
      var ms = {}; jan.forEach(function (b) { ms[mesDe(b.data)] = 1; });
      var nMeses = Object.keys(ms).length;
      // com menos de 3 meses de recibos, entra tudo o que foi comprado; depois, só o que aparece em 2 dos últimos 3 meses
      var auto = meses.length < 3 ? nMeses >= 1 : nMeses >= 2;
      if (!auto && fixo !== true) return;
      var soma = jan.reduce(function (s, b) { return s + b.qtd; }, 0) / nm, peso = jan.some(function (b) { return b.qtd % 1; });
      var qtd = peso ? Math.max(0.1, Math.round(soma * 10) / 10) : Math.max(1, Math.round(soma));
      var pr = M.produtos[k] || {}; if (+pr.qtd > 0) qtd = +pr.qtd;
      var ult = c.compras.slice().sort(function (a, b) { return b.data.localeCompare(a.data); })[0] || null;
      var precos = COMPARA.map(function (l) { var p = precoEm(k, l.id, cat); return p ? Object.assign({ loja: l.id }, p) : null; }).filter(Boolean);
      var min = precos.reduce(function (a, b) { return !a || b.p < a.p ? b : a; }, null);
      out.push({ k: k, pt: c.pt, cat: c.cat, qtd: qtd, ult: ult, precos: precos, min: min, meses: nMeses, marcado: pr.marcado === mesDe(hojeISO()), loja: LN[pr.loja] ? pr.loja : null });
    });
    return out.sort(function (a, b) { return CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || a.pt.localeCompare(b.pt); });
  }
  function resumo(L) {
    var sempre = 0, melhor = 0;
    L.forEach(function (i) { var u = i.ult ? i.ult.p : (i.min ? i.min.p : 0); sempre += u * i.qtd; melhor += (i.min ? i.min.p : u) * i.qtd; });
    return { sempre: sempre, melhor: melhor };
  }
  function gastoMes(m) { return recibos().filter(function (r) { return mesDe(r.data) === m; }).reduce(function (s, r) { return s + (+r.total || 0); }, 0); }

  // ── telas ──
  function desenhar() {
    var f = { lista: telaLista, recibo: telaRecibo, precos: telaPrecos, saude: telaSaude, gastos: telaGastos, ajustes: telaAjustes }[UI.aba];
    $('conteudo').innerHTML = f();
    ligar();
  }
  function kpis() {
    var L = listaDoMes(), r = resumo(L), orc = +M.ajustes.orcamento || 0, g = gastoMes(mesDe(hojeISO()));
    return '<div class="kpis"><div class="kpi azul"><b>' + din(g) + '</b><span>gasto este mês</span></div>' +
      '<div class="kpi ' + (orc && g > orc ? 'vermelho' : '') + '"><b>' + (orc ? din(Math.max(0, orc - g)) : '—') + '</b><span>' + (orc ? (g > orc ? 'acima do orçamento' : 'sobra do orçamento') : '<a href="#" data-ir="gastos">defina o orçamento em Gastos</a>') + '</span></div>' +
      '<div class="kpi verde"><b>' + (L.length ? din(Math.max(0, r.sempre - r.melhor)) : '—') + '</b><span>economia possível na lista</span></div><div class="kpi kpi-ajuda">' + ajuda('resumo') + '<span>O que são esses números?</span></div></div>';
  }
  function nomesConhecidos() { var n = {}; Object.keys(M.dic).forEach(function (k) { n[M.dic[k].pt] = 1; }); Object.values(catalogo()).forEach(function (c) { n[c.pt] = 1; }); return Object.keys(n).sort(); }
  function grupos(L) {
    var g = [], idx = {};
    L.forEach(function (i) {
      var nome = UI.agrupar === 'loja' ? (i.loja ? LN[i.loja] : i.min ? LN[i.min.loja] : 'Qualquer mercado') : i.cat;
      if (!(nome in idx)) { idx[nome] = g.length; g.push({ nome: nome, itens: [] }); }
      g[idx[nome]].itens.push(i);
    });
    if (UI.agrupar === 'loja') g.sort(function (a, b) { return (a.nome === 'Qualquer mercado') - (b.nome === 'Qualquer mercado') || b.itens.length - a.itens.length; });
    return g;
  }
  function precoLista(i) { if (i.loja) { var p = i.precos.filter(function (x) { return x.loja === i.loja; })[0]; return p ? p.p : null; } return i.min ? i.min.p : null; }
  function textoLista(L) {
    var linhas = ['🛒 Lista do mercado — ' + mesBR(mesDe(hojeISO()))];
    grupos(L).forEach(function (g) {
      var sub = g.itens.reduce(function (s, i) { var p = precoLista(i); return s + (p ? p * i.qtd : 0); }, 0);
      linhas.push('', '*' + g.nome + '*' + (UI.agrupar === 'loja' && sub ? ' (~' + din(sub) + ')' : ''));
      g.itens.forEach(function (i) { var onde = i.loja || (i.min && i.min.loja), p = precoLista(i); linhas.push((i.marcado ? '☑ ' : '☐ ') + i.qtd + ' × ' + i.pt + (UI.agrupar !== 'loja' && onde ? ' — ' + LN[onde] + (p ? ' ' + din(p) : '') : '')); });
    });
    var r = resumo(L);
    if (r.melhor) linhas.push('', 'Estimativa: ' + din(r.melhor));
    return linhas.join('\n');
  }
  function compartilharTexto(t, titulo) {
    if (navigator.share) { navigator.share({ title: titulo || 'Lista do mercado', text: t }).catch(function (e) { if (e && e.name !== 'AbortError') copiarTexto(t); }); return; }
    copiarTexto(t);
  }
  function copiarTexto(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copiado. Cole no WhatsApp ou no e-mail.'); }, function () {
      abrirFolha('<h3>Copie o texto</h3><textarea class="in" style="min-height:260px">' + esc(t) + '</textarea><button class="btn cheio" id="f-fechar" style="margin-top:10px">Fechar</button>'); $('f-fechar').onclick = function () { fecharFolha(); };
    });
  }
  function cartaoIncluir() {
    return '<div class="card"><h2>Incluir na lista' + ajuda('incluir') + '</h2><datalist id="nomes-l">' + nomesConhecidos().map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      '<input class="in" id="add-nome" list="nomes-l" placeholder="Ex.: Café 925 g, detergente…" aria-label="Item para incluir">' +
      '<div class="grade3" style="grid-template-columns:minmax(0,1fr) 5.5em auto;margin-top:6px"><label class="mini">Onde comprar<select class="in" id="add-loja"><option value="">Mais barato</option>' + LOJAS.map(function (l) { return '<option value="' + l.id + '">' + esc(l.n) + '</option>'; }).join('') + '</select></label>' +
      '<label class="mini">Qtd<input class="in" id="add-qtd" type="number" min="0.1" step="0.1" inputmode="decimal" value="1"></label><button class="btn pri" id="add-ok">Incluir</button></div><div class="erro" id="add-erro"></div></div>';
  }
  function telaLista() {
    var L = listaDoMes();
    if (!L.length) return kpis() + cartaoIncluir() + '<div class="card"><h2>A lista se monta sozinha' + ajuda('lista') + '</h2><p class="nota">Com o que você compra com frequência nos recibos, ou com os itens que você incluir acima.</p><button class="btn" data-ir="recibo">Adicionar recibo</button></div>';
    var r = resumo(L), meses = ultimosMeses(3).map(mesBR).join(', '), marcados = L.filter(function (i) { return i.marcado; }).length;
    var h = kpis() + cartaoIncluir() + '<div class="card"><details' + (UI.abrirLista ? ' open' : '') + ' id="det-lista"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px"><h2 style="margin:0">Lista do mês · ' + L.length + ' itens' + (marcados ? ' · ' + marcados + ' no carrinho' : '') + ajuda('lista') + '</h2><span class="nota" style="margin:0;white-space:nowrap">' + (UI.abrirLista ? 'fechar ▴' : 'ver ▾') + '</span></summary><div style="margin-top:10px">' +
      '<p class="nota">' + (meses ? (ultimosMeses(3).length < 3 ? 'Tudo o que você comprou nos recibos (' + esc(meses) + ') e o que você incluiu. Quando houver 3 meses de recibos, a lista mostra só o que se repete. ' : 'O que você comprou em pelo menos 2 dos últimos 3 meses (' + esc(meses) + ') e o que você incluiu. ') : '') + 'Comprando cada item onde é mais barato: <b>' + din(r.melhor) + '</b>' + (r.sempre > r.melhor ? ' em vez de ' + din(r.sempre) : '') + '. Toque no quadradinho para marcar o que já pegou.</p>' +
      '<div class="filtros"><button data-agrupar="cat" class="' + (UI.agrupar === 'cat' ? 'on' : '') + '">Por categoria</button><button data-agrupar="loja" class="' + (UI.agrupar === 'loja' ? 'on' : '') + '">Por mercado</button></div>';
    grupos(L).forEach(function (g) {
      var sub = g.itens.reduce(function (s, i) { var p = precoLista(i); return s + (p ? p * i.qtd : 0); }, 0);
      h += '<div class="selo" style="margin:12px 0 2px">' + esc(g.nome) + (UI.agrupar === 'loja' && sub ? ' · ~' + din(sub) : '') + '</div>';
      g.itens.forEach(function (i) {
        h += '<div class="linha' + (i.marcado ? ' feito' : '') + '"><button class="caixa" data-marcar="' + esc(i.k) + '" aria-pressed="' + i.marcado + '" aria-label="Marcar ' + esc(i.pt) + '">' + (i.marcado ? '✓' : '') + '</button><div class="info"><div class="t">' + esc(i.qtd) + ' × ' + esc(i.pt) + '</div><div class="s">' +
          (i.loja ? 'Comprar na ' + esc(LN[i.loja]) + (precoLista(i) ? ' · ' + din(precoLista(i)) : '') + (i.min && i.min.loja !== i.loja ? ' · mais barato: ' + esc(LN[i.min.loja]) + ' ' + din(i.min.p) : '') : i.min ? (UI.agrupar === 'loja' ? din(i.min.p) + ' cada' : 'Mais barato: ' + esc(LN[i.min.loja]) + ' ' + din(i.min.p)) : 'Sem preço para comparar') + (i.ult && UI.agrupar !== 'loja' && !(i.min && i.min.loja === i.ult.loja && Math.abs(i.min.p - i.ult.p) < 0.005) ? ' · última vez ' + din(i.ult.p) + ' na ' + esc(LN[i.ult.loja] || '') : '') + '</div></div>' +
          '<button class="btn sm" data-qtd="' + esc(i.k) + '" aria-label="Editar ' + esc(i.pt) + '">Editar</button></div>';
      });
    });
    h += '<div class="grupo-btn" style="margin-top:14px"><button class="btn pri" id="compartilhar">Compartilhar</button><button class="btn" id="copiar-lista">Copiar</button>' + (marcados ? '<button class="btn" id="desmarcar">Desmarcar tudo</button>' : '') + '</div>' +
      '<p class="nota" style="margin-top:8px">Compartilhar abre o WhatsApp, o e-mail ou as Mensagens do iPhone com a lista pronta' + (UI.agrupar === 'loja' ? ', separada por mercado' : '') + '.</p></div></details></div>';
    var fora = Object.values(catalogo()).filter(function (c) { return !L.some(function (l) { return l.k === c.k; }); }).sort(function (a, b) { return a.pt.localeCompare(b.pt); });
    if (fora.length) h += '<div class="card"><h2>Outros itens já comprados</h2><p class="nota">Toque para colocar na lista.</p><div class="chips">' + fora.map(function (c) { return '<button class="chip" data-fixar="' + esc(c.k) + '">+ ' + esc(c.pt) + '</button>'; }).join('') + '</div></div>';
    return h;
  }
  function folhaPedido() { abrirFolha('<h3>Copie o pedido</h3><p class="nota">Toque e segure no texto → Selecionar tudo → Copiar.</p><textarea class="in" readonly style="min-height:240px">' + esc(PEDIDO_IA) + '</textarea><button class="btn cheio" id="f-fechar" style="margin-top:10px">Fechar</button>'); }
  function mostrarCaixa(msg) { $('caixa').style.display = ''; $('texto').focus(); $('r-erro').textContent = msg; }
  // Link do iCloud do atalho "Mercado" (Shortcuts → segurar → Share → Copy iCloud Link). Trocar aqui se o atalho mudar.
  var ATALHO_URL = 'https://www.icloud.com/shortcuts/6662d894184449e487534350d39ba320';
  var PEDIDO_IA = 'Read the attached store receipt photo. Reply ONLY with these lines, no other text:\n' +
    'LOJA|store name\nDATA|YYYY-MM-DD\nTOTAL|total paid\nIMPOSTO|total tax, 0 if none\n' +
    'Then one line per product, in receipt order:\n' +
    'ITEM|name as printed|quantity|unit price|line total|specific product name in Brazilian Portuguese, e.g. Framboesa, Kiwi dourado, Macarrão (never a generic word like Frutas)|category\n' +
    'Category must be one of: Hortifruti, Carnes e peixes, Laticínios e ovos, Padaria, Mercearia, Congelados, Bebidas, Lanches e doces, Limpeza, Higiene, Bebê e pet, Outros.\n' +
    'Numbers with a dot, no $ sign. Weighed items: quantity is the weight. Apply discounts to the item. Never list subtotal, total, tax, payment, card or change as items. The line totals plus tax must equal TOTAL; if not, re-check the prices.';
  function telaAjustes() {
    return cartaoFamilia() + '<div class="card"><h2>Instalar o atalho no iPhone' + ajuda('atalho') + '</h2><p class="nota">Para usar o botão <b>1. Foto do recibo</b> em outro iPhone (por exemplo, da família):</p>' +
      '<ol class="passos"><li>Toque no botão abaixo.</li><li>Toque em <b>Get Shortcut</b> (Obter atalho) e depois em <b>Add Shortcut</b> (Adicionar atalho).</li><li>Deixe o nome <b>Mercado</b>, sem mudar.</li></ol>' +
      '<a class="btn cheio" href="' + ATALHO_URL + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Instalar o atalho Mercado</a>' +
      '<p class="nota" style="margin-top:8px">O atalho usa a IA da Apple (iPhone 15 Pro ou mais novo). Sem ela, use <b>Não tem a IA da Apple?</b> na aba <b>Recibo</b>. Se o iPhone pedir para baixar o app <b>Atalhos</b> (Shortcuts), baixe na App Store: é gratuito, da Apple.</p></div>';
  }
  function telaRecibo() {
    if (UI.rev) return telaRevisar();
    var h = '<div class="card"><h2>Novo recibo' + ajuda('novo') + '</h2>' +
      // Caminho principal: atalho "Mercado" do iPhone (foto → IA da Apple → volta aqui em #recibo) e depois Colar
      '<a class="btn pri cheio" id="atalho" href="shortcuts://run-shortcut?name=Mercado" style="min-height:56px;font-size:17px;display:flex;align-items:center;justify-content:center;text-decoration:none">📷 1. Foto do recibo</a>' +
      '<button class="btn cheio" id="colar" style="min-height:52px;font-size:17px;margin-top:10px">📋 2. Colar o recibo</button>' +
      '<p class="nota" style="margin:8px 0 0">O botão 1 abre o atalho <b>Mercado</b>. Depois da foto, o app volta aqui: toque no 2 e, se o iPhone mostrar o balãozinho <b>Colar</b> (Paste), toque nele. <a href="#" data-ir="ajustes">Primeira vez? Instale o atalho em ⚙️ Configuração.</a></p><div class="erro" id="r-erro"></div>' +
      // caixa de reserva: só aparece se o navegador não deixar ler a área de transferência
      '<div id="caixa" style="display:' + (UI.texto ? '' : 'none') + ';margin-top:10px"><textarea class="in" id="texto" placeholder="Toque e segure aqui → Colar">' + esc(UI.texto) + '</textarea>' +
      '<div class="grupo-btn" style="margin-top:8px"><button class="btn" id="ler">Ler este recibo</button></div></div>' +
      '<div class="grupo-btn" style="margin-top:10px"><button class="btn sm" id="manual">✍️ Digitar recibo à mão</button></div>' +
      // sem IA da Apple: qualquer app de IA que leia foto (ChatGPT, Gemini, Copilot, Claude) devolve o mesmo formato
      '<details style="margin-top:14px"><summary class="btn cheio" style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:center;gap:6px">🤖 Não tem a IA da Apple? Use o ChatGPT ou o Gemini</summary>' +
      '<ol class="passos"><li>Toque em <b>Copiar pedido para a IA</b>.</li><li>Abra um app de IA que leia foto (ChatGPT, Gemini, Copilot ou Claude), <b>cole o pedido</b> e mande a <b>foto do recibo</b>.</li><li>Copie a resposta, volte aqui e toque em <b>2. Colar o recibo</b>.</li></ol>' +
      '<button class="btn cheio" id="copiar-pedido">Copiar pedido para a IA</button></details></div>';
    var rs = recibos().sort(function (a, b) { return (b.data || '').localeCompare(a.data || '') || (b.criado || 0) - (a.criado || 0); });
    h += '<div class="card"><details' + (UI.abrirRecibos ? ' open' : '') + ' id="det-recibos"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between"><h2 style="margin:0">Recibos salvos · ' + rs.length + ajuda('salvos') + '</h2><span class="nota" style="margin:0">' + (UI.abrirRecibos ? 'fechar ▴' : 'ver ▾') + '</span></summary><div style="margin-top:10px">' + (rs.length ? rs.slice(0, UI.nRecibos || 20).map(function (r) {
      return '<div class="linha"><div class="info"><div class="t">' + esc(LN[r.loja] || 'Outro') + '</div><div class="s">' + esc(dataBR(r.data)) + ' · ' + r.itens.length + ' itens</div></div><div class="valor">' + din(r.total) + '</div><button class="btn sm" data-ver="' + esc(r.id) + '">Abrir</button></div>';
    }).join('') : '<div class="vazio">Nenhum recibo ainda.</div>') + '</div></details></div>';
    if (rs.length > (UI.nRecibos || 20)) h = h.replace(/<\/div><\/details><\/div>$/, '<button class="btn cheio" id="mais-recibos" style="margin-top:10px">Ver mais recibos (' + (rs.length - (UI.nRecibos || 20)) + ')</button></div></details></div>');
    var nd = Object.keys(M.dic).length;
    if (nd) h += '<div class="card"><h2>Nomes aprendidos · ' + nd + ajuda('nomes') + '</h2><p class="nota">Cada código do recibo que você renomeia fica guardado. Na próxima vez ele já vem com o seu nome e a categoria certa.</p><button class="btn sm" id="ver-dic">Ver e corrigir</button></div>';
    return h;
  }
  function itemDoLeitor(it) {
    var d = M.dic[chave(it.raw)];
    return { raw: it.raw, pt: d ? d.pt : it.en, cat: d ? d.cat : it.cat, qtd: it.qtd, un: it.un, total: it.total, novo: !d };
  }
  // Recibo repetido: mesmo mercado, mesma data e mesmo total de um recibo já salvo
  function duplicado(r, total) {
    if (total == null || isNaN(total)) return null;
    return recibos().filter(function (x) { return x.id !== r.id && x.loja === r.loja && x.data === r.data && Math.abs((+x.total || 0) - total) < 0.005; })[0] || null;
  }
  function totalRev(r) { var soma = r.itens.reduce(function (s, i) { return s + (+i.total || 0); }, 0); return r.total == null || r.total === '' ? Math.round((soma + (+r.imposto || 0)) * 100) / 100 : +r.total; }
  function avisoDup(d) { return 'Este recibo já foi salvo: <b>' + esc(LN[d.loja] || 'Outro') + ' · ' + esc(dataBR(d.data)) + ' · ' + din(d.total) + '</b>. Não precisa salvar de novo.'; }
  function dataBR(d) { var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '/' + m[2] + '/' + m[1] : (d || ''); }
  function somaHtml(r) {
    var soma = r.itens.reduce(function (s, i) { return s + (+i.total || 0); }, 0), dif = r.total ? Math.abs(soma + (+r.imposto || 0) - r.total) : 0;
    return 'Itens: <b>' + din(soma) + '</b>' + (r.total ? ' + imposto ' + din(r.imposto || 0) + ' = ' + din(soma + (+r.imposto || 0)) + (dif > 0.05 ? ' · <b style="color:#b91c1c">diferença de ' + din(dif) + ' para o total pago — confira</b>' : ' · <b style="color:#15803d">confere com o total ✓</b>') : '');
  }
  function atualizarSoma() { if ($('rv-soma') && UI.rev) $('rv-soma').innerHTML = somaHtml(UI.rev); }
  function telaRevisar() {
    var r = UI.rev, soma = r.itens.reduce(function (s, i) { return s + (+i.total || 0); }, 0);
    var dif = r.total ? Math.abs(soma + (+r.imposto || 0) - r.total) : 0;
    var nomes = {}; Object.keys(M.dic).forEach(function (k) { nomes[M.dic[k].pt] = 1; }); Object.values(catalogo()).forEach(function (c) { nomes[c.pt] = 1; });
    var h = '<datalist id="nomes">' + Object.keys(nomes).sort().map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>';
    h += '<div class="barra-voltar"><button class="btn" id="rv-voltar">← Voltar</button><span>' + (r.id ? 'Recibo salvo' : 'Recibo novo, ainda não salvo') + '</span></div>';
    var dup = r.id ? null : duplicado(r, totalRev(r));
    if (dup) h += '<div class="card" style="background:#fef2f2;border:1px solid #fecaca"><p class="nota" style="margin:0;color:#991b1b">⚠️ ' + avisoDup(dup) + ' Toque em <b>← Voltar</b>.</p></div>';
    h += '<div class="card"><h2>' + (r.id ? 'Editar recibo' : 'Conferir recibo') + ajuda('conferir') + '</h2>' +
      (r.emparelhou ? '<p class="nota">O texto veio com os nomes e os preços em colunas separadas. Juntei na ordem; confira se cada preço ficou no item certo.</p>' : '') +
      '<div class="grade3" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)"><div><label class="lb" for="rv-loja">Mercado</label><select class="in" id="rv-loja">' + LOJAS.map(function (l) { return '<option value="' + l.id + '"' + (l.id === r.loja ? ' selected' : '') + '>' + esc(l.n) + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="lb" for="rv-data">Data</label><input class="in" type="date" id="rv-data" value="' + esc(r.data) + '"></div>' +
      '<div><label class="lb" for="rv-total">Total pago</label><input class="in" type="number" step="0.01" inputmode="decimal" id="rv-total" value="' + esc(dec2(r.total)) + '"></div>' +
      '<div><label class="lb" for="rv-imp">Imposto (HST)</label><input class="in" type="number" step="0.01" inputmode="decimal" id="rv-imp" value="' + esc(r.imposto ? dec2(r.imposto) : '') + '"></div></div>' +
      '<p class="nota" style="margin-top:10px" id="rv-soma">' + somaHtml(r) + '</p></div>';
    h += '<div class="card"><h2>' + r.itens.length + ' itens</h2><p class="nota">Dê a cada item o nome que você usa (ex.: “Leite 2% 4 L”). Use sempre o mesmo nome em mercados diferentes para comparar os preços. O app lembra na próxima vez.</p>' +
      r.itens.map(function (it, i) {
        return '<div class="item-rev">' + (it.raw ? '<div class="raw">' + esc(it.raw) + (it.novo ? ' · <b style="color:#b45309">nome novo, confira</b>' : '') + '</div>' : '') +
          '<input class="in" list="nomes" data-i="' + i + '" data-f="pt" value="' + esc(it.pt) + '" aria-label="Nome do item">' +
          '<div class="grade3"><select class="in" data-i="' + i + '" data-f="cat" aria-label="Categoria">' + CATS.map(function (c) { return '<option' + (c === it.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
          '<label class="mini">Qtd<input class="in" type="number" step="0.001" inputmode="decimal" data-i="' + i + '" data-f="qtd" value="' + esc(it.qtd) + '"></label>' +
          '<label class="mini">Valor (CA$)<input class="in" type="number" step="0.01" inputmode="decimal" data-i="' + i + '" data-f="total" value="' + esc(dec2(it.total)) + '"></label>' +
          '<button class="btn sm" data-rm="' + i + '" aria-label="Remover item">×</button></div></div>';
      }).join('') +
      '<div class="grupo-btn" style="margin-top:12px"><button class="btn" id="rv-mais">+ Adicionar item</button></div></div>' +
      '<div class="grupo-btn acoes-fixas"><button class="btn pri" id="rv-salvar" style="flex:1">' + (r.id ? 'Salvar alterações' : 'Salvar recibo') + '</button><button class="btn" id="rv-cancelar">' + (r.id ? 'Voltar sem salvar' : 'Descartar') + '</button><div class="erro" id="rv-erro" style="flex-basis:100%;margin:0"></div></div>' + (r.id ? '<div style="text-align:center;margin:18px 0 6px"><button class="btn" id="rv-apagar" style="color:#b91c1c;border-color:#fecaca">Apagar este recibo</button></div>' : '');
    return h;
  }
  function telaPrecos() {
    var L = listaDoMes(), cat = catalogo();
    if (!L.length) return '<div class="card"><h2>Preços</h2><p class="vazio">A comparação aparece quando houver itens na lista do mês.</p></div>';
    var r = resumo(L);
    var tot = COMPARA.map(function (l) { var s = 0, n = 0; L.forEach(function (i) { var p = precoEm(i.k, l.id, cat); if (p) { s += p.p * i.qtd; n++; } }); return { l: l, s: s, n: n }; });
    var completo = tot.filter(function (t) { return t.n === L.length; }).sort(function (a, b) { return a.s - b.s; })[0];
    var h = '<div class="kpis"><div class="kpi"><b>' + din(r.sempre) + '</b><span>pagando como sempre</span></div><div class="kpi verde"><b>' + din(r.melhor) + '</b><span>melhor preço em cada item</span></div>' +
      '<div class="kpi azul"><b>' + (completo ? din(completo.s) : '—') + '</b><span>' + (completo ? 'tudo na ' + esc(completo.l.n) : 'faltam preços para comparar um mercado só') + '</span></div></div>';
    h += '<div class="card"><h2>Comparar preços' + ajuda('precos') + '</h2><p class="nota" style="margin:0">Os preços vêm dos seus recibos e do que você anota. Toque num mercado para anotar o preço que viu no folheto, no Flipp ou na prateleira. Compare sempre a mesma embalagem. Em amarelo, o mais barato.</p>' +
      '<p class="nota" style="margin:10px 0 0">Para montar a lista de compras: toque no mercado onde quer comprar cada item (ele fica marcado com 🛒), ou use o botão abaixo para escolher o mais barato de todos de uma vez.</p>' +
      '<button class="btn pri cheio" id="lista-baratos" style="margin-top:10px">🛒 Montar a lista com os mais baratos</button>' +
      '<button class="btn cheio" data-ver-lista="1" style="margin-top:8px">Ver a lista de compras por mercado</button></div>';
    var c = '';
    L.forEach(function (i) {
      if (i.cat !== c) { c = i.cat; h += '<div class="selo" style="margin:6px 0 8px">' + esc(c) + '</div>'; }
      h += '<div class="card" style="padding:12px 14px"><div class="t" style="font-weight:700">' + esc(i.qtd) + ' × ' + esc(i.pt) + '</div><div class="s" style="font-size:13.5px;color:#475569;margin-top:2px">' + (i.loja ? '🛒 Comprar na <b>' + esc(LN[i.loja]) + '</b>' : i.min ? 'Ainda sem mercado escolhido · mais barato: ' + esc(LN[i.min.loja]) : 'Sem preço ainda') + '</div><div class="chips">' +
        COMPARA.map(function (l) {
          var p = precoEm(i.k, l.id, cat), melhor = p && i.min && p.p === i.min.p;
          return '<button class="chip' + (melhor ? ' melhor' : '') + (p ? '' : ' falta') + (i.loja === l.id ? ' escolhido' : '') + '" data-k="' + esc(i.k) + '" data-loja="' + l.id + '">' + (i.loja === l.id ? '🛒 ' : '') + esc(l.n) + (p ? '<b>' + din(p.p) + '</b><small>' + esc(p.fonte) + ' ' + esc((p.data || '').slice(5).split('-').reverse().join('/')) + '</small>' : '<b>+</b>') + '</button>';
        }).join('') + '</div></div>';
    });
    h += '<div class="card"><h2>Total da lista por mercado</h2>' + tot.map(function (t) { return '<div class="linha"><div class="info"><div class="t">' + esc(t.l.n) + '</div><div class="s">' + t.n + ' de ' + L.length + ' itens com preço</div></div><div class="valor">' + (t.n ? din(t.s) : '—') + '</div></div>'; }).join('') + '</div>';
    h += '<div class="card"><h2>Mercados de Saint John</h2>' + LOJAS.map(function (l) { return '<div class="s" style="font-size:13px;color:#475569;margin:4px 0">' + esc(l.l) + '</div>'; }).join('') + '</div>';
    return h;
  }
  function nsBadge(g) { g = String(g || '').toLowerCase(); return /^[a-e]$/.test(g) ? '<span class="ns ns-' + g + '">' + g.toUpperCase() + '</span>' : ''; }
  function yukaCor(v) { return v < 25 ? 'y0' : v < 50 ? 'y1' : v < 75 ? 'y2' : 'y3'; }
  function telaSaude() {
    var L = listaDoMes().filter(function (i) { return COMIDA[i.cat]; });
    var h = '<div class="card"><h2>Mais saudável' + ajuda('saude') + '</h2><p class="nota">Para cada alimento da lista, busque o produto no <b>Open Food Facts</b> (base aberta e gratuita) para ver o Nutri-Score e a classificação NOVA, e depois opções melhores vendidas no Canadá. O Yuka é opcional: escanear o código de barras nele é grátis; anote a nota aqui.</p>' +
      '<p class="nota" style="margin:0">Nutri-Score: ' + ['a', 'b', 'c', 'd', 'e'].map(nsBadge).join(' ') + ' (A é o melhor). NOVA: 1 natural … 4 ultraprocessado. Yuka: <span class="ns y0">0–24</span> <span class="ns y1">25–49</span> <span class="ns y2">50–74</span> <span class="ns y3">75–100</span></p></div>';
    if (!L.length) return h + '<div class="vazio">Os alimentos da sua lista aparecem aqui.</div>';
    L.forEach(function (i) {
      var p = M.produtos[i.k] || {}, o = p.off, alts = [].concat(p.alts || []).filter(Boolean), res = UI.off[i.k];
      h += '<div class="card"><div class="linha" style="padding:0"><div class="info"><div class="t" style="display:flex;align-items:center;gap:8px">' + esc(i.pt) + '</div><div class="s">' + (o ? esc(o.nome) + (o.marca ? ' · ' + esc(o.marca) : '') + ' ' + nsBadge(o.ns) + (o.nova ? ' <span class="selo">NOVA ' + esc(o.nova) + '</span>' : '') : 'Ainda não buscado') + '</div></div>' +
        (p.yuka != null ? '<span class="ns ' + yukaCor(+p.yuka) + '">' + esc(p.yuka) + '</span>' : '') + '</div>';
      if (res && res.lista) {
        h += '<p class="nota" style="margin-top:10px">Qual destes é o seu?</p>' + (res.lista.length ? res.lista.map(function (x, j) { return '<div class="linha"><div class="info"><div class="t" style="font-size:14px">' + esc(x.product_name || '?') + '</div><div class="s">' + esc(x.brands || '') + ' ' + esc(x.quantity || '') + ' ' + nsBadge(x.nutriscore_grade) + '</div></div><button class="btn sm" data-escolher="' + esc(i.k) + '" data-j="' + j + '">É este</button></div>'; }).join('') : '<div class="vazio">Nada encontrado. Tente outro nome.</div>');
      }
      if (res && res.msg) h += '<p class="nota" style="margin-top:10px">' + esc(res.msg) + (res.site ? ' <a href="' + esc(res.site) + '" target="_blank" rel="noopener">Abrir no site do Open Food Facts</a>' : '') + '</p>';
      if (alts.length) h += '<p class="nota" style="margin:12px 0 2px"><b>Opções melhores no Canadá</b></p>' + alts.map(function (a) { return '<div class="linha"><div class="info"><div class="t" style="font-size:14px">' + nsBadge(a.ns) + ' ' + esc(a.nome) + '</div><div class="s">' + esc(a.marca || '') + ' ' + esc(a.qtd || '') + (a.nova ? ' · NOVA ' + esc(a.nova) : '') + '</div></div>' + (/^\d{6,14}$/.test(a.code || '') ? '<a class="btn sm" href="https://world.openfoodfacts.org/product/' + esc(a.code) + '" target="_blank" rel="noopener">Ver</a>' : '') + '</div>'; }).join('');
      h += '<input class="in" style="margin-top:10px" data-busca="' + esc(i.k) + '" value="' + esc((res && res.q) || p.en || i.pt) + '" aria-label="Nome para buscar no Open Food Facts">' +
        '<div class="grupo-btn" style="margin-top:6px"><button class="btn sm" data-off="' + esc(i.k) + '">Buscar no Open Food Facts</button>' + (o && o.cat ? '<button class="btn sm" data-alt="' + esc(i.k) + '">Opções melhores</button>' : '') + '</div>' +
        // notas digitadas à mão (ex.: viu no site do Open Food Facts)
        '<div class="grade3" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);margin-top:10px"><label class="mini">Nutri-Score<select class="in" data-ns="' + esc(i.k) + '"><option value="">—</option>' + ['a', 'b', 'c', 'd', 'e'].map(function (n) { return '<option value="' + n + '"' + (o && o.ns === n ? ' selected' : '') + '>' + n.toUpperCase() + '</option>'; }).join('') + '</select></label>' +
        '<label class="mini">NOVA<select class="in" data-nova="' + esc(i.k) + '"><option value="">—</option>' + [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '"' + (o && +o.nova === n ? ' selected' : '') + '>' + n + (n === 1 ? ' natural' : n === 4 ? ' ultraprocessado' : '') + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="grade3" style="grid-template-columns:auto 6em;justify-content:start;margin-top:4px"><label class="nota" for="y-' + esc(i.k) + '" style="margin:0">Nota Yuka <span style="font-weight:400">(opcional)</span></label><input class="in" id="y-' + esc(i.k) + '" type="number" min="0" max="100" inputmode="numeric" data-yuka="' + esc(i.k) + '" value="' + esc(p.yuka == null ? '' : p.yuka) + '"></div></div>';
    });
    return h;
  }
  function barras(linhas, max, limite) {
    if (!linhas.length) return '<div class="vazio">Sem dados.</div>';
    return linhas.map(function (r) { return '<div class="barra' + (limite && r.v > limite ? ' passou' : '') + '"><span>' + esc(r.l) + '</span><div class="tr"><i style="width:' + (max ? Math.max(2, r.v / max * 100) : 0) + '%"></i></div><span class="valor">' + din(r.v) + '</span></div>'; }).join('');
  }
  function telaGastos() {
    var orc = +M.ajustes.orcamento || 0, rs = recibos(), pm = {};
    rs.forEach(function (r) { var m = mesDe(r.data); pm[m] = (pm[m] || 0) + (+r.total || 0); });
    var meses = Object.keys(pm).sort().slice(-12).map(function (m) { return { l: mesBR(m), v: pm[m] }; });
    var este = mesDe(hojeISO()), pc = {};
    rs.filter(function (r) { return mesDe(r.data) === este; }).forEach(function (r) { r.itens.forEach(function (i) { pc[i.cat || 'Outros'] = (pc[i.cat || 'Outros'] || 0) + (+i.total || 0); }); });
    var cats = Object.keys(pc).map(function (c) { return { l: c, v: pc[c] }; }).sort(function (a, b) { return b.v - a.v; });
    var u3 = ultimosMeses(3), pl = {};
    rs.filter(function (r) { return u3.indexOf(mesDe(r.data)) >= 0; }).forEach(function (r) { var n = LN[r.loja] || 'Outro'; pl[n] = (pl[n] || 0) + (+r.total || 0); });
    var lojas = Object.keys(pl).map(function (n) { return { l: n, v: pl[n] }; }).sort(function (a, b) { return b.v - a.v; });
    var mx = function (a) { return Math.max.apply(null, [1].concat(a.map(function (r) { return r.v; }))); };
    return kpis() + '<div class="card"><h2>Orçamento mensal do mercado' + ajuda('gastos') + '</h2><div class="grade3" style="grid-template-columns:minmax(0,10em) auto;justify-content:start"><input class="in" type="number" min="0" step="10" inputmode="decimal" id="orc" value="' + esc(orc ? dec2(orc) : '') + '" placeholder="CA$" aria-label="Orçamento mensal em dólares"><button class="btn" id="orc-salvar">Salvar</button></div></div>' +
      '<div class="card"><h2>Por mês</h2>' + barras(meses, Math.max(orc, mx(meses)), orc) + (orc ? '<p class="nota" style="margin-top:8px">Em vermelho, os meses acima de ' + din(orc) + '.</p>' : '') + '</div>' +
      '<div class="card"><h2>Este mês por categoria</h2>' + barras(cats, mx(cats)) + '</div>' +
      '<div class="card"><h2>Por mercado · últimos 3 meses</h2>' + barras(lojas, mx(lojas)) + '</div>';
  }

  // ── ações ──
  function ligar() {
    qsa('[data-ir]').forEach(function (b) { b.onclick = function (e) { if (e) e.preventDefault(); qsa('#abas button').forEach(function (x) { if (x.dataset.aba === b.dataset.ir) x.click(); }); }; });
    qsa('[data-tirar]').forEach(function (b) { b.onclick = function () { if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Confirmar'; setTimeout(function () { b.dataset.ok = ''; b.textContent = 'Tirar'; }, 4000); return; } var k = b.dataset.tirar, m = {}; m['produtos/' + k + '/fixo'] = false; gravar(m).then(function () { toast('Tirado da lista'); }); }; });
    qsa('[data-fixar]').forEach(function (b) { b.onclick = function () { var k = b.dataset.fixar, c = catalogo()[k], m = {}; m['produtos/' + k + '/fixo'] = true; m['produtos/' + k + '/pt'] = c.pt; m['produtos/' + k + '/cat'] = c.cat; gravar(m); }; });
    if ($('copiar-lista')) $('copiar-lista').onclick = function () { copiarTexto(textoLista(listaDoMes())); };
    if ($('compartilhar')) $('compartilhar').onclick = function () { compartilharTexto(textoLista(listaDoMes())); };
    qsa('[data-agrupar]').forEach(function (b) { b.onclick = function () { UI.agrupar = b.dataset.agrupar; desenhar(); }; });
    qsa('[data-marcar]').forEach(function (b) { b.onclick = function () { var k = b.dataset.marcar, on = b.getAttribute('aria-pressed') !== 'true', m = {}; m['produtos/' + k + '/marcado'] = on ? mesDe(hojeISO()) : null; m['produtos/' + k + '/pt'] = (catalogo()[k] || {}).pt || k; gravar(m); }; });
    if ($('desmarcar')) $('desmarcar').onclick = function () { var b = this; if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Toque de novo para desmarcar'; setTimeout(function () { b.dataset.ok = ''; b.textContent = 'Desmarcar tudo'; }, 4000); return; } var m = {}; listaDoMes().forEach(function (i) { if (i.marcado) m['produtos/' + i.k + '/marcado'] = null; }); gravar(m); };
    qsa('[data-qtd]').forEach(function (b) { b.onclick = function () { editarQtd(b.dataset.qtd); }; });
    if ($('add-nome')) {
      $('add-nome').onchange = function () { var p = M.produtos[chave(this.value)]; if (p && p.loja) $('add-loja').value = p.loja; };
      $('add-ok').onclick = function () {
        var nome = $('add-nome').value.trim().slice(0, 80), q = +$('add-qtd').value || 1, loja = $('add-loja').value;
        if (!nome) { $('add-erro').textContent = 'Digite o nome do item.'; return; }
        var k = chave(nome), m = {}, existe = catalogo()[k], p = M.produtos[k] || {};
        m['produtos/' + k + '/pt'] = existe ? existe.pt : nome; m['produtos/' + k + '/cat'] = (existe && existe.cat) || p.cat || adivinharCat(nome);
        m['produtos/' + k + '/fixo'] = true; m['produtos/' + k + '/qtd'] = q; m['produtos/' + k + '/loja'] = loja || null;
        gravar(m).then(function () { toast('Incluído: ' + nome + (loja ? ' (' + LN[loja] + ')' : '')); });
      };
      $('add-nome').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('add-ok').click(); });
    }
    if ($('mb-add')) $('mb-add').onclick = adicionarMembro;
    qsa('[data-mbrm]').forEach(function (b) { b.onclick = function () { if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Confirmar'; return; } removerMembro(b.dataset.mbrm); }; });
    // recibo
    if ($('texto')) $('texto').oninput = function () {
      UI.texto = this.value;
      // texto do Scan Text (ou colado) chegou: lê sozinho quando parar de mudar
      clearTimeout(UI.auto);
      if (this.value.length - (UI.inicio || 0) > 40 && /\d[.,]\d{2}/.test(this.value) && /\bTOTAL\b/i.test(this.value) && /\d[.,]\d{2}[\s\S]*\d[.,]\d{2}[\s\S]*\d[.,]\d{2}/.test(this.value)) UI.auto = setTimeout(lerTexto, 1200);
    };
    if ($('texto')) $('texto').onfocus = function () { UI.inicio = this.value.length; };
    if ($('copiar-pedido')) $('copiar-pedido').onclick = function () {
      var b = this, ok = function () { b.textContent = 'Pedido copiado ✓ Agora abra o app de IA'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(PEDIDO_IA).then(ok, function () { folhaPedido(); });
      else folhaPedido();
    };
    if ($('colar')) $('colar').onclick = function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) { mostrarCaixa('Toque e segure na caixa abaixo e escolha Colar.'); return; }
      navigator.clipboard.readText().then(function (t) { if (!t.trim()) { $('r-erro').textContent = 'Não há nada copiado. Toque primeiro em 1. Foto do recibo.'; return; } UI.texto = t; lerTexto(); },
        function () { mostrarCaixa('Toque e segure na caixa abaixo e escolha Colar.'); });
    };
    if ($('ler')) $('ler').onclick = function () { UI.texto = $('texto').value; lerTexto(); };
    if ($('manual')) $('manual').onclick = function () { marcarHistorico(); UI.rev = { loja: 'superstore', data: hojeISO(), total: null, imposto: 0, itens: [{ raw: '', pt: '', cat: 'Mercearia', qtd: 1, un: 0, total: 0 }] }; desenhar(); };
    qsa('[data-ver]').forEach(function (b) { b.onclick = function () { var r = recibos().filter(function (x) { return x.id === b.dataset.ver; })[0]; if (!r) return; UI.rev = JSON.parse(JSON.stringify(r)); marcarHistorico(); desenhar(); window.scrollTo(0, 0); }; });
    if ($('ver-dic')) $('ver-dic').onclick = abrirDic;
    if ($('mais-recibos')) $('mais-recibos').onclick = function () { UI.nRecibos = (UI.nRecibos || 20) + 20; desenhar(); };
    // Saudável: copiar o nome do produto para colar no Yuka (nome do Open Food Facts, se já buscado; senão o da busca)
    qsa('[data-copiar]').forEach(function (b) { b.onclick = function () {
      var k = b.dataset.copiar, p = M.produtos[k] || {}, o = p.off, inp = qsa('[data-busca="' + k + '"]')[0];
      var nome = o && o.nome ? ((o.marca ? o.marca + ' ' : '') + o.nome) : (inp ? inp.value : (p.en || p.pt || ''));
      nome = String(nome || '').trim(); if (!nome) return;
      var ok = function () { b.textContent = '✓ Copiado'; toast('Copiado: ' + nome + ' — cole no Yuka'); setTimeout(function () { b.textContent = '📋 Copiar'; }, 2500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(nome).then(ok, function () { if (inp) { inp.focus(); inp.select(); } toast('Toque e segure no nome abaixo e escolha Copiar.'); });
      else if (inp) { inp.focus(); inp.select(); toast('Toque e segure no nome abaixo e escolha Copiar.'); }
    }; });
    if ($('det-recibos')) $('det-recibos').ontoggle = function () { UI.abrirRecibos = this.open; var sp = this.querySelector('summary span'); if (sp) sp.textContent = this.open ? 'fechar ▴' : 'ver ▾'; };
    if ($('det-lista')) $('det-lista').ontoggle = function () { UI.abrirLista = this.open; var sp = this.querySelector('summary span'); if (sp) sp.textContent = this.open ? 'fechar ▴' : 'ver ▾'; };
    if (UI.rev && $('rv-salvar')) ligarRevisao();
    // preços
    qsa('[data-loja]').forEach(function (b) { b.onclick = function () { if (precoEm(b.dataset.k, b.dataset.loja, catalogo())) escolherLoja(b.dataset.k, b.dataset.loja); else editarPreco(b.dataset.k, b.dataset.loja); }; });
    if ($('lista-baratos')) $('lista-baratos').onclick = function () {
      var m = {}, n = 0; listaDoMes().forEach(function (i) { if (i.min) { m['produtos/' + i.k + '/loja'] = i.min.loja; m['produtos/' + i.k + '/pt'] = i.pt; n++; } });
      if (!n) { toast('Ainda não há preços para comparar.'); return; }
      gravar(m).then(function () { toast(n + ' itens marcados no mercado mais barato'); irParaListaPorMercado(); });
    };
    qsa('[data-ver-lista]').forEach(function (b) { b.onclick = irParaListaPorMercado; });
    // saudável
    qsa('[data-off]').forEach(function (b) { b.onclick = function () { var k = b.dataset.off, q = qsa('[data-busca]').filter(function (x) { return x.dataset.busca === k; })[0].value.trim(); buscarOFF(k, q); }; });
    qsa('[data-escolher]').forEach(function (b) { b.onclick = function () { escolherOFF(b.dataset.escolher, +b.dataset.j); }; });
    qsa('[data-alt]').forEach(function (b) { b.onclick = function () { alternativas(b.dataset.alt); }; });
    // Nutri-Score e NOVA digitados à mão
    qsa('[data-ns],[data-nova]').forEach(function (sel) { sel.onchange = function () {
      var k = sel.dataset.ns || sel.dataset.nova, o = Object.assign({}, (M.produtos[k] || {}).off || {}), m = {};
      if (!o.nome) o.nome = (catalogo()[k] || {}).pt || k;
      if (sel.dataset.ns) o.ns = sel.value; else o.nova = sel.value ? +sel.value : null;
      m['produtos/' + k + '/off'] = o; m['produtos/' + k + '/pt'] = (catalogo()[k] || {}).pt || k;
      gravar(m).then(function () { toast('Nota salva'); });
    }; });
    qsa('[data-yuka]').forEach(function (inp) { inp.onchange = function () { var k = inp.dataset.yuka, v = inp.value === '' ? null : Math.max(0, Math.min(100, Math.round(+inp.value))), m = {}; m['produtos/' + k + '/yuka'] = v; m['produtos/' + k + '/pt'] = (catalogo()[k] || {}).pt || k; gravar(m).then(function () { toast('Nota Yuka salva'); }); }; });
    // gastos
    if ($('orc-salvar')) $('orc-salvar').onclick = function () { gravar({ 'ajustes/orcamento': +$('orc').value || 0 }).then(function () { toast('Orçamento salvo'); }); };
  }
  function lerTexto() {
    if (UI.aba !== 'recibo' || !$('r-erro')) return;
    var t = UI.texto || '';
    if (!t.trim()) { $('r-erro').textContent = 'Cole o texto do recibo primeiro.'; return; }
    var r = Leitor.ler(t);
    if (!r.itens.length) { mostrarCaixa('Não encontrei itens com preço no que foi copiado. Tire a foto de novo (recibo inteiro, bem iluminado) ou use “Digitar recibo à mão”.'); $('texto').value = t; return; }
    UI.rev = { loja: r.loja, data: r.data || hojeISO(), total: r.total, imposto: r.imposto, emparelhou: r.emparelhou, itens: r.itens.map(itemDoLeitor) };
    marcarHistorico(); desenhar(); window.scrollTo(0, 0);
  }
  // fecha o recibo aberto; se o usuário mexeu em algo de um recibo salvo, ou é um recibo novo, confirma antes
  function fecharRevisao(semPerguntar, doHistorico) {
    var r = UI.rev; if (!r) return true;
    if (!semPerguntar && (r._mudou || !r.id) && !window.confirm(r.id ? 'Sair sem salvar as mudanças deste recibo?' : 'Descartar este recibo sem salvar?')) return false;
    UI.rev = null; UI.texto = ''; desenhar(); window.scrollTo(0, 0);
    if (!doHistorico && history.state && history.state.mercado) { UI.ignorarPop = true; try { history.back(); } catch (e) {} }
    return true;
  }
  function ligarRevisao() {
    var r = UI.rev;
    qsa('[data-f]').forEach(function (inp) {
      inp.oninput = inp.onchange = function () { var it = r.itens[+inp.dataset.i], f = inp.dataset.f; it[f] = (f === 'qtd' || f === 'total') ? +inp.value : inp.value; if (f === 'qtd' || f === 'total') it.un = it.qtd ? Math.round(it.total / it.qtd * 100) / 100 : it.total; UI.rev._mudou = true; atualizarSoma();
        if (f === 'pt') { var d = Object.keys(M.dic).map(function (k) { return M.dic[k]; }).filter(function (x) { return x.pt === inp.value; })[0]; if (d) { it.cat = d.cat; var s = qsa('select[data-i="' + inp.dataset.i + '"]')[0]; if (s) s.value = d.cat; } } };
    });
    $('rv-loja').onchange = function () { r.loja = this.value; r._mudou = true; };
    $('rv-data').onchange = function () { r.data = this.value; r._mudou = true; };
    $('rv-total').oninput = $('rv-total').onchange = function () { r.total = this.value === '' ? null : +this.value; r._mudou = true; atualizarSoma(); };
    $('rv-imp').oninput = $('rv-imp').onchange = function () { r.imposto = +this.value || 0; r._mudou = true; atualizarSoma(); };
    qsa('[data-rm]').forEach(function (b) { b.onclick = function () { r.itens.splice(+b.dataset.rm, 1); r._mudou = true; desenhar(); }; });
    $('rv-mais').onclick = function () { r.itens.push({ raw: '', pt: '', cat: 'Mercearia', qtd: 1, un: 0, total: 0 }); r._mudou = true; desenhar(); setTimeout(function () { var l = qsa('input[data-f="pt"]').pop(); if (l) { l.scrollIntoView({ block: 'center' }); l.focus(); } }, 50); };
    $('rv-cancelar').onclick = $('rv-voltar').onclick = function () { fecharRevisao(); };
    if ($('rv-apagar')) $('rv-apagar').onclick = function () {
      var b = $('rv-apagar'); if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Toque de novo para apagar'; setTimeout(function () { b.dataset.ok = ''; b.textContent = 'Apagar este recibo'; }, 4000); return; }
      var m = {}; m['recibos/' + r.id] = null; gravar(m).then(function () { fecharRevisao(true); toast('Recibo apagado'); });
    };
    $('rv-salvar').onclick = function () {
      var itens = r.itens.filter(function (i) { return (i.pt || '').trim() && +i.total; }), fora = r.itens.length - itens.length;
      if (!itens.length) { $('rv-erro').textContent = 'Nenhum item com nome e valor.'; return; }
      if (fora && this.dataset.fora !== '1') { this.dataset.fora = '1'; $('rv-erro').textContent = fora + (fora > 1 ? ' itens sem nome ou sem valor não serão salvos.' : ' item sem nome ou sem valor não será salvo.') + ' Toque em Salvar de novo para continuar.'; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data || '')) { $('rv-erro').textContent = 'Confira a data.'; return; }
      var dp = duplicado(r, totalRev(r));
      if (dp && this.dataset.ok !== '1') { this.dataset.ok = '1'; this.textContent = 'Salvar mesmo assim'; $('rv-erro').innerHTML = avisoDup(dp) + ' Se for outra compra igual, toque em <b>Salvar mesmo assim</b>.'; return; }
      var id = r.id || (r.data + '-' + r.loja + '-' + Math.random().toString(36).slice(2, 7)), m = {};
      var soma = itens.reduce(function (s, i) { return s + i.total; }, 0);
      m['recibos/' + id] = { loja: r.loja, data: r.data, total: r.total == null ? Math.round((soma + (+r.imposto || 0)) * 100) / 100 : +r.total, imposto: +r.imposto || 0, criado: r.criado || Date.now(),
        itens: itens.map(function (i) { return { raw: String(i.raw || '').slice(0, 80), pt: i.pt.trim().slice(0, 80), cat: i.cat, qtd: +i.qtd || 1, un: Math.round((+i.total / (+i.qtd || 1)) * 100) / 100, total: Math.round(+i.total * 100) / 100 }; }) };
      itens.forEach(function (i) {
        if (i.raw) m['dic/' + chave(i.raw)] = { pt: i.pt.trim().slice(0, 80), cat: i.cat };
        var k = chave(i.pt); if (!M.produtos[k] || !M.produtos[k].en) { m['produtos/' + k + '/pt'] = i.pt.trim().slice(0, 80); m['produtos/' + k + '/cat'] = i.cat; if (i.raw) m['produtos/' + k + '/en'] = Leitor.expandir(i.raw).toLowerCase(); }
      });
      $('rv-salvar').disabled = true;
      gravar(m).then(function () { fecharRevisao(true); toast('Recibo salvo'); }, function () { $('rv-salvar').disabled = false; });
    };
  }
  function editarQtd(k) {
    var c = catalogo()[k], i = listaDoMes().filter(function (x) { return x.k === k; })[0]; if (!c || !i) return;
    var auto = !(+((M.produtos[k] || {}).qtd) > 0);
    abrirFolha('<h3>' + esc(c.pt) + '</h3><p class="nota">' + (auto ? 'A quantidade vem da sua média por mês.' : 'Quantidade definida por você.') + '</p><label class="lb" for="f-qtd">Quantidade no mês</label><input class="in" id="f-qtd" type="number" min="0.1" step="0.1" inputmode="decimal" value="' + esc(i.qtd) + '">' +
      '<label class="lb" for="f-loja">Onde comprar</label><select class="in" id="f-loja"><option value="">Mais barato</option>' + LOJAS.map(function (l) { return '<option value="' + l.id + '"' + (l.id === i.loja ? ' selected' : '') + '>' + esc(l.n) + '</option>'; }).join('') + '</select>' +
      '<div class="grupo-btn" style="margin-top:12px"><button class="btn pri" id="f-ok" style="flex:1">Salvar</button>' + (auto ? '' : '<button class="btn" id="f-auto">Usar a média</button>') + '<button class="btn" id="f-fechar">Cancelar</button></div>' +
      '<div style="text-align:center;margin-top:16px"><button class="btn" id="f-tirar" style="color:#b91c1c;border-color:#fecaca">Tirar da lista</button></div>');
    $('f-fechar').onclick = function () { fecharFolha(); };
    $('f-tirar').onclick = function () { var b = this; if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Toque de novo para tirar'; return; } var m = {}; m['produtos/' + k + '/fixo'] = false; m['produtos/' + k + '/pt'] = c.pt; gravar(m).then(function () { fecharFolha(); toast('Tirado da lista.'); }); };
    var salva = function (v) { var m = {}; m['produtos/' + k + '/qtd'] = v; m['produtos/' + k + '/loja'] = $('f-loja').value || null; m['produtos/' + k + '/pt'] = c.pt; gravar(m).then(fecharFolha); };
    $('f-ok').onclick = function () { var v = +$('f-qtd').value; salva(v > 0 ? Math.round(v * 10) / 10 : null); };
    if ($('f-auto')) $('f-auto').onclick = function () { salva(null); };
  }
  // ── família: o dono libera outras contas pelo código delas ──
  function cartaoFamilia() {
    if (!ehDono) return '<div class="card"><h2>Mercado compartilhado</h2><p class="nota" style="margin:0">Você está usando o Mercado da casa, liberado pelo administrador. Tudo o que você incluir, marcar ou salvar aparece para ele também.</p></div>';
    var ms = M.membros || {}, ids = Object.keys(ms);
    return '<div class="card"><h2>Compartilhar com a família' + ajuda('familia') + '</h2><p class="nota">Quem você liberar vê e mexe em tudo do Mercado: lista, preços, recibos e gastos. Para liberar, a pessoa abre <b>minhacasaapp.com/mercado</b>, entra com o e-mail e a senha dela do MinhaCasa e te manda o código que aparece.</p>' +
      (ids.length ? ids.map(function (id) { return '<div class="linha"><div class="info"><div class="t">' + esc(ms[id].nome || 'Sem nome') + '</div><div class="s mono">' + esc(id.slice(0, 10)) + '…</div></div><button class="btn sm" data-mbrm="' + esc(id) + '">Remover</button></div>'; }).join('') : '') +
      '<label class="lb" for="mb-nome">Nome</label><input class="in" id="mb-nome" placeholder="Ex.: Esposa">' +
      '<label class="lb" for="mb-cod">Código que a pessoa te mandou</label><input class="in mono" id="mb-cod" autocapitalize="off" autocomplete="off" spellcheck="false">' +
      '<div class="grupo-btn" style="margin-top:10px"><button class="btn pri" id="mb-add">Liberar acesso</button></div><div class="erro" id="mb-erro"></div></div>';
  }
  function raiz(m) { return F.update(F.ref(DB), m).catch(function (e) { toast('Não salvou: ' + erroTxt(e)); throw e; }); }
  function adicionarMembro() {
    var cod = ($('mb-cod').value.match(/[A-Za-z0-9]{20,40}/) || [''])[0], nome = $('mb-nome').value.trim().slice(0, 40) || 'Família';
    if (!cod) { $('mb-erro').textContent = 'Cole o código completo (são umas 28 letras e números).'; return; }
    if (cod === U.uid) { $('mb-erro').textContent = 'Esse é o seu próprio código.'; return; }
    var m = {}; m['mercadoMembros/' + dono + '/' + cod] = true; m['mercadoDe/' + cod] = dono; m[base + '/membros/' + cod] = { nome: nome, desde: hojeISO() };
    raiz(m).then(function () { toast('Acesso liberado para ' + nome); });
  }
  function removerMembro(cod) {
    var m = {}; m['mercadoMembros/' + dono + '/' + cod] = null; m['mercadoDe/' + cod] = null; m[base + '/membros/' + cod] = null;
    raiz(m).then(function () { toast('Acesso removido'); });
  }
  function abrirDic() {
    var ks = Object.keys(M.dic).sort(function (a, b) { return M.dic[a].pt.localeCompare(M.dic[b].pt); });
    abrirFolha('<h3>Nomes aprendidos</h3><p class="nota">Código do recibo → seu nome. Apague um para o app perguntar de novo.</p>' + ks.map(function (k) { return '<div class="linha"><div class="info"><div class="t" style="font-size:14px">' + esc(M.dic[k].pt) + '</div><div class="s mono">' + esc(k.replace(/-/g, ' ').toUpperCase()) + ' · ' + esc(M.dic[k].cat) + '</div></div><button class="btn sm" data-dicrm="' + esc(k) + '">Apagar</button></div>'; }).join('') + '<button class="btn cheio" id="f-fechar" style="margin-top:12px">Fechar</button>');
    $('f-fechar').onclick = function () { fecharFolha(); };
    qsa('[data-dicrm]').forEach(function (b) { b.onclick = function () { if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Confirmar'; return; } var m = {}; m['dic/' + b.dataset.dicrm] = null; gravar(m).then(function () { b.closest('.linha').remove(); }); }; });
  }
  function irParaListaPorMercado() { UI.agrupar = 'loja'; UI.abrirLista = true; qsa('#abas button').forEach(function (x) { if (x.dataset.aba === 'lista') x.click(); }); setTimeout(function () { if ($('det-lista')) $('det-lista').scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 80); }
  // tocar num mercado que já tem preço: escolher comprar ali, ou mudar o preço
  function escolherLoja(k, loja) {
    var c = catalogo()[k], p = precoEm(k, loja, catalogo()), atual = (M.produtos[k] || {}).loja === loja;
    abrirFolha('<h3>' + esc(c.pt) + '</h3><p class="nota">' + esc(LN[loja]) + ' · ' + din(p.p) + '</p>' +
      '<button class="btn pri cheio" id="f-aqui" style="min-height:52px">' + (atual ? '✓ Já está na lista para comprar aqui' : '🛒 Comprar este item na ' + esc(LN[loja])) + '</button>' +
      (atual ? '<button class="btn cheio" id="f-tirar-loja" style="margin-top:8px">Não escolher mercado (usar o mais barato)</button>' : '') +
      '<button class="btn cheio" id="f-preco-edit" style="margin-top:8px">Anotar outro preço</button>' +
      '<button class="btn cheio" id="f-fechar" style="margin-top:8px">Cancelar</button>');
    var grava = function (v, msg) { var m = {}; m['produtos/' + k + '/loja'] = v; m['produtos/' + k + '/pt'] = c.pt; gravar(m).then(function () { fecharFolha(); toast(msg); }); };
    $('f-aqui').onclick = function () { if (atual) { fecharFolha(); return; } grava(loja, 'Vai para a lista na ' + LN[loja]); };
    if ($('f-tirar-loja')) $('f-tirar-loja').onclick = function () { grava(null, 'Mercado desmarcado'); };
    $('f-preco-edit').onclick = function () { fecharFolha(true); editarPreco(k, loja); };
  }
  function editarPreco(k, loja) {
    var c = catalogo()[k]; if (!c) return;
    var p = M.produtos[k] || {}, atual = p.precos && p.precos[loja], l = LOJAS.filter(function (x) { return x.id === loja; })[0];
    var termo = encodeURIComponent((p.en || c.pt).slice(0, 60));
    abrirFolha('<h3>' + esc(c.pt) + '</h3><p class="nota">' + esc(l.l) + '</p>' +
      '<label class="lb" for="f-preco">Preço (CAD), mesma embalagem</label><input class="in" id="f-preco" type="number" step="0.01" min="0" inputmode="decimal" value="' + esc(atual ? dec2(atual.p) : '') + '">' +
      '<label class="lb" for="f-fonte">De onde</label><select class="in" id="f-fonte">' + ['folheto', 'Flipp', 'site', 'prateleira'].map(function (f) { return '<option' + (atual && atual.fonte === f ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select>' +
      (l.busca ? '<p class="nota" style="margin-top:10px"><a href="' + l.busca + termo + '" target="_blank" rel="noopener">Procurar no site da ' + esc(l.n) + '</a></p>' : '') +
      '<div class="grupo-btn" style="margin-top:12px"><button class="btn pri" id="f-ok" style="flex:1">Salvar</button>' + (atual ? '<button class="btn" id="f-apagar">Apagar</button>' : '') + '<button class="btn" id="f-fechar">Cancelar</button></div>');
    setTimeout(function () { if ($('f-preco')) $('f-preco').focus(); }, 60);
    $('f-fechar').onclick = function () { fecharFolha(); };
    var salva = function (v) { var m = {}; m['produtos/' + k + '/precos/' + loja] = v; m['produtos/' + k + '/pt'] = c.pt; gravar(m).then(function () { fecharFolha(); toast('Preço salvo'); }); };
    $('f-ok').onclick = function () { var v = parseFloat($('f-preco').value); if (!(v > 0)) { fecharFolha(); return; } salva({ p: Math.round(v * 100) / 100, data: hojeISO(), fonte: $('f-fonte').value }); };
    if ($('f-apagar')) $('f-apagar').onclick = function () { salva(null); };
  }
  // ── Open Food Facts (gratuito; até 10 buscas por minuto) ──
  var OFF = 'https://world.openfoodfacts.org';
  var CAMPOS = 'code,product_name,brands,quantity,nutriscore_grade,nova_group,categories_tags';
  // pedido com limite de tempo (o Open Food Facts às vezes não responde e o botão parecia "não fazer nada")
  function pedirOFF(url, ms) {
    var ctl = window.AbortController ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 12000) : null;
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(t); if (r.status === 429) throw { code: 'limite' }; if (!r.ok) throw { code: 'http' }; return r.json(); }, function (e) { clearTimeout(t); throw e; });
  }
  var BUSCA_NOVA = 'https://search.openfoodfacts.org/search';
  function buscaTexto(q) {
    // 1º a busca nova do Open Food Facts (Search-a-licious); se falhar, a antiga
    var url = function (txt) { return BUSCA_NOVA + '?q=' + encodeURIComponent(txt) + '&page_size=6&fields=' + CAMPOS; };
    return pedirOFF(url(q + ' countries_tags:"en:canada"'), 10000).then(function (d) {
      var l = (d && (d.hits || d.products)) || []; if (l.length) return l;
      return pedirOFF(url(q), 10000).then(function (d2) { return (d2 && (d2.hits || d2.products)) || []; });
    }).catch(function () {
      return pedirOFF(OFF + '/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=6&tagtype_0=countries&tag_contains_0=contains&tag_0=canada&fields=' + CAMPOS, 15000).then(function (d) { return (d && d.products) || []; });
    });
  }
  function linkSiteOFF(q) { return OFF + '/cgi/search.pl?search_terms=' + encodeURIComponent(q || '') + '&search_simple=1&action=process'; }
  function falhaOFF(k, e) { UI.off[k] = Object.assign(UI.off[k] || {}, { lista: null, msg: e && e.code === 'limite' ? 'O Open Food Facts limita a 10 buscas por minuto. Espere um pouco e tente de novo.' : 'O Open Food Facts não respondeu agora (ele é gratuito e às vezes fica lento). Tente de novo em 1 minuto, ou procure direto no site dele.', site: linkSiteOFF((UI.off[k] || {}).q) }); desenhar(); }
  function buscarOFF(k, q) {
    if (!q) return;
    UI.off[k] = { q: q, msg: '⏳ Buscando no Open Food Facts… pode levar alguns segundos.' }; desenhar();
    buscaTexto(q).then(function (l) {
      UI.off[k] = l.length ? { q: q, lista: l.slice(0, 6) } : { q: q, msg: 'Não achei “' + q + '” no Open Food Facts. Tente outro nome, em inglês, com a marca (ex.: “Nature Valley granola bar”).', site: linkSiteOFF(q) };
      desenhar();
    }, function (e) { falhaOFF(k, e); });
  }
  function escolherOFF(k, j) {
    var x = UI.off[k] && UI.off[k].lista && UI.off[k].lista[j]; if (!x) return;
    var tags = x.categories_tags || [], m = {};
    m['produtos/' + k + '/off'] = { code: String(x.code || ''), nome: String(x.product_name || '').slice(0, 80), marca: String(x.brands || '').slice(0, 60), ns: String(x.nutriscore_grade || '').slice(0, 1), nova: x.nova_group || null, cat: String(tags[tags.length - 1] || '').slice(0, 80) };
    m['produtos/' + k + '/pt'] = (catalogo()[k] || {}).pt || k;
    gravar(m).then(function () { UI.off[k] = null; desenhar(); });
  }
  function alternativas(k) {
    var o = (M.produtos[k] || {}).off; if (!o || !o.cat) return;
    var atual = 'abcde'.indexOf(o.ns || 'e'); if (atual < 0) atual = 4;
    var notas = 'abcde'.slice(0, Math.max(1, atual)).split('').join('|') || 'a';
    UI.off[k] = { msg: 'Procurando opções melhores…' }; desenhar();
    pedirOFF(OFF + '/api/v2/search?categories_tags=' + encodeURIComponent(o.cat) + '&countries_tags_en=canada&nutrition_grades_tags=' + encodeURIComponent(notas) + '&sort_by=popularity_key&page_size=8&fields=' + CAMPOS)
      .then(function (d) {
        var alts = (d.products || []).filter(function (x) { return x.product_name && String(x.code) !== o.code; }).slice(0, 4).map(function (x) { return { code: String(x.code || ''), nome: String(x.product_name).slice(0, 80), marca: String(x.brands || '').slice(0, 60), qtd: String(x.quantity || '').slice(0, 30), ns: String(x.nutriscore_grade || '').slice(0, 1), nova: x.nova_group || null }; });
        if (!alts.length) { UI.off[k] = { msg: atual === 0 ? 'Este já é Nutri-Score A. Boa escolha!' : 'Não achei opções melhores nesta categoria vendidas no Canadá.' }; desenhar(); return; }
        var m = {}; m['produtos/' + k + '/alts'] = alts; gravar(m).then(function () { UI.off[k] = null; desenhar(); });
      }, function (e) { falhaOFF(k, e); });
  }
};
