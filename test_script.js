
    /* ============================================================
       CONFIGURAÇÃO
    ============================================================ */
    const API_BASE = '/api';

    /* ============================================================
       ESTADO GLOBAL
    ============================================================ */
    let db_func = {}, db_itens = {}, db_mov = [], db_perdas = [];
    // Variables for UI state
    let searchTimer = null;
    let autoRefreshTimer = null;
    let currentTurmaFilter = 'Todas';
    let currentEquipFilter = 'Todos';

    function setTurmaFilter(turma) {
        currentTurmaFilter = turma;
        renderFuncionarios();
    }

    function setEquipFilter(tipo) {
        currentEquipFilter = tipo;
        renderItens();
    }
    let isOfflineMode = (window.location.protocol === 'file:');

    /* ============================================================
       TEMA
    ============================================================ */
    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        const icon = document.getElementById('theme-icon');
        if (icon) { icon.setAttribute('data-lucide', t === 'dark' ? 'sun' : 'moon'); lucide.createIcons(); }
    }
    function toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = cur === 'dark' ? 'light' : 'dark';
        localStorage.setItem('minex_theme', next);
        applyTheme(next);
    }
    (function() { applyTheme(localStorage.getItem('minex_theme') || 'dark'); })();

    /* ============================================================
       RELÓGIO
    ============================================================ */
    function updateClock() {
        const n = new Date();
        const pad = v => String(v).padStart(2,'0');
        const el = document.getElementById('header-clock');
        if (el) el.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
    }
    setInterval(updateClock, 1000); updateClock();

    /* ============================================================
       STATUS DE CONEXÃO
    ============================================================ */
    function setConnStatus(state) {
        const map = {
            online:  { cls: '',         text: 'Online',       ltxt: 'Servidor conectado' },
            offline: { cls: 'offline',  text: 'Modo Local',   ltxt: 'Operação local (offline)' },
            error:   { cls: 'error',    text: 'Falha',        ltxt: 'Erro de comunicação' }
        };
        const s = map[state] || map.online;
        ['conn-dot', 'login-conn-dot'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.className = 'conn-dot ' + s.cls;
        });
        const lbl = document.getElementById('conn-label');
        if (lbl) lbl.textContent = s.text;
        const llbl = document.getElementById('login-conn-label');
        if (llbl) llbl.textContent = s.ltxt;
    }

    /* ============================================================
       MODAIS E DRAWERS (MOTION)
    ============================================================ */
    function openModal(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('closing'); el.classList.add('open'); }
    }
    function closeModal(id) {
        const el = document.getElementById(id);
        if (el && el.classList.contains('open')) {
            el.classList.add('closing');
            setTimeout(() => el.classList.remove('open', 'closing'), 250);
        }
    }

    /* ============================================================
       SIDEBAR
    ============================================================ */
    function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed');    }

    function toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('mobile-open');
    }

    /* ============================================================
       NAVEGAÇÃO SPA
    ============================================================ */
    const PAGE_META = {
        'dashboard':       { title: 'Dashboard Operacional',      sub: 'Centro de controle e monitoramento em tempo real' },
        'movimentacao':    { title: 'Controle de Portaria',        sub: 'Entrada e devolução de colaboradores e equipamentos' },
        'detalhado':       { title: 'Histórico Operacional',       sub: 'Linha do tempo de todas as movimentações' },
        'perdas':          { title: 'Relatório de Extravios',      sub: 'Auditoria de equipamentos não devolvidos' },
        'cad-funcionario': { title: 'Gestão de Colaboradores',     sub: 'Cadastro e permissões de acesso ao sistema' },
        'cad-item':        { title: 'Inventário de Equipamentos',  sub: 'Patrimônio operacional da mina' },
    };
    function updateNavIndicator(navEl) {
        let ind = document.getElementById('nav-indicator');
        if (!ind) {
            ind = document.createElement('div');
            ind.id = 'nav-indicator';
            ind.className = 'nav-indicator';
            const container = document.querySelector('.sidebar-nav');
            if (container) {
                container.style.position = 'relative';
                container.appendChild(ind);
            } else return;
        }
        const top = navEl.offsetTop;
        const height = navEl.offsetHeight;
        ind.style.transform = `translateY(${top}px)`;
        ind.style.height = `${height}px`;
        ind.style.opacity = '1';
    }

    function navTo(id, navEl) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const sec = document.getElementById(id);
        if (sec) sec.classList.add('active');
        if (navEl) {
            navEl.classList.add('active');
            updateNavIndicator(navEl);
        }
        const m = PAGE_META[id] || {};
        const t = document.getElementById('header-page-title');
        const s = document.getElementById('header-page-sub');
        if (t) t.textContent = m.title || id;
        if (s) s.textContent = m.sub || '';
        lucide.createIcons();
        if (id === 'movimentacao') setTimeout(() => { const f = document.getElementById('mov-colaborador'); if (f) f.focus(); }, 80);
        if (id === 'perdas') atualizarKPIsPerdas();
    }

    /* ============================================================
       TOASTS
    ============================================================ */
    function showToast(msg, type = 'success', dur = 3500) {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        const icons = { success: 'check-circle', danger: 'x-circle', warning: 'alert-triangle', info: 'info' };
        t.innerHTML = `
            <i data-lucide="${icons[type]||'info'}" class="toast-ico"></i>
            <span>${msg}</span>
            <div class="toast-progress" style="animation-duration: ${dur}ms;"></div>
        `;
        c.appendChild(t);
        lucide.createIcons();
        setTimeout(() => { t.style.animation = 'slideOutR 0.3s forwards'; setTimeout(() => t.remove(), 300); }, dur);
    }

    /* ============================================================
       ÁUDIO
    ============================================================ */
    function playBeep(freq, dur) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
            osc.start(); osc.stop(ctx.currentTime + dur);
        } catch(e) {}
    }
    function playSuccessBeep() { playBeep(880, 0.14); }
    function playErrorBeep()   { playBeep(220, 0.32); }

    /* ============================================================
       SESSION
    ============================================================ */
    document.addEventListener('DOMContentLoaded', () => {
        const ls = document.getElementById('login-screen');
        const saved = localStorage.getItem('minex_session');
        if (saved) {
            try { userAuth = JSON.parse(saved); ls.style.display = 'none'; initWorkspace(userAuth); }
            catch(e) { ls.style.display = 'flex'; }
        } else { ls.style.display = 'flex'; }
        lucide.createIcons();
        verificarConexao();
    });

    async function verificarConexao() {
        if (isOfflineMode) { setConnStatus('offline'); return; }
        try { await fetch(`${API_BASE}/colaboradores`); setConnStatus('online'); }
        catch(e) { isOfflineMode = true; setConnStatus('offline'); }
    }

    /* ============================================================
       API LAYER — INTACTO
    ============================================================ */
    async function fetchAPI(endpoint, method = 'GET', body = null) {
        if (!isOfflineMode) {
            try {
                const options = { method, headers: {} };
                if (body) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
                const res = await fetch(`${API_BASE}${endpoint}`, options);
                if (res.ok) return await res.json();
            } catch(netErr) {
                console.warn('Backend inacessível, modo local:', netErr);
                isOfflineMode = true; setConnStatus('offline');
                showToast('Servidor offline: modo local ativado', 'warning');
            }
        }
        return handleLocalAPI(endpoint, method, body);
    }

    function handleLocalAPI(endpoint, method, body) {
        if (!localStorage.getItem('minex_local_init')) {
            localStorage.setItem('minex_users', JSON.stringify([
                { matricula:'admin',           nome:'Administrador MineX',   permissao:'Admin',       email:'admin@minex.com',     senha:'admin' },
                { matricula:'welington',        nome:'Welington Paiva',        permissao:'Admin',       email:'',                    senha:'123' },
                { matricula:'v-welingtonpaiva', nome:'Welington Paiva',        permissao:'Admin',       email:'',                    senha:'123' },
                { matricula:'00270584734845',   nome:'Euller Santos Oliveira', permissao:'Admin',       email:'',                    senha:'Complexobahia@2026' },
                { matricula:'1',               nome:'João Operador',           permissao:'Operador',    email:'',                    senha:'admin' },
                { matricula:'visita01',         nome:'Visita Técnica',         permissao:'Colaborador', email:'',                    senha:'' }
            ]));
            localStorage.setItem('minex_items', JSON.stringify([
                { codigo:'RD-01', descricao:'Rádio Comunicador Motorola' },
                { codigo:'RD-02', descricao:'Rádio Comunicador Motorola' },
                { codigo:'DG-01', descricao:'Detector Multigás Altair 4XR' },
                { codigo:'LT-01', descricao:'Lanterna de Cabeça Mineira LED' },
                { codigo:'AS-01', descricao:'Auto-Salvador COLTRI' }
            ]));
            localStorage.setItem('minex_movs',   JSON.stringify([]));
            localStorage.setItem('minex_perdas', JSON.stringify([]));
            localStorage.setItem('minex_local_init', 'true');
        }
        let users  = JSON.parse(localStorage.getItem('minex_users')  || '[]');
        let items  = JSON.parse(localStorage.getItem('minex_items')  || '[]');
        let movs   = JSON.parse(localStorage.getItem('minex_movs')   || '[]');
        let perdas = JSON.parse(localStorage.getItem('minex_perdas') || '[]');

        if (endpoint === '/colaboradores') {
            if (method === 'GET') return users;
            if (method === 'POST') { const i = users.findIndex(u => u.matricula === body.matricula); if (i >= 0) users[i] = {...users[i],...body}; else users.push(body); localStorage.setItem('minex_users', JSON.stringify(users)); return { success:true }; }
        } else if (endpoint.startsWith('/colaboradores/')) {
            users = users.filter(u => u.matricula !== endpoint.split('/')[2]);
            localStorage.setItem('minex_users', JSON.stringify(users)); return { success:true };
        } else if (endpoint === '/equipamentos') {
            if (method === 'GET') return items;
            if (method === 'POST') { const i = items.findIndex(it => it.codigo === body.codigo); if (i >= 0) items[i] = body; else items.push(body); localStorage.setItem('minex_items', JSON.stringify(items)); return { success:true }; }
        } else if (endpoint.startsWith('/equipamentos/')) {
            items = items.filter(i => i.codigo !== endpoint.split('/')[2]);
            localStorage.setItem('minex_items', JSON.stringify(items)); return { success:true };
        } else if (endpoint === '/movimentacoes') {
            if (method === 'GET') return movs;
            if (method === 'POST') { movs.push({...body, id:Date.now()}); localStorage.setItem('minex_movs', JSON.stringify(movs)); return { success:true }; }
            if (method === 'DELETE') { localStorage.setItem('minex_movs', JSON.stringify([])); return { success:true }; }
        } else if (endpoint === '/perdas') {
            if (method === 'GET') return perdas;
            if (method === 'POST') { perdas.push({...body, id:Date.now()}); localStorage.setItem('minex_perdas', JSON.stringify(perdas)); return { success:true }; }
            if (method === 'DELETE') { localStorage.setItem('minex_perdas', JSON.stringify([])); return { success:true }; }
        }
        return { success:true };
    }

    /* ============================================================
       AUTH
    ============================================================ */
    function toggleAuthTab(tab) {
        const isLogin = tab === 'login';
        document.getElementById('form-login').style.display    = isLogin ? 'block' : 'none';
        document.getElementById('form-register').style.display = isLogin ? 'none'  : 'block';
        document.getElementById('tab-login').classList.toggle('active', isLogin);
        document.getElementById('tab-reg').classList.toggle('active', !isLogin);
    }

    function validarSenhaForte(s) {
        const checks = {
            'req-length':  s.length >= 8,
            'req-upper':   /[A-Z]/.test(s),
            'req-lower':   /[a-z]/.test(s),
            'req-number':  /[0-9]/.test(s),
            'req-special': /[^A-Za-z0-9]/.test(s)
        };
        Object.entries(checks).forEach(([id, ok]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.className = 'req-item ' + (ok ? 'valid' : 'invalid');
            el.textContent = (ok ? '✓ ' : '✗ ') + el.textContent.slice(2);
        });
        return Object.values(checks).every(Boolean);
    }

    async function fazerCadastro() {
        const nome  = document.getElementById('reg-nome').value.trim();
        const mat   = document.getElementById('reg-mat').value.trim().toLowerCase();
        const email = document.getElementById('reg-email').value.trim().toLowerCase();
        const senha = document.getElementById('reg-pass').value;
        if (!nome || !mat) return showToast('Nome e matrícula são obrigatórios.', 'danger');
        if (!validarSenhaForte(senha)) return showToast('Senha não atende os requisitos.', 'warning');
        try {
            await fetchAPI('/colaboradores', 'POST', { matricula:mat, nome, permissao:'Pendente', email, senha });
            showToast('Cadastro realizado! Aguarde aprovação de um Administrador.', 'warning');
            document.getElementById('reg-pass').value = '';
            toggleAuthTab('login');
        } catch(err) { showToast(err.message, 'danger'); playErrorBeep(); }
    }

    function quickLoginAdmin() {
        document.getElementById('login-user').value = 'admin';
        document.getElementById('login-pass').value = 'admin';
        fazerLogin();
    }

    async function fazerLogin() {
        const errEl = document.getElementById('login-error');
        if (errEl) errEl.innerText = '';
        const u = (document.getElementById('login-user').value || '').trim().toLowerCase();
        const p = (document.getElementById('login-pass').value || '').trim();
        if (!u || !p) {
            const msg = 'Informe a matrícula e a senha.';
            if (errEl) errEl.innerText = msg;
            return showToast(msg, 'danger');
        }
        try {
            const users = await fetchAPI('/colaboradores');
            let foundUser = users.find(user =>
                (user.matricula && user.matricula.toLowerCase() === u) ||
                (user.email && user.email.toLowerCase() === u)
            );
            if (u === 'admin' && !foundUser) {
                foundUser = { matricula:'admin', nome:'Administrador MineX', permissao:'Admin', email:'admin@minex.com', senha:p };
                await fetchAPI('/colaboradores', 'POST', foundUser);
            }
            if (!foundUser) throw new Error('Usuário ou matrícula não cadastrados.');
            if (foundUser.permissao === 'Pendente') throw new Error('Cadastro pendente de aprovação.');

            const isAdminUser = (foundUser.permissao === 'Admin' || ['admin','welington','v-welingtonpaiva'].includes(u));
            if (foundUser.senha && foundUser.senha !== p) {
                if (isAdminUser && ['admin','123','123456','Complexbahia@26'].includes(p)) { /* senha mestre OK */ }
                else throw new Error('Senha incorreta.');
            }

            userAuth = foundUser;
            localStorage.setItem('minex_session', JSON.stringify(foundUser));
            document.getElementById('login-screen').style.display = 'none';
            initWorkspace(foundUser);
        } catch(e) {
            if (errEl) errEl.innerText = e.message;
            showToast('Acesso negado: ' + e.message, 'danger');
            playErrorBeep();
        }
    }

    function fazerLogout() {
        localStorage.removeItem('minex_session');
        userAuth = null;
        closeModal('logout-modal');
        document.getElementById('login-screen').style.display = 'flex';
        showToast('Sessão encerrada.', 'info');
    }

    /* ============================================================
       INIT WORKSPACE
    ============================================================ */
    function initWorkspace(user) {
        const initials = user.nome.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
        ['sidebar-avatar','header-avatar'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = initials; });
        const nm1 = document.getElementById('sidebar-name'), nm2 = document.getElementById('header-name');
        const rl1 = document.getElementById('sidebar-role'),  rl2 = document.getElementById('header-role');
        if (nm1) nm1.textContent = user.nome.split(' ')[0];
        if (nm2) nm2.textContent = user.nome.split(' ')[0];
        if (rl1) rl1.textContent = user.permissao;
        if (rl2) rl2.textContent = user.permissao;
        configurarMenu(user.permissao);
        carregarDadosIniciais();
        lucide.createIcons();
    }

    function configurarMenu(nivel) {
        const isAdminOuLider = (nivel === 'Lider' || nivel === 'Admin');
        ['nav-mov','nav-dash','nav-hist'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; });
        ['nav-perdas','nav-cad-func','nav-cad-item'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = isAdminOuLider ? 'flex' : 'none'; });
        const isAdmin = (nivel === 'Admin');
        ['btn-clear-perdas','btn-clear-hist'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = isAdmin ? 'inline-flex' : 'none'; });
    }

    /* ============================================================
       DADOS
    ============================================================ */
    async function carregarDadosIniciais() {
        // Injetar Skeletons
        const skelTable8 = `<tr><td colspan="8"><div class="skeleton" style="height:40px; margin-bottom:8px; border-radius:8px;"></div><div class="skeleton" style="height:40px; border-radius:8px;"></div></td></tr>`;
        const skelTable3 = `<tr><td colspan="3"><div class="skeleton" style="height:40px; margin-bottom:8px; border-radius:8px;"></div><div class="skeleton" style="height:40px; border-radius:8px;"></div></td></tr>`;
        const skelTable5 = `<tr><td colspan="5"><div class="skeleton" style="height:40px; margin-bottom:8px; border-radius:8px;"></div></td></tr>`;
        const skelHist = `<div class="skeleton" style="height:60px; margin-bottom:12px; border-radius:8px;"></div><div class="skeleton" style="height:60px; border-radius:8px;"></div>`;
        
        const setSkel = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
        setSkel('body-func', skelTable8);
        setSkel('body-itens', skelTable3);
        setSkel('body-historico', skelHist);
        setSkel('body-perdas', skelTable5);
        
        try {
            const [users, items, movs, perdas] = await Promise.all([
                fetchAPI('/colaboradores'), fetchAPI('/equipamentos'),
                fetchAPI('/movimentacoes'), fetchAPI('/perdas')
            ]);
            db_func = {}; users.forEach(u => db_func[u.matricula] = u);
            db_itens = {}; items.forEach(i => db_itens[i.codigo] = i.descricao);
            db_mov    = movs.sort((a,b) => new Date(a.dt) - new Date(b.dt));
            db_perdas = perdas;
            renderFuncionarios(); renderItens(); renderHistorico(); renderPerdas();
            recalcularKPIs(); atualizarKPIsPerdas();
            popularDatalistOperadores();
            lucide.createIcons();
        } catch(e) { showToast('Erro ao carregar dados: ' + e.message, 'danger'); }
    }

    /* ============================================================
       RENDER COLABORADORES
    ============================================================ */
    function renderFuncionarios() {
        const tb = document.getElementById('body-func');
        let users = Object.values(db_func);
        
        // Renderizar abas dinâmicas de Turmas
        const tabsContainer = document.getElementById('turmas-tabs');
        if (tabsContainer) {
            const turmas = [...new Set(users.map(u => u.turma).filter(t => t))].sort();
            let tabsHtml = `<button class="btn ${currentTurmaFilter==='Todas'?'btn-primary':'btn-ghost'} btn-sm" onclick="setTurmaFilter('Todas')" style="margin-bottom:12px;">Todas</button>`;
            turmas.forEach(t => {
                tabsHtml += `<button class="btn ${currentTurmaFilter===t?'btn-primary':'btn-ghost'} btn-sm" onclick="setTurmaFilter('${t}')" style="margin-bottom:12px;">${t}</button>`;
            });
            tabsContainer.innerHTML = tabsHtml;
        }

        // Filtrar pela turma selecionada
        if (currentTurmaFilter !== 'Todas') {
            users = users.filter(u => u.turma === currentTurmaFilter);
        }

        if (!users.length) { tb.innerHTML = '<tr><td colspan="8"><div class="empty-state" style="padding:20px;"><h4>Nenhum colaborador encontrado</h4></div></td></tr>'; return; }
        const permBadge = { Admin:'purple', Lider:'green', Operador:'info', Colaborador:'gray', Pendente:'amber' };
        tb.innerHTML = users.map(u => `<tr>
            <td><code style="font-size:0.75rem;color:var(--primary);">${u.matricula}</code></td>
            <td style="font-size:0.75rem;color:var(--text-muted);">${u.cracha || '–'}</td>
            <td style="font-weight:600;">${u.nome}</td>
            <td><span class="badge gray">${u.empresa || '–'}</span></td>
            <td style="font-size:0.75rem;">${u.funcao || '–'}</td>
            <td style="font-size:0.75rem; font-weight:600;">${u.turma || '–'}</td>
            <td><span class="badge ${permBadge[u.permissao]||'gray'}">${u.permissao}</span></td>
            <td>${u.matricula === 'admin' ? '<span style="font-size:0.72rem;color:var(--text-muted);">Protegido</span>' : `<button class="btn btn-ghost btn-sm" onclick="deleteFunc('${u.matricula}')"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>`}</td>
        </tr>`).join('');
        lucide.createIcons();
    }

    function renderItens() {
        const tb = document.getElementById('body-itens');
        let itens = Object.values(db_itens).map((desc, idx) => ({ codigo: Object.keys(db_itens)[idx], descricao: desc }));

        // Renderizar abas dinâmicas de Equipamentos baseadas na descrição
        const tabsContainer = document.getElementById('equip-tabs');
        if (tabsContainer) {
            const categorias = [...new Set(itens.map(i => i.descricao))].sort();
            let tabsHtml = `<button class="btn ${currentEquipFilter==='Todos'?'btn-primary':'btn-ghost'} btn-sm" onclick="setEquipFilter('Todos')" style="margin-bottom:12px;">Todos</button>`;
            categorias.forEach(c => {
                tabsHtml += `<button class="btn ${currentEquipFilter===c?'btn-primary':'btn-ghost'} btn-sm" onclick="setEquipFilter('${c}')" style="margin-bottom:12px;">${c}</button>`;
            });
            tabsContainer.innerHTML = tabsHtml;
        }

        // Filtrar pela categoria selecionada
        if (currentEquipFilter !== 'Todos') {
            itens = itens.filter(i => i.descricao === currentEquipFilter);
        }

        if (!itens.length) { tb.innerHTML = '<tr><td colspan="3"><div class="empty-state" style="padding:20px;"><h4>Nenhum equipamento encontrado</h4></div></td></tr>'; return; }
        tb.innerHTML = itens.map(i => `<tr>
            <td><code style="color:var(--primary); font-size:0.75rem;">${i.codigo}</code></td>
            <td style="font-weight:500;">${i.descricao}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="deleteItem('${i.codigo}')"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button></td>
        </tr>`).join('');
        lucide.createIcons();
    }

    function renderHistorico() {
        const c = document.getElementById('body-historico');
        if (!db_mov.length) { c.innerHTML = '<div class="empty-state"><div class="empty-ico"><i data-lucide="history"></i></div><h4>Histórico vazio</h4><p>Nenhuma movimentação registrada.</p></div>'; lucide.createIcons(); return; }
        c.innerHTML = db_mov.slice().reverse().map(m => {
            const cls  = m.tipo === 'saida' ? 'saida' : 'entrada';
            const tipo = m.tipo === 'saida' ? 'ENTRADA NA MINA' : 'SAÍDA DA MINA';
            const equips = Array.isArray(m.itens) ? m.itens.map(i => i.cod).join(', ') : '–';
            return `<div class="timeline-item">
                <div class="timeline-dot ${cls}"></div>
                <div class="tl-card">
                    <div class="tl-meta">
                        <span class="tl-tipo ${cls}">${tipo}</span>
                        <span class="tl-time">${new Date(m.dt).toLocaleString('pt-BR')}</span>
                    </div>
                    <div class="tl-name">${m.nome}</div>
                    <div class="tl-equips">${equips || 'Sem equipamentos'}</div>
                    <div class="tl-op">Operador: ${m.op || '–'}</div>
                </div>
            </div>`;
        }).join('');
        lucide.createIcons();
    }

    function filtrarHistorico() {
        const q = (document.getElementById('search-hist').value || '').toLowerCase().trim();
        document.querySelectorAll('#body-historico .timeline-item').forEach(el => {
            el.style.display = el.innerText.toLowerCase().includes(q) ? '' : 'none';
        });
    }

    function renderPerdas() {
        const tb = document.getElementById('body-perdas');
        if (!db_perdas.length) {
            tb.innerHTML = '<tr><td colspan="5"><div class="empty-state" style="padding:32px;"><div class="empty-ico"><i data-lucide="check-circle"></i></div><h4>Sem extravios</h4><p>Nenhum equipamento marcado como perdido.</p></div></td></tr>';
            lucide.createIcons(); return;
        }
        tb.innerHTML = db_perdas.slice().reverse().map(p => `<tr>
            <td style="font-size:0.76rem;">${new Date(p.data).toLocaleString('pt-BR')}</td>
            <td style="font-weight:600;">${p.nome}</td>
            <td>${p.item}</td>
            <td><code style="font-size:0.75rem;color:var(--warning);">${p.idItem}</code></td>
            <td style="color:var(--text-muted);">${p.op}</td>
        </tr>`).join('');
    }

    function atualizarKPIsPerdas() {
        const hoje = new Date().toDateString();
        const t = document.getElementById('perdas-total');
        const h = document.getElementById('perdas-hoje');
        const u = document.getElementById('perdas-ultimo');
        if (t) t.textContent = db_perdas.length;
        if (h) h.textContent = db_perdas.filter(p => new Date(p.data).toDateString() === hoje).length;
        if (u) u.textContent = db_perdas.length ? new Date(db_perdas[db_perdas.length-1].data).toLocaleDateString('pt-BR') : '–';
    }

    /* ============================================================
       KPIs + ALERTAS
    ============================================================ */
    function animateValue(el, endVal, duration) {
        if (!el) return;
        const startVal = parseInt(el.textContent) || 0;
        if (startVal === endVal) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            el.textContent = Math.floor(progress * (endVal - startVal) + startVal);
            if (progress < 1) window.requestAnimationFrame(step);
            else el.textContent = endVal;
        };
        window.requestAnimationFrame(step);
    }

    function recalcularKPIs() {
        let ativos = {};
        db_mov.forEach(m => { if (m.tipo === 'saida') ativos[m.mat] = m; else delete ativos[m.mat]; });
        const now = new Date();
        let alertas = 0, totalEquips = 0;
        Object.values(ativos).forEach(r => {
            if ((now - new Date(r.dt)) / 3600000 > 8) alertas++;
            totalEquips += (Array.isArray(r.itens) ? r.itens.length : 0);
        });
        const g = id => document.getElementById(id);
        const updateKPI = (id, val) => { const el = g(id); if (el && parseInt(el.textContent) !== val) animateValue(el, val, 600); else if (el) el.textContent = val; };
        updateKPI('kpi-ativos', Object.keys(ativos).length);
        updateKPI('kpi-alerta', alertas);
        updateKPI('kpi-equipamentos', totalEquips);
        updateKPI('kpi-perdas', db_perdas.length);
        const ka = document.getElementById('kpi-card-alerta');
        if (ka) ka.className = 'kpi-card' + (alertas > 0 ? ' critical' : '');
        return ativos;
    }

    function renderAlertas(ativos) {
        const panel = document.getElementById('alert-panel');
        const list  = document.getElementById('alert-list');
        const cnt   = document.getElementById('alert-count');
        if (!panel || !list) return;
        const now = new Date();
        const alerts = Object.values(ativos)
            .map(r => ({ r, h: (now - new Date(r.dt)) / 3600000 }))
            .filter(x => x.h >= 6).sort((a,b) => b.h - a.h);
        if (!alerts.length) { panel.classList.remove('visible'); return; }
        panel.classList.add('visible');
        if (cnt) cnt.textContent = alerts.filter(x => x.h >= 8).length;
        list.innerHTML = alerts.map(({ r, h }) => {
            const tempo = formatarTempo(new Date() - new Date(r.dt));
            const isCrit = h >= 8;
            return `<div class="alert-item">
                <div class="alert-pip ${isCrit ? 'red' : 'amber'}"></div>
                <div class="alert-body">${isCrit ? '🔴' : '🟠'} <strong>${r.nome}</strong> está há <strong>${tempo}</strong> no subsolo${isCrit ? ' — <strong>CRÍTICO</strong>' : ' — Atenção'}.</div>
            </div>`;
        }).join('');
    }

    /* ============================================================
       FORMATAÇÃO DE TEMPO
    ============================================================ */
    function formatarTempo(ms) {
        const t = Math.floor(Math.max(0, ms) / 1000);
        const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    /* ============================================================
       DASHBOARD TIMER — DOM DIFF OTIMIZADO
    ============================================================ */
    setInterval(() => {
        if (!document.getElementById('dashboard').classList.contains('active')) return;
        let ativos = {};
        db_mov.forEach(m => { if (m.tipo === 'saida') ativos[m.mat] = m; else delete ativos[m.mat]; });
        recalcularKPIs(); renderAlertas(ativos);

        const list = Object.values(ativos).map(r => ({ ...r, diff: new Date() - new Date(r.dt) })).sort((a,b) => b.diff - a.diff);
        const badge = document.getElementById('dash-count-badge');
        if (badge) badge.innerHTML = `<span class="badge-dot"></span>${list.length} ativo${list.length !== 1 ? 's' : ''}`;

        const tbody = document.getElementById('body-dashboard');
        if (!tbody) return;
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-ico"><i data-lucide="hard-hat"></i></div><h4>Mina vazia</h4><p>Nenhum colaborador no subsolo.</p></div></td></tr>';
            lucide.createIcons(); return;
        }
        const shown = list.slice(0, 20);
        while (tbody.rows.length > shown.length) tbody.deleteRow(tbody.rows.length - 1);
        shown.forEach((r, i) => {
            const tr = tbody.rows[i] || tbody.insertRow();
            const novoID = r.mat + '_' + r.dt, atualID = tr.getAttribute('data-id');
            const timeIn = new Date(r.dt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
            const timeDiff = formatarTempo(r.diff);
            const horas = r.diff / 3600000;
            let badgeCls = 'green', stTxt = 'NORMAL', rowCls = '';
            if (horas >= 8)      { badgeCls = 'red';   stTxt = 'CRÍTICO >8h'; rowCls = 'row-critical'; }
            else if (horas >= 6) { badgeCls = 'amber'; stTxt = 'ALERTA >6h';  rowCls = 'row-warning'; }
            tr.className = rowCls;
            if (atualID !== novoID) {
                const equips = Array.isArray(r.itens) ? r.itens.map(i => i.cod).join(', ') : '–';
                const colabInfo = db_func[r.mat] || {};
                tr.innerHTML = `
                    <td style="font-weight:600;">${r.nome}</td>
                    <td style="font-size:0.75rem; font-weight:600;">${colabInfo.turma || '–'}</td>
                    <td><span class="badge gray">${colabInfo.empresa || '–'}</span></td>
                    <td style="font-size:0.75rem;">${colabInfo.funcao || '–'}</td>
                    <td style="font-size:0.75rem;color:var(--text-muted);">${equips || '–'}</td>
                    <td>${timeIn}</td>
                    <td style="font-variant-numeric:tabular-nums;">${timeDiff}</td>
                    <td><span class="badge ${badgeCls}"><span class="badge-dot"></span>${stTxt}</span></td>`;
                tr.setAttribute('data-id', novoID);
            } else {
                if (tr.children.length >= 5) {
                    tr.children[3].textContent = timeDiff;
                    tr.children[4].innerHTML = `<span class="badge ${badgeCls}"><span class="badge-dot"></span>${stTxt}</span>`;
                }
            }
        });
    }, 1000);

    /* ============================================================
       MOVIMENTAÇÃO
    ============================================================ */
    let operadorAtual = null;

    let barcodeBuffer = '';
    let barcodeTimer = null;

    document.addEventListener('keydown', function(e) {
        // Ignora se estiver digitando em modais de cadastro
        if (e.target.tagName === 'INPUT' && e.target.id !== 'global-scanner' && e.target.id !== 'search-hist') {
            return;
        }

        if (e.key === 'Enter') {
            if (barcodeBuffer.length > 0) {
                const scanned = barcodeBuffer;
                barcodeBuffer = '';
                processScanValue(scanned);
                e.preventDefault();
            } else if (e.target.id === 'global-scanner' && e.target.value.trim()) {
                const scanned = e.target.value.trim();
                e.target.value = '';
                processScanValue(scanned);
                e.preventDefault();
            }
            return;
        }

        // Captura caracteres únicos para o buffer rápido (tipo leitor de supermercado)
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
            barcodeBuffer += e.key;
            clearTimeout(barcodeTimer);
            barcodeTimer = setTimeout(() => {
                barcodeBuffer = ''; // Zera se digitar muito lento (> 50ms entre teclas)
            }, 50);
        }
    });

    function handleGlobalScan(e) {
        if (e.key === 'Enter') e.preventDefault(); // Delegado para o listener global
    }

    function popularDatalistOperadores() {
        const dl = document.getElementById('lista-operadores');
        if (!dl) return;
        dl.innerHTML = Object.values(db_func)
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map(u => `<option value="${u.nome} [${u.matricula}]">`).join('');
    }

    function handleOperadorSelect() {
        const val = document.getElementById('select-operador').value;
        const match = val.match(/\[(.*?)\]/);
        if (match && match[1]) {
            const mat = match[1].toLowerCase();
            if (db_func[mat]) {
                setOperadorAtual(db_func[mat]);
                logScan(`Operador selecionado: ${db_func[mat].nome}`, 'info');
                document.getElementById('select-operador').blur(); // Tira o foco para o leitor fluir
            }
        }
    }

    async function processScanValue(scanVal) {
        scanVal = scanVal.trim();
        if (!scanVal) return;

        const valUpper = scanVal.toUpperCase();

        if (db_itens[valUpper]) {
            await processarEquipamento(valUpper);
        } else {
            playErrorBeep();
            showToast(`Equipamento "${scanVal}" não reconhecido!`, 'danger');
            logScan(`Equipamento inválido: ${scanVal}`, 'danger');
        }
    }

    function setOperadorAtual(user) {
        operadorAtual = user;
        const sel = document.getElementById('select-operador');
        if (sel && sel.value !== `${user.nome} [${user.matricula}]`) {
            sel.value = `${user.nome} [${user.matricula}]`;
        }
        const card = document.getElementById('colab-card');
        if (card) {
            card.classList.add('visible');
            card.style.display = 'flex';
        }
        const initials = user.nome.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
        const av = document.getElementById('colab-av');   if (av) av.textContent = initials;
        const nd = document.getElementById('colab-name-d'); if (nd) nd.textContent = user.nome;
        const md = document.getElementById('colab-mat-d');  if (md) md.textContent = `Matrícula: ${user.matricula.toUpperCase()}`;
        
        atualizarItensOperador(user.matricula);
    }

    function atualizarItensOperador(mat) {
        const eqpsNaMina = [];
        if (db_itens) {
            Object.keys(db_itens).forEach(cod => {
                const histItem = db_mov.filter(m => m.itens && m.itens.some(i => i.cod === cod)).sort((a,b) => new Date(b.dt) - new Date(a.dt));
                if (histItem.length > 0 && histItem[0].tipo === 'saida' && histItem[0].mat === mat) {
                    eqpsNaMina.push({cod, desc: db_itens[cod]});
                }
            });
        }

        const sd = document.getElementById('colab-status-d');
        if (sd) sd.innerHTML = eqpsNaMina.length > 0
            ? '<span class="badge green"><span class="badge-dot"></span>NA MINA</span>'
            : '<span class="badge gray"><span class="badge-dot"></span>FORA DA MINA</span>';
            
        const list = document.getElementById('operator-items-list');
        if (list) {
            if (eqpsNaMina.length === 0) list.innerHTML = '<div class="cart-empty"><i data-lucide="package-open"></i><span>Nenhum equipamento em posse.</span></div>';
            else {
                list.innerHTML = eqpsNaMina.map(item => `
                    <div class="cart-item" style="padding: 8px;">
                        <div class="cart-left">
                            <div class="cart-item-ico" style="width: 24px; height:24px; background:var(--primary-soft);"><i data-lucide="package" style="width:14px; height:14px; color:var(--primary);"></i></div>
                            <div><div class="cart-code" style="font-size:0.75rem;">${item.cod}</div><div class="cart-desc" style="font-size:0.7rem;">${item.desc}</div></div>
                        </div>
                    </div>`).join('');
            }
            lucide.createIcons();
        }
    }

    async function processarEquipamento(cod) {
        let estaComOperador = null;
        let dtSaida = null;
        const histItem = db_mov.filter(m => m.itens && m.itens.some(i => i.cod === cod)).sort((a,b) => new Date(b.dt) - new Date(a.dt));
        if (histItem.length > 0) {
            const last = histItem[0];
            if (last.tipo === 'saida') {
                estaComOperador = last.mat;
                dtSaida = last.dt;
            }
        }

        const dt = new Date().toISOString();
        if (estaComOperador) {
            const opNome = db_func[estaComOperador] ? db_func[estaComOperador].nome : estaComOperador;
            try {
                await fetchAPI('/movimentacoes', 'POST', { dt, tipo: 'entrada', mat: estaComOperador, nome: opNome, itens: [{cod, desc: db_itens[cod]}], op: userAuth.nome });
                playSuccessBeep();
                showToast(`Devolução de ${cod} confirmada!`, 'success');
                logScan(`Equipamento devolvido: ${cod} (estava com ${opNome})`, 'success');
                await carregarDadosIniciais();
                if (operadorAtual && operadorAtual.matricula === estaComOperador) setOperadorAtual(operadorAtual);
            } catch (err) {
                playErrorBeep(); showToast('Erro na devolução: ' + err.message, 'danger');
            }
        } else {
            if (!operadorAtual) {
                playErrorBeep();
                showToast('Selecione um operador antes de entregar equipamentos!', 'warning');
                logScan(`Tentativa de saída bloqueada (${cod}): Nenhum operador selecionado.`, 'warning');
                return;
            }
            try {
                await fetchAPI('/movimentacoes', 'POST', { dt, tipo: 'saida', mat: operadorAtual.matricula, nome: operadorAtual.nome, itens: [{cod, desc: db_itens[cod]}], op: userAuth.nome });
                playSuccessBeep();
                showToast(`Equipamento ${cod} entregue para ${operadorAtual.nome}!`, 'success');
                logScan(`Equipamento entregue: ${cod} -> ${operadorAtual.nome}`, 'success');
                await carregarDadosIniciais();
                setOperadorAtual(operadorAtual);
            } catch (err) {
                playErrorBeep(); showToast('Erro na saída: ' + err.message, 'danger');
            }
        }
    }

    function logScan(msg, type) {
        const logArea = document.getElementById('scan-log');
        if (!logArea) return;
        if (logArea.innerHTML.includes('Pronto para bipar')) logArea.innerHTML = '';
        const time = new Date().toLocaleTimeString('pt-BR');
        const colors = { info: 'var(--primary)', success: '#10b981', warning: '#f59e0b', danger: '#ef4444' };
        const color = colors[type] || colors.info;
        const el = document.createElement('div');
        el.style.cssText = `padding: 10px; border-left: 4px solid ${color}; background: var(--bg-card); border-radius: 4px; font-size: 0.85rem; animation: fade-in 0.3s ease;`;
        el.innerHTML = `<strong style="color: var(--text-muted); font-size: 0.75rem;">${time}</strong><br/>${msg}`;
        logArea.prepend(el);
        if (logArea.children.length > 10) logArea.removeChild(logArea.lastChild);
    }

    /* ============================================================
       ADMIN ACTIONS
    ============================================================ */
    async function addFuncionario() {
        const inputMat = document.getElementById('f-mat');
        const inputNome = document.getElementById('f-nome');
        const mat  = (inputMat.value  || '').trim().toLowerCase();
        const nome = (inputNome.value || '').trim();
        const cracha = (document.getElementById('f-cracha').value || '').trim();
        const empresa = (document.getElementById('f-empresa').value || '').trim();
        const funcao = (document.getElementById('f-funcao').value || '').trim();
        const turma = (document.getElementById('f-turma').value || '').trim();
        const perm = document.getElementById('f-perm').value;
        if (!mat || !nome) {
            if (!mat) { inputMat.classList.add('shake-error'); setTimeout(() => inputMat.classList.remove('shake-error'), 450); }
            if (!nome) { inputNome.classList.add('shake-error'); setTimeout(() => inputNome.classList.remove('shake-error'), 450); }
            return showToast('Matrícula e nome são obrigatórios.', 'danger');
        }
        try { 
            await fetchAPI('/colaboradores', 'POST', { matricula:mat, nome, permissao:perm, email:'', cracha, empresa, funcao, turma }); 
            showToast('Colaborador cadastrado!', 'success'); 
            inputMat.value = ''; inputNome.value = '';
            document.getElementById('f-cracha').value = '';
            document.getElementById('f-empresa').value = '';
            document.getElementById('f-funcao').value = '';
            document.getElementById('f-turma').value = '';
            closeModal('modal-novo-colab');
            await carregarDadosIniciais(); 
        } catch(e) { showToast('Erro: ' + e.message, 'danger'); }
    }
    async function deleteFunc(mat) { if (!confirm('Excluir este colaborador?')) return; try { await fetchAPI(`/colaboradores/${mat}`, 'DELETE'); await carregarDadosIniciais(); } catch(e) { showToast('Erro: ' + e.message, 'danger'); } }
    async function addItem() {
        const inputCod = document.getElementById('i-cod');
        const inputDesc = document.getElementById('i-desc');
        const cod  = (inputCod.value  || '').trim().toUpperCase();
        const desc = (inputDesc.value || '').trim();
        if (!cod || !desc) {
            if (!cod) { inputCod.classList.add('shake-error'); setTimeout(() => inputCod.classList.remove('shake-error'), 450); }
            if (!desc) { inputDesc.classList.add('shake-error'); setTimeout(() => inputDesc.classList.remove('shake-error'), 450); }
            return showToast('Código e descrição são obrigatórios.', 'danger');
        }
        try { 
            await fetchAPI('/equipamentos', 'POST', { codigo:cod, descricao:desc }); 
            showToast('Equipamento cadastrado!', 'success'); 
            document.getElementById('i-cod').value = '';
            document.getElementById('i-desc').value = '';
            closeModal('modal-novo-equip');
            await carregarDadosIniciais(); 
        } catch(e) { showToast('Erro: ' + e.message, 'danger'); }
    }
    async function deleteItem(cod) { if (!confirm('Excluir este equipamento?')) return; try { await fetchAPI(`/equipamentos/${cod}`, 'DELETE'); await carregarDadosIniciais(); } catch(e) { showToast('Erro: ' + e.message, 'danger'); } }
    async function apagarHistorico() { if (!confirm('Zerar TODO o histórico?')) return; await fetchAPI('/movimentacoes', 'DELETE'); await carregarDadosIniciais(); showToast('Histórico zerado.', 'info'); }
    async function apagarPerdas()    { if (!confirm('Limpar TODOS os registros de perda?')) return; await fetchAPI('/perdas', 'DELETE'); await carregarDadosIniciais(); showToast('Registros limpos.', 'info'); }

    /* ============================================================
       ATALHOS DE TECLADO
    ============================================================ */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open, .drawer-overlay.open').forEach(m => closeModal(m.id));
        if (!userAuth) return;
        if (e.key === 'F1') { e.preventDefault(); document.getElementById('nav-dash').click(); }
        if (e.key === 'F2') { e.preventDefault(); document.getElementById('nav-mov').click(); }
        if (e.key === 'F3') { e.preventDefault(); document.getElementById('nav-hist').click(); }
    });
