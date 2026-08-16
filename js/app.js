/**
 * ============================================================
 * MOZ1VENDAS - FRONTEND
 * ============================================================
 * Frontend comunica com Google Apps Script.
 * Google Sheets = Backend / armazenamento
 * GAS = Motor / API
 *
 * VERSÃO CORRIGIDA
 * - Navegação centralizada
 * - Feedback em botões
 * - Tratamento de erros
 * - Proteção contra sessão inválida
 * - Botões funcionais
 * - Evita propagação de cliques
 * - Loading nos formulários
 * - Melhor tratamento das respostas GAS
 * ============================================================
 */

var CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzjEcGPI6LoR1JbaMG8MyK9yLmgGPoyOlGOkcJ2feQLQlXWEFLF3IBZcosrI7gmyR8Q/exec',
  APP_NAME: 'MOZ1VENDAS'
};

var state = {
  token: localStorage.getItem('mz1_token') || null,
  vendedor: null,
  produtos: [],
  produtoAtual: null,
  currentPage: 'home',
  currentParams: {}
};

/* ============================================================
   INICIALIZAÇÃO SEGURA
   ============================================================ */

try {
  state.vendedor = JSON.parse(
    localStorage.getItem('mz1_vendedor') || 'null'
  );
} catch (e) {
  state.vendedor = null;
  localStorage.removeItem('mz1_vendedor');
}

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

function $(sel) {
  return document.querySelector(sel);
}

function $$(sel) {
  return document.querySelectorAll(sel);
}

function fmtMoney(v) {
  var n = parseFloat(v) || 0;
  return n.toLocaleString('pt-MZ') + ' MT';
}

function fmtDate(s) {
  if (!s) return '-';

  try {
    var d = new Date(s);

    if (isNaN(d.getTime())) {
      return '-';
    }

    return d.toLocaleDateString('pt-MZ');
  } catch (e) {
    return '-';
  }
}

function esc(t) {
  if (t === null || t === undefined) {
    return '';
  }

  var d = document.createElement('div');
  d.textContent = String(t);

  return d.innerHTML;
}

