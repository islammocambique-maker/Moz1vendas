/**
 * ============================================================
 * MOZ1VENDAS - FRONTEND
 * ============================================================
 *
 * Frontend:
 *   HTML + CSS + JavaScript
 *
 * Backend:
 *   Google Sheets
 *
 * Motor/API:
 *   Google Apps Script (GAS)
 *
 * IMPORTANTE:
 *   O GAS deve estar publicado como Web App:
 *   - Executar como: você
 *   - Quem tem acesso: qualquer pessoa
 *
 * ============================================================
 */

'use strict';

/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */

var CONFIG = {

  API_URL:
    'https://script.google.com/macros/s/AKfycbzjEcGPI6LoR1JbaMG8MyK9yLmgGPoyOlGOkcJ2feQLQlXWEFLF3IBZcosrI7gmyR8Q/exec',

  APP_NAME: 'MOZ1VENDAS',

  TIMEOUT: 30000
};


/* ============================================================
   ESTADO DA APLICAÇÃO
   ============================================================ */

var state = {

  token:
    localStorage.getItem('mz1_token') || null,

  vendedor:
    JSON.parse(
      localStorage.getItem('mz1_vendedor') || 'null'
    ),

  produtos: [],

  produtoAtual: null,

  currentPage: 'home'

};


/* ============================================================
   HELPERS DOM
   ============================================================ */

function $(sel) {
  return document.querySelector(sel);
}

function $$(sel) {
  return document.querySelectorAll(sel);
}


/* ============================================================
   FORMATAÇÃO
   ============================================================ */

function fmtMoney(v) {

  var valor = Number(v);

  if (isNaN(valor)) {
    valor = 0;
  }

  return valor.toLocaleString(
    'pt-MZ',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ) + ' MT';
}


function fmtDate(s) {

  if (!s) {
    return '-';
  }

  try {

    var d = new Date(s);

    if (isNaN(d.getTime())) {
      return String(s);
    }

    return d.toLocaleDateString('pt-MZ');

  } catch (e) {

    return String(s);
  }
}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function esc(t) {

  if (t === null || t === undefined) {
    return '';
  }

  var d = document.createElement('div');

  d.textContent = String(t);

  return d.innerHTML;
}


/* ============================================================
   ESCAPE PARA ATRIBUTOS
   ============================================================ */

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

  var c =
    document.getElementById('toastContainer');

  if (!c) {

    c = document.createElement('div');

    c.id = 'toastContainer';

    c.className = 'toast-container';

    document.body.appendChild(c);
  }

  var t =
    document.createElement('div');

  t.className =
    'toast ' + type;

  t.textContent =
    msg || '';

  c.appendChild(t);

  setTimeout(function () {

    if (t && t.parentNode) {
      t.parentNode.removeChild(t);
    }

  }, 4000);
}


/* ============================================================
   LOADING
   ============================================================ */

function loadingHtml() {

  return `
    <div class="loading">
      <div class="spinner"></div>
    </div>
  `;
}


/* ============================================================
   ERRO
   ============================================================ */

function erroHtml(msg, retryFn) {

  return `
    <div class="empty-state"
         style="grid-column:1/-1;">

      <div class="icon">📡</div>

      <p>
        <strong>Erro de conexão</strong>
      </p>

      <p style="font-size:0.85rem;color:#999;">
        ${esc(msg || 'Não foi possível comunicar com o servidor.')}
      </p>

      ${
        retryFn
        ?
        `
        <button
          class="btn btn-verde"
          style="margin-top:12px;"
          onclick="${escAttr(retryFn)}()">
          Tentar novamente
        </button>
        `
        :
        ''
      }

    </div>
  `;
}


/* ============================================================
   NORMALIZAR RESPOSTA
   ============================================================ */

function parseApiResponse(text) {

  if (!text) {

    throw new Error(
      'O servidor não enviou nenhuma resposta.'
    );
  }

  var txt =
    String(text).trim();

  /*
   * GAS pode eventualmente retornar HTML
   * quando a URL não está correta ou o Web App
   * não está publicado corretamente.
   */

  if (
    txt.charAt(0) === '<' ||
    txt.indexOf('<!DOCTYPE') === 0 ||
    txt.indexOf('<html') === 0
  ) {

    throw new Error(
      'O GAS retornou HTML em vez de JSON. ' +
      'Verifique a publicação do Web App e a URL da API.'
    );
  }

  try {

    return JSON.parse(txt);

  } catch (e) {

    console.error(
      'Resposta recebida do GAS:',
      txt
    );

    throw new Error(
      'Resposta inválida do servidor.'
    );
  }
}


/* ============================================================
   FETCH COM TIMEOUT
   ============================================================ */

function fetchWithTimeout(url, options) {

  options = options || {};

  var controller = null;

  if (window.AbortController) {

    controller =
      new AbortController();

    options.signal =
      controller.signal;
  }

  return new Promise(function(resolve, reject) {

    var finished = false;

    var timer =
      setTimeout(function() {

        if (finished) {
          return;
        }

        finished = true;

        if (controller) {
          controller.abort();
        }

        reject(
          new Error(
            'Tempo limite excedido. Verifique a ligação à internet ou o Web App do GAS.'
          )
        );

      }, CONFIG.TIMEOUT);


    fetch(url, options)

      .then(function(response) {

        if (finished) {
          return;
        }

        finished = true;

        clearTimeout(timer);

        resolve(response);

      })

      .catch(function(error) {

        if (finished) {
          return;
        }

        finished = true;

        clearTimeout(timer);

        reject(error);

      });

  });
}


/* ============================================================
   API GET
   ============================================================ */

function apiGet(action, params) {

  params = params || {};

  if (!CONFIG.API_URL) {

    return Promise.reject(
      new Error('API_URL não configurada.')
    );
  }

  var url =
    CONFIG.API_URL +
    '?action=' +
    encodeURIComponent(action);


  Object.keys(params).forEach(function(k) {

    var value = params[k];

    if (
      value !== null &&
      value !== undefined &&
      value !== ''
    ) {

      url +=
        '&' +
        encodeURIComponent(k) +
        '=' +
        encodeURIComponent(value);
    }

  });


  return fetchWithTimeout(
    url,
    {
      method: 'GET',

      mode: 'cors',

      cache: 'no-store',

      redirect: 'follow',

      credentials: 'omit',

      headers: {
        'Accept': 'application/json'
      }
    }
  )

  .then(function(response) {

    if (!response.ok) {

      throw new Error(
        'HTTP ' + response.status
      );
    }

    return response.text();
  })

  .then(function(text) {

    return parseApiResponse(text);

  })

  .catch(function(error) {

    console.error(
      'API GET:',
      action,
      error
    );

    throw error;
  });
}


/* ============================================================
   API POST
   ============================================================ */

function apiPost(action, data) {

  data = data || {};

  if (!CONFIG.API_URL) {

    return Promise.reject(
      new Error('API_URL não configurada.')
    );
  }


  var payload =
    Object.assign(
      {
        action: action
      },
      data
    );


  return fetchWithTimeout(

    CONFIG.API_URL,

    {
      method: 'POST',

      mode: 'cors',

      cache: 'no-store',

      redirect: 'follow',

      credentials: 'omit',

      headers: {
        'Content-Type':
          'text/plain;charset=utf-8',

        'Accept':
          'application/json'
      },

      body:
        JSON.stringify(payload)
    }

  )

  .then(function(response) {

    if (!response.ok) {

      throw new Error(
        'HTTP ' + response.status
      );
    }

    return response.text();
  })

  .then(function(text) {

    return parseApiResponse(text);

  })

  .catch(function(error) {

    console.error(
      'API POST:',
      action,
      error
    );

    throw error;
  });
}


/* ============================================================
   ROUTER
   ============================================================ */

function navigate(page, params) {

  params = params || {};

  state.currentPage =
    page || 'home';

  window.scrollTo(
    0,
    0
  );


  $$('.page').forEach(function(p) {

    p.classList.add('hidden');

  });


  updateHeader();


  switch (state.currentPage) {

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
      renderHome();
  }
}


/* ============================================================
   HEADER
   ============================================================ */

