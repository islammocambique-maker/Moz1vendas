/**
 * MOZ1VENDAS - Frontend JavaScript
 * SPA completa para marketplace
 */

// ==================== CONFIGURAÇÃO ====================
const CONFIG = {
  // Substitua pela URL do seu Web App do Google Apps Script após o deploy
  API_URL: 'https://script.google.com/macros/s/AKfycbxIhiGNTxlvo-EOUsx_sNAy2y2jzYQmnxQ7OebswTg0Czc5_gzCN0JDFwvseH8yjT0u/exec',
  APP_NAME: 'MOZ1VENDAS'
};

// ==================== ESTADO ====================
const state = {
  token: localStorage.getItem('mz1_token') || null,
  vendedor: JSON.parse(localStorage.getItem('mz1_vendedor') || 'null'),
  produtos: [],
  produtoAtual: null,
  planos: {},
  currentPage: 'home'
};

// ==================== UTILITÁRIOS ====================
function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function formatMoney(valor) {
  return parseFloat(valor || 0).toLocaleString('pt-MZ') + ' MT';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-MZ');
}

function showToast(message, type = 'success') {
  const container = $('#toastContainer') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function createToastContainer() {
  const div = document.createElement('div');
  div.id = 'toastContainer';
  div.className = 'toast-container';
  document.body.appendChild(div);
  return div;
}

function showLoading(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
}

// ==================== API CLIENT ====================
async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.append('action', action);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(action, data = {}) {
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data })
  });
  return res.json();
}

