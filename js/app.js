/**
 * MOZ1VENDAS - Frontend
 * Comunica com GAS proxy. Regras de negocio estao no Google Sheets.
 */

var CONFIG = {
  // SUBSTITUA PELA URL DO SEU WEB APP
  API_URL: 'https://script.google.com/macros/s/AKfycbxIhiGNTxlvo-EOUsx_sNAy2y2jzYQmnxQ7OebswTg0Czc5_gzCN0JDFwvseH8yjT0u/exec',
  APP_NAME: 'MOZ1VENDAS'
};

var state = {
  token: localStorage.getItem('mz1_token') || null,
  vendedor: JSON.parse(localStorage.getItem('mz1_vendedor') || 'null'),
  produtos: [],
  produtoAtual: null,
  currentPage: 'home'
};

function $(sel){ return document.querySelector(sel); }
function $$(sel){ return document.querySelectorAll(sel); }

function fmtMoney(v){ return (parseFloat(v)||0).toLocaleString('pt-MZ') + ' MT'; }
function fmtDate(s){ if(!s) return '-'; return new Date(s).toLocaleDateString('pt-MZ'); }
function esc(t){ if(!t) return ''; var d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

function toast(msg, type){
  type = type || 'success';
  var c = document.getElementById('toastContainer');
  if(!c){ c=document.createElement('div'); c.id='toastContainer'; c.className='toast-container'; document.body.appendChild(c); }
  var t=document.createElement('div'); t.className='toast ' + type; t.textContent=msg; c.appendChild(t);
  setTimeout(function(){ t.remove(); }, 4000);
}

/* ---------- API ---------- */
function apiGet(action, params){
  params = params || {};
  var url = CONFIG.API_URL + '?action=' + encodeURIComponent(action);
  for(var k in params){ if(params[k] != null) url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }
  return fetch(url, {method:'GET', mode:'cors', cache:'no-cache'}).then(function(r){
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }).then(function(txt){
    if(!txt || txt.trim()==='') throw new Error('Resposta vazia');
    if(txt.trim().charAt(0)==='<') throw new Error('Servidor retornou HTML. Verifique a URL do Web App.');
    return JSON.parse(txt);
  });
}

function apiPost(action, data){
  data = data || {};
  return fetch(CONFIG.API_URL, {
    method:'POST', mode:'cors', cache:'no-cache',
    headers: {'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({action: action, ...data})
  }).then(function(r){
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }).then(function(txt){
    if(!txt || txt.trim()==='') throw new Error('Resposta vazia');
    if(txt.trim().charAt(0)==='<') throw new Error('Servidor retornou HTML. Verifique a URL do Web App.');
    return JSON.parse(txt);
  });
}

/* ---------- ROUTER ---------- */
function navigate(page, params){
  params = params || {};
  state.currentPage = page;
  window.scrollTo(0,0);
  $$('.page').forEach(function(p){ p.classList.add('hidden'); });
  updateHeader();
  switch(page){
    case 'home': renderHome(); break;
    case 'produtos': renderProdutos(params); break;
    case 'produto': renderProduto(params.id); break;
    case 'login': renderLogin(); break;
    case 'registo': renderRegisto(); break;
    case 'dashboard': renderDashboard(); break;
    case 'meusProdutos': renderMeusProdutos(); break;
    case 'adicionarProduto': renderAdicionarProduto(); break;
    case 'editarProduto': renderEditarProduto(params.id); break;
    case 'minhasVendas': renderMinhasVendas(); break;
    case 'carteira': renderCarteira(); break;
    case 'plano': renderPlano(); break;
    case 'vender': renderVender(); break;
    default: renderHome();
  }
}

function updateHeader(){
  var h = document.getElementById('appHeader');
  if(!h) return;
  var logged = !!state.token;
  h.innerHTML = '<div class="header-inner">' +
    '<div class="logo" onclick="navigate(\'home\')"><div class="logo-icon">🛒</div><span>' + CONFIG.APP_NAME + '</span></div>' +
    '<nav class="nav-links">' +
      '<a onclick="navigate(\'home\')">Início</a>' +
      '<a onclick="navigate(\'produtos\')">Produtos</a>' +
      '<a onclick="navigate(\'vender\')">Vender</a>' +
      (logged ?
        '<a onclick="navigate(\'dashboard\')">Painel</a>' +
        '<a onclick="logout()">Sair</a>' :
        '<a onclick="navigate(\'login\')">Entrar</a>') +
    '</nav>' +
    '<button class="mobile-menu-btn" onclick="alert(\'Menu mobile\')">☰</button>' +
  '</div>';
}

/* ---------- HOME ---------- */
function renderHome(){
  var p = document.getElementById('pageHome');
  p.classList.remove('hidden');
  p.innerHTML =
    '<div class="hero"><h1>Compre e Venda em Moçambique</h1><p>O marketplace mais simples e seguro.</p>' +
    '<button class="btn btn-dourado" onclick="navigate(\'produtos\')">Explorar Produtos</button></div>' +
    '<div class="search-container"><div class="search-box">' +
      '<input type="text" id="searchInput" placeholder="Pesquisar produtos..." onkeypress="if(event.key===\'Enter\')searchProducts()">' +
      '<button class="btn btn-verde" onclick="searchProducts()">🔍 Pesquisar</button></div></div>' +
    '<div class="categories"><h2>📂 Categorias</h2><div class="cat-grid">' +
      '<div class="cat-card" onclick="filterByCategory(\'FISICO\')"><div class="icon">📦</div><span>Produtos Físicos</span></div>' +
      '<div class="cat-card" onclick="filterByCategory(\'DIGITAL\')"><div class="icon">💾</div><span>Produtos Digitais</span></div>' +
      '<div class="cat-card" onclick="navigate(\'produtos\')"><div class="icon">🔥</div><span>Mais Vendidos</span></div>' +
      '<div class="cat-card" onclick="navigate(\'produtos\')"><div class="icon">⭐</div><span>Novidades</span></div>' +
    '</div></div>' +
    '<div class="products-section"><h2>🛍️ Produtos em Destaque</h2><div id="homeProducts" class="products-grid"></div></div>';
  loadHomeProducts();
}

function loadHomeProducts(){
  var c = document.getElementById('homeProducts');
  if(!c) return;
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  apiGet('produtos').then(function(res){
    state.produtos = res.produtos || [];
    renderGrid(c, state.produtos.slice(0,8));
  }).catch(function(e){
    c.innerHTML = erroHtml(e.message, 'loadHomeProducts');
  });
}

function renderGrid(container, items){
  if(!items || items.length===0){
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📭</div><p>Nenhum produto</p></div>';
    return;
  }
  container.innerHTML = items.map(function(p){
    return '<div class="product-card" onclick="navigate(\'produto\',{id:\'' + esc(p.produtoId) + '\'})">' +
      '<div class="product-img">' + (p.imagemUrl ? '<img src="' + esc(p.imagemUrl) + '" alt="' + esc(p.nome) + '" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'🛒\'">' : '🛒') + '</div>' +
      '<div class="product-info">' +
        '<span class="product-type ' + (p.tipo==='DIGITAL'?'type-digital':'type-fisico') + '">' + esc(p.tipo) + '</span>' +
        '<h3>' + esc(p.nome) + '</h3>' +
        '<p class="desc">' + esc(p.descricao) + '</p>' +
        '<div class="product-meta"><span class="product-price">' + fmtMoney(p.preco) + '</span><span class="product-brand">' + esc(p.marca) + '</span></div>' +
        '<button class="btn btn-verde btn-sm btn-block">Ver Produto</button>' +
      '</div></div>';
  }).join('');
}

function erroHtml(msg, retryFn){
  return '<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📡</div>' +
    '<p><strong>Erro de conexão</strong></p><p style="font-size:0.85rem;color:#999;">' + esc(msg) + '</p>' +
    '<button class="btn btn-verde" style="margin-top:12px;" onclick="' + retryFn + '()">Tentar novamente</button></div>';
}

function renderProdutos(params){
  params = params || {};
  var p = document.getElementById('pageProdutos');
  p.classList.remove('hidden');
  p.innerHTML = '<div style="padding:32px 24px;max-width:1400px;margin:0 auto;">' +
    '<div class="search-container" style="margin:0 0 32px 0;"><div class="search-box">' +
      '<input type="text" id="prodSearchInput" placeholder="Pesquisar..." value="' + esc(params.search||'') + '" onkeypress="if(event.key===\'Enter\')searchProductsPage()">' +
      '<button class="btn btn-verde" onclick="searchProductsPage()">🔍</button></div></div>' +
    '<h2 style="margin-bottom:24px;color:var(--verde-escuro);">🛍️ Produtos</h2>' +
    '<div id="allProducts" class="products-grid"></div></div>';
  loadAllProducts(params.search, params.categoria);
}

function loadAllProducts(search, categoria){
  var c = document.getElementById('allProducts');
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  apiGet('produtos', {search: search, categoria: categoria}).then(function(res){
    state.produtos = res.produtos || [];
    renderGrid(c, state.produtos);
  }).catch(function(e){
    c.innerHTML = erroHtml(e.message, 'loadAllProducts');
  });
}

function searchProducts(){ var q=$('#searchInput').value.trim(); if(q) navigate('produtos',{search:q}); }
function searchProductsPage(){ loadAllProducts($('#prodSearchInput').value.trim()); }
function filterByCategory(cat){ navigate('produtos',{categoria:cat}); }

function renderProduto(id){
  var p = document.getElementById('pageProduto');
  p.classList.remove('hidden');
  p.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  apiGet('produto', {id:id}).then(function(res){
    if(!res.ok){ p.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>Produto não encontrado</p></div>'; return; }
    var prod = res.produto;
    state.produtoAtual = prod;
    var isNetshop = prod.metodoPagamento === 'NETSHOP';
    var payBox = isNetshop ?
      '<div class="payment-box"><h3>💳 Pagamento Online</h3>' +
      '<p style="color:var(--cinza);margin-bottom:16px;">Pague via Netshop</p>' +
      '<div class="form-group"><label>Seu telefone</label><input type="tel" id="buyerPhone" value="+258"></div>' +
      '<div class="form-group"><label>Método</label><select id="paymentMethod"><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="mkesh">mKesh</option><option value="card">Cartão</option></select></div>' +
      '<button class="netshop-btn" onclick="buyNetshop()">💳 COMPRAR — ' + fmtMoney(prod.preco) + '</button></div>' :
      '<div class="payment-box"><h3>📱 WhatsApp</h3><p style="color:var(--cinza);margin-bottom:16px;">Negocie com o vendedor</p>' +
      '<a href="https://wa.me/' + esc(prod.whatsapp) + '?text=' + encodeURIComponent('Olá, quero comprar ' + prod.produtoId + ' — ' + prod.nome + ' por ' + fmtMoney(prod.preco)) + '" target="_blank" class="whatsapp-btn">📱 COMPRAR PELO WHATSAPP</a></div>';

    p.innerHTML = '<div class="product-detail"><div class="detail-grid">' +
      '<div class="detail-img">' + (prod.imagemUrl?'<img src="'+esc(prod.imagemUrl)+'" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'🛒\'">':'🛒') + '</div>' +
      '<div class="detail-info">' +
        '<span class="product-type '+(prod.tipo==='DIGITAL'?'type-digital':'type-fisico')+'">'+esc(prod.tipo)+'</span>' +
        '<h1>'+esc(prod.nome)+'</h1><p class="brand">🏪 '+esc(prod.marca)+'</p>' +
        '<div class="price">'+fmtMoney(prod.preco)+'</div>' +
        '<p class="desc">'+esc(prod.descricao)+'</p>' +
        '<p style="color:var(--cinza);margin-bottom:16px;"><strong>Ref:</strong> '+esc(prod.produtoId)+'<br><strong>Método:</strong> '+(isNetshop?'Online':'WhatsApp')+'</p>' +
        payBox + '</div></div></div>';
  }).catch(function(e){
    p.innerHTML = '<div class="empty-state"><div class="icon">📡</div><p><strong>Erro</strong></p><p style="font-size:0.85rem;color:#999;">'+esc(e.message)+'</p><button class="btn btn-verde" onclick="renderProduto(\''+esc(id)+'\')">Tentar</button></div>';
  });
}

function buyNetshop(){
  var p = state.produtoAtual;
  var phone = document.getElementById('buyerPhone').value.trim();
  var method = document.getElementById('paymentMethod').value;
  if(!phone || phone.length<9){ toast('Telefone inválido','error'); return; }
  toast('Iniciando pagamento...');
  apiPost('criarPagamento', {produtoId:p.produtoId, clienteTelefone:phone, metodo:method}).then(function(res){
    if(res.ok && res.checkoutUrl){ window.open(res.checkoutUrl,'_blank'); toast('Redirecionado para pagamento'); }
    else if(res.ok){ toast('Pagamento iniciado'); }
    else { toast(res.erro || 'Erro','error'); }
  }).catch(function(e){ toast('Erro: '+e.message,'error'); });
}

/* ---------- AUTH ---------- */
function renderLogin(){
  var p = document.getElementById('pageLogin');
  p.classList.remove('hidden');
  p.innerHTML = '<div class="form-container"><h2>🔐 Entrar</h2><p class="subtitle">Acesse o painel de vendedor</p>' +
    '<form onsubmit="event.preventDefault();doLogin();"><div class="form-group"><label>Nome ou Telefone</label><input type="text" id="loginIdentificador" required></div>' +
    '<div class="form-group"><label>PIN</label><input type="password" id="loginPin" required maxlength="6"></div>' +
    '<button type="submit" class="btn btn-verde btn-block" style="margin-bottom:16px;">ENTRAR</button>' +
    '<p style="text-align:center;color:var(--cinza);">Não tem conta? <a href="#" onclick="navigate(\'registo\')" style="color:var(--verde);font-weight:600;">Registe-se</a></p></form></div>';
}

function doLogin(){
  var id = document.getElementById('loginIdentificador').value.trim();
  var pin = document.getElementById('loginPin').value;
  apiPost('loginVendedor', {identificador:id, pin:pin}).then(function(res){
    if(res.ok){
      state.token = res.token;
      state.vendedor = res.vendedor;
      localStorage.setItem('mz1_token', res.token);
      localStorage.setItem('mz1_vendedor', JSON.stringify(res.vendedor));
      toast('Bem-vindo, ' + res.vendedor.empresa + '!');
      navigate('dashboard');
    } else {
      toast(res.erro || 'Erro no login', 'error');
    }
  }).catch(function(e){ toast('Erro: '+e.message, 'error'); });
}

function renderRegisto(){
  var p = document.getElementById('pageRegisto');
  p.classList.remove('hidden');
  p.innerHTML = '<div class="form-container"><h2>📝 Tornar-se Vendedor</h2><p class="subtitle">Comece a vender</p>' +
    '<form onsubmit="event.preventDefault();doRegisto();">' +
    '<div class="form-group"><label>Nome Completo</label><input type="text" id="regNome" required></div>' +
    '<div class="form-group"><label>Telefone</label><input type="tel" id="regTelefone" placeholder="+25884..." required></div>' +
    '<div class="form-group"><label>BI</label><input type="text" id="regBi" required></div>' +
    '<div class="form-group"><label>Marca/Empresa</label><input type="text" id="regEmpresa" required></div>' +
    '<div class="form-group"><label>PIN (4-6 dígitos)</label><input type="password" id="regPin" required minlength="4" maxlength="6"></div>' +
    '<div class="form-group"><label>Plano</label><select id="regPlano"><option value="SIMPLES">Simples — 50 MT/mês (3 produtos)</option><option value="MEDIO">Médio — 200 MT/mês (10 produtos)</option><option value="PRO">Pro — 1.000 MT/mês (Ilimitado)</option></select></div>' +
    '<button type="submit" class="btn btn-dourado btn-block" style="margin-bottom:16px;">REGISTAR-SE</button>' +
    '<p style="text-align:center;color:var(--cinza);">Já tem conta? <a href="#" onclick="navigate(\'login\')" style="color:var(--verde);font-weight:600;">Entrar</a></p></form></div>';
}

function doRegisto(){
  var data = {
    nome: document.getElementById('regNome').value.trim(),
    telefone: document.getElementById('regTelefone').value.trim(),
    bi: document.getElementById('regBi').value.trim(),
    empresa: document.getElementById('regEmpresa').value.trim(),
    pin: document.getElementById('regPin').value,
    plano: document.getElementById('regPlano').value
  };
  apiPost('registarVendedor', data).then(function(res){
    if(res.ok){
      if(res.status === 'PENDENTE_PAGAMENTO'){
        toast('Registado! Efetue o pagamento do plano para ativar.');
      } else {
        toast('Registado! Faça login.');
      }
      navigate('login');
    } else {
      toast(res.erro || 'Erro no registo', 'error');
    }
  }).catch(function(e){ toast('Erro: '+e.message, 'error'); });
}

function logout(){
  if(state.token){ apiPost('logout',{token:state.token}).catch(function(){}); }
  state.token = null; state.vendedor = null;
  localStorage.removeItem('mz1_token'); localStorage.removeItem('mz1_vendedor');
  toast('Sessão terminada'); navigate('home');
}

/* ---------- DASHBOARD ---------- */
function renderDashboard(){
  if(!checkAuth()) return;
  var p = document.getElementById('pageDashboard');
  p.classList.remove('hidden');
  p.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  apiGet('dashboard', {token:state.token}).then(function(res){
    if(!res.ok){ toast('Sessão expirada','error'); logout(); return; }
    var d = res.dashboard;
    var statusClass = d.status==='ATIVO'?'status-ativo':'status-desativado';
    var statusText = d.status==='ATIVO'?'🟢 ATIVO':'🔴 DESATIVADO';
    p.innerHTML = '<div class="dashboard">' +
      '<div class="dashboard-header"><div><h1>👋 Bem-vindo, '+esc(d.empresa)+'</h1><p style="opacity:0.9;margin-top:4px;">'+esc(d.vendedorId)+'</p></div>' +
      '<div class="status"><span class="status-dot '+statusClass+'"></span><span>'+statusText+'</span></div></div>' +
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="label">Produtos</div><div class="value">'+d.produtosPublicados+' / '+esc(String(d.limiteProdutos))+'</div></div>' +
        '<div class="stat-card dourado"><div class="label">Vendas</div><div class="value">'+d.totalVendas+'</div></div>' +
        '<div class="stat-card"><div class="label">Vendido</div><div class="value">'+fmtMoney(d.totalVendido)+'</div></div>' +
        '<div class="stat-card vermelho"><div class="label">Taxas</div><div class="value">'+fmtMoney(d.totalTaxas)+'</div></div>' +
        '<div class="stat-card dourado"><div class="label">Líquido</div><div class="value">'+fmtMoney(d.totalLiquido)+'</div></div>' +
        '<div class="stat-card"><div class="label">Saldo</div><div class="value">'+fmtMoney(d.saldoDisponivel)+'</div></div>' +
        '<div class="stat-card"><div class="label">Plano</div><div class="value">'+esc(d.plano)+'</div></div>' +
        '<div class="stat-card"><div class="label">Expira</div><div class="value">'+fmtDate(d.expira)+'</div></div>' +
      '</div>' +
      (d.status!=='ATIVO'?'<div style="background:#fef3c7;border-radius:16px;padding:24px;text-align:center;margin-bottom:32px;"><p style="color:#92400e;font-weight:600;margin-bottom:12px;">⚠️ Conta desativada. Renove o plano.</p><button class="btn btn-dourado" onclick="navigate(\'plano\')">Renovar</button></div>':'') +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;">' +
        '<div class="table-container" style="cursor:pointer;" onclick="navigate(\'meusProdutos\')"><h2>📦 Meus Produtos</h2><p style="color:var(--cinza);">Gerencie produtos</p><button class="btn btn-verde" style="margin-top:16px;">Ver</button></div>' +
        '<div class="table-container" style="cursor:pointer;" onclick="navigate(\'minhasVendas\')"><h2>📊 Vendas</h2><p style="color:var(--cinza);">Histórico</p><button class="btn btn-verde" style="margin-top:16px;">Ver</button></div>' +
        '<div class="table-container" style="cursor:pointer;" onclick="navigate(\'carteira\')"><h2>💰 Carteira</h2><p style="color:var(--cinza);">Saldo</p><button class="btn btn-verde" style="margin-top:16px;">Ver</button></div>' +
      '</div></div>';
  }).catch(function(e){ p.innerHTML = '<div class="empty-state"><div class="icon">📡</div><p><strong>Erro</strong></p><p style="font-size:0.85rem;color:#999;">'+esc(e.message)+'</p><button class="btn btn-verde" onclick="renderDashboard()">Tentar</button></div>'; });
}

/* ---------- MEUS PRODUTOS ---------- */
function renderMeusProdutos(){
  if(!checkAuth()) return;
  var p = document.getElementById('pageMeusProdutos');
  p.classList.remove('hidden');
  p.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  apiGet('meusProdutos', {token:state.token}).then(function(res){
    var produtos = res.produtos || [];
    p.innerHTML = '<div class="dashboard"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">' +
      '<h2 style="color:var(--verde-escuro);">📦 Meus Produtos</h2><button class="btn btn-dourado" onclick="navigate(\'adicionarProduto\')">+ Adicionar</button></div>' +
      '<div class="table-container"><table><thead><tr><th>Produto</th><th>Preço</th><th>Tipo</th><th>Método</th><th>Status</th><th>Ações</th></tr></thead><tbody>' +
      (produtos.length===0?'<tr><td colspan="6" style="text-align:center;">Nenhum produto</td></tr>':
        produtos.map(function(p){
          return '<tr><td><strong>'+esc(p.nome)+'</strong><br><small style="color:var(--cinza);">'+esc(p.produtoId)+'</small></td>' +
            '<td>'+fmtMoney(p.preco)+'</td>' +
            '<td><span class="badge '+(p.tipo==='DIGITAL'?'badge-pendente':'badge-sucesso')+'">'+esc(p.tipo)+'</span></td>' +
            '<td>'+esc(p.metodoPagamento)+'</td>' +
            '<td><span class="badge '+(p.status==='ATIVO'?'badge-sucesso':'badge-falha')+'">'+esc(p.status)+'</span></td>' +
            '<td><button class="btn btn-sm btn-verde" onclick="navigate(\'editarProduto\',{id:\''+esc(p.produtoId)+'\'})" style="margin-right:4px;">✏️</button>' +
            '<button class="btn btn-sm" onclick="toggleProdStatus(\''+esc(p.produtoId)+'\',\''+(p.status==='ATIVO'?'DESATIVADO':'ATIVO')+'\')" style="border:1px solid var(--cinza);color:var(--cinza);background:transparent;">'+(p.status==='ATIVO'?'Desativar':'Ativar')+'</button></td></tr>';
        }).join('')) +
      '</tbody></table></div></div>';
  }).catch(function(e){ p.innerHTML = '<div class="empty-state"><div class="icon">📡</div><p><strong>Erro</strong></p><p style="font-size:0.85rem;color:#999;">'+esc(e.message)+'</p><button class="btn btn-verde" onclick="renderMeusProdutos()">Tentar</button></div>'; });
}

function toggleProdStatus(pid, st){
  apiPost('alterarStatusProduto', {token:state.token, produtoId:pid, status:st}).then(function(res){
    if(res.ok){ toast(res.msg); renderMeusProdutos(); }
    else { toast(res.erro||'Erro','error'); }
  }).catch(function(e){ toast('Erro: '+e.message,'error'); });
}

/* ---------- PRODUTO FORM ---------- */
function renderAdicionarProduto(){ if(!checkAuth()) return; renderProdForm(); }

function renderEditarProduto(id){
  if(!checkAuth()) return;
  apiGet('meusProdutos', {token:state.token}).then(function(res){
    var prod = (res.produtos||[]).find(function(p){ return p.produtoId===id; });
    if(!prod){ toast('Produto não encontrado','error'); navigate('meusProdutos'); return; }
    renderProdForm(prod);
  }).catch(function(e){ toast('Erro: '+e.message,'error'); });
}

function renderProdForm(prod){
  prod = prod || null;
  var isEdit = !!prod;
  var page = isEdit ? document.getElementById('pageEditarProduto') : document.getElementById('pageAdicionarProduto');
  page.classList.remove('hidden');
  var isDigital = prod && prod.tipo==='DIGITAL';

  page.innerHTML = '<div class="form-container" style="max-width:600px;"><h2>'+(isEdit?'✏️ Editar':'📦 Novo')+' Produto</h2>' +
    '<form onsubmit="event.preventDefault();'+(isEdit?'doEditProd()':'doAddProd()')+';">' +
    '<div class="form-group"><label>Nome</label><input type="text" id="pNome" value="'+esc(prod?prod.nome:'')+'" required></div>' +
    '<div class="form-group"><label>Descrição</label><textarea id="pDesc" required>'+esc(prod?prod.descricao:'')+'</textarea></div>' +
    '<div class="form-group"><label>Imagem URL</label><input type="url" id="pImg" value="'+esc(prod?prod.imagemUrl:'')+'"></div>' +
    '<div class="form-group"><label>Preço (MT)</label><input type="number" id="pPreco" value="'+(prod?prod.preco:'')+'" required min="1"></div>' +
    '<div class="form-group"><label>Tipo</label><select id="pTipo" onchange="onTipoChg()" '+(isEdit?'disabled':'')+'><option value="FISICO" '+(prod&&prod.tipo==='FISICO'?'selected':'')+'>Físico</option><option value="DIGITAL" '+(prod&&prod.tipo==='DIGITAL'?'selected':'')+'>Digital</option></select>'+(isEdit?'<small>Tipo não pode ser alterado</small>':'')+'</div>' +
    '<div class="form-group"><label>Método Pagamento</label><select id="pMetodo" onchange="onMetodoChg()"><option value="WHATSAPP" '+(prod&&prod.metodoPagamento==='WHATSAPP'?'selected':'')+'>WhatsApp</option><option value="NETSHOP" '+(prod&&prod.metodoPagamento==='NETSHOP'?'selected':'')+'>Netshop</option></select></div>' +
    '<div class="form-group" id="wg" style="'+(isDigital||prod&&prod.metodoPagamento==='NETSHOP'?'display:none;':'')+'"><label>WhatsApp</label><input type="tel" id="pWpp" value="'+esc(prod?prod.whatsapp:'')+'"></div>' +
    '<div class="form-group" id="dg" style="'+(!isDigital?'display:none;':'')+'"><label>Link Download</label><input type="url" id="pDown" value="'+esc(prod?prod.downloadUrl:'')+'"><small>Obrigatório para digital</small></div>' +
    '<button type="submit" class="btn btn-verde btn-block" style="margin-bottom:12px;">'+(isEdit?'💾 GUARDAR':'✅ PUBLICAR')+'</button>' +
    '<button type="button" class="btn btn-outline btn-block" onclick="navigate(\'meusProdutos\')" style="border-color:var(--cinza);color:var(--cinza);">Cancelar</button>' +
    (isEdit?'<input type="hidden" id="editPid" value="'+esc(prod.produtoId)+'">':'') +
    '</form></div>';
}

function onTipoChg(){
  var tipo = document.getElementById('pTipo').value;
  var met = document.getElementById('pMetodo');
  if(tipo==='DIGITAL'){ met.value='NETSHOP'; met.disabled=true; document.getElementById('dg').style.display='block'; document.getElementById('wg').style.display='none'; }
  else { met.disabled=false; document.getElementById('dg').style.display='none'; onMetodoChg(); }
}
function onMetodoChg(){
  var m = document.getElementById('pMetodo').value;
  document.getElementById('wg').style.display = m==='WHATSAPP'?'block':'none';
}

function doAddProd(){
  apiPost('criarProduto', {
    token: state.token,
    nome: document.getElementById('pNome').value.trim(),
    descricao: document.getElementById('pDesc').value.trim(),
    imagemUrl: document.getElementById('pImg').value.trim(),
    preco: document.getElementById('pPreco').value,
    tipo: document.getElementById('pTipo').value,
    metodoPagamento: document.getElementById('pMetodo').value,
    whatsapp: document.getElementById('pWpp')?document.getElementById('pWpp').value.trim():'',
    downloadUrl: document.getElementById('pDown')?document.getElementById('pDown').value.trim():''
  }).then(function(res){
    if(res.ok){ toast('Produto criado!'); navigate('meusProdutos'); }
    else { toast(res.erro||'Erro','error'); }
  }).catch(function(e){ toast('Erro: '+e.message,'error'); });
}

function doEditProd(){
  apiPost('editarProduto', {
    token: state.token,
    produtoId: document.getElementById('editPid').value,
    nome: document.getElementById('pNome').value.trim(),
    descricao: document.getElementById('pDesc').value.trim(),
    imagemUrl: document.getElementById('pImg').value.trim(),
    preco: document.getElementById('pPreco').value,
    metodoPagamento: document.getElementById('pMetodo').value,
    whatsapp: document.getElementById('pWpp')?document.getElementById('pWpp').value.trim():'',
    downloadUrl: document.getElementById('pDown')?document.getElementById('pDown').value.trim():''
  }).then(function(res){
    if(res.ok){ toast('Atualizado!'); navigate('meusProdutos'); }
    else { toast(res.erro||'Erro','error'); }
  }).catch(function(e){ toast('Erro: '+e.message,'error'); });
}

/* ---------- VENDAS ---------- */
function renderMinhasVendas(){
  if(!checkAuth()) return;
  var p = document.getElementById('pageMinhasVendas');
  p.classList.remove('hidden');
  p.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  apiGet('minhasVendas', {token:state.token}).then(function(res){
    var vendas = res.vendas || [];
    p.innerHTML = '<div class="dashboard"><h2 style="color:var(--verde-escuro);margin-bottom:24px;">📊 Minhas Vendas</h2>' +
      '<div class="table-container"><table><thead><tr><th>Data</th><th>Produto</th><th>Cliente</th><th>Valor</th><th>Taxa</th><th>Líquido</th><th>Status</th></tr></thead><tbody>' +
      (vendas.length===0?'<tr><td colspan="7" style="text-align:center;">Nenhuma venda</td></tr>':
        vendas.map(function(v){
          return '<tr><td>'+fmtDate(v.data)+'</td><td>'+esc(v.produtoId)+'</td><td>'+esc(v.clienteTelefone||'-')+'</td>' +
            '<td>'+fmtMoney(v.valorBruto)+'</td><td>'+fmtMoney(v.valorTaxa)+'</td><td><strong>'+fmtMoney(v.valorLiquido)+'</strong></td>' +
            '<td><span class="badge '+(v.status==='APROVADO'?'badge-sucesso':v.status==='PENDENTE'?'badge-pendente':'badge-falha')+'">'+esc(v.status)+'</span></td></tr>';
        }).join('')) +
      '</tbody></table></div></div>';
  }).catch(function(e){ p.innerHTML = '<div class="empty-state"><div class="icon">📡</div><p><strong>Erro</strong></p><p style="font-size:0.85rem;color:#999;">'+esc(e.message)+'</p><button class="btn btn-verde" onclick="renderMinhasVendas()">Tentar</button></div>'; });
}

/* ---------- CARTEIRA ---------- */
function renderCarteira(){
  if(!checkAuth()) return;
  var p = document.getElementById('pageCarteira');
  p.classList.remove('hidden');
  p.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  apiGet('minhaCarteira', {token:state.token}).then(function(res){
    if(!res.ok){ p.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>'+esc(res.erro)+'</p></div>'; return; }
    var c = res.carteira;
    p.innerHTML = '<div class="dashboard"><h2 style="color:var(--verde-escuro);margin-bottom:24px;">💰 Carteira</h2>' +
      '<div class="stats-grid">' +
        '<div class="stat-card dourado"><div class="label">Wallet</div><div class="value" style="font-size:1.1rem;">'+esc(c.walletId)+'</div></div>' +
        '<div class="stat-card"><div class="label">Bruto</div><div class="value">'+fmtMoney(c.valorBruto)+'</div></div>' +
        '<div class="stat-card vermelho"><div class="label">Taxas</div><div class="value">'+fmtMoney(c.taxa)+'</div></div>' +
        '<div class="stat-card dourado"><div class="label">Líquido</div><div class="value">'+fmtMoney(c.valorLiquido)+'</div></div>' +
      '</div></div>';
  }).catch(function(e){ p.innerHTML = '<div class="empty-state"><div class="icon">📡</div><p><strong>Erro</strong></p><p style="font-size:0.85rem;color:#999;">'+esc(e.message)+'</p><button class="btn btn-verde" onclick="renderCarteira()">Tentar</button></div>'; });
}

/* ---------- PLANO ---------- */
function renderPlano(){
  if(!checkAuth()) return;
  var p = document.getElementById('pagePlano');
  p.classList.remove('hidden');
  p.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  apiGet('meuPlano', {token:state.token}).then(function(res){
    if(!res.ok){ p.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>'+esc(res.erro)+'</p></div>'; return; }
    var pl = res.plano;
    p.innerHTML = '<div class="dashboard"><h2 style="color:var(--verde-escuro);margin-bottom:8px;">📋 Meu Plano</h2>' +
      '<p style="color:var(--cinza);margin-bottom:24px;">Atual: <strong>'+esc(pl.nome)+'</strong> | Status: <strong>'+esc(pl.status)+'</strong> | Expira: '+fmtDate(pl.expira)+'</p>' +
      '<div class="plans-grid">' +
        '<div class="plan-card '+(pl.nome==='SIMPLES'?'destaque':'')+'"><h3>Simples</h3><div class="preco">50 <span>MT/mês</span></div><ul class="plan-features"><li>3 produtos</li><li>Taxa 17%</li></ul><button class="btn btn-verde btn-block" onclick="renovarPlan(\'SIMPLES\')" '+(pl.nome==='SIMPLES'?'disabled style="opacity:0.5"':'')+'>'+(pl.nome==='SIMPLES'?'Atual':'Escolher')+'</button></div>' +
        '<div class="plan-card '+(pl.nome==='MEDIO'?'destaque':'')+'"><h3>Médio</h3><div class="preco">200 <span>MT/mês</span></div><ul class="plan-features"><li>10 produtos</li><li>Taxa 15%</li></ul><button class="btn btn-verde btn-block" onclick="renovarPlan(\'MEDIO\')" '+(pl.nome==='MEDIO'?'disabled style="opacity:0.5"':'')+'>'+(pl.nome==='MEDIO'?'Atual':'Escolher')+'</button></div>' +
        '<div class="plan-card '+(pl.nome==='PRO'?'destaque':'')+'"><h3>Pro</h3><div class="preco">1.000 <span>MT/mês</span></div><ul class="plan-features"><li>Ilimitado</li><li>Taxa 14%</li></ul><button class="btn btn-dourado btn-block" onclick="renovarPlan(\'PRO\')" '+(pl.nome==='PRO'?'disabled style="opacity:0.5"':'')+'>'+(pl.nome==='PRO'?'Atual':'Escolher')+'</button></div>' +
      '</div></div>';
  }).catch(function(e){ p.innerHTML = '<div class="empty-state"><div class="icon">📡</div><p><strong>Erro</strong></p><p style="font-size:0.85rem;color:#999;">'+esc(e.message)+'</p><button class="btn btn-verde" onclick="renderPlano()">Tentar</button></div>'; });
}

function renovarPlan(plano){
  var metodo = prompt('Método: mpesa, emola, mkesh, card', 'mpesa'); if(!metodo) return;
  var tel = prompt('Telefone:', state.vendedor?state.vendedor.telefone:'+258'); if(!tel) return;
  toast('Processando...');
  apiPost('renovarPlano', {token:state.token, plano:plano, metodoPagamento:metodo, telefone:tel}).then(function(res){
    if(res.ok && res.checkoutUrl){ window.open(res.checkoutUrl,'_blank'); toast('Redirecionado'); }
    else if(res.ok){ toast('Pagamento iniciado'); }
    else { toast(res.erro||'Erro','error'); }
  }).catch(function(e){ toast('Erro: '+e.message,'error'); });
}

/* ---------- VENDER ---------- */
function renderVender(){
  var p = document.getElementById('pageVender');
  p.classList.remove('hidden');
  p.innerHTML = '<div class="hero" style="padding:100px 24px;"><h1>🚀 Venda na '+CONFIG.APP_NAME+'</h1><p>Alcance clientes em Moçambique.</p>' +
    '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:24px;">' +
    '<button class="btn btn-dourado" onclick="navigate(\'registo\')">Começar</button>' +
    '<button class="btn btn-outline" onclick="navigate(\'login\')">Já sou Vendedor</button></div></div>' +
    '<div style="max-width:1000px;margin:0 auto;padding:60px 24px;">' +
    '<h2 style="text-align:center;color:var(--verde-escuro);margin-bottom:48px;">Por que vender connosco?</h2>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:32px;">' +
    '<div style="text-align:center;"><div style="font-size:3rem;margin-bottom:16px;">📱</div><h3>Fácil</h3><p style="color:var(--cinza);">Cadastre em minutos.</p></div>' +
    '<div style="text-align:center;"><div style="font-size:3rem;margin-bottom:16px;">💳</div><h3>Seguro</h3><p style="color:var(--cinza);">M-Pesa, e-Mola, cartões.</p></div>' +
    '<div style="text-align:center;"><div style="font-size:3rem;margin-bottom:16px;">📊</div><h3>Controle</h3><p style="color:var(--cinza);">Dashboard completo.</p></div></div>' +
    '<div style="margin-top:60px;"><h2 style="text-align:center;color:var(--verde-escuro);margin-bottom:32px;">Planos</h2>' +
    '<div class="plans-grid">' +
    '<div class="plan-card"><h3>Simples</h3><div class="preco">50 <span>MT/mês</span></div><ul class="plan-features"><li>3 produtos</li><li>Taxa 17%</li></ul></div>' +
    '<div class="plan-card"><h3>Médio</h3><div class="preco">200 <span>MT/mês</span></div><ul class="plan-features"><li>10 produtos</li><li>Taxa 15%</li></ul></div>' +
    '<div class="plan-card destaque"><h3>Pro</h3><div class="preco">1.000 <span>MT/mês</span></div><ul class="plan-features"><li>Ilimitado</li><li>Taxa 14%</li></ul></div>' +
    '</div></div></div>';
}

/* ---------- UTILS ---------- */
function checkAuth(){ if(!state.token){ toast('Faça login','error'); navigate('login'); return false; } return true; }

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', function(){
  navigate('home');
});