function updateHeader() {

  var h =
    document.getElementById(
      'appHeader'
    );

  if (!h) {
    return;
  }


  var logged =
    !!state.token;


  h.innerHTML =

    '<div class="header-inner">' +

      '<div class="logo" onclick="navigate(\'home\')">' +

        '<div class="logo-icon">🛒</div>' +

        '<span>' +
          esc(CONFIG.APP_NAME) +
        '</span>' +

      '</div>' +


      '<nav class="nav-links">' +

        '<a onclick="navigate(\'home\')">' +
          'Início' +
        '</a>' +

        '<a onclick="navigate(\'produtos\')">' +
          'Produtos' +
        '</a>' +

        '<a onclick="navigate(\'vender\')">' +
          'Vender' +
        '</a>' +

        (
          logged

          ?

          '<a onclick="navigate(\'dashboard\')">' +
            'Painel' +
          '</a>' +

          '<a onclick="logout()">' +
            'Sair' +
          '</a>'

          :

          '<a onclick="navigate(\'login\')">' +
            'Entrar' +
          '</a>'
        ) +

      '</nav>' +


      '<button ' +
        'class="mobile-menu-btn" ' +
        'onclick="toggleMobileMenu()">' +
        '☰' +
      '</button>' +

    '</div>';
}


/* ============================================================
   MENU MOBILE
   ============================================================ */

function toggleMobileMenu() {

  var nav =
    document.querySelector(
      '.nav-links'
    );

  if (!nav) {
    return;
  }

  nav.classList.toggle(
    'mobile-open'
  );
}


/* ============================================================
   HOME
   ============================================================ */

