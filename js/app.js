/* ============================================
   SORTEMZ — Frontend
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

  /* ---------- API ---------- */

  async get(action, params = {}) {
    const url = new URL(GAS_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url);
    return r.json();
  },

  // POST como form-urlencoded (compatível com GAS)
  async post(data) {
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value);
      }
    }

    const r = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });

    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Resposta não-JSON:', text);
      throw new Error('Erro no servidor');
    }
  },

  /* ---------- Config ---------- */

  async carregarConfig() {
    try {
      const cfg = await this.get('config');
      this.config = cfg;
      const abertos = await this.get('sorteiosAbertos');
      if (abertos.success) {
        this.sorteiosDisponiveis = abertos.sorteios || [];
        this.renderSorteios(this.sorteiosDisponiveis);
      }
    } catch (e) { console.error(e); }
  },

  async carregarResultado() {
    try {
      const res = await this.get('resultado');
      const elInfo = document.getElementById('ultimo-resultado-info');
      const elBolas = document.getElementById('ultimo-bolas');
      if (res.success && res.resultado) {
        const r = res.resultado;
        elInfo.textContent = `Sorteio ${r.sorteioId} — ${r.data} ${r.hora}`;
        elBolas.innerHTML = r.numeros.map(n => `<div class="ball">${n}</div>`).join('');
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
          <span class="info-label">${s.hora} (${s.data})</span>
          <span class="info-val">${Number(s.saldoPremios || 0).toLocaleString('pt-PT')} MZN</span>
        </div>
      `).join('');
    } catch (e) {
      document.getElementById('lista-cofres').innerHTML = '<div class="empty-state">Erro ao carregar cofres</div>';
    }
  },

  /* ---------- Login ---------- */

  async entrar() {
    const nome = document.getElementById('login-nome').value.trim();
    const telefone = document.getElementById('login-telefone').value.trim();
    if (!nome || !telefone) { this.toast('Preenche nome e telefone'); return; }

    this.toast('A processar…');
    try {
      const res = await this.post({ action: 'registarUsuario', nome, telefone });
      if (res.success) {
        this.user = { id: res.id, nome, telefone, referencia: res.referencia, saldo: res.saldo };
        localStorage.setItem('sortemz_user', JSON.stringify(this.user));
        this.entrarApp();
        this.toast(res.existente ? 'Bem-vindo de volta!' : 'Conta criada!');
      } else { this.toast(res.error || 'Erro'); }
    } catch (e) {
      console.error(e);
      this.toast('Erro de ligação: ' + e.message);
    }
  },

  verificarSessao() {
    const raw = localStorage.getItem('sortemz_user');
    if (raw) {
      try { this.user = JSON.parse(raw); this.entrarApp(); }
      catch (e) { localStorage.removeItem('sortemz_user'); }
    }
  },

  async entrarApp() {
    document.getElementById('tela-login').classList.add('hidden');
    document.getElementById('tela-app').classList.remove('hidden');
    document.getElementById('user-ref').textContent = `Ref: ${this.user.referencia}`;
    document.getElementById('dep-ref').textContent = this.user.referencia;

    try {
      const u = await this.get('usuario', { id: this.user.id });
      if (u.success && u.usuario) {
        this.user.saldo = u.usuario.saldo;
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
    this.user = null; this.selected.clear();
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
      b.className = 'num-btn'; b.textContent = i;
      b.onclick = () => this.toggleNum(i, b);
      g.appendChild(b);
    }
  },

  toggleNum(n, btn) {
    if (this.selected.has(n)) { this.selected.delete(n); btn.classList.remove('selected'); }
    else if (this.selected.size < 5) { this.selected.add(n); btn.classList.add('selected'); }
    this.updateCounter();
  },

  updateCounter() {
    document.getElementById('contador-nums').textContent = `${this.selected.size}/5`;
    const nums = [...this.selected].sort((a, b) => a - b);
    document.getElementById('resumo-nums').textContent = nums.length ? nums.join(', ') : '—';
    document.getElementById('btn-apostar').disabled = nums.length !== 5 || !this.sorteioAtual;
  },

  renderSorteios(sorteios) {
    const c = document.getElementById('sorteio-selector');
    if (!sorteios.length) {
      c.innerHTML = '<span class="badge badge-gray">Nenhum sorteio aberto</span>';
      this.sorteioAtual = null; return;
    }
    this.sorteioAtual = sorteios[0].id;
    c.innerHTML = sorteios.map(s => {
      const fechamento = s.fechamento ? `Fecha: ${s.fechamento.split(' ')[1]}` : '';
      return `<button class="sorteio-tag ${s.id === this.sorteioAtual ? 'active' : ''}" onclick="app.selecionarSorteio('${s.id}', '${s.hora}', '${s.data}')"><strong>${s.hora}</strong> <span style="opacity:0.7;font-size:11px;">${s.data}</span><div style="font-size:10px;font-weight:400;margin-top:2px;">${fechamento}</div></button>`;
    }).join('');
    document.getElementById('resumo-sorteio').textContent = `${sorteios[0].hora} (${sorteios[0].data})`;
  },

  selecionarSorteio(id, hora, data) {
    this.sorteioAtual = id;
    document.querySelectorAll('.sorteio-tag').forEach(b => {
      b.classList.toggle('active', b.getAttribute('onclick').includes(id));
    });
    document.getElementById('resumo-sorteio').textContent = `${hora} (${data})`;
    this.updateCounter();
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
    if (this.selected.size !== 5 || !this.user || !this.sorteioAtual) return;

    const nums = [...this.selected].sort((a, b) => a - b);
    this.toast('A confirmar aposta…');

    try {
      const res = await this.post({
        action: 'registarJogada',
        usuarioId: this.user.id,
        referencia: this.user.referencia,
        sorteioId: this.sorteioAtual,
        numeros: JSON.stringify(nums),
        valor: 10
      });

      if (res.success) {
        this.user.saldo = res.saldoRestante;
        localStorage.setItem('sortemz_user', JSON.stringify(this.user));
        this.atualizarUI();
        this.limparNums();
        this.toast('Aposta confirmada! Boa sorte!');
        this.adicionarHistoricoLocal(nums, res.jogadaId, res.sorteioId);
      } else { this.toast(res.error || 'Erro'); }
    } catch (e) {
      console.error(e);
      this.toast('Erro de ligação: ' + e.message);
    }
  },

  /* ---------- UI ---------- */

  atualizarUI() {
    document.getElementById('saldo-display').innerHTML = `${Number(this.user.saldo || 0).toLocaleString('pt-PT')} <span class="saldo-mzn">MZN</span>`;
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
    if (t === 'resultados') { this.carregarResultado(); this.carregarCofres(); }
    if (t === 'historico') { this.renderPremios(); }
    if (t === 'conta') { this.renderLevantamentos(); }
  },

  /* ---------- Depósito ---------- */

  abrirDeposito() { document.getElementById('modal-deposito').classList.remove('hidden'); },
  fecharDeposito() { document.getElementById('modal-deposito').classList.add('hidden'); },

  /* ---------- Levantamento ---------- */

  abrirLevantamento() {
    if (!this.user) { this.toast('Entra primeiro'); return; }
    document.getElementById('lev-saldo').textContent = `${Number(this.user.saldo || 0).toLocaleString('pt-PT')} MZN`;
    document.getElementById('lev-telefone').value = this.user.telefone || '';
    document.getElementById('modal-levantamento').classList.remove('hidden');
  },

  fecharLevantamento() { document.getElementById('modal-levantamento').classList.add('hidden'); },

  async solicitarLevantamento() {
    const valor = Number(document.getElementById('lev-valor').value);
    const telefone = document.getElementById('lev-telefone').value.trim();

    if (!valor || valor < 50) { this.toast('Valor mínimo: 50 MZN'); return; }
    if (!telefone) { this.toast('Telefone M-Pesa obrigatório'); return; }
    if (this.user.saldo < valor) { this.toast('Saldo insuficiente'); return; }

    this.toast('A processar pedido…');

    try {
      const res = await this.post({
        action: 'solicitarLevantamento',
        usuarioId: this.user.id,
        valor: valor,
        telefone: telefone
      });

      if (res.success) {
        this.user.saldo = res.novoSaldo;
        localStorage.setItem('sortemz_user', JSON.stringify(this.user));
        this.atualizarUI();
        this.fecharLevantamento();
        this.toast('Pedido enviado! Aguarda aprovação.');
        this.renderLevantamentos();
      } else { this.toast(res.error || 'Erro no pedido'); }
    } catch (e) {
      console.error(e);
      this.toast('Erro de ligação: ' + e.message);
    }
  },

  /* ---------- Histórico ---------- */

  adicionarHistoricoLocal(nums, jogadaId, sorteioId) {
    const sorteio = this.sorteiosDisponiveis.find(s => s.id === sorteioId) || { hora: '?', data: '?' };
    const hist = JSON.parse(localStorage.getItem('sortemz_historico') || '[]');
    hist.unshift({ id: jogadaId, nums, sorteio: sorteio.hora, data: sorteio.data, status: 'Confirmada' });
    localStorage.setItem('sortemz_historico', JSON.stringify(hist.slice(0, 50)));
    this.renderHistorico();
  },

  renderHistorico() {
    const c = document.getElementById('lista-historico');
    const hist = JSON.parse(localStorage.getItem('sortemz_historico') || '[]');
    if (!hist.length) { c.innerHTML = '<div class="empty-state">Ainda não fizeste apostas</div>'; return; }
    c.innerHTML = hist.map(j => {
      const sc = j.status.includes('Ganhou') ? 'badge-gold' : j.status === 'Perdeu' ? 'badge-gray' : 'badge-green';
      return `<div class="aposta-card"><div class="aposta-header"><span class="aposta-meta">${j.id} · ${j.data} · ${j.sorteio}</span><span class="badge ${sc}">${j.status}</span></div><div class="aposta-bolas">${j.nums.map(n => `<div class="ball">${n}</div>`).join('')}</div></div>`;
    }).join('');
  },

  renderMovimentos() {
    const c = document.getElementById('lista-movimentos');
    const movs = JSON.parse(localStorage.getItem('sortemz_movimentos') || '[]');
    if (!movs.length) { c.innerHTML = '<div class="empty-state">Sem movimentos</div>'; return; }
    c.innerHTML = movs.map(m => `<div class="info-row"><span class="info-label">${m.data} · ${m.tipo}</span><span class="info-val" style="color:${m.valor > 0 ? 'var(--color-green)' : m.valor < 0 ? 'var(--color-red)' : 'inherit'}">${m.valor > 0 ? '+' : ''}${m.valor} MZN</span></div>`).join('');
  },

  async renderPremios() {
    if (!this.user) return;
    const c = document.getElementById('lista-premios');
    try {
      const res = await this.get('meusPremios', { id: this.user.id });
      if (res.success && res.premios.length) {
        c.innerHTML = res.premios.map(p => `<div class="info-row"><span class="info-label">${p.acertos} acertos · Sorteio ${p.sorteioId}</span><span class="info-val" style="color:var(--color-green)">+${p.premio} MZN</span></div>`).join('');
      } else { c.innerHTML = '<div class="empty-state">Sem prémios ainda</div>'; }
    } catch (e) { c.innerHTML = '<div class="empty-state">Erro ao carregar</div>'; }
  },

  async renderLevantamentos() {
    if (!this.user) return;
    const c = document.getElementById('lista-levantamentos');
    try {
      const res = await this.get('meusLevantamentos', { id: this.user.id });
      if (res.success && res.levantamentos.length) {
        c.innerHTML = res.levantamentos.map(l => {
          const cor = l.status === 'APROVADO' ? 'var(--color-green)' : l.status === 'REJEITADO' ? 'var(--color-red)' : 'var(--color-gold)';
          return `<div class="info-row"><span class="info-label">${l.data} · ${l.status}</span><span class="info-val" style="color:${cor}">${l.valor} MZN</span></div>`;
        }).join('');
      } else { c.innerHTML = '<div class="empty-state">Sem levantamentos</div>'; }
    } catch (e) { c.innerHTML = '<div class="empty-state">Erro ao carregar</div>'; }
  },

  /* ---------- Toast ---------- */

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
