/* ============================================
   SORTEMZ — Frontend Otimizado para GAS
   ============================================ */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbycq5wHfa3O3cu27K5RIKZvN3EbK4UIYqUuj6jhCLtdQo77UcxkNTVhjEocECRAVoBHmQ/exec';

const app = {
  user: null,
  selected: new Set(),
  sorteioAtual: null,
  sorteiosDisponiveis: [],
  config: null,

  init() {
    this.renderGrid();
    this.carregarConfig();
    this.verificarSessao();
  },

  /* ---------- Comunicação API (GAS) ---------- */

  async get(action, params = {}) {
    try {
      const url = new URL(GAS_URL);
      url.searchParams.set('action', action);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      
      const r = await fetch(url.toString(), { credentials: 'omit' });
      if (!r.ok) throw new Error(`HTTP Error: ${r.status}`);
      return await r.json();
    } catch (e) {
      console.error(`[GET ${action}] Erro:`, e);
      return { success: false, error: 'Falha de comunicação com o servidor' };
    }
  },

  async post(data) {
    try {
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
        console.error('Resposta não-JSON do GAS:', text);
        throw new Error('Servidor respondeu com formato inválido.');
      }
    } catch (e) {
      console.error('[POST] Erro:', e);
      return { success: false, error: e.message || 'Erro de rede' };
    }
  },

  /* ---------- Configurações e Dados do Sistema ---------- */

  async carregarConfig() {
    try {
      const cfg = await this.get('config');
      if (cfg) this.config = cfg;

      const abertos = await this.get('sorteiosAbertos');
      if (abertos.success) {
        this.sorteiosDisponiveis = abertos.sorteios || [];
        this.renderSorteios(this.sorteiosDisponiveis);
      }
    } catch (e) {
      console.error('Erro ao carregar configurações:', e);
    }
  },

  async carregarResultado() {
    const elInfo = document.getElementById('ultimo-resultado-info');
    const elBolas = document.getElementById('ultimo-bolas');
    
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
      if (elInfo) elInfo.textContent = 'Erro ao carregar resultado';
    }
  },

  async carregarCofres() {
    const c = document.getElementById('lista-cofres');
    try {
      const res = await this.get('sorteios');
      const sorteios = Array.isArray(res) ? res : (res.sorteios || []);

      if (!sorteios.length) {
        c.innerHTML = '<div class="empty-state">Sem sorteios agendados</div>';
        return;
      }
      c.innerHTML = sorteios.map(s => `
        <div class="info-row">
          <span class="info-label">${s.hora} (${s.data})</span>
          <span class="info-val">${Number(s.saldoPremios || 0).toLocaleString('pt-PT')} MZN</span>
        </div>
      `).join('');
    } catch (e) {
      if (c) c.innerHTML = '<div class="empty-state">Erro ao carregar cofres</div>';
    }
  },

  /* ---------- Autenticação / Sessão ---------- */

  async entrar() {
    const nome = document.getElementById('login-nome').value.trim();
    const telefone = document.getElementById('login-telefone').value.trim();
    if (!nome || !telefone) { this.toast('Preencha o nome e o telefone'); return; }

    this.toast('A verificar conta…');
    const res = await this.post({ action: 'registarUsuario', nome, telefone });

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
      this.toast(res.error || 'Não foi possível aceder à conta');
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

    // Atualização imediata do ID de referência do utilizador
    const elRef = document.getElementById('user-ref');
    const elDepRef = document.getElementById('dep-ref');
    if (elRef) elRef.textContent = `Ref: ${this.user.referencia}`;
    if (elDepRef) elDepRef.textContent = this.user.referencia;

    // Atualizar dados em tempo real no GAS
    try {
      const u = await this.get('usuario', { id: this.user.id });
      if (u.success && u.usuario) {
        this.user.saldo = Number(u.usuario.saldo || 0);
        this.user.nome = u.usuario.nome;
        this.user.telefone = u.usuario.telefone;
        localStorage.setItem('sortemz_user', JSON.stringify(this.user));
      }
    } catch (e) {}

    this.atualizarUI();
    this.carregarResultado();
    this.carregarCofres();
    this.renderHistorico();
    this.renderMovimentos();
    this.renderPremios();
    this.renderLevantamentos();
  },

  sair() {
    this.user = null; 
    this.selected.clear();
    localStorage.removeItem('sortemz_user');
    document.getElementById('tela-app').classList.add('hidden');
    document.getElementById('tela-login').classList.remove('hidden');
    this.limparNums();
  },

  /* ---------- Mecânica do Jogo (Lotaria 5/55) ---------- */

  renderGrid() {
    const g = document.getElementById('grid-numeros');
    if (!g) return;
    g.innerHTML = '';
    // Regra da Lotaria 5/55
    for (let i = 1; i <= 55; i++) {
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
      return `
        <button class="sorteio-tag ${s.id === this.sorteioAtual ? 'active' : ''}" 
                onclick="app.selecionarSorteio('${s.id}', '${s.hora}', '${s.data}')">
          <strong>${s.hora}</strong> 
          <span style="opacity:0.7;font-size:11px;">${s.data}</span>
          <div style="font-size:10px;font-weight:400;margin-top:2px;">${fechamento}</div>
        </button>
      `;
    }).join('');

    const elResumoSorteio = document.getElementById('resumo-sorteio');
    if (elResumoSorteio) elResumoSorteio.textContent = `${sorteios[0].hora} (${sorteios[0].data})`;
    this.updateCounter();
  },

  selecionarSorteio(id, hora, data) {
    this.sorteioAtual = id;
    document.querySelectorAll('.sorteio-tag').forEach(b => {
      b.classList.toggle('active', b.getAttribute('onclick').includes(id));
    });
    const elResumoSorteio = document.getElementById('resumo-sorteio');
    if (elResumoSorteio) elResumoSorteio.textContent = `${hora} (${data})`;
    this.updateCounter();
  },

  limparNums() {
    this.selected.clear();
    document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('selected'));
    this.updateCounter();
  },

  aleatorio() {
    this.limparNums();
    // Gera 5 números aleatórios no intervalo de 1 a 55
    while (this.selected.size < 5) {
      const n = Math.floor(Math.random() * 55) + 1;
      this.selected.add(n);
    }
    const btns = document.querySelectorAll('.num-btn');
    this.selected.forEach(n => {
      if (btns[n - 1]) btns[n - 1].classList.add('selected');
    });
    this.updateCounter();
  },

  async apostar() {
    if (this.selected.size !== 5 || !this.user || !this.sorteioAtual) return;

    const btnApostar = document.getElementById('btn-apostar');
    if (btnApostar) btnApostar.disabled = true;

    const nums = [...this.selected].sort((a, b) => a - b);
    this.toast('A registar aposta…');

    const res = await this.post({
      action: 'registarJogada',
      usuarioId: this.user.id,
      referencia: this.user.referencia,
      sorteioId: this.sorteioAtual,
      numeros: nums,
      valor: 10
    });

    if (res.success) {
      this.user.saldo = Number(res.saldoRestante);
      localStorage.setItem('sortemz_user', JSON.stringify(this.user));
      this.atualizarUI();
      this.limparNums();
      this.toast('Aposta confirmada! Boa sorte!');
      this.adicionarHistoricoLocal(nums, res.jogadaId, res.sorteioId);
    } else {
      this.toast(res.error || 'Erro ao processar aposta');
      if (btnApostar) btnApostar.disabled = false;
    }
  },

  /* ---------- Interface & Tabs ---------- */

  atualizarUI() {
    const elSaldo = document.getElementById('saldo-display');
    if (elSaldo) {
      elSaldo.innerHTML = `${Number(this.user.saldo || 0).toLocaleString('pt-PT')} <span class="saldo-mzn">MZN</span>`;
    }
    
    ['nome', 'telefone', 'ref', 'id'].forEach(field => {
      const el = document.getElementById(`conta-${field}`);
      if (el && this.user[field === 'ref' ? 'referencia' : field]) {
        el.textContent = this.user[field === 'ref' ? 'referencia' : field];
      }
    });
  },

  setTab(t) {
    document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === t));
    ['jogar', 'resultados', 'historico', 'conta'].forEach(x => {
      const el = document.getElementById('tab-' + x);
      if (el) el.classList.toggle('hidden', x !== t);
    });

    if (t === 'resultados') { this.carregarResultado(); this.carregarCofres(); }
    if (t === 'historico') { this.renderPremios(); }
    if (t === 'conta') { this.renderLevantamentos(); }
  },

  /* ---------- Modal Depósito / Levantamento ---------- */

  abrirDeposito() { 
    document.getElementById('modal-deposito').classList.remove('hidden'); 
  },
  
  fecharDeposito() { 
    document.getElementById('modal-deposito').classList.add('hidden'); 
  },

  abrirLevantamento() {
    if (!this.user) { this.toast('Inicie sessão primeiro'); return; }
    document.getElementById('lev-saldo').textContent = `${Number(this.user.saldo || 0).toLocaleString('pt-PT')} MZN`;
    document.getElementById('lev-telefone').value = this.user.telefone || '';
    document.getElementById('modal-levantamento').classList.remove('hidden');
  },

  fecharLevantamento() { 
    document.getElementById('modal-levantamento').classList.add('hidden'); 
  },

  async solicitarLevantamento() {
    const valor = Number(document.getElementById('lev-valor').value);
    const telefone = document.getElementById('lev-telefone').value.trim();

    if (!valor || valor < 50) { this.toast('Valor mínimo: 50 MZN'); return; }
    if (!telefone) { this.toast('Telefone obrigatório'); return; }
    if (this.user.saldo < valor) { this.toast('Saldo insuficiente'); return; }

    this.toast('A processar pedido…');

    const res = await this.post({
      action: 'solicitarLevantamento',
      usuarioId: this.user.id,
      valor: valor,
      telefone: telefone
    });

    if (res.success) {
      this.user.saldo = Number(res.novoSaldo);
      localStorage.setItem('sortemz_user', JSON.stringify(this.user));
      this.atualizarUI();
      this.fecharLevantamento();
      this.toast('Pedido enviado! Aguarde aprovação.');
      this.renderLevantamentos();
    } else {
      this.toast(res.error || 'Erro ao efetuar o pedido');
    }
  },

  /* ---------- Histórico e Consultas ---------- */

  adicionarHistoricoLocal(nums, jogadaId, sorteioId) {
    const sorteio = this.sorteiosDisponiveis.find(s => s.id === sorteioId) || { hora: '?', data: '?' };
    const hist = JSON.parse(localStorage.getItem('sortemz_historico') || '[]');
    hist.unshift({ id: jogadaId, nums, sorteio: sorteio.hora, data: sorteio.data, status: 'Confirmada' });
    localStorage.setItem('sortemz_historico', JSON.stringify(hist.slice(0, 50)));
    this.renderHistorico();
  },

  renderHistorico() {
    const c = document.getElementById('lista-historico');
    if (!c) return;
    const hist = JSON.parse(localStorage.getItem('sortemz_historico') || '[]');
    if (!hist.length) { c.innerHTML = '<div class="empty-state">Ainda não realizou apostas</div>'; return; }
    
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

  renderMovimentos() {
    const c = document.getElementById('lista-movimentos');
    if (!c) return;
    const movs = JSON.parse(localStorage.getItem('sortemz_movimentos') || '[]');
    if (!movs.length) { c.innerHTML = '<div class="empty-state">Sem movimentos registados</div>'; return; }
    
    c.innerHTML = movs.map(m => `
      <div class="info-row">
        <span class="info-label">${m.data} · ${m.tipo}</span>
        <span class="info-val" style="color:${m.valor > 0 ? 'var(--color-green)' : m.valor < 0 ? 'var(--color-red)' : 'inherit'}">
          ${m.valor > 0 ? '+' : ''}${m.valor} MZN
        </span>
      </div>
    `).join('');
  },

  async renderPremios() {
    if (!this.user) return;
    const c = document.getElementById('lista-premios');
    if (!c) return;

    const res = await this.get('meusPremios', { id: this.user.id });
    if (res.success && res.premios && res.premios.length) {
      c.innerHTML = res.premios.map(p => `
        <div class="info-row">
          <span class="info-label">${p.acertos} acertos · Sorteio ${p.sorteioId}</span>
          <span class="info-val" style="color:var(--color-green)">+${p.premio} MZN</span>
        </div>
      `).join('');
    } else { 
      c.innerHTML = '<div class="empty-state">Sem prémios acumulados</div>'; 
    }
  },

  async renderLevantamentos() {
    if (!this.user) return;
    const c = document.getElementById('lista-levantamentos');
    if (!c) return;

    const res = await this.get('meusLevantamentos', { id: this.user.id });
    if (res.success && res.levantamentos && res.levantamentos.length) {
      c.innerHTML = res.levantamentos.map(l => {
        const cor = l.status === 'APROVADO' ? 'var(--color-green)' : l.status === 'REJEITADO' ? 'var(--color-red)' : 'var(--color-gold)';
        return `
          <div class="info-row">
            <span class="info-label">${l.data} · ${l.status}</span>
            <span class="info-val" style="color:${cor}">${l.valor} MZN</span>
          </div>
        `;
      }).join('');
    } else { 
      c.innerHTML = '<div class="empty-state">Sem histórico de levantamentos</div>'; 
    }
  },

  /* ---------- Sistema de Notificação Toast ---------- */

  toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; 
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
