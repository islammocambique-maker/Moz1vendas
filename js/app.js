/* ============================================
   SORTEMZ — Frontend Otimizado para GAS v2.0
   ============================================ */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyMZ7oDQ7-FOoeitC-MUhzaurSgHY1AJACexuRoCB77nhmCT2tzdjJlfBPrMZ79bw-gBA/exec';

const app = {
  user: null,
  selected: new Set(),
  sorteioAtual: null,
  sorteiosDisponiveis: [],
  config: null,
  pollingDeposito: null,

  /* ==========================================================
     INICIALIZACAO
     ========================================================== */

  init() {
    this.renderGrid();
    this.carregarConfig();
    this.verificarSessao();
    this.bindGlobalEvents();
  },

  bindGlobalEvents() {
    // Fechar modais ao clicar fora
    document.querySelectorAll('.modal-overlay').forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) {
          const id = m.id;
          if (id === 'modal-deposito') this.fecharDeposito();
          if (id === 'modal-levantamento') this.fecharLevantamento();
          if (id === 'modal-confirmar-aposta') this.fecharConfirmacaoAposta();
        }
      });
    });

    // Enter nos inputs de login
    const loginInputs = document.querySelectorAll('#login-nome, #login-telefone');
    loginInputs.forEach(inp => {
      inp.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.entrar();
      });
    });
  },

  /* ==========================================================
     COMUNICACAO API (GAS)
     ========================================================== */

  async get(action, params = {}) {
    try {
      const url = new URL(GAS_URL);
      url.searchParams.set('action', action);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      });

      const r = await fetch(url.toString(), { credentials: 'omit' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data;
    } catch (e) {
      console.error(`[GET ${action}]`, e);
      return { success: false, error: 'Falha de comunicacao com o servidor' };
    }
  },

  async post(data) {
    try {
      // GAS prefere form-urlencoded; JSON pode ser usado mas 
      // form-data e mais compativel com doPost(e.parameter)
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
      }

      const r = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
        credentials: 'omit'
      });

      const text = await r.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('Resposta nao-JSON:', text.substring(0, 200));
        throw new Error('Servidor respondeu com formato invalido');
      }
    } catch (e) {
      console.error('[POST]', e);
      return { success: false, error: e.message || 'Erro de rede' };
    }
  },

  /* ==========================================================
     CONFIGURACOES E DADOS DO SISTEMA
     ========================================================== */

  async carregarConfig() {
    try {
      const cfg = await this.get('config');
      if (cfg && cfg.success) this.config = cfg;

      const abertos = await this.get('sorteiosAbertos');
      if (abertos.success) {
        this.sorteiosDisponiveis = abertos.sorteios || [];
        this.renderSorteios(this.sorteiosDisponiveis);
      }
    } catch (e) {
      console.error('Erro config:', e);
    }
  },

  async carregarResultado() {
    const elInfo = document.getElementById('ultimo-resultado-info');
    const elBolas = document.getElementById('ultimo-bolas');
    if (!elInfo || !elBolas) return;

    try {
      const res = await this.get('resultado');
      if (res.success && res.resultado) {
        const r = res.resultado;
        elInfo.textContent = `Sorteio ${r.sorteioId} — ${r.data} ${r.hora}`;
        elBolas.innerHTML = r.numeros.map(n => `<div class="ball">${n}</div>`).join('');
      } else {
        elInfo.textContent = 'Ainda sem resultados hoje';
        elBolas.innerHTML = '';
      }
    } catch (e) {
      elInfo.textContent = 'Erro ao carregar resultado';
    }
  },

  /* ==========================================================
     AUTENTICACAO / SESSAO
     ========================================================== */

  async entrar() {
    const nome = document.getElementById('login-nome').value.trim();
    const telefone = this.formatarTelefone(document.getElementById('login-telefone').value);

    if (!nome || nome.length < 2) { this.toast('Nome invalido (min. 2 caracteres)'); return; }
    if (!telefone || telefone.length < 9) { this.toast('Telefone invalido'); return; }

    this.setLoading('btn-entrar', true);
    this.toast('A verificar conta...');

    const res = await this.post({ action: 'registarUsuario', nome, telefone });

    this.setLoading('btn-entrar', false);

    if (res.success) {
      this.user = {
        id: res.id,
        nome,
        telefone,
        referencia: res.referencia,
        saldo: Number(res.saldo || 0)
      };
      localStorage.setItem('sortemz_user', JSON.stringify(this.user));
      this.entrarApp();
      this.toast(res.existente ? 'Bem-vindo de volta!' : 'Conta criada com sucesso!');
    } else {
      this.toast(res.error || 'Nao foi possivel aceder a conta');
    }
  },

  verificarSessao() {
    const raw = localStorage.getItem('sortemz_user');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id && parsed.referencia) {
        this.user = parsed;
        this.entrarApp();
      } else {
        localStorage.removeItem('sortemz_user');
      }
    } catch (e) {
      localStorage.removeItem('sortemz_user');
    }
  },

  async entrarApp() {
    document.getElementById('tela-login').classList.add('hidden');
    document.getElementById('tela-app').classList.remove('hidden');

    // Sync com servidor
    await this.syncUsuario();

    this.atualizarUI();
    this.carregarResultado();
    this.renderHistorico();
    this.renderMovimentos();
    this.renderPremios();
    this.renderLevantamentos();

    // Atualizacao periodica de saldo (a cada 30s)
    if (this._saldoInterval) clearInterval(this._saldoInterval);
    this._saldoInterval = setInterval(() => this.syncUsuario(), 30000);
  },

  async syncUsuario() {
    if (!this.user) return;
    try {
      const u = await this.get('usuario', { id: this.user.id });
      if (u.success && u.usuario) {
        this.user.saldo = Number(u.usuario.saldo || 0);
        this.user.nome = u.usuario.nome;
        this.user.telefone = u.usuario.telefone;
        this.user.referencia = u.usuario.referencia;
        localStorage.setItem('sortemz_user', JSON.stringify(this.user));
        this.atualizarUI();
      }
    } catch (e) {
      console.warn('Sync falhou:', e);
    }
  },

  sair() {
    this.user = null;
    this.selected.clear();
    this.sorteioAtual = null;
    if (this._saldoInterval) clearInterval(this._saldoInterval);
    if (this.pollingDeposito) clearInterval(this.pollingDeposito);
    localStorage.removeItem('sortemz_user');
    localStorage.removeItem('sortemz_historico');

    document.getElementById('tela-app').classList.add('hidden');
    document.getElementById('tela-login').classList.remove('hidden');
    this.limparNums();
    this.renderSorteios([]);
  },

  /* ==========================================================
     GRID DE NUMEROS (LOTARIA 5/55)
     ========================================================== */

  renderGrid() {
    const g = document.getElementById('grid-numeros');
    if (!g) return;
    g.innerHTML = '';

    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= 55; i++) {
      const b = document.createElement('button');
      b.className = 'num-btn';
      b.textContent = i;
      b.setAttribute('aria-label', `Numero ${i}`);
      b.onclick = () => this.toggleNum(i, b);
      fragment.appendChild(b);
    }
    g.appendChild(fragment);
  },

  toggleNum(n, btn) {
    if (this.selected.has(n)) {
      this.selected.delete(n);
      btn.classList.remove('selected');
    } else if (this.selected.size < 5) {
      this.selected.add(n);
      btn.classList.add('selected');
    } else {
      this.toast('Ja selecionou 5 numeros');
      return;
    }
    this.updateCounter();
  },

  updateCounter() {
    const elContador = document.getElementById('contador-nums');
    const elResumo = document.getElementById('resumo-nums');
    const btnApostar = document.getElementById('btn-apostar');

    if (elContador) elContador.textContent = `${this.selected.size}/5`;

    const nums = [...this.selected].sort((a, b) => a - b);
    if (elResumo) elResumo.textContent = nums.length ? nums.join(', ') : '—';
    if (btnApostar) btnApostar.disabled = nums.length !== 5 || !this.sorteioAtual;
  },

  renderSorteios(sorteios) {
    const c = document.getElementById('sorteio-selector');
    if (!c) return;

    if (!sorteios.length) {
      c.innerHTML = '<span class="badge badge-gray">Nenhum sorteio aberto</span>';
      this.sorteioAtual = null;
      this.updateCounter();
      return;
    }

    this.sorteioAtual = sorteios[0].id;
    c.innerHTML = sorteios.map(s => {
      const fechamento = s.fechamento ? `Fecha: ${s.fechamento.split(' ')[1]}` : '';
      const isActive = s.id === this.sorteioAtual;
      return `
        <button class="sorteio-tag ${isActive ? 'active' : ''}"
                data-id="${s.id}"
                onclick="app.selecionarSorteio('${s.id}', '${s.hora}', '${s.data}')">
          <strong>${s.hora}</strong>
          <span style="opacity:0.7;font-size:11px;">${s.data}</span>
          <div style="font-size:10px;font-weight:400;margin-top:2px;">${fechamento}</div>
        </button>
      `;
    }).join('');

    const elResumo = document.getElementById('resumo-sorteio');
    if (elResumo) elResumo.textContent = `${sorteios[0].hora} (${sorteios[0].data})`;
    this.updateCounter();
  },

  selecionarSorteio(id, hora, data) {
    this.sorteioAtual = id;
    document.querySelectorAll('.sorteio-tag').forEach(b => {
      b.classList.toggle('active', b.dataset.id === id);
    });
    const elResumo = document.getElementById('resumo-sorteio');
    if (elResumo) elResumo.textContent = `${hora} (${data})`;
    this.updateCounter();
  },

  limparNums() {
    this.selected.clear();
    document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
    this.updateCounter();
  },

  aleatorio() {
    this.limparNums();
    const nums = new Set();
    while (nums.size < 5) nums.add(Math.floor(Math.random() * 55) + 1);
    this.selected = nums;

    const btns = document.querySelectorAll('.num-btn');
    this.selected.forEach(n => {
      if (btns[n - 1]) btns[n - 1].classList.add('selected');
    });
    this.updateCounter();
  },

  /* ==========================================================
     APOSTA
     ========================================================== */

  async apostar() {
    if (this.selected.size !== 5 || !this.user || !this.sorteioAtual) return;

    const nums = [...this.selected].sort((a, b) => a - b);
    this.numsPendentes = nums;
    this.abrirConfirmacaoAposta(nums);
  },

  abrirConfirmacaoAposta(nums) {
    const elNums = document.getElementById('confirm-nums');
    const elSorteio = document.getElementById('confirm-sorteio');
    const elValor = document.getElementById('confirm-valor');

    if (elNums) elNums.textContent = nums.join(', ');
    if (elSorteio) elSorteio.textContent = this.sorteiosDisponiveis.find(s => s.id === this.sorteioAtual)?.hora || '?';
    if (elValor) elValor.textContent = '10 MZN';

    document.getElementById('modal-confirmar-aposta').classList.remove('hidden');
  },

  fecharConfirmacaoAposta() {
    document.getElementById('modal-confirmar-aposta').classList.add('hidden');
    this.numsPendentes = null;
  },

  async confirmarAposta() {
    if (!this.numsPendentes || !this.sorteioAtual) return;

    this.fecharConfirmacaoAposta();
    const btnApostar = document.getElementById('btn-apostar');
    if (btnApostar) btnApostar.disabled = true;

    this.toast('A registar aposta...');

    const res = await this.post({
      action: 'registarJogada',
      usuarioId: this.user.id,
      referencia: this.user.referencia,
      sorteioId: this.sorteioAtual,
      numeros: this.numsPendentes,
      valor: 10
    });

    if (res.success) {
      this.user.saldo = Number(res.saldoRestante);
      localStorage.setItem('sortemz_user', JSON.stringify(this.user));
      this.atualizarUI();
      this.limparNums();
      this.toast('Aposta confirmada! Boa sorte!');
      this.adicionarHistoricoLocal(this.numsPendentes, res.jogadaId, res.sorteioId);
      this.numsPendentes = null;
    } else {
      this.toast(res.error || 'Erro ao processar aposta');
      if (btnApostar) btnApostar.disabled = false;
    }
  },

  /* ==========================================================
     INTERFACE & TABS
     ========================================================== */

  atualizarUI() {
    const elSaldo = document.getElementById('saldo-display');
    if (elSaldo) {
      elSaldo.innerHTML = `${Number(this.user?.saldo || 0).toLocaleString('pt-PT')} <span class="saldo-mzn">MZN</span>`;
    }

    const map = { nome: 'nome', telefone: 'telefone', ref: 'referencia', id: 'id' };
    Object.entries(map).forEach(([field, key]) => {
      const el = document.getElementById(`conta-${field}`);
      if (el && this.user?.[key]) el.textContent = this.user[key];
    });

    // Atualizar referencia no modal de deposito
    const elDepRef = document.getElementById('dep-ref');
    if (elDepRef && this.user?.referencia) elDepRef.textContent = this.user.referencia;
  },

  setTab(t) {
    document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === t));
    ['jogar', 'resultados', 'historico', 'conta'].forEach(x => {
      const el = document.getElementById('tab-' + x);
      if (el) el.classList.toggle('hidden', x !== t);
    });

    if (t === 'resultados') { this.carregarResultado(); }
    if (t === 'historico') { this.renderPremios(); }
    if (t === 'conta') { this.renderMovimentos(); this.renderLevantamentos(); }
  },

  /* ==========================================================
     MODAL DEPOSITO (NETSHOP)
     ========================================================== */

  abrirDeposito() {
    if (!this.user) { this.toast('Inicie sessao primeiro'); return; }

    const modal = document.getElementById('modal-deposito');
    const elRef = document.getElementById('dep-ref');
    const elTelefone = document.getElementById('dep-telefone');
    const elValor = document.getElementById('dep-valor');
    const elStatus = document.getElementById('dep-status');

    if (elRef) elRef.textContent = this.user.referencia;
    if (elTelefone) elTelefone.value = this.user.telefone || '';
    if (elValor) elValor.value = '';
    if (elStatus) {
      elStatus.classList.add('hidden');
      elStatus.textContent = '';
    }

    // Reset estado
    this._depositoChargeId = null;
    if (this.pollingDeposito) {
      clearInterval(this.pollingDeposito);
      this.pollingDeposito = null;
    }

    modal.classList.remove('hidden');
  },

  fecharDeposito() {
    document.getElementById('modal-deposito').classList.add('hidden');
    if (this.pollingDeposito) {
      clearInterval(this.pollingDeposito);
      this.pollingDeposito = null;
    }
  },

  async processarDeposito() {
    const telefone = this.formatarTelefone(document.getElementById('dep-telefone').value);
    const valor = Number(document.getElementById('dep-valor').value);
    const metodo = document.getElementById('dep-metodo')?.value || 'mpesa';
    const elStatus = document.getElementById('dep-status');

    if (!telefone || telefone.length < 9) { this.toast('Telefone invalido'); return; }
    if (!valor || valor < 10) { this.toast('Valor minimo: 10 MZN'); return; }

    this.setLoading('btn-depositar', true);
    this.mostrarStatusDeposito('A iniciar pagamento...', 'info');

    const res = await this.post({
      action: 'depositoNetshop',
      referencia: this.user.referencia,
      telefone: telefone,
      valor: valor,
      metodo: metodo
    });

    this.setLoading('btn-depositar', false);

    if (!res.success) {
      this.mostrarStatusDeposito(res.message || 'Erro no pagamento', 'error');
      return;
    }

    if (res.status === 'paid') {
      this.mostrarStatusDeposito('Pagamento confirmado! Saldo atualizado.', 'success');
      await this.syncUsuario();
      this.toast('Deposito creditado com sucesso!');
      setTimeout(() => this.fecharDeposito(), 2000);
    } else if (res.status === 'pending' && res.charge_id) {
      this._depositoChargeId = res.charge_id;
      this.mostrarStatusDeposito(res.message || 'Aguardando confirmacao no seu celular...', 'warning');
      this.iniciarPollingDeposito();
    } else {
      this.mostrarStatusDeposito(res.message || 'Resposta inesperada do servidor', 'error');
    }
  },

  mostrarStatusDeposito(msg, tipo) {
    const el = document.getElementById('dep-status');
    if (!el) return;
    el.classList.remove('hidden', 'success', 'error', 'warning', 'info');
    el.classList.add(tipo);
    el.textContent = msg;
  },

  iniciarPollingDeposito() {
    if (this.pollingDeposito) clearInterval(this.pollingDeposito);

    let tentativas = 0;
    const maxTentativas = 20; // ~2 minutos (a cada 6s)

    this.pollingDeposito = setInterval(async () => {
      tentativas++;
      if (tentativas > maxTentativas) {
        clearInterval(this.pollingDeposito);
        this.pollingDeposito = null;
        this.mostrarStatusDeposito('Tempo esgotado. O deposito pode demorar. Verifique o saldo mais tarde.', 'warning');
        return;
      }

      // Verifica saldo — se aumentou, considera pago
      const u = await this.get('usuario', { id: this.user.id });
      if (u.success && u.usuario) {
        const novoSaldo = Number(u.usuario.saldo || 0);
        if (novoSaldo > (this.user.saldo || 0)) {
          clearInterval(this.pollingDeposito);
          this.pollingDeposito = null;
          this.user.saldo = novoSaldo;
          localStorage.setItem('sortemz_user', JSON.stringify(this.user));
          this.atualizarUI();
          this.mostrarStatusDeposito('Pagamento confirmado! Saldo atualizado.', 'success');
          this.toast('Deposito creditado com sucesso!');
          setTimeout(() => this.fecharDeposito(), 2000);
        }
      }
    }, 6000);
  },

  copiarReferencia() {
    const ref = this.user?.referencia;
    if (!ref) return;
    navigator.clipboard.writeText(ref).then(() => {
      this.toast('Referencia copiada!');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = ref;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.toast('Referencia copiada!');
    });
  },

  /* ==========================================================
     MODAL LEVANTAMENTO
     ========================================================== */

  abrirLevantamento() {
    if (!this.user) { this.toast('Inicie sessao primeiro'); return; }

    const elSaldo = document.getElementById('lev-saldo');
    const elTelefone = document.getElementById('lev-telefone');
    const elValor = document.getElementById('lev-valor');

    if (elSaldo) elSaldo.textContent = `${Number(this.user.saldo || 0).toLocaleString('pt-PT')} MZN`;
    if (elTelefone) elTelefone.value = this.user.telefone || '';
    if (elValor) elValor.value = '';

    document.getElementById('modal-levantamento').classList.remove('hidden');
  },

  fecharLevantamento() {
    document.getElementById('modal-levantamento').classList.add('hidden');
  },

  async solicitarLevantamento() {
    const valor = Number(document.getElementById('lev-valor').value);
    const telefone = this.formatarTelefone(document.getElementById('lev-telefone').value);

    if (!valor || valor < 50) { this.toast('Valor minimo: 50 MZN'); return; }
    if (!telefone || telefone.length < 9) { this.toast('Telefone invalido'); return; }
    if ((this.user.saldo || 0) < valor) { this.toast('Saldo insuficiente'); return; }

    this.setLoading('btn-confirmar-lev', true);
    this.toast('A processar pedido...');

    const res = await this.post({
      action: 'solicitarLevantamento',
      usuarioId: this.user.id,
      valor: valor,
      telefone: telefone
    });

    this.setLoading('btn-confirmar-lev', false);

    if (res.success) {
      this.user.saldo = Number(res.novoSaldo);
      localStorage.setItem('sortemz_user', JSON.stringify(this.user));
      this.atualizarUI();
      this.fecharLevantamento();
      this.toast('Pedido enviado! Aguarde aprovacao.');
      this.renderLevantamentos();
    } else {
      this.toast(res.error || 'Erro ao efetuar o pedido');
    }
  },

  /* ==========================================================
     HISTORICO, MOVIMENTOS, PREMIOS, LEVANTAMENTOS
     ========================================================== */

  adicionarHistoricoLocal(nums, jogadaId, sorteioId) {
    const sorteio = this.sorteiosDisponiveis.find(s => s.id === sorteioId) || { hora: '?', data: '?' };
    const hist = JSON.parse(localStorage.getItem('sortemz_historico') || '[]');
    hist.unshift({
      id: jogadaId,
      nums,
      sorteio: sorteio.hora,
      data: sorteio.data,
      status: 'Confirmada',
      timestamp: Date.now()
    });
    localStorage.setItem('sortemz_historico', JSON.stringify(hist.slice(0, 50)));
    this.renderHistorico();
  },

  renderHistorico() {
    const c = document.getElementById('lista-historico');
    if (!c) return;

    const hist = JSON.parse(localStorage.getItem('sortemz_historico') || '[]');
    if (!hist.length) {
      c.innerHTML = '<div class="empty-state">Ainda nao realizou apostas</div>';
      return;
    }

    c.innerHTML = hist.map(j => {
      const sc = j.status.includes('Ganhou') ? 'badge-gold' : j.status === 'Perdeu' ? 'badge-gray' : 'badge-green';
      return `
        <div class="aposta-card">
          <div class="aposta-header">
            <span class="aposta-meta">${j.id} · ${j.data} · ${j.sorteio}</span>
            <span class="badge ${sc}">${j.status}</span>
          </div>
          <div class="aposta-bolas">
            ${j.nums.map(n => `<div class="ball">${n}</div>`).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  async renderMovimentos() {
    const c = document.getElementById('lista-movimentos');
    if (!c || !this.user) return;

    // Buscar do servidor (nao do localStorage)
    const res = await this.get('minhasJogadas', { id: this.user.id });
    // Nota: o backend nao tem endpoint de movimentos genericos, 
    // entao mostramos apenas historico local + premios como proxy
    const premiosRes = await this.get('meusPremios', { id: this.user.id });

    let html = '';

    // Premios como movimentos positivos
    if (premiosRes.success && premiosRes.premios?.length) {
      html += premiosRes.premios.map(p => `
        <div class="info-row">
          <span class="info-label">Premio · ${p.acertos} acertos</span>
          <span class="info-val" style="color:var(--color-green)">+${Number(p.premio).toLocaleString('pt-PT')} MZN</span>
        </div>
      `).join('');
    }

    // Apostas como movimentos negativos
    if (res.success && res.jogadas?.length) {
      html += res.jogadas.slice(0, 10).map(j => `
        <div class="info-row">
          <span class="info-label">Aposta · ${j.data}</span>
          <span class="info-val" style="color:var(--color-red)">-${Number(j.valor).toLocaleString('pt-PT')} MZN</span>
        </div>
      `).join('');
    }

    c.innerHTML = html || '<div class="empty-state">Sem movimentos registados</div>';
  },

  async renderPremios() {
    if (!this.user) return;
    const c = document.getElementById('lista-premios');
    if (!c) return;

    const res = await this.get('meusPremios', { id: this.user.id });
    if (res.success && res.premios?.length) {
      c.innerHTML = res.premios.map(p => `
        <div class="info-row">
          <span class="info-label">${p.acertos} acertos · Sorteio ${p.sorteioId}</span>
          <span class="info-val" style="color:var(--color-green)">+${Number(p.premio).toLocaleString('pt-PT')} MZN</span>
        </div>
      `).join('');
    } else {
      c.innerHTML = '<div class="empty-state">Sem premios acumulados</div>';
    }
  },

  async renderLevantamentos() {
    if (!this.user) return;
    const c = document.getElementById('lista-levantamentos');
    if (!c) return;

    const res = await this.get('meusLevantamentos', { id: this.user.id });
    if (res.success && res.levantamentos?.length) {
      c.innerHTML = res.levantamentos.map(l => {
        const cor = l.status === 'APROVADO' ? 'var(--color-green)' : l.status === 'REJEITADO' ? 'var(--color-red)' : 'var(--color-gold)';
        return `
          <div class="info-row">
            <span class="info-label">${l.data} · ${l.status}</span>
            <span class="info-val" style="color:${cor}">${Number(l.valor).toLocaleString('pt-PT')} MZN</span>
          </div>
        `;
      }).join('');
    } else {
      c.innerHTML = '<div class="empty-state">Sem historico de levantamentos</div>';
    }
  },

  /* ==========================================================
     UTILITARIOS
     ========================================================== */

  formatarTelefone(tel) {
    if (!tel) return '';
    let t = String(tel).trim().replace(/\D/g, '');
    // Remove prefixo 258 se existir para normalizar
    if (t.startsWith('258') && t.length > 9) t = t.substring(3);
    return t;
  },

  setLoading(id, ativo) {
    const el = document.getElementById(id);
    if (!el) return;
    if (ativo) {
      el.dataset.originalText = el.textContent;
      el.textContent = '...';
      el.disabled = true;
    } else {
      el.textContent = el.dataset.originalText || el.textContent;
      el.disabled = false;
    }
  },

  toast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
