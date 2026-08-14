/* ============================================
   SORTEMZ — Frontend
   Substitui GAS_URL pelo URL do teu deployment
   ============================================ */

const GAS_URL = 'https://script.google.com/macros/s/SEU_ID_AQUI/exec';

const app = {
  user: null,
  selected: new Set(),
  sorteioAtual: null,
  config: null,

  init() {
    this.renderGrid();
    this.carregarConfig();
    this.verificarSessao();
  },

  /* ---------- API Helpers ---------- */

  async get(action, params = {}) {
    const url = new URL(GAS_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url);
    return r.json();
  },

  async post(data) {
    const r = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return r.json();
  },

  /* ---------- Config & Sorteios ---------- */

  async carregarConfig() {
    try {
      const cfg = await this.get('config');
      this.config = cfg;
      this.renderSorteios(cfg.sorteios || ['10:00', '15:00', '19:00']);
      this.renderProximos(cfg.sorteios || ['10:00', '15:00', '19:00']);
    } catch (e) {
      // fallback
      this.renderSorteios(['10:00', '15:00', '19:00']);
      this.renderProximos(['10:00', '15:00', '19:00']);
    }
  },

  async carregarResultado() {
    try {
      const res = await this.get('resultado');
      const elInfo = document.getElementById('ultimo-resultado-info');
      const elBolas = document.getElementById('ultimo-bolas');
      if (res.success && res.resultado) {
        const r = res.resultado;
        elInfo.textContent = `Sorteio ${r.sorteioId} — ${r.data} ${r.hora}`;
        elBolas.innerHTML = r.numeros.map(n =>
          `<div class="ball">${n}</div>`
        ).join('');
      } else {
        elInfo.textContent = 'Ainda sem resultados';
        elBolas.innerHTML = '';
      }
    } catch (e) {
      document.getElementById('ultimo-resultado-info').textContent = 'Erro ao carregar';
    }
  },

  async carregarCofres() {
    try {
      const sorteios = await this.get('sorteios');
      const c = document.getElementById('lista-cofres');
      if (!sorteios.length) {
        c.innerHTML = '<div class="empty-state">Sem sorteios hoje</div>';
        return;
      }
      c.innerHTML = sorteios.map(s => `
        <div class="info-row">
          <span class="info-label">${s.hora}</span>
          <span class="info-val">${Number(s.saldoPremios || 0).toLocaleString('pt-PT')} MZN</span>
        </div>
      `).join('');
    } catch (e) {
      document.getElementById('lista-cofres').innerHTML = '<div class="empty-state">Erro ao carregar cofres</div>';
    }
  },

  /* ---------- Autenticação ---------- */

  async entrar() {
    const nome = document.getElementById('login-nome').value.trim();
    const telefone = document.getElementById('login-telefone').value.trim();

    if (!nome || !telefone) {
      this.toast('Preenche nome e telefone');
      return;
    }

    this.toast('A processar…');

    try {
      // Tenta obter usuário existente pelo telefone (não tem endpoint direto, então registamos)
      const res = await this.post({
        action: 'registarUsuario',
        nome: nome,
        telefone: telefone
      });

      if (res.success) {
        this.user = {
          id: res.id,
          nome: nome,
          telefone: telefone,
          referencia: res.referencia,
          saldo: res.saldo
        };
        localStorage.setItem('sortemz_user', JSON.stringify(this.user));
        this.entrarApp();
        this.toast('Bem-vindo, ' + nome + '!');
      } else {
        this.toast(res.error || 'Erro ao criar conta');
      }
    } catch (e) {
      this.toast('Erro de ligação. Tenta mais tarde.');
    }
  },

  verificarSessao() {
    const raw = localStorage.getItem('sortemz_user');
    if (raw) {
      try {
        this.user = JSON.parse(raw);
        this.entrarApp();
      } catch (e) {
        localStorage.removeItem('sortemz_user');
      }
    }
  },

  async entrarApp() {
    document.getElementById('tela-login').classList.add('hidden');
    document.getElementById('tela-app').classList.remove('hidden');

    document.getElementById('user-ref').textContent = `Ref: ${this.user.referencia}`;
    document.getElementById('dep-ref').textContent = this.user.referencia;

    // Atualiza saldo do servidor
    try {
      const u = await this.get('usuario', { id: this.user.id });
      if (u.success && u.usuario) {
        this.user.saldo = u.usuario.saldo;
        this.user.nome = u.usuario.nome;
        this.user.telefone = u.usuario.telefone;
        localStorage.setItem('sortemz_user', JSON.stringify(this.user));
      }
    } catch (e) { /* ignora */ }

    this.atualizarUI();
    this.carregarResultado();
    this.carregarCofres();
    this.renderHistorico();
    this.renderMovimentos();
  },

  sair() {
    this.user = null;
    this.selected.clear();
    localStorage.removeItem('sortemz_user');
    document.getElementById('tela-app').classList.add('hidden');
    document.getElementById('tela-login').classList.remove('hidden');
    this.limparNums();
  },

  /* ---------- Jogar ---------- */

  renderGrid() {
    const g = document.getElementById('grid-numeros');
    g.innerHTML = '';
    for (let i = 1; i <= 65; i++) {
      const b = document.createElement('button');
      b.className = 'num-btn';
      b.textContent = i;
      b.onclick = () => this.toggleNum(i, b);
      g.appendChild(b);
    }
  },

  toggleNum(n, btn) {
    if (this.selected.has(n)) {
      this.selected.delete(n);
      btn.classList.remove('selected');
    } else if (this.selected.size < 5) {
      this.selected.add(n);
      btn.classList.add('selected');
    }
    this.updateCounter();
  },

  updateCounter() {
    document.getElementById('contador-nums').textContent = `${this.selected.size}/5`;
    const nums = [...this.selected].sort((a, b) => a - b);
    document.getElementById('resumo-nums').textContent = nums.length ? nums.join(', ') : '—';
    document.getElementById('btn-apostar').disabled = nums.length !== 5;
  },

  renderSorteios(horas) {
    const c = document.getElementById('sorteio-selector');
    this.sorteioAtual = horas[horas.length - 1]; // default último
    c.innerHTML = horas.map(h =>
      `<button class="sorteio-tag ${h === this.sorteioAtual ? 'active' : ''}" onclick="app.selecionarSorteio('${h}')">${h}</button>`
    ).join('');
    document.getElementById('resumo-sorteio').textContent = this.sorteioAtual;
  },

  renderProximos(horas) {
    const c = document.getElementById('proximos-sorteios');
    const agora = new Date();
    c.innerHTML = horas.map(h => {
      const [hh, mm] = h.split(':').map(Number);
      const sorteioHora = new Date();
      sorteioHora.setHours(hh, mm, 0, 0);
      const aberto = sorteioHora > agora ? 'ABERTO' : 'FECHADO';
      return `
        <div class="info-row">
          <span class="info-label">${h}</span>
          <span class="badge ${aberto === 'ABERTO' ? 'badge-green' : 'badge-gray'}">${aberto}</span>
        </div>`;
    }).join('');
  },

  selecionarSorteio(h) {
    this.sorteioAtual = h;
    document.querySelectorAll('.sorteio-tag').forEach(b => b.classList.toggle('active', b.textContent === h));
    document.getElementById('resumo-sorteio').textContent = h;
  },

  limparNums() {
    this.selected.clear();
    document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
    this.updateCounter();
  },

  aleatorio() {
    this.limparNums();
    while (this.selected.size < 5) {
      const n = Math.floor(Math.random() * 65) + 1;
      if (!this.selected.has(n)) this.selected.add(n);
    }
    const btns = document.querySelectorAll('.num-btn');
    this.selected.forEach(n => btns[n - 1].classList.add('selected'));
    this.updateCounter();
  },

  async apostar() {
    if (this.selected.size !== 5) return;
    if (!this.user) { this.toast('Entra primeiro'); return; }

    const nums = [...this.selected].sort((a, b) => a - b);

    this.toast('A confirmar aposta…');

    try {
      const res = await this.post({
        action: 'registarJogada',
        usuarioId: this.user.id,
        referencia: this.user.referencia,
        numeros: nums,
        valor: 10
      });

      if (res.success) {
        this.user.saldo -= 10;
        localStorage.setItem('sortemz_user', JSON.stringify(this.user));
        this.atualizarUI();
        this.limparNums();
        this.toast('Aposta confirmada! Boa sorte!');
        this.adicionarHistoricoLocal(nums, res.jogadaId);
      } else {
        this.toast(res.error || 'Erro ao registar jogada');
      }
    } catch (e) {
      this.toast('Erro de ligação');
    }
  },

  /* ---------- UI Updates ---------- */

  atualizarUI() {
    document.getElementById('saldo-display').innerHTML =
      `${Number(this.user.saldo || 0).toLocaleString('pt-PT')} <span class="saldo-mzn">MZN</span>`;
    document.getElementById('conta-nome').textContent = this.user.nome;
    document.getElementById('conta-telefone').textContent = this.user.telefone;
    document.getElementById('conta-ref').textContent = this.user.referencia;
    document.getElementById('conta-id').textContent = this.user.id;
  },

  setTab(t) {
    document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === t));
    ['jogar', 'resultados', 'historico', 'conta'].forEach(x => {
      document.getElementById('tab-' + x).classList.toggle('hidden', x !== t);
    });
    if (t === 'resultados') {
      this.carregarResultado();
      this.carregarCofres();
    }
  },

  /* ---------- Depósito Netshop ---------- */

  abrirDeposito() {
    document.getElementById('modal-deposito').classList.remove('hidden');
  },

  fecharDeposito() {
    document.getElementById('modal-deposito').classList.add('hidden');
  },

  /* ---------- Histórico (local + server) ---------- */

  adicionarHistoricoLocal(nums, jogadaId) {
    const hist = JSON.parse(localStorage.getItem('sortemz_historico') || '[]');
    hist.unshift({
      id: jogadaId,
      nums: nums,
      sorteio: this.sorteioAtual,
      data: new Date().toLocaleDateString('pt-PT'),
      status: 'Confirmada'
    });
    localStorage.setItem('sortemz_historico', JSON.stringify(hist.slice(0, 50)));
    this.renderHistorico();
  },

  renderHistorico() {
    const c = document.getElementById('lista-historico');
    const hist = JSON.parse(localStorage.getItem('sortemz_historico') || '[]');
    if (!hist.length) {
      c.innerHTML = '<div class="empty-state">Ainda não fizeste apostas</div>';
      return;
    }
    c.innerHTML = hist.map(j => {
      const statusClass = j.status.includes('Ganhou') ? 'badge-gold' : j.status === 'Perdeu' ? 'badge-gray' : 'badge-green';
      return `
        <div class="aposta-card">
          <div class="aposta-header">
            <span class="aposta-meta">${j.id} · ${j.data} · ${j.sorteio}</span>
            <span class="badge ${statusClass}">${j.status}</span>
          </div>
          <div class="aposta-bolas">
            ${j.nums.map(n => `<div class="ball">${n}</div>`).join('')}
          </div>
        </div>`;
    }).join('');
  },

  renderMovimentos() {
    const c = document.getElementById('lista-movimentos');
    const movs = JSON.parse(localStorage.getItem('sortemz_movimentos') || '[]');
    if (!movs.length) {
      c.innerHTML = '<div class="empty-state">Sem movimentos</div>';
      return;
    }
    c.innerHTML = movs.map(m => `
      <div class="info-row">
        <span class="info-label">${m.data} · ${m.tipo}</span>
        <span class="info-val" style="color:${m.valor > 0 ? 'var(--color-green)' : m.valor < 0 ? 'var(--color-red)' : 'inherit'}">
          ${m.valor > 0 ? '+' : ''}${m.valor} MZN
        </span>
      </div>
    `).join('');
  },

  /* ---------- Toast ---------- */

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }
};

// Inicializa
document.addEventListener('DOMContentLoaded', () => app.init());