function renderHome() {

  var p =
    document.getElementById(
      'pageHome'
    );

  if (!p) {
    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =

    '<div class="hero">' +

      '<h1>' +
        'Compre e Venda em Moçambique' +
      '</h1>' +

      '<p>' +
        'O marketplace mais simples e seguro.' +
      '</p>' +

      '<button ' +
        'class="btn btn-dourado" ' +
        'onclick="navigate(\'produtos\')">' +

        'Explorar Produtos' +

      '</button>' +

    '</div>' +


    '<div class="search-container">' +

      '<div class="search-box">' +

        '<input ' +
          'type="text" ' +
          'id="searchInput" ' +
          'placeholder="Pesquisar produtos..." ' +
          'onkeypress="if(event.key===\'Enter\')searchProducts()">' +

        '<button ' +
          'class="btn btn-verde" ' +
          'onclick="searchProducts()">' +

          '🔍 Pesquisar' +

        '</button>' +

      '</div>' +

    '</div>' +


    '<div class="categories">' +

      '<h2>📂 Categorias</h2>' +

      '<div class="cat-grid">' +

        '<div ' +
          'class="cat-card" ' +
          'onclick="filterByCategory(\'FISICO\')">' +

          '<div class="icon">📦</div>' +

          '<span>Produtos Físicos</span>' +

        '</div>' +


        '<div ' +
          'class="cat-card" ' +
          'onclick="filterByCategory(\'DIGITAL\')">' +

          '<div class="icon">💾</div>' +

          '<span>Produtos Digitais</span>' +

        '</div>' +


        '<div ' +
          'class="cat-card" ' +
          'onclick="navigate(\'produtos\')">' +

          '<div class="icon">🔥</div>' +

          '<span>Mais Vendidos</span>' +

        '</div>' +


        '<div ' +
          'class="cat-card" ' +
          'onclick="navigate(\'produtos\')">' +

          '<div class="icon">⭐</div>' +

          '<span>Novidades</span>' +

        '</div>' +

      '</div>' +

    '</div>' +


    '<div class="products-section">' +

      '<h2>🛍️ Produtos em Destaque</h2>' +

      '<div ' +
        'id="homeProducts" ' +
        'class="products-grid">' +

      '</div>' +

    '</div>';


  loadHomeProducts();
}


/* ============================================================
   PRODUTOS HOME
   ============================================================ */

function loadHomeProducts() {

  var c =
    document.getElementById(
      'homeProducts'
    );

  if (!c) {
    return;
  }


  c.innerHTML =
    loadingHtml();


  apiGet(
    'produtos'
  )

  .then(function(res) {

    state.produtos =
      Array.isArray(res.produtos)
      ?
      res.produtos
      :
      [];


    renderGrid(
      c,
      state.produtos.slice(
        0,
        8
      )
    );

  })

  .catch(function(e) {

    c.innerHTML =
      erroHtml(
        e.message,
        'loadHomeProducts'
      );

  });
}


/* ============================================================
   GRID PRODUTOS
   ============================================================ */

function renderGrid(
  container,
  items
) {

  if (
    !items ||
    !items.length
  ) {

    container.innerHTML =

      '<div ' +
        'class="empty-state" ' +
        'style="grid-column:1/-1;">' +

        '<div class="icon">📭</div>' +

        '<p>Nenhum produto encontrado.</p>' +

      '</div>';

    return;
  }


  container.innerHTML =
    items.map(function(p) {

      var id =
        escAttr(p.produtoId);


      var image =
        p.imagemUrl
        ?

        '<img ' +
          'src="' +
          escAttr(p.imagemUrl) +
          '" ' +
          'alt="' +
          escAttr(p.nome) +
          '" ' +

          'onerror="' +
            'this.style.display=\'none\';' +
            'this.parentElement.innerHTML=\'🛒\';' +
          '">' +

        ''

        :

        '🛒';


      return

        '<div ' +
          'class="product-card" ' +
          'onclick="navigate(\'produto\',{id:\'' +
            id +
          '\'})">' +

          '<div class="product-img">' +
            image +
          '</div>' +

          '<div class="product-info">' +

            '<span class="product-type ' +
              (
                p.tipo === 'DIGITAL'
                ?
                'type-digital'
                :
                'type-fisico'
              ) +
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
              'class="btn btn-verde btn-sm btn-block">' +

              'Ver Produto' +

            '</button>' +

          '</div>' +

        '</div>';

    }).join('');
}


/* ============================================================
   LISTAGEM DE PRODUTOS
   ============================================================ */

function renderProdutos(params) {

  params = params || {};

  var p =
    document.getElementById(
      'pageProdutos'
    );

  if (!p) {
    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =

    '<div ' +
      'style="padding:32px 24px;max-width:1400px;margin:0 auto;">' +

      '<div ' +
        'class="search-container" ' +
        'style="margin:0 0 32px 0;">' +

        '<div class="search-box">' +

          '<input ' +
            'type="text" ' +
            'id="prodSearchInput" ' +
            'placeholder="Pesquisar..." ' +
            'value="' +
              escAttr(params.search || '') +
            '" ' +

            'onkeypress="' +
              'if(event.key===\'Enter\')searchProductsPage()' +
            '">' +

          '<button ' +
            'class="btn btn-verde" ' +
            'onclick="searchProductsPage()">' +

            '🔍' +

          '</button>' +

        '</div>' +

      '</div>' +


      '<h2 ' +
        'style="margin-bottom:24px;color:var(--verde-escuro);">' +

        '🛍️ Produtos' +

      '</h2>' +


      '<div ' +
        'id="allProducts" ' +
        'class="products-grid">' +

      '</div>' +

    '</div>';


  loadAllProducts(
    params.search,
    params.categoria
  );
}


/* ============================================================
   CARREGAR TODOS PRODUTOS
   ============================================================ */

function loadAllProducts(
  search,
  categoria
) {

  var c =
    document.getElementById(
      'allProducts'
    );

  if (!c) {
    return;
  }


  c.innerHTML =
    loadingHtml();


  apiGet(
    'produtos',
    {
      search: search || '',
      categoria: categoria || ''
    }
  )

  .then(function(res) {

    state.produtos =
      Array.isArray(res.produtos)
      ?
      res.produtos
      :
      [];


    renderGrid(
      c,
      state.produtos
    );

  })

  .catch(function(e) {

    c.innerHTML =
      erroHtml(
        e.message,
        'loadAllProducts'
      );

  });
}


/* ============================================================
   PESQUISA
   ============================================================ */

function searchProducts() {

  var input =
    document.getElementById(
      'searchInput'
    );

  if (!input) {
    return;
  }


  var q =
    input.value.trim();


  navigate(
    'produtos',
    {
      search: q
    }
  );
}


function searchProductsPage() {

  var input =
    document.getElementById(
      'prodSearchInput'
    );

  if (!input) {
    return;
  }


  loadAllProducts(
    input.value.trim(),
    ''
  );
}


function filterByCategory(cat) {

  navigate(
    'produtos',
    {
      categoria: cat
    }
  );
}


/* ============================================================
   DETALHE DO PRODUTO
   ============================================================ */

function renderProduto(id) {

  var p =
    document.getElementById(
      'pageProduto'
    );

  if (!p) {
    return;
  }


  if (!id) {

    p.classList.remove(
      'hidden'
    );

    p.innerHTML =
      '<div class="empty-state">' +
        '<div class="icon">😕</div>' +
        '<p>Produto inválido.</p>' +
      '</div>';

    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =
    loadingHtml();


  apiGet(
    'produto',
    {
      id: id
    }
  )

  .then(function(res) {

    if (!res || !res.ok || !res.produto) {

      p.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon">😕</div>' +
          '<p>Produto não encontrado.</p>' +
        '</div>';

      return;
    }


    var prod =
      res.produto;


    state.produtoAtual =
      prod;


    var isNetshop =
      String(
        prod.metodoPagamento || ''
      ).toUpperCase() ===
      'NETSHOP';


    var payBox;


    if (isNetshop) {

      payBox =

        '<div class="payment-box">' +

          '<h3>💳 Pagamento Online</h3>' +

          '<p ' +
            'style="color:var(--cinza);margin-bottom:16px;">' +

            'Pague via Netshop.' +

          '</p>' +


          '<div class="form-group">' +

            '<label>Seu telefone</label>' +

            '<input ' +
              'type="tel" ' +
              'id="buyerPhone" ' +
              'value="+258" ' +
              'placeholder="+25884..." ' +
              'autocomplete="tel">' +

          '</div>' +


          '<div class="form-group">' +

            '<label>Método</label>' +

            '<select id="paymentMethod">' +

              '<option value="mpesa">' +
                'M-Pesa' +
              '</option>' +

              '<option value="emola">' +
                'e-Mola' +
              '</option>' +

              '<option value="mkesh">' +
                'mKesh' +
              '</option>' +

              '<option value="card">' +
                'Cartão' +
              '</option>' +

            '</select>' +

          '</div>' +


          '<button ' +
            'class="netshop-btn" ' +
            'onclick="buyNetshop()">' +

            '💳 COMPRAR — ' +
            fmtMoney(prod.preco) +

          '</button>' +

        '</div>';

    }

    else {

      var whatsapp =
        String(
          prod.whatsapp || ''
        ).replace(
          /\D/g,
          ''
        );


      var whatsappUrl =
        'https://wa.me/' +
        whatsapp +
        '?text=' +
        encodeURIComponent(
          'Olá, quero comprar ' +
          String(prod.produtoId || '') +
          ' — ' +
          String(prod.nome || '') +
          ' por ' +
          fmtMoney(prod.preco)
        );


      payBox =

        '<div class="payment-box">' +

          '<h3>📱 WhatsApp</h3>' +

          '<p ' +
            'style="color:var(--cinza);margin-bottom:16px;">' +

            'Negocie com o vendedor.' +

          '</p>' +

          '<a ' +
            'href="' +
              escAttr(whatsappUrl) +
            '" ' +
            'target="_blank" ' +
            'rel="noopener noreferrer" ' +
            'class="whatsapp-btn">' +

            '📱 COMPRAR PELO WHATSAPP' +

          '</a>' +

        '</div>';
    }


    var detailImage =
      prod.imagemUrl

      ?

      '<img ' +
        'src="' +
          escAttr(prod.imagemUrl) +
        '" ' +
        'alt="' +
          escAttr(prod.nome) +
        '" ' +

        'onerror="' +
          'this.style.display=\'none\';' +
          'this.parentElement.innerHTML=\'🛒\';' +
        '">' +

      ''

      :

      '🛒';


    p.innerHTML =

      '<div class="product-detail">' +

        '<div class="detail-grid">' +

          '<div class="detail-img">' +
            detailImage +
          '</div>' +


          '<div class="detail-info">' +

            '<span class="product-type ' +
              (
                prod.tipo === 'DIGITAL'
                ?
                'type-digital'
                :
                'type-fisico'
              ) +
            '">' +

              esc(prod.tipo) +

            '</span>' +


            '<h1>' +
              esc(prod.nome) +
            '</h1>' +


            '<p class="brand">' +
              '🏪 ' +
              esc(prod.marca) +
            '</p>' +


            '<div class="price">' +
              fmtMoney(prod.preco) +
            '</div>' +


            '<p class="desc">' +
              esc(prod.descricao) +
            '</p>' +


            '<p ' +
              'style="color:var(--cinza);margin-bottom:16px;">' +

              '<strong>Ref:</strong> ' +
              esc(prod.produtoId) +

              '<br>' +

              '<strong>Método:</strong> ' +

              (
                isNetshop
                ?
                'Online'
                :
                'WhatsApp'
              ) +

            '</p>' +


            payBox +

          '</div>' +

        '</div>' +

      '</div>';

  })

  .catch(function(e) {

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +

          esc(e.message) +

        '</p>' +

        '<button ' +
          'class="btn btn-verde" ' +
          'onclick="renderProduto(\'' +
            escAttr(id) +
          '\')">' +

          'Tentar novamente' +

        '</button>' +

      '</div>';

  });
}


/* ============================================================
   PAGAMENTO NETSHOP
   ============================================================ */

function buyNetshop() {

  var p =
    state.produtoAtual;


  if (!p) {

    toast(
      'Produto não selecionado.',
      'error'
    );

    return;
  }


  var phoneEl =
    document.getElementById(
      'buyerPhone'
    );

  var methodEl =
    document.getElementById(
      'paymentMethod'
    );


  if (!phoneEl || !methodEl) {

    toast(
      'Formulário de pagamento não encontrado.',
      'error'
    );

    return;
  }


  var phone =
    phoneEl.value.trim();


  var method =
    methodEl.value;


  var digits =
    phone.replace(
      /\D/g,
      ''
    );


  if (
    !digits ||
    digits.length < 9
  ) {

    toast(
      'Telefone inválido.',
      'error'
    );

    return;
  }


  toast(
    'Iniciando pagamento...'
  );


  apiPost(
    'criarPagamento',
    {
      produtoId:
        p.produtoId,

      clienteTelefone:
        phone,

      metodo:
        method
    }
  )

  .then(function(res) {

    if (
      res &&
      res.ok &&
      res.checkoutUrl
    ) {

      window.open(
        res.checkoutUrl,
        '_blank',
        'noopener,noreferrer'
      );

      toast(
        'Pagamento iniciado.'
      );

      return;
    }


    if (
      res &&
      res.ok
    ) {

      toast(
        res.msg ||
        'Pagamento iniciado.'
      );

      return;
    }


    toast(
      res && res.erro
      ?
      res.erro
      :
      'Erro ao iniciar pagamento.',
      'error'
    );

  })

  .catch(function(e) {

    toast(
      'Erro: ' + e.message,
      'error'
    );

  });
}


/* ============================================================
   LOGIN
   ============================================================ */

function renderLogin() {

  var p =
    document.getElementById(
      'pageLogin'
    );

  if (!p) {
    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =

    '<div class="form-container">' +

      '<h2>🔐 Entrar</h2>' +

      '<p class="subtitle">' +
        'Acesse o painel de vendedor' +
      '</p>' +


      '<form ' +
        'onsubmit="event.preventDefault();doLogin();">' +

        '<div class="form-group">' +

          '<label>Nome ou Telefone</label>' +

          '<input ' +
            'type="text" ' +
            'id="loginIdentificador" ' +
            'autocomplete="username" ' +
            'required>' +

        '</div>' +


        '<div class="form-group">' +

          '<label>PIN</label>' +

          '<input ' +
            'type="password" ' +
            'id="loginPin" ' +
            'autocomplete="current-password" ' +
            'required ' +
            'maxlength="6">' +

        '</div>' +


        '<button ' +
          'type="submit" ' +
          'class="btn btn-verde btn-block" ' +
          'style="margin-bottom:16px;">' +

          'ENTRAR' +

        '</button>' +


        '<p ' +
          'style="text-align:center;color:var(--cinza);">' +

          'Não tem conta? ' +

          '<a ' +
            'href="#" ' +
            'onclick="event.preventDefault();navigate(\'registo\')" ' +
            'style="color:var(--verde);font-weight:600;">' +

            'Registe-se' +

          '</a>' +

        '</p>' +

      '</form>' +

    '</div>';
}


/* ============================================================
   EXECUTAR LOGIN
   ============================================================ */

function doLogin() {

  var idEl =
    document.getElementById(
      'loginIdentificador'
    );

  var pinEl =
    document.getElementById(
      'loginPin'
    );


  if (!idEl || !pinEl) {
    return;
  }


  var id =
    idEl.value.trim();


  var pin =
    pinEl.value;


  if (!id) {

    toast(
      'Informe o nome ou telefone.',
      'error'
    );

    return;
  }


  if (!pin) {

    toast(
      'Informe o PIN.',
      'error'
    );

    return;
  }


  toast(
    'A verificar os dados...'
  );


  apiPost(
    'loginVendedor',
    {
      identificador: id,
      pin: pin
    }
  )

  .then(function(res) {

    if (
      res &&
      res.ok &&
      res.token &&
      res.vendedor
    ) {

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
        JSON.stringify(
          res.vendedor
        )
      );


      toast(
        'Bem-vindo, ' +
        (
          res.vendedor.empresa ||
          res.vendedor.nome ||
          ''
        ) +
        '!'
      );


      navigate(
        'dashboard'
      );

      return;
    }


    toast(
      res && res.erro
      ?
      res.erro
      :
      'Dados de login inválidos.',
      'error'
    );

  })

  .catch(function(e) {

    toast(
      'Erro: ' + e.message,
      'error'
    );

  });
}


/* ============================================================
   REGISTO
   ============================================================ */

function renderRegisto() {

  var p =
    document.getElementById(
      'pageRegisto'
    );

  if (!p) {
    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =

    '<div class="form-container">' +

      '<h2>📝 Tornar-se Vendedor</h2>' +

      '<p class="subtitle">' +
        'Comece a vender no MOZ1VENDAS' +
      '</p>' +


      '<form ' +
        'onsubmit="event.preventDefault();doRegisto();">' +


        '<div class="form-group">' +
          '<label>Nome Completo</label>' +

          '<input ' +
            'type="text" ' +
            'id="regNome" ' +
            'required>' +

        '</div>' +


        '<div class="form-group">' +
          '<label>Telefone</label>' +

          '<input ' +
            'type="tel" ' +
            'id="regTelefone" ' +
            'placeholder="+25884..." ' +
            'required>' +

        '</div>' +


        '<div class="form-group">' +
          '<label>BI</label>' +

          '<input ' +
            'type="text" ' +
            'id="regBi" ' +
            'required>' +

        '</div>' +


        '<div class="form-group">' +
          '<label>Marca/Empresa</label>' +

          '<input ' +
            'type="text" ' +
            'id="regEmpresa" ' +
            'required>' +

        '</div>' +


        '<div class="form-group">' +
          '<label>PIN (4-6 dígitos)</label>' +

          '<input ' +
            'type="password" ' +
            'id="regPin" ' +
            'inputmode="numeric" ' +
            'pattern="[0-9]{4,6}" ' +
            'required ' +
            'minlength="4" ' +
            'maxlength="6">' +

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


        '<button ' +
          'type="submit" ' +
          'class="btn btn-dourado btn-block" ' +
          'style="margin-bottom:16px;">' +

          'REGISTAR-SE' +

        '</button>' +


        '<p ' +
          'style="text-align:center;color:var(--cinza);">' +

          'Já tem conta? ' +

          '<a ' +
            'href="#" ' +
            'onclick="event.preventDefault();navigate(\'login\')" ' +
            'style="color:var(--verde);font-weight:600;">' +

            'Entrar' +

          '</a>' +

        '</p>' +

      '</form>' +

    '</div>';
}


/* ============================================================
   EXECUTAR REGISTO
   ============================================================ */

function doRegisto() {

  var data = {

    nome:
      document.getElementById(
        'regNome'
      ).value.trim(),

    telefone:
      document.getElementById(
        'regTelefone'
      ).value.trim(),

    bi:
      document.getElementById(
        'regBi'
      ).value.trim(),

    empresa:
      document.getElementById(
        'regEmpresa'
      ).value.trim(),

    pin:
      document.getElementById(
        'regPin'
      ).value,

    plano:
      document.getElementById(
        'regPlano'
      ).value

  };


  if (!data.nome) {

    toast(
      'Informe o nome completo.',
      'error'
    );

    return;
  }


  if (!data.telefone) {

    toast(
      'Informe o telefone.',
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


  toast(
    'A registar vendedor...'
  );


  apiPost(
    'registarVendedor',
    data
  )

  .then(function(res) {

    if (
      res &&
      res.ok
    ) {

      if (
        res.status ===
        'PENDENTE_PAGAMENTO'
      ) {

        toast(
          'Registado! Efetue o pagamento do plano.'
        );

      }

      else {

        toast(
          'Registado! Faça login.'
        );
      }


      navigate(
        'login'
      );

      return;
    }


    toast(
      res && res.erro
      ?
      res.erro
      :
      'Erro no registo.',
      'error'
    );

  })

  .catch(function(e) {

    toast(
      'Erro: ' + e.message,
      'error'
    );

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
    )

    .catch(function() {

      /*
       * Mesmo que o servidor não responda,
       * limpamos a sessão local.
       */

    });
  }


  state.token =
    null;

  state.vendedor =
    null;


  localStorage.removeItem(
    'mz1_token'
  );

  localStorage.removeItem(
    'mz1_vendedor'
  );


  updateHeader();


  toast(
    'Sessão terminada.'
  );


  navigate(
    'home'
  );
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

    navigate(
      'login'
    );

    return false;
  }


  return true;
}


/* ============================================================
   DASHBOARD
   ============================================================ */

function renderDashboard() {

  if (!checkAuth()) {
    return;
  }


  var p =
    document.getElementById(
      'pageDashboard'
    );

  if (!p) {
    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =
    loadingHtml();


  apiGet(
    'dashboard',
    {
      token: state.token
    }
  )

  .then(function(res) {

    if (
      !res ||
      !res.ok
    ) {

      toast(
        'Sessão expirada.',
        'error'
      );

      logout();

      return;
    }


    var d =
      res.dashboard || {};


    var statusAtivo =
      String(d.status || '')
        .toUpperCase() ===
      'ATIVO';


    var statusClass =
      statusAtivo
      ?
      'status-ativo'
      :
      'status-desativado';


    var statusText =
      statusAtivo
      ?
      '🟢 ATIVO'
      :
      '🔴 DESATIVADO';


    p.innerHTML =

      '<div class="dashboard">' +

        '<div class="dashboard-header">' +

          '<div>' +

            '<h1>' +
              '👋 Bem-vindo, ' +
              esc(d.empresa) +
            '</h1>' +

            '<p style="opacity:0.9;margin-top:4px;">' +
              esc(d.vendedorId) +
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
              esc(d.produtosPublicados) +
              ' / ' +
              esc(d.limiteProdutos) +
            '</div>' +
          '</div>' +


          '<div class="stat-card dourado">' +
            '<div class="label">Vendas</div>' +
            '<div class="value">' +
              esc(d.totalVendas) +
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
              esc(d.plano) +
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
          !statusAtivo

          ?

          '<div ' +
            'style="background:#fef3c7;border-radius:16px;padding:24px;text-align:center;margin-bottom:32px;">' +

            '<p style="color:#92400e;font-weight:600;margin-bottom:12px;">' +

              '⚠️ Conta desativada. Renove o plano.' +

            '</p>' +

            '<button ' +
              'class="btn btn-dourado" ' +
              'onclick="navigate(\'plano\')">' +

              'Renovar' +

            '</button>' +

          '</div>'

          :

          ''
        ) +


        '<div ' +
          'style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;">' +


          '<div ' +
            'class="table-container" ' +
            'style="cursor:pointer;" ' +
            'onclick="navigate(\'meusProdutos\')">' +

            '<h2>📦 Meus Produtos</h2>' +

            '<p style="color:var(--cinza);">' +
              'Gerencie produtos' +
            '</p>' +

            '<button ' +
              'class="btn btn-verde" ' +
              'style="margin-top:16px;">' +

              'Ver' +

            '</button>' +

          '</div>' +


          '<div ' +
            'class="table-container" ' +
            'style="cursor:pointer;" ' +
            'onclick="navigate(\'minhasVendas\')">' +

            '<h2>📊 Vendas</h2>' +

            '<p style="color:var(--cinza);">' +
              'Histórico' +
            '</p>' +

            '<button ' +
              'class="btn btn-verde" ' +
              'style="margin-top:16px;">' +

              'Ver' +

            '</button>' +

          '</div>' +


          '<div ' +
            'class="table-container" ' +
            'style="cursor:pointer;" ' +
            'onclick="navigate(\'carteira\')">' +

            '<h2>💰 Carteira</h2>' +

            '<p style="color:var(--cinza);">' +
              'Saldo' +
            '</p>' +

            '<button ' +
              'class="btn btn-verde" ' +
              'style="margin-top:16px;">' +

              'Ver' +

            '</button>' +

          '</div>' +

        '</div>' +

      '</div>';

  })

  .catch(function(e) {

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +

          esc(e.message) +

        '</p>' +

        '<button ' +
          'class="btn btn-verde" ' +
          'onclick="renderDashboard()">' +

          'Tentar novamente' +

        '</button>' +

      '</div>';

  });
}


/* ============================================================
   MEUS PRODUTOS
   ============================================================ */

function renderMeusProdutos() {

  if (!checkAuth()) {
    return;
  }


  var p =
    document.getElementById(
      'pageMeusProdutos'
    );

  if (!p) {
    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =
    loadingHtml();


  apiGet(
    'meusProdutos',
    {
      token: state.token
    }
  )

  .then(function(res) {

    if (
      res &&
      res.ok === false
    ) {

      toast(
        res.erro ||
        'Sessão inválida.',
        'error'
      );

      return;
    }


    var produtos =
      Array.isArray(res.produtos)
      ?
      res.produtos
      :
      [];


    p.innerHTML =

      '<div class="dashboard">' +

        '<div ' +
          'style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">' +

          '<h2 style="color:var(--verde-escuro);">' +
            '📦 Meus Produtos' +
          '</h2>' +

          '<button ' +
            'class="btn btn-dourado" ' +
            'onclick="navigate(\'adicionarProduto\')">' +

            '+ Adicionar' +

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
                  '<td colspan="6" style="text-align:center;">' +
                    'Nenhum produto' +
                  '</td>' +
                '</tr>'

                :

                produtos.map(function(prod) {

                  var pid =
                    escAttr(
                      prod.produtoId
                    );


                  var nextStatus =
                    prod.status === 'ATIVO'
                    ?
                    'DESATIVADO'
                    :
                    'ATIVO';


                  return

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
                            ?
                            'badge-pendente'
                            :
                            'badge-sucesso'
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
                            ?
                            'badge-sucesso'
                            :
                            'badge-falha'
                          ) +
                        '">' +

                          esc(prod.status) +

                        '</span>' +

                      '</td>' +


                      '<td>' +

                        '<button ' +
                          'class="btn btn-sm btn-verde" ' +
                          'onclick="navigate(\'editarProduto\',{id:\'' +
                            pid +
                          '\'})" ' +
                          'style="margin-right:4px;">' +

                          '✏️' +

                        '</button>' +


                        '<button ' +
                          'class="btn btn-sm" ' +
                          'onclick="toggleProdStatus(\'' +
                            pid +
                            '\',\'' +
                            nextStatus +
                          '\')" ' +
                          'style="border:1px solid var(--cinza);color:var(--cinza);background:transparent;">' +

                          (
                            prod.status === 'ATIVO'
                            ?
                            'Desativar'
                            :
                            'Ativar'
                          ) +

                        '</button>' +

                      '</td>' +

                    '</tr>';

                }).join('')
              ) +

            '</tbody>' +

          '</table>' +

        '</div>' +

      '</div>';

  })

  .catch(function(e) {

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +

          esc(e.message) +

        '</p>' +

        '<button ' +
          'class="btn btn-verde" ' +
          'onclick="renderMeusProdutos()">' +

          'Tentar novamente' +

        '</button>' +

      '</div>';

  });
}


/* ============================================================
   ALTERAR STATUS PRODUTO
   ============================================================ */

function toggleProdStatus(
  pid,
  st
) {

  if (!checkAuth()) {
    return;
  }


  apiPost(
    'alterarStatusProduto',
    {
      token: state.token,

      produtoId: pid,

      status: st
    }
  )

  .then(function(res) {

    if (
      res &&
      res.ok
    ) {

      toast(
        res.msg ||
        'Status atualizado.'
      );

      renderMeusProdutos();

    }

    else {

      toast(
        res && res.erro
        ?
        res.erro
        :
        'Erro ao alterar status.',
        'error'
      );
    }

  })

  .catch(function(e) {

    toast(
      'Erro: ' + e.message,
      'error'
    );

  });
}


/* ============================================================
   ADICIONAR PRODUTO
   ============================================================ */

function renderAdicionarProduto() {

  if (!checkAuth()) {
    return;
  }


  renderProdForm(
    null
  );
}


/* ============================================================
   EDITAR PRODUTO
   ============================================================ */

function renderEditarProduto(id) {

  if (!checkAuth()) {
    return;
  }


  if (!id) {

    toast(
      'Produto inválido.',
      'error'
    );

    navigate(
      'meusProdutos'
    );

    return;
  }


  apiGet(
    'meusProdutos',
    {
      token: state.token
    }
  )

  .then(function(res) {

    var produtos =
      Array.isArray(res.produtos)
      ?
      res.produtos
      :
      [];


    var prod =
      produtos.find(
        function(item) {

          return String(
            item.produtoId
          ) === String(id);

        }
      );


    if (!prod) {

      toast(
        'Produto não encontrado.',
        'error'
      );

      navigate(
        'meusProdutos'
      );

      return;
    }


    renderProdForm(
      prod
    );

  })

  .catch(function(e) {

    toast(
      'Erro: ' + e.message,
      'error'
    );

  });
}


/* ============================================================
   FORMULÁRIO PRODUTO
   ============================================================ */

function renderProdForm(prod) {

  prod =
    prod || null;


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


  if (!page) {
    return;
  }


  page.classList.remove(
    'hidden'
  );


  var isDigital =
    prod &&
    String(prod.tipo).toUpperCase() ===
    'DIGITAL';


  var metodo =
    prod
    ?
    String(
      prod.metodoPagamento || ''
    ).toUpperCase()
    :
    'WHATSAPP';


  if (
    isDigital
  ) {
    metodo =
      'NETSHOP';
  }


  page.innerHTML =

    '<div ' +
      'class="form-container" ' +
      'style="max-width:600px;">' +

      '<h2>' +

        (
          isEdit
          ?
          '✏️ Editar Produto'
          :
          '📦 Novo Produto'
        ) +

      '</h2>' +


      '<form ' +
        'onsubmit="event.preventDefault();' +
        (
          isEdit
          ?
          'doEditProd()'
          :
          'doAddProd()'
        ) +
        ';">' +


        '<div class="form-group">' +

          '<label>Nome</label>' +

          '<input ' +
            'type="text" ' +
            'id="pNome" ' +
            'value="' +
              escAttr(
                prod
                ?
                prod.nome
                :
                ''
              ) +
            '" ' +
            'required>' +

        '</div>' +


        '<div class="form-group">' +

          '<label>Descrição</label>' +

          '<textarea ' +
            'id="pDesc" ' +
            'required>' +

            esc(
              prod
              ?
              prod.descricao
              :
              ''
            ) +

          '</textarea>' +

        '</div>' +


        '<div class="form-group">' +

          '<label>Imagem URL</label>' +

          '<input ' +
            'type="url" ' +
            'id="pImg" ' +
            'value="' +
              escAttr(
                prod
                ?
                prod.imagemUrl
                :
                ''
              ) +
            '">' +

        '</div>' +


        '<div class="form-group">' +

          '<label>Preço (MT)</label>' +

          '<input ' +
            'type="number" ' +
            'id="pPreco" ' +
            'value="' +
              (
                prod
                ?
                escAttr(prod.preco)
                :
                ''
              ) +
            '" ' +
            'required ' +
            'min="1" ' +
            'step="0.01">' +

        '</div>' +


        '<div class="form-group">' +

          '<label>Tipo</label>' +

          '<select ' +
            'id="pTipo" ' +
            'onchange="onTipoChg()" ' +
            (
              isEdit
              ?
              'disabled'
              :
              ''
            ) +
          '>' +

            '<option ' +
              'value="FISICO" ' +
              (
                !isDigital
                ?
                'selected'
                :
                ''
              ) +
            '>' +

              'Físico' +

            '</option>' +


            '<option ' +
              'value="DIGITAL" ' +
              (
                isDigital
                ?
                'selected'
                :
                ''
              ) +
            '>' +

              'Digital' +

            '</option>' +

          '</select>' +


          (
            isEdit
            ?
            '<small>Tipo não pode ser alterado.</small>'
            :
            ''
          ) +

        '</div>' +


        '<div class="form-group">' +

          '<label>Método Pagamento</label>' +

          '<select ' +
            'id="pMetodo" ' +
            'onchange="onMetodoChg()" ' +
            (
              isDigital
              ?
              'disabled'
              :
              ''
            ) +
          '>' +

            '<option ' +
              'value="WHATSAPP" ' +
              (
                metodo === 'WHATSAPP'
                ?
                'selected'
                :
                ''
              ) +
            '>' +

              'WhatsApp' +

            '</option>' +


            '<option ' +
              'value="NETSHOP" ' +
              (
                metodo === 'NETSHOP'
                ?
                'selected'
                :
                ''
              ) +
            '>' +

              'Netshop' +

            '</option>' +

          '</select>' +

        '</div>' +


        '<div ' +
          'class="form-group" ' +
          'id="wg" ' +
          'style="' +
            (
              isDigital ||
              metodo === 'NETSHOP'
              ?
              'display:none;'
              :
              ''
            ) +
          '">' +

          '<label>WhatsApp</label>' +

          '<input ' +
            'type="tel" ' +
            'id="pWpp" ' +
            'value="' +
              escAttr(
                prod
                ?
                prod.whatsapp
                :
                ''
              ) +
            '">' +

        '</div>' +


        '<div ' +
          'class="form-group" ' +
          'id="dg" ' +
          'style="' +
            (
              !isDigital
              ?
              'display:none;'
              :
              ''
            ) +
          '">' +

          '<label>Link Download</label>' +

          '<input ' +
            'type="url" ' +
            'id="pDown" ' +
            'value="' +
              escAttr(
                prod
                ?
                prod.downloadUrl
                :
                ''
              ) +
            '">' +

          '<small>Obrigatório para produto digital.</small>' +

        '</div>' +


        '<button ' +
          'type="submit" ' +
          'class="btn btn-verde btn-block" ' +
          'style="margin-bottom:12px;">' +

          (
            isEdit
            ?
            '💾 GUARDAR'
            :
            '✅ PUBLICAR'
          ) +

        '</button>' +


        '<button ' +
          'type="button" ' +
          'class="btn btn-outline btn-block" ' +
          'onclick="navigate(\'meusProdutos\')" ' +
          'style="border-color:var(--cinza);color:var(--cinza);">' +

          'Cancelar' +

        '</button>' +


        (
          isEdit

          ?

          '<input ' +
            'type="hidden" ' +
            'id="editPid" ' +
            'value="' +
              escAttr(prod.produtoId) +
            '">' 

          :

          ''
        ) +


      '</form>' +

    '</div>';


  /*
   * Garante que o estado visual fique correto
   * imediatamente após carregar o formulário.
   */

  if (
    isDigital
  ) {

    var met =
      document.getElementById(
        'pMetodo'
      );

    if (met) {
      met.value =
        'NETSHOP';
    }
  }
}


/* ============================================================
   ALTERAÇÃO DO TIPO
   ============================================================ */

function onTipoChg() {

  var tipoEl =
    document.getElementById(
      'pTipo'
    );

  var metEl =
    document.getElementById(
      'pMetodo'
    );


  var dg =
    document.getElementById(
      'dg'
    );

  var wg =
    document.getElementById(
      'wg'
    );


  if (
    !tipoEl ||
    !metEl
  ) {
    return;
  }


  var tipo =
    tipoEl.value;


  if (
    tipo ===
    'DIGITAL'
  ) {

    metEl.value =
      'NETSHOP';

    metEl.disabled =
      true;


    if (dg) {
      dg.style.display =
        'block';
    }


    if (wg) {
      wg.style.display =
        'none';
    }

  }

  else {

    metEl.disabled =
      false;


    if (dg) {
      dg.style.display =
        'none';
    }


    onMetodoChg();
  }
}


/* ============================================================
   ALTERAÇÃO MÉTODO
   ============================================================ */

function onMetodoChg() {

  var metEl =
    document.getElementById(
      'pMetodo'
    );

  var wg =
    document.getElementById(
      'wg'
    );


  if (
    !metEl ||
    !wg
  ) {
    return;
  }


  wg.style.display =
    metEl.value ===
    'WHATSAPP'

    ?

    'block'

    :

    'none';
}


/* ============================================================
   ADICIONAR PRODUTO
   ============================================================ */

function doAddProd() {

  if (!checkAuth()) {
    return;
  }


  var tipo =
    document.getElementById(
      'pTipo'
    ).value;


  var metodoEl =
    document.getElementById(
      'pMetodo'
    );


  /*
   * Mesmo que o select esteja disabled,
   * precisamos enviar NETSHOP para DIGITAL.
   */

  var metodo =
    tipo === 'DIGITAL'
    ?
    'NETSHOP'
    :
    metodoEl.value;


  var data = {

    token:
      state.token,

    nome:
      document.getElementById(
        'pNome'
      ).value.trim(),

    descricao:
      document.getElementById(
        'pDesc'
      ).value.trim(),

    imagemUrl:
      document.getElementById(
        'pImg'
      ).value.trim(),

    preco:
      document.getElementById(
        'pPreco'
      ).value,

    tipo:
      tipo,

    metodoPagamento:
      metodo,

    whatsapp:
      document.getElementById(
        'pWpp'
      )
      ?
      document.getElementById(
        'pWpp'
      ).value.trim()
      :
      '',

    downloadUrl:
      document.getElementById(
        'pDown'
      )
      ?
      document.getElementById(
        'pDown'
      ).value.trim()
      :
      ''

  };


  if (!data.nome) {

    toast(
      'Informe o nome do produto.',
      'error'
    );

    return;
  }


  if (!data.descricao) {

    toast(
      'Informe a descrição.',
      'error'
    );

    return;
  }


  if (
    !data.preco ||
    Number(data.preco) <= 0
  ) {

    toast(
      'O preço deve ser maior que zero.',
      'error'
    );

    return;
  }


  if (
    tipo === 'DIGITAL' &&
    !data.downloadUrl
  ) {

    toast(
      'Informe o link de download.',
      'error'
    );

    return;
  }


  if (
    tipo === 'FISICO' &&
    metodo === 'WHATSAPP' &&
    !data.whatsapp
  ) {

    toast(
      'Informe o WhatsApp do vendedor.',
      'error'
    );

    return;
  }


  toast(
    'Publicando produto...'
  );


  apiPost(
    'criarProduto',
    data
  )

  .then(function(res) {

    if (
      res &&
      res.ok
    ) {

      toast(
        res.msg ||
        'Produto criado!'
      );

      navigate(
        'meusProdutos'
      );

      return;
    }


    toast(
      res && res.erro
      ?
      res.erro
      :
      'Erro ao criar produto.',
      'error'
    );

  })

  .catch(function(e) {

    toast(
      'Erro: ' + e.message,
      'error'
    );

  });
}


/* ============================================================
   EDITAR PRODUTO
   ============================================================ */

function doEditProd() {

  if (!checkAuth()) {
    return;
  }


  var pidEl =
    document.getElementById(
      'editPid'
    );


  if (!pidEl) {

    toast(
      'ID do produto não encontrado.',
      'error'
    );

    return;
  }


  var tipoEl =
    document.getElementById(
      'pTipo'
    );


  var tipo =
    tipoEl
    ?
    tipoEl.value
    :
    'FISICO';


  var metodoEl =
    document.getElementById(
      'pMetodo'
    );


  var metodo =
    metodoEl
    ?
    metodoEl.value
    :
    'WHATSAPP';


  if (
    tipo === 'DIGITAL'
  ) {
    metodo =
      'NETSHOP';
  }


  var data = {

    token:
      state.token,

    produtoId:
      pidEl.value,

    nome:
      document.getElementById(
        'pNome'
      ).value.trim(),

    descricao:
      document.getElementById(
        'pDesc'
      ).value.trim(),

    imagemUrl:
      document.getElementById(
        'pImg'
      ).value.trim(),

    preco:
      document.getElementById(
        'pPreco'
      ).value,

    metodoPagamento:
      metodo,

    whatsapp:
      document.getElementById(
        'pWpp'
      )
      ?
      document.getElementById(
        'pWpp'
      ).value.trim()
      :
      '',

    downloadUrl:
      document.getElementById(
        'pDown'
      )
      ?
      document.getElementById(
        'pDown'
      ).value.trim()
      :
      ''

  };


  if (!data.nome) {

    toast(
      'Informe o nome.',
      'error'
    );

    return;
  }


  if (!data.descricao) {

    toast(
      'Informe a descrição.',
      'error'
    );

    return;
  }


  if (
    !data.preco ||
    Number(data.preco) <= 0
  ) {

    toast(
      'Preço inválido.',
      'error'
    );

    return;
  }


  if (
    tipo === 'DIGITAL' &&
    !data.downloadUrl
  ) {

    toast(
      'Informe o link de download.',
      'error'
    );

    return;
  }


  apiPost(
    'editarProduto',
    data
  )

  .then(function(res) {

    if (
      res &&
      res.ok
    ) {

      toast(
        res.msg ||
        'Produto atualizado!'
      );

      navigate(
        'meusProdutos'
      );

      return;
    }


    toast(
      res && res.erro
      ?
      res.erro
      :
      'Erro ao atualizar produto.',
      'error'
    );

  })

  .catch(function(e) {

    toast(
      'Erro: ' + e.message,
      'error'
    );

  });
}


/* ============================================================
   MINHAS VENDAS
   ============================================================ */

function renderMinhasVendas() {

  if (!checkAuth()) {
    return;
  }


  var p =
    document.getElementById(
      'pageMinhasVendas'
    );

  if (!p) {
    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =
    loadingHtml();


  apiGet(
    'minhasVendas',
    {
      token: state.token
    }
  )

  .then(function(res) {

    var vendas =
      Array.isArray(res.vendas)
      ?
      res.vendas
      :
      [];


    p.innerHTML =

      '<div class="dashboard">' +

        '<h2 ' +
          'style="color:var(--verde-escuro);margin-bottom:24px;">' +

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
                  '<td colspan="7" style="text-align:center;">' +
                    'Nenhuma venda' +
                  '</td>' +
                '</tr>'

                :

                vendas.map(function(v) {

                  var status =
                    String(
                      v.status || ''
                    ).toUpperCase();


                  var badge =
                    status === 'APROVADO'
                    ?
                    'badge-sucesso'
                    :
                    status === 'PENDENTE'
                    ?
                    'badge-pendente'
                    :
                    'badge-falha';


                  return

                    '<tr>' +

                      '<td>' +
                        fmtDate(v.data) +
                      '</td>' +

                      '<td>' +
                        esc(v.produtoId) +
                      '</td>' +

                      '<td>' +
                        esc(
                          v.clienteTelefone ||
                          '-'
                        ) +
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
                          badge +
                        '">' +

                          esc(v.status) +

                        '</span>' +

                      '</td>' +

                    '</tr>';

                }).join('')
              ) +

            '</tbody>' +

          '</table>' +

        '</div>' +

      '</div>';

  })

  .catch(function(e) {

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +

          esc(e.message) +

        '</p>' +

        '<button ' +
          'class="btn btn-verde" ' +
          'onclick="renderMinhasVendas()">' +

          'Tentar novamente' +

        '</button>' +

      '</div>';

  });
}


/* ============================================================
   CARTEIRA
   ============================================================ */

function renderCarteira() {

  if (!checkAuth()) {
    return;
  }


  var p =
    document.getElementById(
      'pageCarteira'
    );

  if (!p) {
    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =
    loadingHtml();


  apiGet(
    'minhaCarteira',
    {
      token: state.token
    }
  )

  .then(function(res) {

    if (
      !res ||
      !res.ok
    ) {

      p.innerHTML =

        '<div class="empty-state">' +

          '<div class="icon">😕</div>' +

          '<p>' +
            esc(
              res && res.erro
              ?
              res.erro
              :
              'Não foi possível carregar a carteira.'
            ) +
          '</p>' +

        '</div>';

      return;
    }


    var c =
      res.carteira || {};


    p.innerHTML =

      '<div class="dashboard">' +

        '<h2 ' +
          'style="color:var(--verde-escuro);margin-bottom:24px;">' +

          '💰 Carteira' +

        '</h2>' +


        '<div class="stats-grid">' +

          '<div class="stat-card dourado">' +

            '<div class="label">Wallet</div>' +

            '<div ' +
              'class="value" ' +
              'style="font-size:1.1rem;">' +

              esc(c.walletId) +

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

  .catch(function(e) {

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +

          esc(e.message) +

        '</p>' +

        '<button ' +
          'class="btn btn-verde" ' +
          'onclick="renderCarteira()">' +

          'Tentar novamente' +

        '</button>' +

      '</div>';

  });
}


/* ============================================================
   PLANO
   ============================================================ */

function renderPlano() {

  if (!checkAuth()) {
    return;
  }


  var p =
    document.getElementById(
      'pagePlano'
    );

  if (!p) {
    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =
    loadingHtml();


  apiGet(
    'meuPlano',
    {
      token: state.token
    }
  )

  .then(function(res) {

    if (
      !res ||
      !res.ok
    ) {

      p.innerHTML =

        '<div class="empty-state">' +

          '<div class="icon">😕</div>' +

          '<p>' +

            esc(
              res && res.erro
              ?
              res.erro
              :
              'Não foi possível carregar o plano.'
            ) +

          '</p>' +

        '</div>';

      return;
    }


    var pl =
      res.plano || {};


    var nomePlano =
      String(
        pl.nome || ''
      ).toUpperCase();


    p.innerHTML =

      '<div class="dashboard">' +

        '<h2 ' +
          'style="color:var(--verde-escuro);margin-bottom:8px;">' +

          '📋 Meu Plano' +

        '</h2>' +


        '<p ' +
          'style="color:var(--cinza);margin-bottom:24px;">' +

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


          '<div class="plan-card ' +
            (
              nomePlano === 'SIMPLES'
              ?
              'destaque'
              :
              ''
            ) +
          '">' +

            '<h3>Simples</h3>' +

            '<div class="preco">' +
              '50 ' +
              '<span>MT/mês</span>' +
            '</div>' +

            '<ul class="plan-features">' +
              '<li>3 produtos</li>' +
              '<li>Taxa 17%</li>' +
            '</ul>' +

            '<button ' +
              'class="btn btn-verde btn-block" ' +
              'onclick="renovarPlan(\'SIMPLES\')" ' +
              (
                nomePlano === 'SIMPLES'
                ?
                'disabled style="opacity:0.5"'
                :
                ''
              ) +
            '>' +

              (
                nomePlano === 'SIMPLES'
                ?
                'Atual'
                :
                'Escolher'
              ) +

            '</button>' +

          '</div>' +


          '<div class="plan-card ' +
            (
              nomePlano === 'MEDIO'
              ?
              'destaque'
              :
              ''
            ) +
          '">' +

            '<h3>Médio</h3>' +

            '<div class="preco">' +
              '200 ' +
              '<span>MT/mês</span>' +
            '</div>' +

            '<ul class="plan-features">' +
              '<li>10 produtos</li>' +
              '<li>Taxa 15%</li>' +
            '</ul>' +

            '<button ' +
              'class="btn btn-verde btn-block" ' +
              'onclick="renovarPlan(\'MEDIO\')" ' +
              (
                nomePlano === 'MEDIO'
                ?
                'disabled style="opacity:0.5"'
                :
                ''
              ) +
            '>' +

              (
                nomePlano === 'MEDIO'
                ?
                'Atual'
                :
                'Escolher'
              ) +

            '</button>' +

          '</div>' +


          '<div class="plan-card ' +
            (
              nomePlano === 'PRO'
              ?
              'destaque'
              :
              ''
            ) +
          '">' +

            '<h3>Pro</h3>' +

            '<div class="preco">' +
              '1.000 ' +
              '<span>MT/mês</span>' +
            '</div>' +

            '<ul class="plan-features">' +
              '<li>Ilimitado</li>' +
              '<li>Taxa 14%</li>' +
            '</ul>' +

            '<button ' +
              'class="btn btn-dourado btn-block" ' +
              'onclick="renovarPlan(\'PRO\')" ' +
              (
                nomePlano === 'PRO'
                ?
                'disabled style="opacity:0.5"'
                :
                ''
              ) +
            '>' +

              (
                nomePlano === 'PRO'
                ?
                'Atual'
                :
                'Escolher'
              ) +

            '</button>' +

          '</div>' +


        '</div>' +

      '</div>';

  })

  .catch(function(e) {

    p.innerHTML =

      '<div class="empty-state">' +

        '<div class="icon">📡</div>' +

        '<p><strong>Erro</strong></p>' +

        '<p style="font-size:0.85rem;color:#999;">' +

          esc(e.message) +

        '</p>' +

        '<button ' +
          'class="btn btn-verde" ' +
          'onclick="renderPlano()">' +

          'Tentar novamente' +

        '</button>' +

      '</div>';

  });
}


/* ============================================================
   RENOVAR PLANO
   ============================================================ */

function renovarPlan(plano) {

  if (!checkAuth()) {
    return;
  }


  var metodo =
    prompt(
      'Método: mpesa, emola, mkesh, card',
      'mpesa'
    );


  if (!metodo) {
    return;
  }


  metodo =
    metodo.trim().toLowerCase();


  var metodosValidos = [
    'mpesa',
    'emola',
    'mkesh',
    'card'
  ];


  if (
    metodosValidos.indexOf(
      metodo
    ) === -1
  ) {

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
      ?
      state.vendedor.telefone || '+258'
      :
      '+258'
    );


  if (!tel) {
    return;
  }


  toast(
    'Processando pagamento...'
  );


  apiPost(
    'renovarPlano',
    {
      token:
        state.token,

      plano:
        plano,

      metodoPagamento:
        metodo,

      telefone:
        tel.trim()
    }
  )

  .then(function(res) {

    if (
      res &&
      res.ok &&
      res.checkoutUrl
    ) {

      window.open(
        res.checkoutUrl,
        '_blank',
        'noopener,noreferrer'
      );

      toast(
        'Redirecionado para pagamento.'
      );

      return;
    }


    if (
      res &&
      res.ok
    ) {

      toast(
        res.msg ||
        'Pagamento iniciado.'
      );

      return;
    }


    toast(
      res && res.erro
      ?
      res.erro
      :
      'Erro no pagamento.',
      'error'
    );

  })

  .catch(function(e) {

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

  if (!p) {
    return;
  }


  p.classList.remove(
    'hidden'
  );


  p.innerHTML =

    '<div ' +
      'class="hero" ' +
      'style="padding:100px 24px;">' +

      '<h1>' +
        '🚀 Venda na ' +
        esc(CONFIG.APP_NAME) +
      '</h1>' +

      '<p>' +
        'Alcance clientes em Moçambique.' +
      '</p>' +


      '<div ' +
        'style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:24px;">' +

        '<button ' +
          'class="btn btn-dourado" ' +
          'onclick="navigate(\'registo\')">' +

          'Começar' +

        '</button>' +


        '<button ' +
          'class="btn btn-outline" ' +
          'onclick="navigate(\'login\')">' +

          'Já sou Vendedor' +

        '</button>' +

      '</div>' +

    '</div>' +


    '<div ' +
      'style="max-width:1000px;margin:0 auto;padding:60px 24px;">' +

      '<h2 ' +
        'style="text-align:center;color:var(--verde-escuro);margin-bottom:48px;">' +

        'Por que vender connosco?' +

      '</h2>' +


      '<div ' +
        'style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:32px;">' +


        '<div style="text-align:center;">' +

          '<div style="font-size:3rem;margin-bottom:16px;">' +
            '📱' +
          '</div>' +

          '<h3>Fácil</h3>' +

          '<p style="color:var(--cinza);">' +
            'Cadastre em minutos.' +
          '</p>' +

        '</div>' +


        '<div style="text-align:center;">' +

          '<div style="font-size:3rem;margin-bottom:16px;">' +
            '💳' +
          '</div>' +

          '<h3>Seguro</h3>' +

          '<p style="color:var(--cinza);">' +
            'M-Pesa, e-Mola, cartões.' +
          '</p>' +

        '</div>' +


        '<div style="text-align:center;">' +

          '<div style="font-size:3rem;margin-bottom:16px;">' +
            '📊' +
          '</div>' +

          '<h3>Controle</h3>' +

          '<p style="color:var(--cinza);">' +
            'Dashboard completo.' +
          '</p>' +

        '</div>' +

      '</div>' +


      '<div style="margin-top:60px;">' +

        '<h2 ' +
          'style="text-align:center;color:var(--verde-escuro);margin-bottom:32px;">' +

          'Planos' +

        '</h2>' +


        '<div class="plans-grid">' +


          '<div class="plan-card">' +

            '<h3>Simples</h3>' +

            '<div class="preco">' +
              '50 ' +
              '<span>MT/mês</span>' +
            '</div>' +

            '<ul class="plan-features">' +
              '<li>3 produtos</li>' +
              '<li>Taxa 17%</li>' +
            '</ul>' +

          '</div>' +


          '<div class="plan-card">' +

            '<h3>Médio</h3>' +

            '<div class="preco">' +
              '200 ' +
              '<span>MT/mês</span>' +
            '</div>' +

            '<ul class="plan-features">' +
              '<li>10 produtos</li>' +
              '<li>Taxa 15%</li>' +
            '</ul>' +

          '</div>' +


          '<div class="plan-card destaque">' +

            '<h3>Pro</h3>' +

            '<div class="preco">' +
              '1.000 ' +
              '<span>MT/mês</span>' +
            '</div>' +

            '<ul class="plan-features">' +
              '<li>Ilimitado</li>' +
              '<li>Taxa 14%</li>' +
            '</ul>' +

          '</div>' +


        '</div>' +

      '</div>' +

    '</div>';
}


/* ============================================================
   VERIFICAR SESSÃO AO CARREGAR
   ============================================================ */

function restoreSession() {

  var token =
    localStorage.getItem(
      'mz1_token'
    );


  var vendedorRaw =
    localStorage.getItem(
      'mz1_vendedor'
    );


  if (!token) {

    state.token =
      null;

    state.vendedor =
      null;

    return;
  }


  state.token =
    token;


  if (vendedorRaw) {

    try {

      state.vendedor =
        JSON.parse(
          vendedorRaw
        );

    } catch (e) {

      state.vendedor =
        null;
    }
  }
}


/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  function() {

    restoreSession();

    updateHeader();

    navigate(
      'home'
    );

  }
);


/* ============================================================
   EVITAR ERROS NÃO CAPTURADOS
   ============================================================ */

window.addEventListener(
  'unhandledrejection',
  function(event) {

    console.error(
      'Promise não tratada:',
      event.reason
    );

  }
);