// ==================== ROUTER ====================
function navigate(page, params = {}) {
  state.currentPage = page;
  window.scrollTo(0, 0);

  // Esconder todas as páginas
  $$('.page').forEach(p => p.classList.add('hidden'));

  // Atualizar header
  updateHeader();

  switch(page) {
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

function updateHeader() {
  const header = $('#appHeader');
  if (!header) return;

  const isLogged = !!state.token;
  const vendedor = state.vendedor;

  header.innerHTML = `
    <div class="header-inner">
      <div class="logo" onclick="navigate('home')">
        <div class="logo-icon">🛒</div>
        <span>${CONFIG.APP_NAME}</span>
      </div>
      <nav class="nav-links">
        <a onclick="navigate('home')">Início</a>
        <a onclick="navigate('produtos')">Produtos</a>
        <a onclick="navigate('vender')">Vender na ${CONFIG.APP_NAME}</a>
        ${isLogged ? `
          <a onclick="navigate('dashboard')">Painel</a>
          <a onclick="logout()">Sair</a>
        ` : `
          <a onclick="navigate('login')">Entrar</a>
        `}
      </nav>
      <button class="mobile-menu-btn" onclick="toggleMobileMenu()">☰</button>
    </div>
  `;
}

// ==================== PÁGINAS PÚBLICAS ====================
function renderHome() {
  const page = $('#pageHome');
  page.classList.remove('hidden');

  page.innerHTML = `
    <div class="hero">
      <h1>Compre e Venda em Moçambique</h1>
      <p>O marketplace mais simples e seguro para o seu negócio. Produtos físicos e digitais em um só lugar.</p>
      <button class="btn btn-dourado" onclick="navigate('produtos')">Explorar Produtos</button>
    </div>

    <div class="search-container">
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="Pesquisar produtos..." onkeypress="if(event.key==='Enter')searchProducts()">
        <button class="btn btn-verde" onclick="searchProducts()">🔍 Pesquisar</button>
      </div>
    </div>

    <div class="categories">
      <h2>📂 Categorias</h2>
      <div class="cat-grid">
        <div class="cat-card" onclick="filterByCategory('FISICO')">
          <div class="icon">📦</div>
          <span>Produtos Físicos</span>
        </div>
        <div class="cat-card" onclick="filterByCategory('DIGITAL')">
          <div class="icon">💾</div>
          <span>Produtos Digitais</span>
        </div>
        <div class="cat-card" onclick="navigate('produtos')">
          <div class="icon">🔥</div>
          <span>Mais Vendidos</span>
        </div>
        <div class="cat-card" onclick="navigate('produtos')">
          <div class="icon">⭐</div>
          <span>Novidades</span>
        </div>
      </div>
    </div>

    <div class="products-section">
      <h2>🛍️ Produtos em Destaque</h2>
      <div id="homeProducts" class="products-grid"></div>
    </div>
  `;

  loadHomeProducts();
}

async function loadHomeProducts() {
  const container = $('#homeProducts');
  if (!container) return;
  showLoading(container);

  try {
    const res = await apiGet('produtos');
    state.produtos = res.produtos || [];
    renderProductGrid(container, state.produtos.slice(0, 8));
  } catch(e) {
    container.innerHTML = '<p class="empty-state">Erro ao carregar produtos</p>';
  }
}

function renderProductGrid(container, produtos) {
  if (!produtos || produtos.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="icon">📭</div>
        <p>Nenhum produto encontrado</p>
      </div>
    `;
    return;
  }

  container.innerHTML = produtos.map(p => `
    <div class="product-card" onclick="navigate('produto', {id:'${p.produtoId}'})">
      <div class="product-img">
        ${p.imagemUrl ? `<img src="${p.imagemUrl}" alt="${p.nome}" onerror="this.style.display='none';this.parentElement.innerHTML='🛒'">` : '🛒'}
      </div>
      <div class="product-info">
        <span class="product-type ${p.tipo === 'DIGITAL' ? 'type-digital' : 'type-fisico'}">${p.tipo}</span>
        <h3>${escapeHtml(p.nome)}</h3>
        <p class="desc">${escapeHtml(p.descricao)}</p>
        <div class="product-meta">
          <span class="product-price">${formatMoney(p.preco)}</span>
          <span class="product-brand">${escapeHtml(p.marca)}</span>
        </div>
        <button class="btn btn-verde btn-sm btn-block">Ver Produto</button>
      </div>
    </div>
  `).join('');
}

function renderProdutos(params = {}) {
  const page = $('#pageProdutos');
  page.classList.remove('hidden');

  page.innerHTML = `
    <div style="padding: 32px 24px; max-width: 1400px; margin: 0 auto;">
      <div class="search-container" style="margin: 0 0 32px 0;">
        <div class="search-box">
          <input type="text" id="prodSearchInput" placeholder="Pesquisar produtos..." value="${params.search || ''}" onkeypress="if(event.key==='Enter')searchProductsPage()">
          <button class="btn btn-verde" onclick="searchProductsPage()">🔍 Pesquisar</button>
        </div>
      </div>
      <h2 style="margin-bottom: 24px; color: var(--verde-escuro);">🛍️ Todos os Produtos</h2>
      <div id="allProducts" class="products-grid"></div>
    </div>
  `;

  loadAllProducts(params.search, params.categoria);
}

async function loadAllProducts(search, categoria) {
  const container = $('#allProducts');
  showLoading(container);

  try {
    const res = await apiGet('produtos', { search, categoria });
    state.produtos = res.produtos || [];
    renderProductGrid(container, state.produtos);
  } catch(e) {
    container.innerHTML = '<p class="empty-state">Erro ao carregar produtos</p>';
  }
}

function searchProducts() {
  const q = $('#searchInput').value.trim();
  if (q) navigate('produtos', { search: q });
}

function searchProductsPage() {
  const q = $('#prodSearchInput').value.trim();
  loadAllProducts(q);
}

function filterByCategory(cat) {
  navigate('produtos', { categoria: cat });
}

async function renderProduto(id) {
  const page = $('#pageProduto');
  page.classList.remove('hidden');
  page.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const res = await apiGet('produto', { id });
    if (!res.success) {
      page.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>Produto não encontrado</p></div>';
      return;
    }

    const p = res.produto;
    state.produtoAtual = p;

    const isDigital = p.tipo === 'DIGITAL';
    const isNetshop = p.metodoPagamento === 'NETSHOP';

    let paymentSection = '';
    if (isNetshop) {
      paymentSection = `
        <div class="payment-box">
          <h3>💳 Pagamento Online</h3>
          <p style="color: var(--cinza); margin-bottom: 16px;">Pague de forma segura via Netshop (M-Pesa, e-Mola, mKesh ou Cartão)</p>
          <div class="form-group">
            <label>Seu telefone</label>
            <input type="tel" id="buyerPhone" placeholder="+25884..." value="+258">
          </div>
          <div class="form-group">
            <label>Método de pagamento</label>
            <select id="paymentMethod">
              <option value="mpesa">M-Pesa</option>
              <option value="emola">e-Mola</option>
              <option value="mkesh">mKesh</option>
              <option value="card">Cartão Visa/Mastercard</option>
            </select>
          </div>
          <button class="netshop-btn" onclick="buyNetshop()">
            💳 COMPRAR AGORA — ${formatMoney(p.preco)}
          </button>
        </div>
      `;
    } else {
      const msg = encodeURIComponent(`Olá, quero comprar o produto ${p.produtoId} — ${p.nome} por ${formatMoney(p.preco)}.`);
      paymentSection = `
        <div class="payment-box">
          <h3>📱 Comprar pelo WhatsApp</h3>
          <p style="color: var(--cinza); margin-bottom: 16px;">Negocie diretamente com o vendedor</p>
          <a href="https://wa.me/${p.whatsapp}?text=${msg}" target="_blank" class="whatsapp-btn">
            📱 COMPRAR PELO WHATSAPP
          </a>
        </div>
      `;
    }

    page.innerHTML = `
      <div class="product-detail">
        <div class="detail-grid">
          <div class="detail-img">
            ${p.imagemUrl ? `<img src="${p.imagemUrl}" alt="${p.nome}" onerror="this.style.display='none';this.parentElement.innerHTML='🛒'">` : '🛒'}
          </div>
          <div class="detail-info">
            <span class="product-type ${isDigital ? 'type-digital' : 'type-fisico'}">${p.tipo}</span>
            <h1>${escapeHtml(p.nome)}</h1>
            <p class="brand">🏪 ${escapeHtml(p.marca)}</p>
            <div class="price">${formatMoney(p.preco)}</div>
            <p class="desc">${escapeHtml(p.descricao)}</p>
            <p style="color: var(--cinza); margin-bottom: 16px;">
              <strong>Referência:</strong> ${p.produtoId}<br>
              <strong>Método:</strong> ${p.metodoPagamento === 'NETSHOP' ? 'Pagamento Online' : 'WhatsApp'}
            </p>
            ${paymentSection}
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    page.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>Erro ao carregar produto</p></div>';
  }
}

async function buyNetshop() {
  const p = state.produtoAtual;
  const phone = $('#buyerPhone').value.trim();
  const method = $('#paymentMethod').value;

  if (!phone || phone.length < 9) {
    showToast('Informe um número de telefone válido', 'error');
    return;
  }

  showToast('A iniciar pagamento...');

  try {
    const res = await apiPost('criarPagamento', {
      produtoId: p.produtoId,
      clienteTelefone: phone,
      metodo: method
    });

    if (res.success) {
      if (res.checkoutUrl) {
        window.open(res.checkoutUrl, '_blank');
        showToast('Redirecionado para o pagamento Netshop');
      } else {
        showToast('Pagamento iniciado! Aguarde confirmação.');
      }
    } else {
      showToast(res.error || 'Erro ao iniciar pagamento', 'error');
    }
  } catch(e) {
    showToast('Erro de conexão', 'error');
  }
}

// ==================== AUTENTICAÇÃO ====================
function renderLogin() {
  const page = $('#pageLogin');
  page.classList.remove('hidden');

  page.innerHTML = `
    <div class="form-container">
      <h2>🔐 Entrar na minha conta</h2>
      <p class="subtitle">Acesse o seu painel de vendedor</p>
      <form onsubmit="event.preventDefault(); doLogin();">
        <div class="form-group">
          <label>Nome ou Telefone</label>
          <input type="text" id="loginIdentificador" placeholder="Nome ou +258..." required>
        </div>
        <div class="form-group">
          <label>PIN</label>
          <input type="password" id="loginPin" placeholder="****" required maxlength="6">
        </div>
        <button type="submit" class="btn btn-verde btn-block" style="margin-bottom: 16px;">ENTRAR</button>
        <p style="text-align: center; color: var(--cinza);">
          Ainda não tem conta? <a href="#" onclick="navigate('registo')" style="color: var(--verde); font-weight: 600;">Registe-se</a>
        </p>
      </form>
    </div>
  `;
}

async function doLogin() {
  const identificador = $('#loginIdentificador').value.trim();
  const pin = $('#loginPin').value;

  try {
    const res = await apiPost('loginVendedor', { identificador, pin });
    if (res.success) {
      state.token = res.token;
      state.vendedor = res.vendedor;
      localStorage.setItem('mz1_token', res.token);
      localStorage.setItem('mz1_vendedor', JSON.stringify(res.vendedor));
      showToast('Bem-vindo, ' + res.vendedor.empresa + '!');
      navigate('dashboard');
    } else {
      showToast(res.error || 'Erro no login', 'error');
    }
  } catch(e) {
    showToast('Erro de conexão', 'error');
  }
}

function renderRegisto() {
  const page = $('#pageRegisto');
  page.classList.remove('hidden');

  page.innerHTML = `
    <div class="form-container">
      <h2>📝 Tornar-se Vendedor</h2>
      <p class="subtitle">Comece a vender na ${CONFIG.APP_NAME}</p>
      <form onsubmit="event.preventDefault(); doRegisto();">
        <div class="form-group">
          <label>Nome Completo</label>
          <input type="text" id="regNome" required>
        </div>
        <div class="form-group">
          <label>Número de Telefone</label>
          <input type="tel" id="regTelefone" placeholder="+25884..." required>
        </div>
        <div class="form-group">
          <label>Número do BI</label>
          <input type="text" id="regBi" required>
        </div>
        <div class="form-group">
          <label>Marca ou Empresa</label>
          <input type="text" id="regEmpresa" required>
        </div>
        <div class="form-group">
          <label>PIN (4-6 dígitos)</label>
          <input type="password" id="regPin" required minlength="4" maxlength="6">
        </div>
        <div class="form-group">
          <label>Plano</label>
          <select id="regPlano">
            <option value="SIMPLES">Simples — 50 MT/mês (3 produtos)</option>
            <option value="MEDIO">Médio — 200 MT/mês (10 produtos)</option>
            <option value="PRO">Pro — 1.000 MT/mês (Ilimitado)</option>
          </select>
        </div>
        <button type="submit" class="btn btn-dourado btn-block" style="margin-bottom: 16px;">REGISTAR-SE</button>
        <p style="text-align: center; color: var(--cinza);">
          Já tem conta? <a href="#" onclick="navigate('login')" style="color: var(--verde); font-weight: 600;">Entrar</a>
        </p>
      </form>
    </div>
  `;
}

async function doRegisto() {
  const data = {
    nome: $('#regNome').value.trim(),
    telefone: $('#regTelefone').value.trim(),
    bi: $('#regBi').value.trim(),
    empresa: $('#regEmpresa').value.trim(),
    pin: $('#regPin').value,
    plano: $('#regPlano').value
  };

  try {
    const res = await apiPost('registarVendedor', data);
    if (res.success) {
      showToast('Registo efetuado! Faça login.');
      navigate('login');
    } else {
      showToast(res.error || 'Erro no registo', 'error');
    }
  } catch(e) {
    showToast('Erro de conexão', 'error');
  }
}

async function logout() {
  if (state.token) {
    await apiPost('logout', { token: state.token });
  }
  state.token = null;
  state.vendedor = null;
  localStorage.removeItem('mz1_token');
  localStorage.removeItem('mz1_vendedor');
  showToast('Sessão terminada');
  navigate('home');
}

// ==================== DASHBOARD VENDEDOR ====================
async function renderDashboard() {
  if (!checkAuth()) return;

  const page = $('#pageDashboard');
  page.classList.remove('hidden');
  page.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const res = await apiGet('dashboard', { token: state.token });
    if (!res.success) {
      showToast('Sessão expirada', 'error');
      logout();
      return;
    }

    const d = res.dashboard;
    const statusClass = d.status === 'ATIVO' ? 'status-ativo' : 'status-desativado';
    const statusText = d.status === 'ATIVO' ? '🟢 ATIVO' : '🔴 DESATIVADO';

    page.innerHTML = `
      <div class="dashboard">
        <div class="dashboard-header">
          <div>
            <h1>👋 Bem-vindo, ${escapeHtml(d.empresa)}</h1>
            <p style="opacity: 0.9; margin-top: 4px;">Vendedor: ${d.vendedorId}</p>
          </div>
          <div class="status">
            <span class="status-dot ${statusClass}"></span>
            <span>${statusText}</span>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Produtos Publicados</div>
            <div class="value">${d.produtosPublicados} / ${d.limiteProdutos}</div>
          </div>
          <div class="stat-card dourado">
            <div class="label">Total de Vendas</div>
            <div class="value">${d.totalVendas}</div>
          </div>
          <div class="stat-card">
            <div class="label">Total Vendido</div>
            <div class="value">${formatMoney(d.totalVendido)}</div>
          </div>
          <div class="stat-card vermelho">
            <div class="label">Taxas</div>
            <div class="value">${formatMoney(d.totalTaxas)}</div>
          </div>
          <div class="stat-card dourado">
            <div class="label">Valor Líquido</div>
            <div class="value">${formatMoney(d.totalLiquido)}</div>
          </div>
          <div class="stat-card">
            <div class="label">Saldo Disponível</div>
            <div class="value">${formatMoney(d.saldoDisponivel)}</div>
          </div>
          <div class="stat-card">
            <div class="label">Plano</div>
            <div class="value">${d.plano}</div>
          </div>
          <div class="stat-card">
            <div class="label">Expira em</div>
            <div class="value">${formatDate(d.expira)}</div>
          </div>
        </div>

        ${d.status !== 'ATIVO' ? `
          <div style="background: #fef3c7; border-radius: var(--radius); padding: 24px; text-align: center; margin-bottom: 32px;">
            <p style="color: #92400e; font-weight: 600; margin-bottom: 12px;">⚠️ A sua conta está desativada. Renove o plano para continuar a vender.</p>
            <button class="btn btn-dourado" onclick="navigate('plano')">Renovar Plano</button>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
          <div class="table-container" style="cursor: pointer;" onclick="navigate('meusProdutos')">
            <h2>📦 Meus Produtos</h2>
            <p style="color: var(--cinza);">Gerencie os seus produtos publicados</p>
            <button class="btn btn-verde" style="margin-top: 16px;">Ver Produtos</button>
          </div>
          <div class="table-container" style="cursor: pointer;" onclick="navigate('minhasVendas')">
            <h2>📊 Minhas Vendas</h2>
            <p style="color: var(--cinza);">Consulte o histórico de vendas</p>
            <button class="btn btn-verde" style="margin-top: 16px;">Ver Vendas</button>
          </div>
          <div class="table-container" style="cursor: pointer;" onclick="navigate('carteira')">
            <h2>💰 Minha Carteira</h2>
            <p style="color: var(--cinza);">Consulte o seu saldo e movimentos</p>
            <button class="btn btn-verde" style="margin-top: 16px;">Ver Carteira</button>
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    page.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>Erro ao carregar dashboard</p></div>';
  }
}

// ==================== MEUS PRODUTOS ====================
async function renderMeusProdutos() {
  if (!checkAuth()) return;

  const page = $('#pageMeusProdutos');
  page.classList.remove('hidden');
  page.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const res = await apiGet('meusProdutos', { token: state.token });
    const produtos = res.produtos || [];

    page.innerHTML = `
      <div class="dashboard">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
          <h2 style="color: var(--verde-escuro);">📦 Meus Produtos</h2>
          <button class="btn btn-dourado" onclick="navigate('adicionarProduto')">+ Adicionar Produto</button>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Preço</th>
                <th>Tipo</th>
                <th>Método</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${produtos.length === 0 ? '<tr><td colspan="6" style="text-align:center;">Nenhum produto registado</td></tr>' : 
                produtos.map(p => `
                <tr>
                  <td>
                    <strong>${escapeHtml(p.nome)}</strong><br>
                    <small style="color: var(--cinza);">${p.produtoId}</small>
                  </td>
                  <td>${formatMoney(p.preco)}</td>
                  <td><span class="badge ${p.tipo === 'DIGITAL' ? 'badge-pendente' : 'badge-sucesso'}">${p.tipo}</span></td>
                  <td>${p.metodoPagamento}</td>
                  <td><span class="badge ${p.status === 'ATIVO' ? 'badge-sucesso' : 'badge-falha'}">${p.status}</span></td>
                  <td>
                    <button class="btn btn-sm btn-verde" onclick="navigate('editarProduto', {id:'${p.produtoId}'})" style="margin-right: 4px;">✏️</button>
                    <button class="btn btn-sm ${p.status === 'ATIVO' ? 'btn-outline' : 'btn-verde'}" onclick="toggleProdutoStatus('${p.produtoId}', '${p.status === 'ATIVO' ? 'DESATIVADO' : 'ATIVO'}')" style="border-color: var(--cinza); color: var(--cinza);">
                      ${p.status === 'ATIVO' ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch(e) {
    page.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>Erro ao carregar produtos</p></div>';
  }
}

async function toggleProdutoStatus(produtoId, novoStatus) {
  try {
    const res = await apiPost('alterarStatusProduto', { token: state.token, produtoId, status: novoStatus });
    if (res.success) {
      showToast(res.message);
      renderMeusProdutos();
    } else {
      showToast(res.error || 'Erro', 'error');
    }
  } catch(e) {
    showToast('Erro de conexão', 'error');
  }
}

// ==================== ADICIONAR/EDITAR PRODUTO ====================
function renderAdicionarProduto() {
  if (!checkAuth()) return;
  renderProdutoForm();
}

async function renderEditarProduto(id) {
  if (!checkAuth()) return;

  try {
    const res = await apiGet('meusProdutos', { token: state.token });
    const produto = (res.produtos || []).find(p => p.produtoId === id);
    if (!produto) {
      showToast('Produto não encontrado', 'error');
      navigate('meusProdutos');
      return;
    }
    renderProdutoForm(produto);
  } catch(e) {
    showToast('Erro', 'error');
  }
}

function renderProdutoForm(produto = null) {
  const isEdit = !!produto;
  const page = isEdit ? $('#pageEditarProduto') : $('#pageAdicionarProduto');
  page.classList.remove('hidden');

  const isDigital = produto?.tipo === 'DIGITAL';

  page.innerHTML = `
    <div class="form-container" style="max-width: 600px;">
      <h2>${isEdit ? '✏️ Editar Produto' : '📦 Adicionar Produto'}</h2>
      <p class="subtitle">${isEdit ? 'Atualize os dados do seu produto' : 'Preencha os dados do novo produto'}</p>
      <form onsubmit="event.preventDefault(); ${isEdit ? 'doEditarProduto()' : 'doCriarProduto()'};">
        <div class="form-group">
          <label>Nome do Produto</label>
          <input type="text" id="prodNome" value="${escapeHtml(produto?.nome || '')}" required>
        </div>
        <div class="form-group">
          <label>Descrição</label>
          <textarea id="prodDescricao" required>${escapeHtml(produto?.descricao || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Link da Imagem (URL)</label>
          <input type="url" id="prodImagem" value="${escapeHtml(produto?.imagemUrl || '')}" placeholder="https://...">
        </div>
        <div class="form-group">
          <label>Preço (MT)</label>
          <input type="number" id="prodPreco" value="${produto?.preco || ''}" required min="1">
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="prodTipo" onchange="onTipoChange()" ${isEdit ? 'disabled' : ''}>
            <option value="FISICO" ${produto?.tipo === 'FISICO' ? 'selected' : ''}>Produto Físico</option>
            <option value="DIGITAL" ${produto?.tipo === 'DIGITAL' ? 'selected' : ''}>Produto Digital</option>
          </select>
          ${isEdit ? '<small>Não é possível alterar o tipo do produto</small>' : ''}
        </div>
        <div class="form-group">
          <label>Método de Pagamento</label>
          <select id="prodMetodo" onchange="onMetodoChange()">
            <option value="WHATSAPP" ${produto?.metodoPagamento === 'WHATSAPP' ? 'selected' : ''}>WhatsApp</option>
            <option value="NETSHOP" ${produto?.metodoPagamento === 'NETSHOP' ? 'selected' : ''}>Netshop (Online)</option>
          </select>
        </div>
        <div class="form-group" id="whatsappGroup" style="${isDigital || produto?.metodoPagamento === 'NETSHOP' ? 'display:none;' : ''}">
          <label>Contacto WhatsApp</label>
          <input type="tel" id="prodWhatsapp" value="${escapeHtml(produto?.whatsapp || '')}" placeholder="+25884...">
        </div>
        <div class="form-group" id="downloadGroup" style="${!isDigital ? 'display:none;' : ''}">
          <label>Link de Download</label>
          <input type="url" id="prodDownload" value="${escapeHtml(produto?.downloadUrl || '')}" placeholder="https://...">
          <small>Obrigatório para produtos digitais</small>
        </div>
        <button type="submit" class="btn btn-verde btn-block" style="margin-bottom: 12px;">
          ${isEdit ? '💾 GUARDAR ALTERAÇÕES' : '✅ PUBLICAR PRODUTO'}
        </button>
        <button type="button" class="btn btn-outline btn-block" onclick="navigate('meusProdutos')" style="border-color: var(--cinza); color: var(--cinza);">
          Cancelar
        </button>
        ${isEdit ? `<input type="hidden" id="editProdutoId" value="${produto.produtoId}">` : ''}
      </form>
    </div>
  `;
}

function onTipoChange() {
  const tipo = $('#prodTipo').value;
  const metodo = $('#prodMetodo');
  const downloadGroup = $('#downloadGroup');
  const whatsappGroup = $('#whatsappGroup');

  if (tipo === 'DIGITAL') {
    metodo.value = 'NETSHOP';
    metodo.disabled = true;
    downloadGroup.style.display = 'block';
    whatsappGroup.style.display = 'none';
  } else {
    metodo.disabled = false;
    downloadGroup.style.display = 'none';
    onMetodoChange();
  }
}

function onMetodoChange() {
  const metodo = $('#prodMetodo').value;
  const whatsappGroup = $('#whatsappGroup');
  if (metodo === 'WHATSAPP') {
    whatsappGroup.style.display = 'block';
  } else {
    whatsappGroup.style.display = 'none';
  }
}

async function doCriarProduto() {
  const data = {
    token: state.token,
    nome: $('#prodNome').value.trim(),
    descricao: $('#prodDescricao').value.trim(),
    imagemUrl: $('#prodImagem').value.trim(),
    preco: $('#prodPreco').value,
    tipo: $('#prodTipo').value,
    metodoPagamento: $('#prodMetodo').value,
    whatsapp: $('#prodWhatsapp')?.value.trim() || '',
    downloadUrl: $('#prodDownload')?.value.trim() || ''
  };

  try {
    const res = await apiPost('criarProduto', data);
    if (res.success) {
      showToast('Produto criado com sucesso!');
      navigate('meusProdutos');
    } else {
      showToast(res.error || 'Erro ao criar produto', 'error');
    }
  } catch(e) {
    showToast('Erro de conexão', 'error');
  }
}

async function doEditarProduto() {
  const data = {
    token: state.token,
    produtoId: $('#editProdutoId').value,
    nome: $('#prodNome').value.trim(),
    descricao: $('#prodDescricao').value.trim(),
    imagemUrl: $('#prodImagem').value.trim(),
    preco: $('#prodPreco').value,
    metodoPagamento: $('#prodMetodo').value,
    whatsapp: $('#prodWhatsapp')?.value.trim() || '',
    downloadUrl: $('#prodDownload')?.value.trim() || ''
  };

  try {
    const res = await apiPost('editarProduto', data);
    if (res.success) {
      showToast('Produto atualizado!');
      navigate('meusProdutos');
    } else {
      showToast(res.error || 'Erro ao atualizar', 'error');
    }
  } catch(e) {
    showToast('Erro de conexão', 'error');
  }
}

// ==================== MINHAS VENDAS ====================
async function renderMinhasVendas() {
  if (!checkAuth()) return;

  const page = $('#pageMinhasVendas');
  page.classList.remove('hidden');
  page.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const res = await apiGet('minhasVendas', { token: state.token });
    const vendas = res.vendas || [];

    page.innerHTML = `
      <div class="dashboard">
        <h2 style="color: var(--verde-escuro); margin-bottom: 24px;">📊 Minhas Vendas</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Cliente</th>
                <th>Valor</th>
                <th>Taxa</th>
                <th>Líquido</th>
                <th>Método</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${vendas.length === 0 ? '<tr><td colspan="8" style="text-align:center;">Nenhuma venda registada</td></tr>' :
                vendas.map(v => `
                <tr>
                  <td>${formatDate(v.data)} ${v.hora || ''}</td>
                  <td>${v.produtoId}</td>
                  <td>${v.clienteTelefone || '-'}</td>
                  <td>${formatMoney(v.valorBruto)}</td>
                  <td>${formatMoney(v.valorTaxa)}</td>
                  <td><strong>${formatMoney(v.valorLiquido)}</strong></td>
                  <td>${v.metodo}</td>
                  <td><span class="badge ${v.status === 'APROVADO' ? 'badge-sucesso' : v.status === 'PENDENTE' ? 'badge-pendente' : 'badge-falha'}">${v.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch(e) {
    page.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>Erro ao carregar vendas</p></div>';
  }
}

// ==================== CARTEIRA ====================
async function renderCarteira() {
  if (!checkAuth()) return;

  const page = $('#pageCarteira');
  page.classList.remove('hidden');
  page.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const res = await apiGet('minhaCarteira', { token: state.token });
    const c = res.carteira;

    page.innerHTML = `
      <div class="dashboard">
        <h2 style="color: var(--verde-escuro); margin-bottom: 24px;">💰 Minha Carteira</h2>
        <div class="stats-grid">
          <div class="stat-card dourado">
            <div class="label">Wallet ID</div>
            <div class="value" style="font-size: 1.2rem;">${c.walletId}</div>
          </div>
          <div class="stat-card">
            <div class="label">Valor Bruto</div>
            <div class="value">${formatMoney(c.valorBruto)}</div>
          </div>
          <div class="stat-card vermelho">
            <div class="label">Taxas</div>
            <div class="value">${formatMoney(c.taxa)}</div>
          </div>
          <div class="stat-card dourado">
            <div class="label">Valor Líquido</div>
            <div class="value">${formatMoney(c.valorLiquido)}</div>
          </div>
        </div>
        <div class="table-container" style="margin-top: 24px;">
          <p style="color: var(--cinza);">Os valores são atualizados automaticamente após a confirmação de cada venda via Netshop.</p>
        </div>
      </div>
    `;
  } catch(e) {
    page.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>Erro ao carregar carteira</p></div>';
  }
}

// ==================== PLANO ====================
async function renderPlano() {
  if (!checkAuth()) return;

  const page = $('#pagePlano');
  page.classList.remove('hidden');
  page.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const res = await apiGet('meuPlano', { token: state.token });
    const p = res.plano;

    page.innerHTML = `
      <div class="dashboard">
        <h2 style="color: var(--verde-escuro); margin-bottom: 8px;">📋 Meu Plano</h2>
        <p style="color: var(--cinza); margin-bottom: 24px;">Plano atual: <strong>${p.nome}</strong> | Status: <strong>${p.status}</strong> | Expira: ${formatDate(p.expira)}</p>

        <div class="plans-grid">
          <div class="plan-card ${p.nome === 'SIMPLES' ? 'destaque' : ''}">
            <h3>Simples</h3>
            <div class="preco">50 <span>MT/mês</span></div>
            <ul class="plan-features">
              <li>Até 3 produtos</li>
              <li>Pagamento Netshop</li>
              <li>Taxa de 17% por venda</li>
              <li>Suporte básico</li>
            </ul>
            <button class="btn btn-verde btn-block" onclick="renovarPlano('SIMPLES')" ${p.nome === 'SIMPLES' ? 'disabled style="opacity:0.5"' : ''}>
              ${p.nome === 'SIMPLES' ? 'Plano Atual' : 'Escolher Simples'}
            </button>
          </div>
          <div class="plan-card ${p.nome === 'MEDIO' ? 'destaque' : ''}">
            <h3>Médio</h3>
            <div class="preco">200 <span>MT/mês</span></div>
            <ul class="plan-features">
              <li>Até 10 produtos</li>
              <li>Pagamento Netshop</li>
              <li>Taxa de 15% por venda</li>
              <li>Suporte prioritário</li>
            </ul>
            <button class="btn btn-verde btn-block" onclick="renovarPlano('MEDIO')" ${p.nome === 'MEDIO' ? 'disabled style="opacity:0.5"' : ''}>
              ${p.nome === 'MEDIO' ? 'Plano Atual' : 'Escolher Médio'}
            </button>
          </div>
          <div class="plan-card ${p.nome === 'PRO' ? 'destaque' : ''}">
            <h3>Pro</h3>
            <div class="preco">1.000 <span>MT/mês</span></div>
            <ul class="plan-features">
              <li>Produtos ilimitados</li>
              <li>Pagamento Netshop</li>
              <li>Taxa de 14% por venda</li>
              <li>Suporte VIP</li>
            </ul>
            <button class="btn btn-dourado btn-block" onclick="renovarPlano('PRO')" ${p.nome === 'PRO' ? 'disabled style="opacity:0.5"' : ''}>
              ${p.nome === 'PRO' ? 'Plano Atual' : 'Escolher Pro'}
            </button>
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    page.innerHTML = '<div class="empty-state"><div class="icon">😕</div><p>Erro ao carregar plano</p></div>';
  }
}

async function renovarPlano(plano) {
  const metodo = prompt('Método de pagamento: mpesa, emola, mkesh ou card', 'mpesa');
  if (!metodo) return;

  const telefone = prompt('Número de telefone para pagamento:', state.vendedor?.telefone || '+258');
  if (!telefone) return;

  try {
    showToast('A processar pagamento do plano...');
    const res = await apiPost('renovarPlano', {
      token: state.token,
      plano,
      metodoPagamento: metodo,
      telefone
    });

    if (res.success && res.checkoutUrl) {
      window.open(res.checkoutUrl, '_blank');
      showToast('Redirecionado para pagamento do plano');
    } else if (res.success) {
      showToast('Pagamento do plano iniciado!');
    } else {
      showToast(res.error || 'Erro', 'error');
    }
  } catch(e) {
    showToast('Erro de conexão', 'error');
  }
}

// ==================== VENDER ====================
function renderVender() {
  const page = $('#pageVender');
  page.classList.remove('hidden');

  page.innerHTML = `
    <div class="hero" style="padding: 100px 24px;">
      <h1>🚀 Venda na ${CONFIG.APP_NAME}</h1>
      <p>Alcance milhares de clientes em Moçambique. Simples, rápido e seguro.</p>
      <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-top: 24px;">
        <button class="btn btn-dourado" onclick="navigate('registo')">Começar a Vender</button>
        <button class="btn btn-outline" onclick="navigate('login')">Já sou Vendedor</button>
      </div>
    </div>

    <div style="max-width: 1000px; margin: 0 auto; padding: 60px 24px;">
      <h2 style="text-align: center; color: var(--verde-escuro); margin-bottom: 48px;">Por que vender connosco?</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 32px;">
        <div style="text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">📱</div>
          <h3>Fácil de usar</h3>
          <p style="color: var(--cinza);">Cadastre-se em minutos e comece a vender imediatamente.</p>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">💳</div>
          <h3>Pagamentos seguros</h3>
          <p style="color: var(--cinza);">Integração com Netshop para pagamentos online via M-Pesa, e-Mola e cartões.</p>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">📊</div>
          <h3>Controle total</h3>
          <p style="color: var(--cinza);">Dashboard completo com vendas, carteira e histórico.</p>
        </div>
      </div>

      <div style="margin-top: 60px;">
        <h2 style="text-align: center; color: var(--verde-escuro); margin-bottom: 32px;">Planos de Venda</h2>
        <div class="plans-grid">
          <div class="plan-card">
            <h3>Simples</h3>
            <div class="preco">50 <span>MT/mês</span></div>
            <ul class="plan-features">
              <li>3 produtos</li>
              <li>Taxa 17%</li>
            </ul>
          </div>
          <div class="plan-card">
            <h3>Médio</h3>
            <div class="preco">200 <span>MT/mês</span></div>
            <ul class="plan-features">
              <li>10 produtos</li>
              <li>Taxa 15%</li>
            </ul>
          </div>
          <div class="plan-card destaque">
            <h3>Pro</h3>
            <div class="preco">1.000 <span>MT/mês</span></div>
            <ul class="plan-features">
              <li>Ilimitado</li>
              <li>Taxa 14%</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==================== HELPERS ====================
function checkAuth() {
  if (!state.token) {
    showToast('Faça login para aceder', 'error');
    navigate('login');
    return false;
  }
  return true;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toggleMobileMenu() {
  // Implementação simples - em produção usar menu slide
  alert('Menu mobile — use desktop para melhor experiência');
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
  // Verificar sessão guardada
  if (state.token && state.vendedor) {
    // Opcional: validar token no backend
  }

  // Renderizar página inicial
  navigate('home');
});