function escAttr(t) {
  return esc(t)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   TOAST
   ============================================================ */

function toast(msg, type) {
  type = type || 'success';

  var c = document.getElementById('toastContainer');

  if (!c) {
    c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }

  var t = document.createElement('div');

  t.className = 'toast ' + type;
  t.textContent = msg;

  c.appendChild(t);

  setTimeout(function () {
    if (t && t.parentNode) {
      t.parentNode.removeChild(t);
    }
  }, 4000);
}

/* ============================================================
   NAVEGAÇÃO SEGURA
   ============================================================ */

function go(page, params) {
  params = params || {};

  try {
    navigate(page, params);
  } catch (e) {
    console.error('Erro de navegação:', e);

    toast(
      'Não foi possível abrir esta página.',
      'error'
    );
  }
}

/* ============================================================
   ROUTER
   ============================================================ */

function navigate(page, params) {
  params = params || {};

  state.currentPage = page;
  state.currentParams = params;

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  $$('.page').forEach(function (p) {
    p.classList.add('hidden');
  });

  updateHeader();

  try {

    switch (page) {

      case 'home':
        renderHome();
        break;

      case 'produtos':
        renderProdutos(params);
        break;

      case 'produto':
        renderProduto(params.id);
        break;

      case 'login':
        renderLogin();
        break;

      case 'registo':
        renderRegisto();
        break;

      case 'dashboard':
        renderDashboard();
        break;

      case 'meusProdutos':
        renderMeusProdutos();
        break;

      case 'adicionarProduto':
        renderAdicionarProduto();
        break;

      case 'editarProduto':
        renderEditarProduto(params.id);
        break;

      case 'minhasVendas':
        renderMinhasVendas();
        break;

      case 'carteira':
        renderCarteira();
        break;

      case 'plano':
        renderPlano();
        break;

      case 'vender':
        renderVender();
        break;

      default:
        console.warn('Página desconhecida:', page);
        renderHome();
    }

  } catch (e) {

    console.error('Erro ao renderizar página:', e);

    showPageError(
      'Ocorreu um erro ao abrir esta página.',
      function () {
        navigate(page, params);
      }
    );
  }
}

/* ============================================================
   HEADER
   ============================================================ */

function updateHeader() {

  var h = document.getElementById('appHeader');

  if (!h) return;

  var logged = !!state.token;

  h.innerHTML =
    '<div class="header-inner">' +

      '<div class="logo" onclick="go(\'home\')" style="cursor:pointer;">' +
        '<div class="logo-icon">🛒</div>' +
        '<span>' + esc(CONFIG.APP_NAME) + '</span>' +
      '</div>' +

      '<nav class="nav-links">' +

        '<a href="javascript:void(0)" onclick="go(\'home\')">' +
          'Início' +
        '</a>' +

        '<a href="javascript:void(0)" onclick="go(\'produtos\')">' +
          'Produtos' +
        '</a>' +

        '<a href="javascript:void(0)" onclick="go(\'vender\')">' +
          'Vender' +
        '</a>' +

        (
          logged ?

          '<a href="javascript:void(0)" onclick="go(\'dashboard\')">' +
            'Painel' +
          '</a>' +

          '<a href="javascript:void(0)" onclick="logout()">' +
            'Sair' +
          '</a>'

          :

          '<a href="javascript:void(0)" onclick="go(\'login\')">' +
            'Entrar' +
          '</a>'
        ) +

      '</nav>' +

      '<button class="mobile-menu-btn" onclick="toggleMobileMenu()">' +
        '☰' +
      '</button>' +

    '</div>';
}

/* ============================================================
   MENU MOBILE
   ============================================================ */

function toggleMobileMenu() {

  var nav = document.querySelector('.nav-links');

  if (!nav) return;

  nav.classList.toggle('mobile-open');
}

/* ============================================================
   HOME
   ============================================================ */

function renderHome() {

  var p = document.getElementById('pageHome');

  if (!p) return;

  p.classList.remove('hidden');

  p.innerHTML =

    '<div class="hero">' +

      '<h1>Compre e Venda em Moçambique</h1>' +

      '<p>O marketplace mais simples e seguro.</p>' +

      '<button class="btn btn-dourado" onclick="go(\'produtos\')">' +
        '🛍️ Explorar Produtos' +
      '</button>' +

      '<button class="btn btn-verde" style="margin-left:8px;" onclick="go(\'vender\')">' +
        '🚀 Começar a Vender' +
      '</button>' +

    '</div>' +

    '<div class="search-container">' +

      '<div class="search-box">' +

        '<input ' +
          'type="text" ' +
          'id="searchInput" ' +
          'placeholder="Pesquisar produtos..." ' +
          'onkeypress="if(event.key===\'Enter\'){searchProducts();}"' +
        '>' +

        '<button class="btn btn-verde" onclick="searchProducts()">' +
          '🔍 Pesquisar' +
        '</button>' +

      '</div>' +

    '</div>' +

    '<div class="categories">' +

      '<h2>📂 Categorias</h2>' +

      '<div class="cat-grid">' +

        '<div class="cat-card" onclick="filterByCategory(\'FISICO\')">' +
          '<div class="icon">📦</div>' +
          '<span>Produtos Físicos</span>' +
        '</div>' +

        '<div class="cat-card" onclick="filterByCategory(\'DIGITAL\')">' +
          '<div class="icon">💾</div>' +
          '<span>Produtos Digitais</span>' +
        '</div>' +

        '<div class="cat-card" onclick="go(\'produtos\')">' +
          '<div class="icon">🔥</div>' +
          '<span>Mais Vendidos</span>' +
        '</div>' +

        '<div class="cat-card" onclick="go(\'produtos\')">' +
          '<div class="icon">⭐</div>' +
          '<span>Novidades</span>' +
        '</div>' +

      '</div>' +

    '</div>' +

    '<div class="products-section">' +

      '<h2>🛍️ Produtos em Destaque</h2>' +

      '<div id="homeProducts" class="products-grid"></div>' +

    '</div>';

  loadHomeProducts();
}

/* ============================================================
   PRODUTOS HOME
   ============================================================ */

function loadHomeProducts() {

  var c = document.getElementById('homeProducts');

  if (!c) return;

  c.innerHTML =
    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>Carregando produtos...</p>' +
    '</div>';

  apiGet('produtos')

    .then(function (res) {

      if (!res || res.ok === false) {

        throw new Error(
          res && res.erro
            ? res.erro
            : 'Não foi possível carregar os produtos.'
        );
      }

      state.produtos = res.produtos || [];

      renderGrid(
        c,
        state.produtos.slice(0, 8)
      );
    })

    .catch(function (e) {

      console.error(e);

      c.innerHTML = erroHtml(
        e.message,
        'loadHomeProducts'
      );
    });
}

/* ============================================================
   GRID DE PRODUTOS
   ============================================================ */

function renderGrid(container, items) {

  if (!container) return;

  if (!items || items.length === 0) {

    container.innerHTML =
      '<div class="empty-state" style="grid-column:1/-1;">' +
        '<div class="icon">📭</div>' +
        '<p>Nenhum produto disponível.</p>' +
        '<button class="btn btn-verde" onclick="go(\'produtos\')">' +
          'Explorar produtos' +
        '</button>' +
      '</div>';

    return;
  }

  container.innerHTML = items.map(function (p) {

    var pid = escAttr(p.produtoId);

    return (

      '<div class="product-card">' +

        '<div class="product-img" onclick="go(\'produto\',{id:\'' + pid + '\'})" style="cursor:pointer;">' +

          (
            p.imagemUrl

            ?

            '<img src="' +
              escAttr(p.imagemUrl) +
              '" ' +
              'alt="' +
              escAttr(p.nome) +
              '" ' +
              'onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'🛒\';"' +
            '>'

            :

            '🛒'
          ) +

        '</div>' +

        '<div class="product-info">' +

          '<span class="product-type ' +
            (p.tipo === 'DIGITAL'
              ? 'type-digital'
              : 'type-fisico') +
          '">' +

            esc(p.tipo) +

          '</span>' +

          '<h3>' +
            esc(p.nome) +
          '</h3>' +

          '<p class="desc">' +
            esc(p.descricao) +
          '</p>' +

          '<div class="product-meta">' +

            '<span class="product-price">' +
              fmtMoney(p.preco) +
            '</span>' +

            '<span class="product-brand">' +
              esc(p.marca) +
            '</span>' +

          '</div>' +

          '<button ' +
            'class="btn btn-verde btn-sm btn-block" ' +
            'onclick="go(\'produto\',{id:\'' + pid + '\'})"' +
          '>' +

            'Ver Produto' +

          '</button>' +

        '</div>' +

      '</div>'
    );

  }).join('');
}

/* ============================================================
   ERRO
   ============================================================ */

function erroHtml(msg, retryFn) {

  var safeMsg = esc(msg || 'Erro desconhecido');

  return (

    '<div class="empty-state" style="grid-column:1/-1;">' +

      '<div class="icon">📡</div>' +

      '<p><strong>Erro de conexão</strong></p>' +

      '<p style="font-size:0.85rem;color:#999;">' +
        safeMsg +
      '</p>' +

      '<button class="btn btn-verde" style="margin-top:12px;" ' +
        'onclick="' + escAttr(retryFn) + '()">' +

        '🔄 Tentar novamente' +

      '</button>' +

    '</div>'
  );
}

function showPageError(message, retry) {

  var pages = $$('.page');

  pages.forEach(function (p) {
    p.classList.add('hidden');
  });

  var target =
    document.getElementById(
      'page' +
      state.currentPage.charAt(0).toUpperCase() +
      state.currentPage.slice(1)
    );

  if (!target) {
    target = document.body;
  }

  target.classList.remove('hidden');

  target.innerHTML =

    '<div class="empty-state">' +

      '<div class="icon">⚠️</div>' +

      '<h3>Ocorreu um erro</h3>' +

      '<p>' +
        esc(message) +
      '</p>' +

      '<button class="btn btn-verde" onclick="go(\'' +
        escAttr(state.currentPage) +
      '\')">' +

        '🔄 Tentar novamente' +

      '</button>' +

    '</div>';

  if (retry) {
    setTimeout(retry, 50);
  }
}

/* ============================================================
   LISTAGEM DE PRODUTOS
   ============================================================ */

function renderProdutos(params) {

  params = params || {};

  var p = document.getElementById('pageProdutos');

  if (!p) return;

  p.classList.remove('hidden');

  p.innerHTML =

    '<div style="padding:32px 24px;max-width:1400px;margin:0 auto;">' +

      '<div class="search-container" style="margin:0 0 32px 0;">' +

        '<div class="search-box">' +

          '<input ' +
            'type="text" ' +
            'id="prodSearchInput" ' +
            'placeholder="Pesquisar..." ' +
            'value="' + escAttr(params.search || '') + '" ' +
            'onkeypress="if(event.key===\'Enter\'){searchProductsPage();}"' +
          '>' +

          '<button class="btn btn-verde" onclick="searchProductsPage()">' +
            '🔍 Pesquisar' +
          '</button>' +

        '</div>' +

      '</div>' +

      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">' +

        '<h2 style="margin-bottom:24px;color:var(--verde-escuro);">' +
          '🛍️ Produtos' +
        '</h2>' +

        '<button class="btn btn-outline" onclick="go(\'home\')">' +
          '← Voltar' +
        '</button>' +

      '</div>' +

      '<div id="allProducts" class="products-grid"></div>' +

    '</div>';

  loadAllProducts(
    params.search || '',
    params.categoria || ''
  );
}

function loadAllProducts(search, categoria) {

  var c = document.getElementById('allProducts');

  if (!c) return;

  c.innerHTML =

    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>Carregando produtos...</p>' +
    '</div>';

  var params = {};

  if (search) {
    params.search = search;
  }

  if (categoria) {
    params.categoria = categoria;
  }

  apiGet('produtos', params)

    .then(function (res) {

      if (!res || res.ok === false) {

        throw new Error(
          res && res.erro
            ? res.erro
            : 'Não foi possível carregar os produtos.'
        );
      }

      state.produtos = res.produtos || [];

      renderGrid(
        c,
        state.produtos
      );
    })

    .catch(function (e) {

      console.error(e);

      c.innerHTML =
        erroHtml(
          e.message,
          'loadAllProducts'
        );
    });
}

function searchProducts() {

  var input =
    document.getElementById('searchInput');

  if (!input) return;

  var q = input.value.trim();

  if (!q) {

    toast(
      'Digite o nome de um produto.',
      'error'
    );

    return;
  }

  go('produtos', {
    search: q
  });
}

function searchProductsPage() {

  var input =
    document.getElementById('prodSearchInput');

  if (!input) return;

  var q = input.value.trim();

  loadAllProducts(
    q,
    state.currentParams.categoria || ''
  );
}

function filterByCategory(cat) {

  go('produtos', {
    categoria: cat
  });
}

/* ============================================================
   DETALHE DO PRODUTO
   ============================================================ */

function renderProduto(id) {

  var p =
    document.getElementById('pageProduto');

  if (!p) return;

  if (!id) {

    p.classList.remove('hidden');

    p.innerHTML =
      '<div class="empty-state">' +
        '<div class="icon">😕</div>' +
        '<p>Produto inválido.</p>' +
        '<button class="btn btn-verde" onclick="go(\'produtos\')">' +
          'Ver produtos' +
        '</button>' +
      '</div>';

    return;
  }

  p.classList.remove('hidden');

  p.innerHTML =
    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>Carregando produto...</p>' +
    '</div>';

  apiGet('produto', {
    id: id
  })

  .then(function (res) {

    if (!res || res.ok === false) {

      p.innerHTML =
        '<div class="empty-state">' +

          '<div class="icon">😕</div>' +

          '<p>Produto não encontrado.</p>' +

          '<button class="btn btn-verde" onclick="go(\'produtos\')">' +
            '← Voltar aos produtos' +
          '</button>' +

        '</div>';

      return;
    }

    var prod = res.produto;

    if (!prod) {
      throw new Error(
        'O servidor não devolveu os dados do produto.'
      );
    }

    state.produtoAtual = prod;

    var isNetshop =
      String(prod.metodoPagamento || '').toUpperCase() === 'NETSHOP';

    var payBox;

    if (isNetshop) {

      payBox =

        '<div class="payment-box">' +

          '<h3>💳 Pagamento Online</h3>' +

          '<p style="color:var(--cinza);margin-bottom:16px;">' +
            'Pague com segurança através da Netshop.' +
          '</p>' +

          '<div class="form-group">' +
            '<label>Seu telefone</label>' +
            '<input type="tel" id="buyerPhone" value="+258">' +
          '</div>' +

          '<div class="form-group">' +
            '<label>Método</label>' +

            '<select id="paymentMethod">' +
              '<option value="mpesa">M-Pesa</option>' +
              '<option value="emola">e-Mola</option>' +
              '<option value="mkesh">mKesh</option>' +
              '<option value="card">Cartão</option>' +
            '</select>' +

          '</div>' +

          '<button class="netshop-btn" id="buyBtn" onclick="buyNetshop()">' +
            '💳 COMPRAR — ' +
            fmtMoney(prod.preco) +
          '</button>' +

        '</div>';

    } else {

      var whatsapp =
        String(prod.whatsapp || '')
          .replace(/[^\d]/g, '');

      var text =
        'Olá, quero comprar ' +
        prod.produtoId +
        ' — ' +
        prod.nome +
        ' por ' +
        fmtMoney(prod.preco);

      var url =
        'https://wa.me/' +
        encodeURIComponent(whatsapp) +
        '?text=' +
        encodeURIComponent(text);

      payBox =

        '<div class="payment-box">' +

          '<h3>📱 WhatsApp</h3>' +

          '<p style="color:var(--cinza);margin-bottom:16px;">' +
            'Negocie diretamente com o vendedor.' +
          '</p>' +

          '<a href="' +
            escAttr(url) +
          '" target="_blank" rel="noopener" class="whatsapp-btn">' +

            '📱 COMPRAR PELO WHATSAPP' +

          '</a>' +

        '</div>';
    }

    p.innerHTML =

      '<div class="product-detail">' +

        '<div style="margin-bottom:20px;">' +

          '<button class="btn btn-outline" onclick="go(\'produtos\')">' +
            '← Voltar' +
          '</button>' +

        '</div>' +

        '<div class="detail-grid">' +

          '<div class="detail-img">' +

            (
              prod.imagemUrl

              ?

              '<img src="' +
                escAttr(prod.imagemUrl) +
                '" ' +
                'alt="' +
                escAttr(prod.nome) +
                '" ' +
                'onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'🛒\';"' +
              '>'

              :

              '🛒'
            ) +

          '</div>' +

          '<div class="detail-info">' +

            '<span class="product-type ' +
              (
                prod.tipo === 'DIGITAL'
                  ? 'type-digital'
                  : 'type-fisico'
              ) +
            '">' +

              esc(prod.tipo) +

            '</span>' +

            '<h1>' +
              esc(prod.nome) +
            '</h1>' +

            '<p class="brand">🏪 ' +
              esc(prod.marca || '-') +
            '</p>' +

            '<div class="price">' +
              fmtMoney(prod.preco) +
            '</div>' +

            '<p class="desc">' +
              esc(prod.descricao) +
            '</p>' +

            '<p style="color:var(--cinza);margin-bottom:16px;">' +

              '<strong>Ref:</strong> ' +
              esc(prod.produtoId) +

              '<br>' +

              '<strong>Método:</strong> ' +
              (
                isNetshop
                  ? 'Pagamento Online'
                  : 'WhatsApp'
              ) +

            '</p>' +

            payBox +

          '</div>' +

        '</div>' +

      '</div>';
  })

  .catch(function (e) {

    console.error(e);

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro ao carregar produto</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +
          esc(e.message) +
        '</p>' +

        '<button class="btn btn-verde" onclick="renderProduto(\'' +
          escAttr(id) +
        '\')">' +

          '🔄 Tentar novamente' +

        '</button>' +

      '</div>';
  });
}

/* ============================================================
   PAGAMENTO NETSHOP
   ============================================================ */

function buyNetshop() {

  var p = state.produtoAtual;

  if (!p) {

    toast(
      'Produto não encontrado.',
      'error'
    );

    return;
  }

  var phoneEl =
    document.getElementById('buyerPhone');

  var methodEl =
    document.getElementById('paymentMethod');

  var btn =
    document.getElementById('buyBtn');

  if (!phoneEl || !methodEl) {

    toast(
      'Formulário de pagamento indisponível.',
      'error'
    );

    return;
  }

  var phone =
    phoneEl.value.trim();

  var method =
    methodEl.value;

  if (!phone || phone.length < 9) {

    toast(
      'Digite um telefone válido.',
      'error'
    );

    phoneEl.focus();

    return;
  }

  if (btn) {

    btn.disabled = true;

    btn.dataset.originalText =
      btn.innerHTML;

    btn.innerHTML =
      '⏳ PROCESSANDO...';
  }

  toast(
    'Iniciando pagamento...'
  );

  apiPost(
    'criarPagamento',
    {
      produtoId: p.produtoId,
      clienteTelefone: phone,
      metodo: method
    }
  )

  .then(function (res) {

    if (res && res.ok && res.checkoutUrl) {

      toast(
        'Pagamento criado. Abrindo checkout...'
      );

      window.open(
        res.checkoutUrl,
        '_blank'
      );

    } else if (res && res.ok) {

      toast(
        res.msg ||
        'Pagamento iniciado.'
      );

    } else {

      toast(
        (res && res.erro) ||
        'Não foi possível iniciar o pagamento.',
        'error'
      );
    }
  })

  .catch(function (e) {

    console.error(e);

    toast(
      'Erro: ' + e.message,
      'error'
    );
  })

  .finally(function () {

    if (btn) {

      btn.disabled = false;

      btn.innerHTML =
        btn.dataset.originalText ||
        '💳 COMPRAR';
    }
  });
}

/* ============================================================
   LOGIN
   ============================================================ */

function renderLogin() {

  var p =
    document.getElementById('pageLogin');

  if (!p) return;

  p.classList.remove('hidden');

  p.innerHTML =

    '<div class="form-container">' +

      '<h2>🔐 Entrar</h2>' +

      '<p class="subtitle">' +
        'Acesse o painel de vendedor' +
      '</p>' +

      '<form onsubmit="event.preventDefault();doLogin();">' +

        '<div class="form-group">' +
          '<label>Nome ou Telefone</label>' +
          '<input type="text" id="loginIdentificador" required>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>PIN</label>' +
          '<input type="password" id="loginPin" required maxlength="6">' +
        '</div>' +

        '<button type="submit" id="loginBtn" class="btn btn-verde btn-block">' +
          'ENTRAR' +
        '</button>' +

        '<p style="text-align:center;color:var(--cinza);">' +

          'Não tem conta? ' +

          '<a href="javascript:void(0)" ' +
             'onclick="go(\'registo\')" ' +
             'style="color:var(--verde);font-weight:600;">' +

            'Registe-se' +

          '</a>' +

        '</p>' +

      '</form>' +

    '</div>';
}

function doLogin() {

  var idEl =
    document.getElementById('loginIdentificador');

  var pinEl =
    document.getElementById('loginPin');

  var btn =
    document.getElementById('loginBtn');

  if (!idEl || !pinEl) return;

  var id =
    idEl.value.trim();

  var pin =
    pinEl.value;

  if (!id || !pin) {

    toast(
      'Preencha todos os campos.',
      'error'
    );

    return;
  }

  if (btn) {

    btn.disabled = true;

    btn.innerHTML =
      '⏳ A ENTRAR...';
  }

  apiPost(
    'loginVendedor',
    {
      identificador: id,
      pin: pin
    }
  )

  .then(function (res) {

    if (res && res.ok) {

      state.token =
        res.token;

      state.vendedor =
        res.vendedor;

      localStorage.setItem(
        'mz1_token',
        res.token
      );

      localStorage.setItem(
        'mz1_vendedor',
        JSON.stringify(res.vendedor)
      );

      toast(
        'Bem-vindo, ' +
        (
          res.vendedor.empresa ||
          res.vendedor.nome ||
          'Vendedor'
        ) +
        '!'
      );

      go('dashboard');

    } else {

      toast(
        (res && res.erro) ||
        'Dados de login incorretos.',
        'error'
      );
    }
  })

  .catch(function (e) {

    console.error(e);

    toast(
      'Erro de ligação: ' +
      e.message,
      'error'
    );
  })

  .finally(function () {

    if (btn) {

      btn.disabled = false;

      btn.innerHTML =
        'ENTRAR';
    }
  });
}

/* ============================================================
   REGISTO
   ============================================================ */

function renderRegisto() {

  var p =
    document.getElementById('pageRegisto');

  if (!p) return;

  p.classList.remove('hidden');

  p.innerHTML =

    '<div class="form-container">' +

      '<h2>📝 Tornar-se Vendedor</h2>' +

      '<p class="subtitle">' +
        'Comece a vender na ' +
        esc(CONFIG.APP_NAME) +
      '</p>' +

      '<form onsubmit="event.preventDefault();doRegisto();">' +

        '<div class="form-group">' +
          '<label>Nome Completo</label>' +
          '<input type="text" id="regNome" required>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>Telefone</label>' +
          '<input type="tel" id="regTelefone" placeholder="+25884..." required>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>BI</label>' +
          '<input type="text" id="regBi" required>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>Marca/Empresa</label>' +
          '<input type="text" id="regEmpresa" required>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>PIN (4-6 dígitos)</label>' +
          '<input type="password" id="regPin" required minlength="4" maxlength="6">' +
        '</div>' +

        '<div class="form-group">' +

          '<label>Plano</label>' +

          '<select id="regPlano">' +

            '<option value="SIMPLES">' +
              'Simples — 50 MT/mês (3 produtos)' +
            '</option>' +

            '<option value="MEDIO">' +
              'Médio — 200 MT/mês (10 produtos)' +
            '</option>' +

            '<option value="PRO">' +
              'Pro — 1.000 MT/mês (Ilimitado)' +
            '</option>' +

          '</select>' +

        '</div>' +

        '<button type="submit" id="regBtn" class="btn btn-dourado btn-block">' +
          'REGISTAR-SE' +
        '</button>' +

        '<p style="text-align:center;color:var(--cinza);">' +

          'Já tem conta? ' +

          '<a href="javascript:void(0)" ' +
             'onclick="go(\'login\')" ' +
             'style="color:var(--verde);font-weight:600;">' +

            'Entrar' +

          '</a>' +

        '</p>' +

      '</form>' +

    '</div>';
}

function doRegisto() {

  var data = {

    nome:
      document.getElementById('regNome').value.trim(),

    telefone:
      document.getElementById('regTelefone').value.trim(),

    bi:
      document.getElementById('regBi').value.trim(),

    empresa:
      document.getElementById('regEmpresa').value.trim(),

    pin:
      document.getElementById('regPin').value,

    plano:
      document.getElementById('regPlano').value
  };

  var btn =
    document.getElementById('regBtn');

  if (!data.nome ||
      !data.telefone ||
      !data.bi ||
      !data.empresa ||
      !data.pin) {

    toast(
      'Preencha todos os campos.',
      'error'
    );

    return;
  }

  if (!/^\d{4,6}$/.test(data.pin)) {

    toast(
      'O PIN deve ter entre 4 e 6 dígitos.',
      'error'
    );

    return;
  }

  if (btn) {

    btn.disabled = true;

    btn.innerHTML =
      '⏳ A REGISTAR...';
  }

  apiPost(
    'registarVendedor',
    data
  )

  .then(function (res) {

    if (res && res.ok) {

      if (
        res.status ===
        'PENDENTE_PAGAMENTO'
      ) {

        toast(
          'Registado! Efetue o pagamento do plano.'
        );

      } else {

        toast(
          'Registo concluído! Faça login.'
        );
      }

      go('login');

    } else {

      toast(
        (res && res.erro) ||
        'Erro no registo.',
        'error'
      );
    }
  })

  .catch(function (e) {

    console.error(e);

    toast(
      'Erro: ' + e.message,
      'error'
    );
  })

  .finally(function () {

    if (btn) {

      btn.disabled = false;

      btn.innerHTML =
        'REGISTAR-SE';
    }
  });
}

/* ============================================================
   LOGOUT
   ============================================================ */

function logout() {

  var token =
    state.token;

  if (token) {

    apiPost(
      'logout',
      {
        token: token
      }
    ).catch(function () {});
  }

  state.token = null;
  state.vendedor = null;

  localStorage.removeItem(
    'mz1_token'
  );

  localStorage.removeItem(
    'mz1_vendedor'
  );

  toast(
    'Sessão terminada.'
  );

  go('home');
}

/* ============================================================
   AUTENTICAÇÃO
   ============================================================ */

function checkAuth() {

  if (!state.token) {

    toast(
      'Faça login para continuar.',
      'error'
    );

    go('login');

    return false;
  }

  return true;
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function renderDashboard() {

  if (!checkAuth()) return;

  var p =
    document.getElementById('pageDashboard');

  if (!p) return;

  p.classList.remove('hidden');

  p.innerHTML =
    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>Carregando painel...</p>' +
    '</div>';

  apiGet(
    'dashboard',
    {
      token: state.token
    }
  )

  .then(function (res) {

    if (!res || !res.ok) {

      toast(
        'Sessão expirada. Faça login novamente.',
        'error'
      );

      logout();

      return;
    }

    var d =
      res.dashboard || {};

    var statusClass =
      d.status === 'ATIVO'
        ? 'status-ativo'
        : 'status-desativado';

    var statusText =
      d.status === 'ATIVO'
        ? '🟢 ATIVO'
        : '🔴 DESATIVADO';

    p.innerHTML =

      '<div class="dashboard">' +

        '<div class="dashboard-header">' +

          '<div>' +

            '<h1>👋 Bem-vindo, ' +
              esc(d.empresa || d.nome || 'Vendedor') +
            '</h1>' +

            '<p style="opacity:0.9;margin-top:4px;">' +
              esc(d.vendedorId || '') +
            '</p>' +

          '</div>' +

          '<div class="status">' +

            '<span class="status-dot ' +
              statusClass +
            '"></span>' +

            '<span>' +
              statusText +
            '</span>' +

          '</div>' +

        '</div>' +

        '<div class="stats-grid">' +

          '<div class="stat-card">' +
            '<div class="label">Produtos</div>' +
            '<div class="value">' +
              (d.produtosPublicados || 0) +
              ' / ' +
              esc(String(d.limiteProdutos || 0)) +
            '</div>' +
          '</div>' +

          '<div class="stat-card dourado">' +
            '<div class="label">Vendas</div>' +
            '<div class="value">' +
              (d.totalVendas || 0) +
            '</div>' +
          '</div>' +

          '<div class="stat-card">' +
            '<div class="label">Vendido</div>' +
            '<div class="value">' +
              fmtMoney(d.totalVendido) +
            '</div>' +
          '</div>' +

          '<div class="stat-card vermelho">' +
            '<div class="label">Taxas</div>' +
            '<div class="value">' +
              fmtMoney(d.totalTaxas) +
            '</div>' +
          '</div>' +

          '<div class="stat-card dourado">' +
            '<div class="label">Líquido</div>' +
            '<div class="value">' +
              fmtMoney(d.totalLiquido) +
            '</div>' +
          '</div>' +

          '<div class="stat-card">' +
            '<div class="label">Saldo</div>' +
            '<div class="value">' +
              fmtMoney(d.saldoDisponivel) +
            '</div>' +
          '</div>' +

          '<div class="stat-card">' +
            '<div class="label">Plano</div>' +
            '<div class="value">' +
              esc(d.plano || '-') +
            '</div>' +
          '</div>' +

          '<div class="stat-card">' +
            '<div class="label">Expira</div>' +
            '<div class="value">' +
              fmtDate(d.expira) +
            '</div>' +
          '</div>' +

        '</div>' +

        (
          d.status !== 'ATIVO'

          ?

          '<div style="background:#fef3c7;border-radius:16px;padding:24px;text-align:center;margin-bottom:32px;">' +

            '<p style="color:#92400e;font-weight:600;margin-bottom:12px;">' +
              '⚠️ Conta desativada. Renove o plano.' +
            '</p>' +

            '<button class="btn btn-dourado" onclick="go(\'plano\')">' +
              'Renovar Plano' +
            '</button>' +

          '</div>'

          :

          ''
        ) +

        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;">' +

          '<div class="table-container">' +

            '<h2>📦 Meus Produtos</h2>' +

            '<p style="color:var(--cinza);">' +
              'Gerencie os seus produtos.' +
            '</p>' +

            '<button class="btn btn-verde" style="margin-top:16px;" onclick="go(\'meusProdutos\')">' +
              'Ver Produtos' +
            '</button>' +

          '</div>' +

          '<div class="table-container">' +

            '<h2>📊 Vendas</h2>' +

            '<p style="color:var(--cinza);">' +
              'Consulte o histórico de vendas.' +
            '</p>' +

            '<button class="btn btn-verde" style="margin-top:16px;" onclick="go(\'minhasVendas\')">' +
              'Ver Vendas' +
            '</button>' +

          '</div>' +

          '<div class="table-container">' +

            '<h2>💰 Carteira</h2>' +

            '<p style="color:var(--cinza);">' +
              'Consulte os seus valores.' +
            '</p>' +

            '<button class="btn btn-verde" style="margin-top:16px;" onclick="go(\'carteira\')">' +
              'Abrir Carteira' +
            '</button>' +

          '</div>' +

        '</div>' +

      '</div>';
  })

  .catch(function (e) {

    console.error(e);

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +
          esc(e.message) +
        '</p>' +

        '<button class="btn btn-verde" onclick="renderDashboard()">' +
          '🔄 Tentar novamente' +
        '</button>' +

      '</div>';
  });
}

/* ============================================================
   MEUS PRODUTOS
   ============================================================ */

function renderMeusProdutos() {

  if (!checkAuth()) return;

  var p =
    document.getElementById('pageMeusProdutos');

  if (!p) return;

  p.classList.remove('hidden');

  p.innerHTML =
    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>Carregando produtos...</p>' +
    '</div>';

  apiGet(
    'meusProdutos',
    {
      token: state.token
    }
  )

  .then(function (res) {

    if (res && res.ok === false) {

      throw new Error(
        res.erro ||
        'Não foi possível carregar os produtos.'
      );
    }

    var produtos =
      res.produtos || [];

    p.innerHTML =

      '<div class="dashboard">' +

        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">' +

          '<div>' +

            '<button class="btn btn-outline" onclick="go(\'dashboard\')" style="margin-bottom:12px;">' +
              '← Painel' +
            '</button>' +

            '<h2 style="color:var(--verde-escuro);">' +
              '📦 Meus Produtos' +
            '</h2>' +

          '</div>' +

          '<button class="btn btn-dourado" onclick="go(\'adicionarProduto\')">' +
            '+ Adicionar Produto' +
          '</button>' +

        '</div>' +

        '<div class="table-container">' +

          '<table>' +

            '<thead>' +

              '<tr>' +
                '<th>Produto</th>' +
                '<th>Preço</th>' +
                '<th>Tipo</th>' +
                '<th>Método</th>' +
                '<th>Status</th>' +
                '<th>Ações</th>' +
              '</tr>' +

            '</thead>' +

            '<tbody>' +

              (
                produtos.length === 0

                ?

                '<tr>' +
                  '<td colspan="6" style="text-align:center;padding:30px;">' +
                    'Nenhum produto publicado.' +
                  '</td>' +
                '</tr>'

                :

                produtos.map(function (prod) {

                  var pid =
                    escAttr(prod.produtoId);

                  return (

                    '<tr>' +

                      '<td>' +
                        '<strong>' +
                          esc(prod.nome) +
                        '</strong>' +

                        '<br>' +

                        '<small style="color:var(--cinza);">' +
                          esc(prod.produtoId) +
                        '</small>' +

                      '</td>' +

                      '<td>' +
                        fmtMoney(prod.preco) +
                      '</td>' +

                      '<td>' +

                        '<span class="badge ' +
                          (
                            prod.tipo === 'DIGITAL'
                              ? 'badge-pendente'
                              : 'badge-sucesso'
                          ) +
                        '">' +

                          esc(prod.tipo) +

                        '</span>' +

                      '</td>' +

                      '<td>' +
                        esc(prod.metodoPagamento) +
                      '</td>' +

                      '<td>' +

                        '<span class="badge ' +
                          (
                            prod.status === 'ATIVO'
                              ? 'badge-sucesso'
                              : 'badge-falha'
                          ) +
                        '">' +

                          esc(prod.status) +

                        '</span>' +

                      '</td>' +

                      '<td>' +

                        '<button class="btn btn-sm btn-verde" ' +
                          'onclick="go(\'editarProduto\',{id:\'' +
                            pid +
                          '\'})" ' +
                          'style="margin-right:4px;">' +

                          '✏️' +

                        '</button>' +

                        '<button class="btn btn-sm" ' +
                          'onclick="toggleProdStatus(\'' +
                            pid +
                            '\',\'' +
                            (
                              prod.status === 'ATIVO'
                                ? 'DESATIVADO'
                                : 'ATIVO'
                            ) +
                          '\')" ' +
                          'style="border:1px solid var(--cinza);color:var(--cinza);background:transparent;">' +

                          (
                            prod.status === 'ATIVO'
                              ? 'Desativar'
                              : 'Ativar'
                          ) +

                        '</button>' +

                      '</td>' +

                    '</tr>'
                  );

                }).join('')
              ) +

            '</tbody>' +

          '</table>' +

        '</div>' +

      '</div>';
  })

  .catch(function (e) {

    console.error(e);

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +
          esc(e.message) +
        '</p>' +

        '<button class="btn btn-verde" onclick="renderMeusProdutos()">' +
          '🔄 Tentar novamente' +
        '</button>' +

      '</div>';
  });
}

/* ============================================================
   ALTERAR STATUS
   ============================================================ */

function toggleProdStatus(pid, st) {

  toast(
    'Atualizando produto...'
  );

  apiPost(
    'alterarStatusProduto',
    {
      token: state.token,
      produtoId: pid,
      status: st
    }
  )

  .then(function (res) {

    if (res && res.ok) {

      toast(
        res.msg ||
        'Status atualizado.'
      );

      renderMeusProdutos();

    } else {

      toast(
        (res && res.erro) ||
        'Erro ao alterar status.',
        'error'
      );
    }
  })

  .catch(function (e) {

    console.error(e);

    toast(
      'Erro: ' + e.message,
      'error'
    );
  });
}

/* ============================================================
   FORM PRODUTO
   ============================================================ */

function renderAdicionarProduto() {

  if (!checkAuth()) return;

  renderProdForm();
}

function renderEditarProduto(id) {

  if (!checkAuth()) return;

  if (!id) {

    toast(
      'Produto inválido.',
      'error'
    );

    go('meusProdutos');

    return;
  }

  var page =
    document.getElementById('pageEditarProduto');

  if (page) {

    page.classList.remove('hidden');

    page.innerHTML =
      '<div class="loading">' +
        '<div class="spinner"></div>' +
        '<p>Carregando produto...</p>' +
      '</div>';
  }

  apiGet(
    'meusProdutos',
    {
      token: state.token
    }
  )

  .then(function (res) {

    var prod =
      (res.produtos || []).find(
        function (p) {
          return String(p.produtoId) === String(id);
        }
      );

    if (!prod) {

      toast(
        'Produto não encontrado.',
        'error'
      );

      go('meusProdutos');

      return;
    }

    renderProdForm(prod);
  })

  .catch(function (e) {

    console.error(e);

    toast(
      'Erro: ' + e.message,
      'error'
    );

    go('meusProdutos');
  });
}

function renderProdForm(prod) {

  prod = prod || null;

  var isEdit =
    !!prod;

  var page =
    isEdit

      ?

    document.getElementById(
      'pageEditarProduto'
    )

      :

    document.getElementById(
      'pageAdicionarProduto'
    );

  if (!page) return;

  page.classList.remove('hidden');

  var isDigital =
    prod &&
    prod.tipo === 'DIGITAL';

  page.innerHTML =

    '<div class="form-container" style="max-width:600px;">' +

      '<button class="btn btn-outline" onclick="go(\'meusProdutos\')" style="margin-bottom:16px;">' +
        '← Voltar' +
      '</button>' +

      '<h2>' +
        (
          isEdit
            ? '✏️ Editar Produto'
            : '📦 Novo Produto'
        ) +
      '</h2>' +

      '<form onsubmit="event.preventDefault();' +
        (
          isEdit
            ? 'doEditProd()'
            : 'doAddProd()'
        ) +
      ';">' +

        '<div class="form-group">' +
          '<label>Nome</label>' +
          '<input type="text" id="pNome" value="' +
            escAttr(prod ? prod.nome : '') +
          '" required>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>Descrição</label>' +
          '<textarea id="pDesc" required>' +
            esc(prod ? prod.descricao : '') +
          '</textarea>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>Imagem URL</label>' +
          '<input type="url" id="pImg" value="' +
            escAttr(prod ? prod.imagemUrl : '') +
          '">' +
        '</div>' +

        '<div class="form-group">' +
          '<label>Preço (MT)</label>' +
          '<input type="number" id="pPreco" value="' +
            (prod ? escAttr(prod.preco) : '') +
          '" required min="1">' +
        '</div>' +

        '<div class="form-group">' +

          '<label>Tipo</label>' +

          '<select id="pTipo" onchange="onTipoChg()" ' +
            (isEdit ? 'disabled' : '') +
          '>' +

            '<option value="FISICO" ' +
              (
                prod &&
                prod.tipo === 'FISICO'
                  ? 'selected'
                  : ''
              ) +
            '>Físico</option>' +

            '<option value="DIGITAL" ' +
              (
                prod &&
                prod.tipo === 'DIGITAL'
                  ? 'selected'
                  : ''
              ) +
            '>Digital</option>' +

          '</select>' +

          (
            isEdit
              ? '<small>O tipo não pode ser alterado.</small>'
              : ''
          ) +

        '</div>' +

        '<div class="form-group">' +

          '<label>Método de Pagamento</label>' +

          '<select id="pMetodo" onchange="onMetodoChg()">' +

            '<option value="WHATSAPP" ' +
              (
                prod &&
                prod.metodoPagamento === 'WHATSAPP'
                  ? 'selected'
                  : ''
              ) +
            '>WhatsApp</option>' +

            '<option value="NETSHOP" ' +
              (
                prod &&
                prod.metodoPagamento === 'NETSHOP'
                  ? 'selected'
                  : ''
              ) +
            '>Netshop</option>' +

          '</select>' +

        '</div>' +

        '<div class="form-group" id="wg" style="' +
          (
            isDigital ||
            (
              prod &&
              prod.metodoPagamento === 'NETSHOP'
            )
              ? 'display:none;'
              : ''
          ) +
        '">' +

          '<label>WhatsApp</label>' +

          '<input type="tel" id="pWpp" value="' +
            escAttr(prod ? prod.whatsapp : '') +
          '">' +

        '</div>' +

        '<div class="form-group" id="dg" style="' +
          (!isDigital ? 'display:none;' : '') +
        '">' +

          '<label>Link Download</label>' +

          '<input type="url" id="pDown" value="' +
            escAttr(prod ? prod.downloadUrl : '') +
          '">' +

          '<small>Obrigatório para produtos digitais.</small>' +

        '</div>' +

        (
          isEdit

          ?

          '<input type="hidden" id="editPid" value="' +
            escAttr(prod.produtoId) +
          '">'

          :

          ''
        ) +

        '<button type="submit" id="productSubmitBtn" class="btn btn-verde btn-block" style="margin-bottom:12px;">' +

          (
            isEdit
              ? '💾 GUARDAR ALTERAÇÕES'
              : '✅ PUBLICAR PRODUTO'
          ) +

        '</button>' +

        '<button type="button" class="btn btn-outline btn-block" onclick="go(\'meusProdutos\')">' +
          'Cancelar' +
        '</button>' +

      '</form>' +

    '</div>';
}

function onTipoChg() {

  var tipoEl =
    document.getElementById('pTipo');

  var met =
    document.getElementById('pMetodo');

  var dg =
    document.getElementById('dg');

  var wg =
    document.getElementById('wg');

  if (!tipoEl || !met) return;

  var tipo =
    tipoEl.value;

  if (tipo === 'DIGITAL') {

    met.value =
      'NETSHOP';

    met.disabled =
      true;

    if (dg) {
      dg.style.display =
        'block';
    }

    if (wg) {
      wg.style.display =
        'none';
    }

  } else {

    met.disabled =
      false;

    if (dg) {
      dg.style.display =
        'none';
    }

    onMetodoChg();
  }
}

function onMetodoChg() {

  var met =
    document.getElementById('pMetodo');

  var wg =
    document.getElementById('wg');

  if (!met || !wg) return;

  wg.style.display =
    met.value === 'WHATSAPP'
      ? 'block'
      : 'none';
}

/* ============================================================
   CRIAR PRODUTO
   ============================================================ */

function doAddProd() {

  var btn =
    document.getElementById(
      'productSubmitBtn'
    );

  var tipo =
    document.getElementById('pTipo').value;

  var metodo =
    document.getElementById('pMetodo').value;

  var data = {

    token:
      state.token,

    nome:
      document.getElementById('pNome').value.trim(),

    descricao:
      document.getElementById('pDesc').value.trim(),

    imagemUrl:
      document.getElementById('pImg').value.trim(),

    preco:
      document.getElementById('pPreco').value,

    tipo:
      tipo,

    metodoPagamento:
      metodo,

    whatsapp:
      document.getElementById('pWpp')
        ? document.getElementById('pWpp').value.trim()
        : '',

    downloadUrl:
      document.getElementById('pDown')
        ? document.getElementById('pDown').value.trim()
        : ''
  };

  if (!data.nome ||
      !data.descricao ||
      !data.preco) {

    toast(
      'Preencha os campos obrigatórios.',
      'error'
    );

    return;
  }

  if (tipo === 'DIGITAL' &&
      !data.downloadUrl) {

    toast(
      'Informe o link de download.',
      'error'
    );

    return;
  }

  if (tipo === 'FISICO' &&
      metodo === 'WHATSAPP' &&
      !data.whatsapp) {

    toast(
      'Informe o WhatsApp do vendedor.',
      'error'
    );

    return;
  }

  if (btn) {

    btn.disabled = true;

    btn.innerHTML =
      '⏳ A PUBLICAR...';
  }

  apiPost(
    'criarProduto',
    data
  )

  .then(function (res) {

    if (res && res.ok) {

      toast(
        'Produto publicado com sucesso!'
      );

      go('meusProdutos');

    } else {

      toast(
        (res && res.erro) ||
        'Erro ao publicar produto.',
        'error'
      );
    }
  })

  .catch(function (e) {

    console.error(e);

    toast(
      'Erro: ' + e.message,
      'error'
    );
  })

  .finally(function () {

    if (btn) {

      btn.disabled = false;

      btn.innerHTML =
        '✅ PUBLICAR PRODUTO';
    }
  });
}

/* ============================================================
   EDITAR PRODUTO
   ============================================================ */

function doEditProd() {

  var btn =
    document.getElementById(
      'productSubmitBtn'
    );

  var data = {

    token:
      state.token,

    produtoId:
      document.getElementById('editPid').value,

    nome:
      document.getElementById('pNome').value.trim(),

    descricao:
      document.getElementById('pDesc').value.trim(),

    imagemUrl:
      document.getElementById('pImg').value.trim(),

    preco:
      document.getElementById('pPreco').value,

    metodoPagamento:
      document.getElementById('pMetodo').value,

    whatsapp:
      document.getElementById('pWpp')
        ? document.getElementById('pWpp').value.trim()
        : '',

    downloadUrl:
      document.getElementById('pDown')
        ? document.getElementById('pDown').value.trim()
        : ''
  };

  if (!data.nome ||
      !data.descricao ||
      !data.preco) {

    toast(
      'Preencha os campos obrigatórios.',
      'error'
    );

    return;
  }

  if (btn) {

    btn.disabled = true;

    btn.innerHTML =
      '⏳ A GUARDAR...';
  }

  apiPost(
    'editarProduto',
    data
  )

  .then(function (res) {

    if (res && res.ok) {

      toast(
        'Produto atualizado com sucesso!'
      );

      go('meusProdutos');

    } else {

      toast(
        (res && res.erro) ||
        'Erro ao atualizar produto.',
        'error'
      );
    }
  })

  .catch(function (e) {

    console.error(e);

    toast(
      'Erro: ' + e.message,
      'error'
    );
  })

  .finally(function () {

    if (btn) {

      btn.disabled = false;

      btn.innerHTML =
        '💾 GUARDAR ALTERAÇÕES';
    }
  });
}

/* ============================================================
   VENDAS
   ============================================================ */

function renderMinhasVendas() {

  if (!checkAuth()) return;

  var p =
    document.getElementById(
      'pageMinhasVendas'
    );

  if (!p) return;

  p.classList.remove('hidden');

  p.innerHTML =
    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>Carregando vendas...</p>' +
    '</div>';

  apiGet(
    'minhasVendas',
    {
      token: state.token
    }
  )

  .then(function (res) {

    var vendas =
      res.vendas || [];

    p.innerHTML =

      '<div class="dashboard">' +

        '<button class="btn btn-outline" onclick="go(\'dashboard\')" style="margin-bottom:16px;">' +
          '← Painel' +
        '</button>' +

        '<h2 style="color:var(--verde-escuro);margin-bottom:24px;">' +
          '📊 Minhas Vendas' +
        '</h2>' +

        '<div class="table-container">' +

          '<table>' +

            '<thead>' +

              '<tr>' +
                '<th>Data</th>' +
                '<th>Produto</th>' +
                '<th>Cliente</th>' +
                '<th>Valor</th>' +
                '<th>Taxa</th>' +
                '<th>Líquido</th>' +
                '<th>Status</th>' +
              '</tr>' +

            '</thead>' +

            '<tbody>' +

              (
                vendas.length === 0

                ?

                '<tr>' +
                  '<td colspan="7" style="text-align:center;padding:30px;">' +
                    'Nenhuma venda encontrada.' +
                  '</td>' +
                '</tr>'

                :

                vendas.map(function (v) {

                  return (

                    '<tr>' +

                      '<td>' +
                        fmtDate(v.data) +
                      '</td>' +

                      '<td>' +
                        esc(v.produtoId) +
                      '</td>' +

                      '<td>' +
                        esc(v.clienteTelefone || '-') +
                      '</td>' +

                      '<td>' +
                        fmtMoney(v.valorBruto) +
                      '</td>' +

                      '<td>' +
                        fmtMoney(v.valorTaxa) +
                      '</td>' +

                      '<td>' +
                        '<strong>' +
                          fmtMoney(v.valorLiquido) +
                        '</strong>' +
                      '</td>' +

                      '<td>' +

                        '<span class="badge ' +
                          (
                            v.status === 'APROVADO'
                              ? 'badge-sucesso'
                              : v.status === 'PENDENTE'
                                ? 'badge-pendente'
                                : 'badge-falha'
                          ) +
                        '">' +

                          esc(v.status) +

                        '</span>' +

                      '</td>' +

                    '</tr>'
                  );

                }).join('')
              ) +

            '</tbody>' +

          '</table>' +

        '</div>' +

      '</div>';
  })

  .catch(function (e) {

    console.error(e);

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +
          esc(e.message) +
        '</p>' +

        '<button class="btn btn-verde" onclick="renderMinhasVendas()">' +
          '🔄 Tentar novamente' +
        '</button>' +

      '</div>';
  });
}

/* ============================================================
   CARTEIRA
   ============================================================ */

function renderCarteira() {

  if (!checkAuth()) return;

  var p =
    document.getElementById(
      'pageCarteira'
    );

  if (!p) return;

  p.classList.remove('hidden');

  p.innerHTML =
    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>Carregando carteira...</p>' +
    '</div>';

  apiGet(
    'minhaCarteira',
    {
      token: state.token
    }
  )

  .then(function (res) {

    if (!res || !res.ok) {

      p.innerHTML =

        '<div class="empty-state">' +

          '<div class="icon">😕</div>' +

          '<p>' +
            esc(
              res && res.erro
                ? res.erro
                : 'Não foi possível carregar a carteira.'
            ) +
          '</p>' +

          '<button class="btn btn-verde" onclick="renderCarteira()">' +
            '🔄 Tentar novamente' +
          '</button>' +

        '</div>';

      return;
    }

    var c =
      res.carteira || {};

    p.innerHTML =

      '<div class="dashboard">' +

        '<button class="btn btn-outline" onclick="go(\'dashboard\')" style="margin-bottom:16px;">' +
          '← Painel' +
        '</button>' +

        '<h2 style="color:var(--verde-escuro);margin-bottom:24px;">' +
          '💰 Carteira' +
        '</h2>' +

        '<div class="stats-grid">' +

          '<div class="stat-card dourado">' +
            '<div class="label">Wallet</div>' +
            '<div class="value" style="font-size:1.1rem;">' +
              esc(c.walletId || '-') +
            '</div>' +
          '</div>' +

          '<div class="stat-card">' +
            '<div class="label">Bruto</div>' +
            '<div class="value">' +
              fmtMoney(c.valorBruto) +
            '</div>' +
          '</div>' +

          '<div class="stat-card vermelho">' +
            '<div class="label">Taxas</div>' +
            '<div class="value">' +
              fmtMoney(c.taxa) +
            '</div>' +
          '</div>' +

          '<div class="stat-card dourado">' +
            '<div class="label">Líquido</div>' +
            '<div class="value">' +
              fmtMoney(c.valorLiquido) +
            '</div>' +
          '</div>' +

        '</div>' +

      '</div>';
  })

  .catch(function (e) {

    console.error(e);

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +
          esc(e.message) +
        '</p>' +

        '<button class="btn btn-verde" onclick="renderCarteira()">' +
          '🔄 Tentar novamente' +
        '</button>' +

      '</div>';
  });
}

/* ============================================================
   PLANO
   ============================================================ */

function renderPlano() {

  if (!checkAuth()) return;

  var p =
    document.getElementById(
      'pagePlano'
    );

  if (!p) return;

  p.classList.remove('hidden');

  p.innerHTML =
    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>Carregando plano...</p>' +
    '</div>';

  apiGet(
    'meuPlano',
    {
      token: state.token
    }
  )

  .then(function (res) {

    if (!res || !res.ok) {

      throw new Error(
        res && res.erro
          ? res.erro
          : 'Não foi possível carregar o plano.'
      );
    }

    var pl =
      res.plano || {};

    p.innerHTML =

      '<div class="dashboard">' +

        '<button class="btn btn-outline" onclick="go(\'dashboard\')" style="margin-bottom:16px;">' +
          '← Painel' +
        '</button>' +

        '<h2 style="color:var(--verde-escuro);margin-bottom:8px;">' +
          '📋 Meu Plano' +
        '</h2>' +

        '<p style="color:var(--cinza);margin-bottom:24px;">' +

          'Atual: <strong>' +
            esc(pl.nome) +
          '</strong> | ' +

          'Status: <strong>' +
            esc(pl.status) +
          '</strong> | ' +

          'Expira: ' +
            fmtDate(pl.expira) +

        '</p>' +

        '<div class="plans-grid">' +

          planCard(
            'SIMPLES',
            'Simples',
            '50',
            '3 produtos',
            'Taxa 17%',
            pl.nome
          ) +

          planCard(
            'MEDIO',
            'Médio',
            '200',
            '10 produtos',
            'Taxa 15%',
            pl.nome
          ) +

          planCard(
            'PRO',
            'Pro',
            '1.000',
            'Ilimitado',
            'Taxa 14%',
            pl.nome,
            true
          ) +

        '</div>' +

      '</div>';
  })

  .catch(function (e) {

    console.error(e);

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +
          esc(e.message) +
        '</p>' +

        '<button class="btn btn-verde" onclick="renderPlano()">' +
          '🔄 Tentar novamente' +
        '</button>' +

      '</div>';
  });
}

function planCard(
  codigo,
  nome,
  preco,
  limite,
  taxa,
  atual,
  dourado
) {

  var isAtual =
    atual === codigo;

  return (

    '<div class="plan-card ' +
      (isAtual ? 'destaque' : '') +
    '">' +

      '<h3>' +
        nome +
      '</h3>' +

      '<div class="preco">' +
        preco +
        ' <span>MT/mês</span>' +
      '</div>' +

      '<ul class="plan-features">' +

        '<li>' +
          limite +
        '</li>' +

        '<li>' +
          taxa +
        '</li>' +

      '</ul>' +

      '<button class="' +
        (
          dourado
            ? 'btn btn-dourado'
            : 'btn btn-verde'
        ) +
        ' btn-block" ' +

        'onclick="renovarPlan(\'' +
          codigo +
        '\')" ' +

        (
          isAtual
            ? 'disabled style="opacity:0.5"'
            : ''
        ) +
      '>' +

        (
          isAtual
            ? 'Plano Atual'
            : 'Escolher'
        ) +

      '</button>' +

    '</div>'
  );
}

function renovarPlan(plano) {

  var metodo =
    prompt(
      'Método de pagamento: mpesa, emola, mkesh ou card',
      'mpesa'
    );

  if (!metodo) return;

  metodo =
    metodo.trim().toLowerCase();

  var permitidos =
    [
      'mpesa',
      'emola',
      'mkesh',
      'card'
    ];

  if (permitidos.indexOf(metodo) === -1) {

    toast(
      'Método de pagamento inválido.',
      'error'
    );

    return;
  }

  var tel =
    prompt(
      'Telefone:',
      state.vendedor
        ? state.vendedor.telefone
        : '+258'
    );

  if (!tel) return;

  toast(
    'Processando pagamento...'
  );

  apiPost(
    'renovarPlano',
    {
      token: state.token,
      plano: plano,
      metodoPagamento: metodo,
      telefone: tel
    }
  )

  .then(function (res) {

    if (res && res.ok && res.checkoutUrl) {

      toast(
        'Pagamento criado. Abrindo checkout...'
      );

      window.open(
        res.checkoutUrl,
        '_blank'
      );

    } else if (res && res.ok) {

      toast(
        res.msg ||
        'Pagamento iniciado.'
      );

    } else {

      toast(
        (res && res.erro) ||
        'Erro no pagamento.',
        'error'
      );
    }
  })

  .catch(function (e) {

    console.error(e);

    toast(
      'Erro: ' + e.message,
      'error'
    );
  });
}

/* ============================================================
   VENDER
   ============================================================ */

function renderVender() {

  var p =
    document.getElementById(
      'pageVender'
    );

  if (!p) return;

  p.classList.remove('hidden');

  p.innerHTML =

    '<div class="hero" style="padding:100px 24px;">' +

      '<h1>🚀 Venda na ' +
        esc(CONFIG.APP_NAME) +
      '</h1>' +

      '<p>' +
        'Alcance clientes em Moçambique.' +
      '</p>' +

      '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:24px;">' +

        '<button class="btn btn-dourado" onclick="go(\'registo\')">' +
          '🚀 Começar a Vender' +
        '</button>' +

        '<button class="btn btn-outline" onclick="go(\'login\')">' +
          '👤 Já sou Vendedor' +
        '</button>' +

        '<button class="btn btn-verde" onclick="go(\'produtos\')">' +
          '🛍️ Explorar Produtos' +
        '</button>' +

      '</div>' +

    '</div>' +

    '<div style="max-width:1000px;margin:0 auto;padding:60px 24px;">' +

      '<h2 style="text-align:center;color:var(--verde-escuro);margin-bottom:48px;">' +
        'Por que vender connosco?' +
      '</h2>' +

      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:32px;">' +

        '<div style="text-align:center;">' +
          '<div style="font-size:3rem;margin-bottom:16px;">📱</div>' +
          '<h3>Fácil</h3>' +
          '<p style="color:var(--cinza);">Cadastre-se em minutos.</p>' +
        '</div>' +

        '<div style="text-align:center;">' +
          '<div style="font-size:3rem;margin-bottom:16px;">💳</div>' +
          '<h3>Seguro</h3>' +
          '<p style="color:var(--cinza);">M-Pesa, e-Mola, mKesh e cartões.</p>' +
        '</div>' +

        '<div style="text-align:center;">' +
          '<div style="font-size:3rem;margin-bottom:16px;">📊</div>' +
          '<h3>Controle</h3>' +
          '<p style="color:var(--cinza);">Dashboard completo.</p>' +
        '</div>' +

      '</div>' +

      '<div style="margin-top:60px;">' +

        '<h2 style="text-align:center;color:var(--verde-escuro);margin-bottom:32px;">' +
          'Planos' +
        '</h2>' +

        '<div class="plans-grid">' +

          '<div class="plan-card">' +
            '<h3>Simples</h3>' +
            '<div class="preco">50 <span>MT/mês</span></div>' +
            '<ul class="plan-features">' +
              '<li>3 produtos</li>' +
              '<li>Taxa 17%</li>' +
            '</ul>' +
            '<button class="btn btn-verde btn-block" onclick="go(\'registo\')">' +
              'Começar' +
            '</button>' +
          '</div>' +

          '<div class="plan-card">' +
            '<h3>Médio</h3>' +
            '<div class="preco">200 <span>MT/mês</span></div>' +
            '<ul class="plan-features">' +
              '<li>10 produtos</li>' +
              '<li>Taxa 15%</li>' +
            '</ul>' +
            '<button class="btn btn-verde btn-block" onclick="go(\'registo\')">' +
              'Começar' +
            '</button>' +
          '</div>' +

          '<div class="plan-card destaque">' +
            '<h3>Pro</h3>' +
            '<div class="preco">1.000 <span>MT/mês</span></div>' +
            '<ul class="plan-features">' +
              '<li>Ilimitado</li>' +
              '<li>Taxa 14%</li>' +
            '</ul>' +
            '<button class="btn btn-dourado btn-block" onclick="go(\'registo\')">' +
              'Começar' +
            '</button>' +
          '</div>' +

        '</div>' +

      '</div>' +

    '</div>';
}

/* ============================================================
   API GET
   ============================================================ */

function apiGet(action, params) {

  params = params || {};

  var url =
    CONFIG.API_URL +
    '?action=' +
    encodeURIComponent(action);

  for (var k in params) {

    if (
      params[k] !== null &&
      params[k] !== undefined &&
      params[k] !== ''
    ) {

      url +=
        '&' +
        encodeURIComponent(k) +
        '=' +
        encodeURIComponent(params[k]);
    }
  }

  return fetch(
    url,
    {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    }
  )

  .then(function (r) {

    if (!r.ok) {

      throw new Error(
        'HTTP ' + r.status
      );
    }

    return r.text();
  })

  .then(function (txt) {

    if (!txt || !txt.trim()) {

      throw new Error(
        'Resposta vazia do servidor.'
      );
    }

    var clean =
      txt.trim();

    if (
      clean.charAt(0) === '<'
    ) {

      throw new Error(
        'O servidor retornou HTML. Verifique a implantação do Web App GAS.'
      );
    }

    try {

      return JSON.parse(clean);

    } catch (e) {

      console.error(
        'Resposta recebida:',
        clean
      );

      throw new Error(
        'Resposta inválida do servidor.'
      );
    }
  });
}

/* ============================================================
   API POST
   ============================================================ */

function apiPost(action, data) {

  data = data || {};

  var payload =
    Object.assign(
      {
        action: action
      },
      data
    );

  return fetch(
    CONFIG.API_URL,
    {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type':
          'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    }
  )

  .then(function (r) {

    if (!r.ok) {

      throw new Error(
        'HTTP ' + r.status
      );
    }

    return r.text();
  })

  .then(function (txt) {

    if (!txt || !txt.trim()) {

      throw new Error(
        'Resposta vazia do servidor.'
      );
    }

    var clean =
      txt.trim();

    if (
      clean.charAt(0) === '<'
    ) {

      throw new Error(
        'O servidor retornou HTML. Verifique a implantação do Web App GAS.'
      );
    }

    try {

      return JSON.parse(clean);

    } catch (e) {

      console.error(
        'Resposta recebida:',
        clean
      );

      throw new Error(
        'Resposta inválida do servidor.'
      );
    }
  });
}

/* ============================================================
   TRATAMENTO GLOBAL DE ERROS JAVASCRIPT
   ============================================================ */

window.addEventListener(
  'error',
  function (event) {

    console.error(
      'Erro JavaScript:',
      event.error || event.message
    );

    toast(
      'Ocorreu um erro na aplicação.',
      'error'
    );
  }
);

window.addEventListener(
  'unhandledrejection',
  function (event) {

    console.error(
      'Promise rejeitada:',
      event.reason
    );

    toast(
      'Erro de comunicação com o servidor.',
      'error'
    );
  }
);

/* ============================================================
   INIT
   ============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  function () {

    try {

      updateHeader();

      navigate('home');

    } catch (e) {

      console.error(
        'Erro na inicialização:',
        e
      );

      toast(
        'Erro ao iniciar a aplicação.',
        'error'
      );
    }
  }
);
