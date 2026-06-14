/* =========================================================================
     BLOCO 1 – CONFIGURAÇÃO DO FIREBASE
     O Firebase é o banco de dados em tempo real.
     Para colocar em produção, substitua as chaves abaixo pelas do seu projeto
     criado em https://console.firebase.google.com
     ========================================================================= */

  // Objeto com as credenciais do projeto Firebase
  // ⚠️ SUBSTITUIR COM SUA CONFIGURAÇÃO REAL
  // Copie a configuração completa de https://console.firebase.google.com → Configurações do projeto
 // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBhvhhuu3AAQuRNbElpqOyE3-I00tU1UJw",
  authDomain: "sistema-casa-de-sucos.firebaseapp.com",
  databaseURL: "https://sistema-casa-de-sucos-default-rtdb.firebaseio.com",
  projectId: "sistema-casa-de-sucos",
  storageBucket: "sistema-casa-de-sucos.firebasestorage.app",
  messagingSenderId: "1086945887838",
  appId: "1:1086945887838:web:10329855c2299b5d3556cf",
  measurementId: "G-TEK4R2P028"
};

  // Inicializa o Firebase com as configurações acima
  // firebase.initializeApp() conecta o app ao seu projeto no servidor Google
  firebase.initializeApp(firebaseConfig);

  // Cria referência ao serviço de autenticação (login/logout)
  const auth = firebase.auth();

  // Cria referência ao Firestore (banco de dados em tempo real)
  const db = firebase.firestore();

  /* =========================================================================
     BLOCO 2 – ESTADO GLOBAL DA APLICAÇÃO
     Variáveis que guardam o estado atual do app durante o uso
     ========================================================================= */

  let usuarioAtual  = null;   // objeto do usuário logado (retornado pelo Firebase Auth)
  let perfilAtual   = null;   // string: 'gerente' ou 'atendente'
  let carrinho      = {};     // objeto: { produtoId: { nome, preco, qtd } }
  let todosProdutos = [];     // array com todos os produtos do cardápio
  let todosPedidos  = [];     // array com todos os pedidos (atualizado em tempo real)
  let filtroAtivo   = 'todos'; // filtro de status na tela de acompanhamento
  let unsubPedidos  = null;   // função para cancelar listener do Firestore

  /* =========================================================================
     BLOCO 3 – INICIALIZAÇÃO: VERIFICA AUTENTICAÇÃO AO CARREGAR A PÁGINA
     onAuthStateChanged é chamada automaticamente pelo Firebase quando:
     - o app carrega (verifica se ainda está logado)
     - o usuário faz login
     - o usuário faz logout
     ========================================================================= */

  auth.onAuthStateChanged(async (usuario) => {
    // Esconde a tela de loading assim que o Firebase responde
    document.getElementById('tela-loading').style.display = 'none';

    if (usuario) {
      // Usuário está autenticado: guarda o objeto do usuário
      usuarioAtual = usuario;

      // Busca o perfil do usuário no Firestore (coleção 'usuarios')
      await carregarPerfilUsuario(usuario.uid);

      // Exibe o app e oculta o login
      mostrarApp();
    } else {
      // Nenhum usuário logado: exibe tela de login
      document.querySelector('.tela-login-container').style.display = 'flex';
    }
  });

  /* =========================================================================
     BLOCO 4 – AUTENTICAÇÃO: LOGIN E LOGOUT (RF1, RF8, RF13, RNF13, RNF14)
     ========================================================================= */

  // Variável que guarda o perfil selecionado nas abas (gerente/atendente)
  let perfilSelecionado = 'gerente';

  /**
   * selecionarPerfil(perfil)
   * Ao clicar nas abas GERENTE / ATENDENTE, atualiza a aparência das abas
   * e pré-preenche o e-mail com o e-mail demo do perfil escolhido
   */
  function selecionarPerfil(perfil) {
    perfilSelecionado = perfil;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('ativo'));
    document.getElementById('tab-' + perfil).classList.add('ativo');
    document.getElementById('input-email').value = '';
    document.getElementById('input-senha').value = '';
  }

  /**
   * fazerLogin()
   * Lê e-mail e senha dos inputs, chama o Firebase para autenticar.
   * Se bem-sucedido, onAuthStateChanged acima assume o controle.
   */
  async function fazerLogin() {
    const email = document.getElementById('input-email').value.trim();
    const senha  = document.getElementById('input-senha').value.trim();
    const erroEl = document.getElementById('erro-login');

    // Esconde mensagem de erro anterior
    erroEl.style.display = 'none';

    // Validação simples: campos obrigatórios
    if (!email || !senha) {
      erroEl.textContent = 'Preencha e-mail e senha.';
      erroEl.style.display = 'block';
      return; // interrompe a função
    }

    try {
      // signInWithEmailAndPassword: método do Firebase Auth que faz o login
      // Retorna uma Promise; aguardamos com await
      await auth.signInWithEmailAndPassword(email, senha);
      // Se chegar aqui, o login foi bem-sucedido
      // onAuthStateChanged acima detecta a mudança e exibe o app
    } catch (erro) {
      // Log no console para debug (abra F12 para ver)
      console.error('❌ Erro Firebase:', erro.code, erro.message);
      
      // Firebase retorna erros com código; traduzimos para o usuário
      let msg = 'Erro ao entrar. Verifique e-mail e senha.';
      if (erro.code === 'auth/user-not-found')    msg = 'Usuário não encontrado.';
      if (erro.code === 'auth/wrong-password')    msg = 'Senha incorreta.';
      if (erro.code === 'auth/invalid-email')     msg = 'E-mail inválido.';
      if (erro.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Tente mais tarde.';
      if (erro.code === 'auth/network-request-failed') msg = '⚠️ Sem conexão. Verifique sua internet.';

      // Mostra mensagem de erro na interface
      erroEl.textContent = msg;
      erroEl.style.display = 'block';
    }
  }

  /**
   * fazerLogout()
   * Encerra a sessão no Firebase e volta para a tela de login
   */
  async function fazerLogout() {
    // Cancela o listener de pedidos em tempo real antes de sair
    if (unsubPedidos) unsubPedidos();

    // signOut() do Firebase Auth encerra a sessão
    await auth.signOut();

    // Limpa o estado do app
    usuarioAtual  = null;
    perfilAtual   = null;
    carrinho      = {};
    todosProdutos = [];

    // Esconde o app e exibe o login
    document.querySelector('.app-container').style.display = 'none';
    document.querySelector('.tela-login-container').style.display = 'flex';
  }

  /* =========================================================================
     BLOCO 5 – CARREGAMENTO DO PERFIL DO USUÁRIO
     Lê o documento do usuário no Firestore para saber se é gerente ou atendente
     ========================================================================= */

  /**
   * carregarPerfilUsuario(uid)
   * uid = ID único do usuário gerado pelo Firebase Auth
   * Busca o documento em /usuarios/{uid} no Firestore
   */
  async function carregarPerfilUsuario(uid) {
    // doc() acessa um documento específico; get() busca uma vez (não tempo real)
    const snap = await db.collection('usuarios').doc(uid).get();

    if (snap.exists) {
      // snap.data() retorna os campos do documento como objeto JS
      perfilAtual = snap.data().perfil; // 'gerente' ou 'atendente'
    } else {
      // Caso não exista documento, usa o perfil selecionado na aba de login
      perfilAtual = perfilSelecionado;

      // Cria o documento automaticamente para próximas vezes
      // set() cria ou sobrescreve o documento
      await db.collection('usuarios').doc(uid).set({
        email:  usuarioAtual.email,
        perfil: perfilAtual,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  /* =========================================================================
     BLOCO 6 – EXIBIÇÃO DO APP (pós-login)
     Configura a interface de acordo com o perfil do usuário
     ========================================================================= */

  /**
   * mostrarApp()
   * Exibe o app principal e esconde o login.
   * Adapta a navbar e os dados de acordo com o perfil.
   */
  function mostrarApp() {
    // Oculta login e mostra o app
    document.querySelector('.tela-login-container').style.display = 'none';
    document.querySelector('.app-container').style.display = 'flex';

    // Atualiza badge de perfil na topbar
    const badge = document.getElementById('badge-perfil');
    badge.textContent = perfilAtual === 'gerente' ? '👔 Gerente' : '🧃 Atendente';
    badge.className   = 'badge-perfil badge-' + perfilAtual;

    // Atualiza tela de configurações
    document.getElementById('cfg-email').textContent  = usuarioAtual.email;
    document.getElementById('cfg-perfil').textContent = 'Perfil: ' + perfilAtual;

    // RF8, RNF14: Restrições por perfil – atendente não vê Cardápio e Relatórios
    if (perfilAtual !== 'gerente') {
      // Esconde os botões de navegação exclusivos do gerente
      document.getElementById('nav-cardapio').style.display   = 'none';
      document.getElementById('nav-relatorios').style.display = 'none';
    } else {
      // Mostra o card de funções admin apenas para gerente
      document.getElementById('card-popular-produtos').style.display = 'block';
    }

    // Carrega dados iniciais
    carregarProdutos();  // cardápio para novo pedido
    escutarPedidos();    // listener em tempo real dos pedidos
    carregarClientes();  // lista de clientes
  }

  /* =========================================================================
     BLOCO 7 – NAVEGAÇÃO ENTRE TELAS
     ========================================================================= */

  /**
   * mudarTela(nomeTela, titulo, btnClicado)
   * Exibe a tela correspondente e atualiza o item ativo da navbar
   */
  function mudarTela(nomeTela, titulo, btnClicado) {
    // Remove classe 'ativa' de todas as telas
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));

    // Adiciona 'ativa' na tela alvo
    document.getElementById('tela-' + nomeTela).classList.add('ativa');

    // Atualiza o título na topbar
    document.getElementById('titulo-tela').textContent = titulo;

    // Atualiza o item ativo na navbar
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('ativo'));
    if (btnClicado) btnClicado.classList.add('ativo');

    // Ações específicas ao abrir cada tela
    if (nomeTela === 'relatorios')    carregarRelatorio();
    if (nomeTela === 'cardapio')      renderizarProdutosAdmin();
    if (nomeTela === 'acompanhamento') renderizarPedidos();
  }

  /* =========================================================================
     BLOCO 8 – CARDÁPIO / PRODUTOS (RF9, RNF4)
     Carrega e gerencia produtos no Firestore
     ========================================================================= */

  /**
   * carregarProdutos()
   * Busca todos os produtos da coleção 'produtos' no Firestore
   * onSnapshot = listener em tempo real: reexecuta sempre que os dados mudam
   */
  function carregarProdutos() {
    db.collection('produtos')
      .orderBy('categoria') // ordena por categoria para agrupar no cardápio
      .onSnapshot(snap => {
        // snap.docs é array de DocumentSnapshot; mapeamos para objetos JS
        todosProdutos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Atualiza o cardápio na tela de novo pedido
        renderizarMenuPedido();
      });
  }

  /**
   * getImagemProduto(nome, categoria, imagemCampo)
   * Retorna HTML da imagem do produto.
   * Se o produto tiver campo 'imagem' (nome do arquivo em img/), usa a foto real.
   * Caso contrário, usa emoji como fallback.
   * 
   * COMO TROCAR A IMAGEM:
   * 1. Coloque o arquivo de foto dentro da pasta img/ (ex: img/linguica.jpg)
   * 2. No app, vá em Cardápio → edite o produto
   * 3. No campo "Imagem (nome do arquivo)", digite: linguica.jpg
   * 4. Salve — a foto aparecerá automaticamente!
   */
  function getImagemProduto(nome, categoria, imagemCampo) {
    if (imagemCampo) {
      const src = imagemCampo.startsWith('data:') ? imagemCampo : 'img/' + imagemCampo;
      const nomeEsc = (nome || '').replace(/"/g, '&quot;');
      return '<img src="' + src + '" alt="' + nomeEsc + '" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.style.display=\'none\'">';
    }
    return getEmojiProduto(nome, categoria);
  }

  /**
   * getEmojiProduto(nome, categoria)
   * Retorna emoji representativo baseado no nome ou categoria do produto (fallback)
   */
  function getEmojiProduto(nome, categoria) {
    const n = (nome || '').toLowerCase();
    const c = (categoria || '').toLowerCase();

    // Sucos por fruta
    if (n.includes('laranja') && n.includes('morango')) return '🍊🍓';
    if (n.includes('laranja') && n.includes('cenoura') && n.includes('beterraba')) return '🥕🍊';
    if (n.includes('laranja') && n.includes('manga')) return '🍊🥭';
    if (n.includes('laranja') && n.includes('acerola')) return '🍊🍒';
    if (n.includes('laranja') && n.includes('abacaxi')) return '🍊🍍';
    if (n.includes('laranja') && n.includes('maracujá') || n.includes('laranja') && n.includes('maracuja')) return '🍊🌸';
    if (n.includes('laranja') && n.includes('mamão') || n.includes('laranja') && n.includes('mamao')) return '🍊🫐';
    if (n.includes('laranja') && n.includes('goiaba')) return '🍊🟡';
    if (n.includes('laranja') && n.includes('pêssego') || n.includes('pessego')) return '🍊🍑';
    if (n.includes('laracreme') || (n.includes('laranja') && n.includes('sorvete'))) return '🍊🍦';
    if (n.includes('coco') && n.includes('abacaxi')) return '🥥🍍';
    if (n.includes('coco') && n.includes('goiaba')) return '🥥🟡';
    if (n.includes('coco') && n.includes('mamão') || n.includes('coco suíço')) return '🥥';
    if (n.includes('abacaxi') && n.includes('hortelã') || n.includes('abacaxi') && n.includes('hortela')) return '🍍🌿';
    if (n.includes('abacaxi') && n.includes('melancia')) return '🍍🍉';
    if (n.includes('abacaxi') && n.includes('limão') || n.includes('abacaxi') && n.includes('limao')) return '🍍🍋';
    if (n.includes('abacaxi') && n.includes('gengibre')) return '🍍🫚';
    if (n.includes('abacaxi') && n.includes('uva')) return '🍍🍇';
    if (n.includes('morango') && n.includes('maracujá') || n.includes('morango') && n.includes('maracuja')) return '🍓🌸';
    if (n.includes('melancia') && n.includes('morango')) return '🍉🍓';
    if (n.includes('melancia') && n.includes('gengibre')) return '🍉🫚';
    if (n.includes('melancia') && n.includes('hortelã')) return '🍉🌿';
    if (n.includes('melancia')) return '🍉';
    if (n.includes('frutas vermelhas')) return '🍓🫐';
    if (n.includes('amora') && n.includes('morango')) return '🫐🍓';
    if (n.includes('morango')) return '🍓';
    if (n.includes('manga') && n.includes('acerola')) return '🥭🍒';
    if (n.includes('maracuja') && n.includes('manga') || n.includes('maracujá') && n.includes('manga')) return '🌸🥭';
    if (n.includes('limonada') || (n.includes('limão') && n.includes('leite'))) return '🍋🥛';
    if (n.includes('limonada') || n.includes('limão') || n.includes('limao')) return '🍋';
    if (n.includes('laranjada suíça') || n.includes('laranjadasuiça')) return '🍊🥛';
    if (n.includes('laranja')) return '🍊';
    if (n.includes('uva')) return '🍇';
    if (n.includes('abacaxi')) return '🍍';
    if (n.includes('maracujá') || n.includes('maracuja')) return '🌸';
    if (n.includes('manga')) return '🥭';
    if (n.includes('mamão') || n.includes('mamao')) return '🍈';
    if (n.includes('goiaba')) return '🟡';
    if (n.includes('acerola')) return '🍒';
    if (n.includes('coco')) return '🥥';
    if (n.includes('beterraba')) return '🫐';
    if (n.includes('cenoura')) return '🥕';

    // Lanches
    if (n.includes('linguiça') || n.includes('linguica')) return '🌭';
    if (n.includes('frango')) return '🥙';
    if (n.includes('pernil')) return '🥩';
    if (n.includes('carne louca')) return '🥩';
    if (n.includes('misto quente')) return '🥪';
    if (n.includes('ovo')) return '🍳';
    if (n.includes('salada')) return '🥗';
    if (n.includes('sanduíche') || n.includes('sanduiche')) return '🥪';

    // Combos
    if (c.includes('combo')) return '🎯';

    // Por categoria genérica
    if (c.includes('suco')) return '🥤';
    if (c.includes('lanche')) return '🥪';
    if (c.includes('salada')) return '🥗';
    if (c.includes('bebida')) return '🧃';
    if (c.includes('adicional')) return '➕';

    return '🍽️';
  }

  /**
   * renderCardProduto(p)
   * Gera o HTML de um card de produto (reutilizado em várias seções)
   */
  function renderCardProduto(p) {
    const qtd = carrinho[p.id]?.qtd || 0;
    const imgConteudo = getImagemProduto(p.nome, p.categoria, p.imagem || '');
    return `
      <div class="produto-item ${qtd > 0 ? 'selecionado' : ''}" id="prod-${p.id}" onclick="abrirModalAdicionais('${p.id}')">
        <div class="produto-img-wrap">${imgConteudo}</div>
        <div class="produto-info-col">
          <div class="produto-nome">${p.nome}</div>
          ${p.descricao ? '<div style="font-size:0.75rem;color:var(--texto-2);margin-top:2px;line-height:1.3">' + p.descricao + '</div>' : ''}
        </div>
        <div class="produto-direita">
          ${p.promocao ? '<span class="badge-promo">PROMO</span>' : ''}
          <span class="produto-preco">R$ ${Number(p.preco).toFixed(2)}</span>
          ${qtd > 0 ? '<span style="font-size:0.75rem;color:var(--verde);font-weight:700;background:var(--verde-bg);padding:2px 7px;border-radius:20px">' + qtd + 'x</span>' : ''}
        </div>
      </div>`;
  }

  /**
   * renderizarMenuPedido()
   * Renderiza o cardápio na tela de "Novo Pedido":
   * 1. Seção "Os Mais Pedidos" (produtos marcados como maisVendido)
   * 2. Seção "Promoções" (produtos marcados como promocao)
   * 3. Cardápio completo agrupado por categoria
   */
  function renderizarMenuPedido() {
    const container = document.getElementById('menu-container');

    if (todosProdutos.length === 0) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">🍹</div><div class="empty-msg">Nenhum produto no cardápio.<br>' +
        (perfilAtual === 'gerente' ? 'Vá em Cardápio para adicionar.' : 'Aguarde o gerente adicionar produtos.') + '</div></div>';
      return;
    }

    let html = '';

    // ── SEÇÃO: OS MAIS PEDIDOS ──────────────────────────────────────────────
    const maisPedidos = todosProdutos.filter(function(p) { return p.maisVendido; });
    if (maisPedidos.length > 0) {
      html += '<div class="secao-destaque-titulo">⭐ Os Mais Pedidos</div><div class="scroll-horizontal">';
      maisPedidos.forEach(function(p) {
        const imgConteudo = getImagemProduto(p.nome, p.categoria, p.imagem || '');
        const qtd = carrinho[p.id] ? carrinho[p.id].qtd : 0;
        html += '<div class="card-destaque ' + (qtd > 0 ? 'selecionado' : '') + '" onclick="abrirModalAdicionais(\'' + p.id + '\')">' +
          '<div class="card-destaque-img">' + imgConteudo + '</div>' +
          '<div class="card-destaque-nome">' + p.nome + '</div>' +
          '<div class="card-destaque-preco">R$ ' + Number(p.preco).toFixed(2) + '</div>' +
          (qtd > 0 ? '<div style="font-size:0.7rem;color:var(--verde);font-weight:700">' + qtd + 'x no carrinho</div>' : '') +
          '</div>';
      });
      html += '</div>';
    }

    // ── SEÇÃO: PROMOÇÕES ────────────────────────────────────────────────────
    const emPromocao = todosProdutos.filter(function(p) { return p.promocao; });
    if (emPromocao.length > 0) {
      html += '<div class="secao-destaque-titulo" style="color:var(--vermelho)">🔥 Promoções</div>';
      emPromocao.forEach(function(p) { html += renderCardProduto(p); });
    }

    // ── CARDÁPIO COMPLETO POR CATEGORIA ─────────────────────────────────────
    const grupos = todosProdutos.reduce(function(acc, p) {
      const cat = p.categoria || 'Outros';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});

    function iconCategoria(cat) {
      const c = cat.toLowerCase();
      if (c.includes('suco')) return '🥤';
      if (c.includes('lanche') || c.includes('pão') || c.includes('pao')) return '🥪';
      if (c.includes('combo')) return '🎯';
      if (c.includes('salada')) return '🥗';
      if (c.includes('bebida')) return '🧃';
      if (c.includes('adicional')) return '➕';
      return '🍽️';
    }

    for (const [cat, produtos] of Object.entries(grupos)) {
      html += '<div class="categoria-titulo">' + iconCategoria(cat) + ' ' + cat + '</div>';
      produtos.forEach(function(p) { html += renderCardProduto(p); });
    }

    container.innerHTML = html;
  }

  /**
   * escapeJS(str)
   * Escapa aspas simples para uso seguro dentro de atributos onclick=""
   */
  function escapeJS(str) {
    return str.replace(/'/g, "\\'");
  }

  /**
   * renderizarProdutosAdmin()
   * Renderiza a lista de produtos na tela de Cardápio (exclusivo do gerente)
   */
  function renderizarProdutosAdmin() {
    const container = document.getElementById('lista-produtos-admin');

    if (todosProdutos.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">🍹</div>
        <div class="empty-msg">Nenhum produto. Clique em "+ Produto".</div></div>`;
      return;
    }

    container.innerHTML = todosProdutos.map(p => {
      const dadosBtn = JSON.stringify({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        preco: p.preco,
        descricao: p.descricao || '',
        imagem: p.imagem || '',
        maisVendido: p.maisVendido || false,
        promocao: p.promocao || false
      });
      return `
      <div class="produto-item">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
          <div class="produto-img-wrap" style="width:44px;height:44px;font-size:1.3rem;flex-shrink:0">
            ${getImagemProduto(p.nome, p.categoria, p.imagem || '')}
          </div>
          <div style="min-width:0">
            <div class="produto-nome">${p.nome}</div>
            <div style="font-size:0.75rem;color:var(--texto-2)">${p.categoria} · R$ ${Number(p.preco).toFixed(2)}</div>
            <div style="display:flex;gap:6px;margin-top:3px">
              ${p.maisVendido ? '<span style="font-size:0.65rem;background:var(--laranja);color:#fff;padding:1px 5px;border-radius:4px;font-weight:700">⭐ TOP</span>' : ''}
              ${p.promocao    ? '<span style="font-size:0.65rem;background:var(--vermelho);color:#fff;padding:1px 5px;border-radius:4px;font-weight:700">🔥 PROMO</span>' : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn-sm" onclick='editarProduto(${dadosBtn})'>✏️</button>
          <button class="btn-sm-vermelho" onclick="excluirProduto('${p.id}','${escapeJS(p.nome)}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  /**
   * abrirModalProduto()
   * Abre o modal de criação de produto com os campos em branco
   */
  function abrirModalProduto() {
    document.getElementById('modal-produto-titulo').textContent = '+ Novo Produto';
    document.getElementById('prod-id').value        = '';
    document.getElementById('prod-nome').value      = '';
    document.getElementById('prod-categoria').value = '';
    document.getElementById('prod-preco').value     = '';
    document.getElementById('prod-desc').value      = '';
    document.getElementById('prod-imagem').value    = '';
    document.getElementById('prod-mais-vendido').checked = false;
    document.getElementById('prod-promocao').checked     = false;
    const preview = document.getElementById('prod-img-preview');
    if (preview) preview.innerHTML = '🖼️';
    const manualEl = document.getElementById('prod-imagem-manual');
    if (manualEl) manualEl.value = '';
    const fileEl = document.getElementById('prod-imagem-file');
    if (fileEl) fileEl.value = '';
    document.getElementById('btn-gerenciar-adicionais').style.display = 'none';
    document.getElementById('modal-produto').classList.add('aberto');
  }

  /**
   * editarProduto(produto)
   * Abre o modal preenchido com os dados do produto para edição
   */
  function editarProduto(p) {
    document.getElementById('modal-produto-titulo').textContent = '✏️ Editar Produto';
    document.getElementById('prod-id').value        = p.id;
    document.getElementById('prod-nome').value      = p.nome;
    document.getElementById('prod-categoria').value = p.categoria;
    document.getElementById('prod-preco').value     = p.preco;
    document.getElementById('prod-desc').value      = p.descricao;
    document.getElementById('prod-imagem').value    = p.imagem || '';
    document.getElementById('prod-mais-vendido').checked = p.maisVendido || false;
    document.getElementById('prod-promocao').checked     = p.promocao || false;

    // Mostra preview da imagem atual
    const preview = document.getElementById('prod-img-preview');
    const manualEl = document.getElementById('prod-imagem-manual');
    if (manualEl) manualEl.value = (p.imagem && !p.imagem.startsWith('data:')) ? p.imagem : '';
    if (preview) {
      if (p.imagem) {
        const src = p.imagem.startsWith('data:') ? p.imagem : 'img/' + p.imagem;
        preview.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px" onerror="this.parentElement.innerHTML=\'❌\'">';
      } else {
        preview.innerHTML = '🖼️';
      }
    }

    document.getElementById('btn-gerenciar-adicionais').style.display = 'block';
    document.getElementById('modal-produto').classList.add('aberto');
  }

  function previewImagemProduto(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result;
      document.getElementById('prod-imagem').value = base64;
      const preview = document.getElementById('prod-img-preview');
      if (preview) preview.innerHTML = '<img src="' + base64 + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px">';
    };
    reader.readAsDataURL(file);
  }

  function previewImagemManual(valor) {
    const nome = (valor || '').trim();
    document.getElementById('prod-imagem').value = nome;
    const preview = document.getElementById('prod-img-preview');
    if (!preview) return;
    if (nome) {
      preview.innerHTML = '<img src="img/' + nome + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px" onerror="this.parentElement.innerHTML=\'❌\'">';
    } else {
      preview.innerHTML = '🖼️';
    }
  }

  /**
   * salvarProduto()
   * Cria ou atualiza um produto no Firestore.
   * Se prod-id está preenchido = edição; senão = criação
   */
  async function salvarProduto() {
    const id          = document.getElementById('prod-id').value;
    const nome        = document.getElementById('prod-nome').value.trim();
    const categoria   = document.getElementById('prod-categoria').value.trim();
    const preco       = parseFloat(document.getElementById('prod-preco').value);
    const descricao   = document.getElementById('prod-desc').value.trim();
    const imagem      = document.getElementById('prod-imagem').value.trim();
    const maisVendido = document.getElementById('prod-mais-vendido').checked;
    const promocao    = document.getElementById('prod-promocao').checked;

    // Validação
    if (!nome || !categoria || isNaN(preco)) {
      mostrarToast('Preencha nome, categoria e preço.', 'erro');
      return;
    }

    // Objeto com os dados do produto
    const dados = { nome, categoria, preco, descricao, imagem, maisVendido, promocao,
                    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() };

    if (id) {
      // Atualiza documento existente com update()
      await db.collection('produtos').doc(id).update(dados);
      mostrarToast('Produto atualizado!');
    } else {
      // Cria novo documento com add() (Firebase gera o ID automaticamente)
      dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('produtos').add(dados);
      mostrarToast('Produto adicionado!');
    }

    fecharModal('modal-produto');
  }

  /**
   * excluirProduto(id, nome)
   * Remove permanentemente um produto do Firestore após confirmação
   */
  async function excluirProduto(id, nome) {
    // confirm() abre um diálogo nativo de confirmação no navegador
    if (!confirm(`Excluir "${nome}"?`)) return;

    // delete() remove o documento do Firestore
    await db.collection('produtos').doc(id).delete();
    mostrarToast('Produto removido.');
  }

  /* =========================================================================
     BLOCO 8.5 – GERENCIAMENTO DE ADICIONAIS (extensão do bloco de produtos)
     Permite adicionar extras/complementos aos produtos
     ========================================================================= */

  let produtoAtualGerenciando = null; // produto cujos adicionais estão sendo gerenciados

  /**
   * abrirModalAdicionaisProduto()
   * Abre o modal para gerenciar adicionais do produto em edição
   */
  function abrirModalAdicionaisProduto() {
    const prodId = document.getElementById('prod-id').value;
    const prodNome = document.getElementById('prod-nome').value;

    if (!prodId) {
      mostrarToast('Salve o produto primeiro.', 'erro');
      return;
    }

    // Busca o produto atual
    produtoAtualGerenciando = todosProdutos.find(p => p.id === prodId);
    if (!produtoAtualGerenciando) return;

    document.getElementById('modal-adic-prod-nome').textContent = prodNome;
    document.getElementById('adic-id').value = '';
    document.getElementById('adic-nome').value = '';
    document.getElementById('adic-preco').value = '';
    document.getElementById('form-adicional').style.display = 'none';

    renderizarAdicionaisProduto();
    document.getElementById('modal-adicionais-gerenciar').classList.add('aberto');
  }

  /**
   * renderizarAdicionaisProduto()
   * Renderiza a lista de adicionais do produto em gerenciamento
   */
  function renderizarAdicionaisProduto() {
    const container = document.getElementById('lista-adicionais-produto');

    if (!produtoAtualGerenciando?.adicionais || produtoAtualGerenciando.adicionais.length === 0) {
      container.innerHTML = `
        <div class="empty" style="padding:20px 0">
          <div class="empty-icon">✨</div>
          <div class="empty-msg">Nenhum adicional cadastrado</div>
        </div>`;
      return;
    }

    let html = '';
    produtoAtualGerenciando.adicionais.forEach(adic => {
      html += `
        <div style="padding:12px;background:var(--superficie);border-radius:var(--raio-sm);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:500">${adic.nome}</div>
            <div style="color:var(--laranja);font-size:0.9rem">R$ ${Number(adic.preco).toFixed(2)}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-sm" onclick="editarAdicional('${adic.id}','${escapeJS(adic.nome)}',${adic.preco})" style="padding:6px 12px">✏️</button>
            <button class="btn-sm-vermelho" onclick="excluirAdicional('${adic.id}','${escapeJS(adic.nome)}')" style="padding:6px 12px">🗑️</button>
          </div>
        </div>`;
    });

    container.innerHTML = html;
  }

  /**
   * abrirFormAdicional()
   * Abre o formulário para adicionar um novo adicional
   */
  function abrirFormAdicional() {
    document.getElementById('adic-id').value = '';
    document.getElementById('adic-nome').value = '';
    document.getElementById('adic-preco').value = '';
    document.getElementById('form-adicional').style.display = 'block';
  }

  /**
   * cancelarFormAdicional()
   * Cancela e fecha o formulário de adicional
   */
  function cancelarFormAdicional() {
    document.getElementById('form-adicional').style.display = 'none';
  }

  /**
   * editarAdicional(id, nome, preco)
   * Abre o formulário com os dados do adicional para edição
   */
  function editarAdicional(id, nome, preco) {
    document.getElementById('adic-id').value = id;
    document.getElementById('adic-nome').value = nome;
    document.getElementById('adic-preco').value = preco;
    document.getElementById('form-adicional').style.display = 'block';
  }

  /**
   * salvarAdicional()
   * Salva um novo adicional ou atualiza um existente no Firestore
   */
  async function salvarAdicional() {
    const adicId = document.getElementById('adic-id').value;
    const nome = document.getElementById('adic-nome').value.trim();
    const preco = parseFloat(document.getElementById('adic-preco').value);

    if (!nome || isNaN(preco)) {
      mostrarToast('Preencha nome e preço.', 'erro');
      return;
    }

    if (!produtoAtualGerenciando) return;

    // Se não tem ID, cria um novo adicional
    if (!adicId) {
      const novoId = 'adic_' + Date.now();
      if (!produtoAtualGerenciando.adicionais) {
        produtoAtualGerenciando.adicionais = [];
      }
      produtoAtualGerenciando.adicionais.push({
        id: novoId,
        nome,
        preco
      });
    } else {
      // Atualiza o adicional existente
      const adic = produtoAtualGerenciando.adicionais.find(a => a.id === adicId);
      if (adic) {
        adic.nome = nome;
        adic.preco = preco;
      }
    }

    // Salva a lista de adicionais no Firestore
    await db.collection('produtos').doc(produtoAtualGerenciando.id).update({
      adicionais: produtoAtualGerenciando.adicionais
    });

    mostrarToast('✅ Adicional salvo!');
    document.getElementById('form-adicional').style.display = 'none';
    renderizarAdicionaisProduto();
  }

  /**
   * excluirAdicional(id, nome)
   * Remove um adicional do produto
   */
  async function excluirAdicional(id, nome) {
    if (!confirm(`Excluir adicional "${nome}"?`)) return;

    if (!produtoAtualGerenciando) return;

    // Remove da lista local
    produtoAtualGerenciando.adicionais = 
      produtoAtualGerenciando.adicionais.filter(a => a.id !== id);

    // Salva no Firestore
    await db.collection('produtos').doc(produtoAtualGerenciando.id).update({
      adicionais: produtoAtualGerenciando.adicionais
    });

    mostrarToast('✅ Adicional removido!');
    renderizarAdicionaisProduto();
  }

  /* =========================================================================
     BLOCO 9 – CARRINHO DE COMPRAS (RF6, RF10)
     Gerencia os itens selecionados antes de confirmar o pedido
     ========================================================================= */

  /**
   * alterarQtd(id, nome, preco, delta)
   * Aumenta (+1) ou diminui (-1) a quantidade de um produto no carrinho
   * delta = +1 para adicionar, -1 para remover
   */
  function alterarQtd(id, nome, preco, delta) {
    // Se o produto ainda não está no carrinho, inicializa com qtd 0
    if (!carrinho[id]) carrinho[id] = { nome, preco, qtd: 0 };

    carrinho[id].qtd += delta; // aplica a mudança

    // Remove do carrinho se quantidade chegou a 0 ou menos
    if (carrinho[id].qtd <= 0) delete carrinho[id];

    // Atualiza o número exibido ao lado do produto
    const el = document.getElementById('qty-' + id);
    if (el) el.textContent = carrinho[id]?.qtd || 0;

    // Atualiza a borda/destaque do produto
    const prodEl = document.getElementById('prod-' + id);
    if (prodEl) {
      const temNoCarrinho = !!carrinho[id];
      prodEl.classList.toggle('selecionado', temNoCarrinho);
    }

    // Atualiza a barra flutuante do carrinho
    atualizarBarraCarrinho();
  }

  /**
   * atualizarBarraCarrinho()
   * Recalcula total e quantidade de itens no carrinho,
   * e exibe/oculta a barra flutuante
   */
  function atualizarBarraCarrinho() {
    // Object.values() retorna array com os valores do objeto carrinho
    const itens = Object.values(carrinho);

    // reduce() soma as quantidades: acumulador + quantidade do item
    const qtdTotal = itens.reduce((acc, i) => acc + i.qtd, 0);

    // reduce() soma o subtotal de cada item (preço × quantidade)
    const total = itens.reduce((acc, i) => acc + i.preco * i.qtd, 0);

    const barra = document.getElementById('carrinho-bar');

    if (qtdTotal > 0) {
      // Exibe a barra com os totais
      barra.style.display = 'flex';
      document.getElementById('carrinho-qtd').textContent      = qtdTotal + (qtdTotal === 1 ? ' item' : ' itens');
      document.getElementById('carrinho-total-bar').textContent = 'R$ ' + total.toFixed(2);
    } else {
      // Oculta a barra quando o carrinho está vazio
      barra.style.display = 'none';
    }
  }

  /**
   * abrirModalCarrinho()
   * Abre o modal de revisão e confirmação do pedido
   */
  function abrirModalCarrinho() {
    const itens = Object.values(carrinho);
    let html  = '';
    let total = 0;

    // Gera linha para cada produto no carrinho
    itens.forEach(i => {
      const sub = i.preco * i.qtd;  // subtotal do item (sem adicionais)
      let subAdicionais = 0;

      let htmlAdicionais = '';
      if (i.adicionais && i.adicionais.length > 0) {
        htmlAdicionais += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--borda)">';
        i.adicionais.forEach(adic => {
          const subAdicional = adic.preco * adic.qtd;
          subAdicionais += subAdicional;
          htmlAdicionais += `
            <div style="font-size:0.85rem;color:var(--texto-2);display:flex;justify-content:space-between;margin-bottom:4px">
              <span>  + ${adic.qtd}× ${adic.nome}</span>
              <span>R$ ${subAdicional.toFixed(2)}</span>
            </div>`;
        });
        htmlAdicionais += '</div>';
      }

      const htmlObs = i.observacoes ? `<div style="margin-top:8px;font-size:0.8rem;color:var(--texto-2);font-style:italic">📝 ${i.observacoes}</div>` : '';

      total += sub + subAdicionais;

      html += `
        <div class="relatorio-item" style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--borda)">
          <div style="display:flex;justify-content:space-between">
            <span>${i.qtd}× ${i.nome}</span>
            <span class="relatorio-valor">R$ ${sub.toFixed(2)}</span>
          </div>
          ${htmlAdicionais}
          ${htmlObs}
        </div>`;
    });

    document.getElementById('modal-carrinho-itens').innerHTML = html;
    document.getElementById('modal-total').textContent = 'R$ ' + total.toFixed(2);
    document.getElementById('modal-carrinho').classList.add('aberto');
  }

  /* =========================================================================
     BLOCO 10 – PEDIDOS: CRIAR E ESCUTAR EM TEMPO REAL (RF6, RF7)
     ========================================================================= */

  /**
   * confirmarPedido()
   * Monta o objeto do pedido e salva no Firestore.
   * O listener onSnapshot nos outros dispositivos recebe automaticamente.
   */
  async function confirmarPedido() {
    const cliente   = document.getElementById('np-cliente').value.trim();
    const mesa      = document.getElementById('np-mesa').value.trim();
    const pagamento = document.getElementById('np-pagamento').value;
    const obs       = document.getElementById('np-obs').value.trim();
    const itens     = Object.values(carrinho);

    // Validação: precisa ter pelo menos um produto
    if (itens.length === 0) {
      mostrarToast('Adicione pelo menos um produto.', 'erro');
      return;
    }

    // Calcula o total do pedido (inclui adicionais)
    const total = itens.reduce((acc, i) => {
      let subItem = i.preco * i.qtd;
      if (i.adicionais && i.adicionais.length > 0) {
        i.adicionais.forEach(adic => {
          subItem += adic.preco * adic.qtd;
        });
      }
      return acc + subItem;
    }, 0);

    // Objeto que será salvo no Firestore
    const pedido = {
      cliente:    cliente || 'Cliente', // nome padrão se não informado
      mesa:       mesa    || '—',
      pagamento,
      obs,
      itens,                            // array de { nome, preco, qtd, adicionais, observacoes }
      total,
      status:    'aguardando',          // status inicial do pedido
      atendente: usuarioAtual.email,    // quem criou o pedido
      criadoEm:  firebase.firestore.FieldValue.serverTimestamp() // timestamp do servidor
    };

    // add() cria o documento; Firebase gera ID automático
    const ref = await db.collection('pedidos').add(pedido);

    // Gera e exibe comprovante (RNF7)
    exibirComprovante({ id: ref.id, ...pedido });

    // Limpa o formulário e o carrinho após salvar
    limparFormularioPedido();

    fecharModal('modal-carrinho');
    mostrarToast('✅ Pedido enviado para a cozinha!');
  }

  /**
   * limparFormularioPedido()
   * Reseta todos os campos e o carrinho após confirmar um pedido
   */
  function limparFormularioPedido() {
    document.getElementById('np-cliente').value = '';
    document.getElementById('np-mesa').value    = '';
    document.getElementById('np-obs').value     = '';

    carrinho = {}; // esvazia o carrinho

    // Reseta os contadores visuais de todos os produtos
    document.querySelectorAll('.qty-num').forEach(el => el.textContent = '0');
    document.querySelectorAll('.produto-item').forEach(el => el.classList.remove('selecionado'));

    // Esconde a barra do carrinho
    document.getElementById('carrinho-bar').style.display = 'none';
  }

  /**
   * escutarPedidos()
   * Cria um listener em tempo real no Firestore.
   * Toda vez que um pedido é criado, atualizado ou removido,
   * o callback é chamado automaticamente em todos os dispositivos conectados.
   * Este é o mecanismo de SINCRONIZAÇÃO EM TEMPO REAL (RF2, RF7).
   */
  function escutarPedidos() {
    // Cancela listener anterior se existir (evita duplicatas ao relogar)
    if (unsubPedidos) unsubPedidos();

    // onSnapshot recebe o estado atual + todas as mudanças futuras
    unsubPedidos = db.collection('pedidos')
      .orderBy('criadoEm', 'desc') // mais recentes primeiro
      .onSnapshot(snap => {
        // Atualiza o array local com os pedidos do Firestore
        todosPedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarPedidos(); // re-renderiza a lista na tela
      });
  }

  /**
   * renderizarPedidos()
   * Renderiza a lista de pedidos de acordo com o filtro ativo
   */
  function renderizarPedidos() {
    const container = document.getElementById('lista-pedidos');

    // Filtra os pedidos de acordo com o filtro selecionado
    const pedidos = filtroAtivo === 'todos'
      ? todosPedidos
      : todosPedidos.filter(p => p.status === filtroAtivo);

    if (pedidos.length === 0) {
      container.innerHTML = `<div class="empty">
        <div class="empty-icon">📋</div>
        <div class="empty-msg">Nenhum pedido ${filtroAtivo !== 'todos' ? 'com status "'+filtroAtivo+'"' : 'ainda'}.</div>
      </div>`;
      return;
    }

    container.innerHTML = pedidos.map(p => {
      // Formata a hora do pedido
      // toDate() converte o Timestamp do Firebase para Date do JS
      const hora = p.criadoEm?.toDate
        ? p.criadoEm.toDate().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit'})
        : '—';

      // Gera linhas para cada item do pedido
      const itensHtml = p.itens.map(i => {
        let subItem = i.preco * i.qtd;
        let htmlAdicionaisItem = '';

        if (i.adicionais && i.adicionais.length > 0) {
          htmlAdicionaisItem += '<div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--borda)">';
          i.adicionais.forEach(adic => {
            const subAdicional = adic.preco * adic.qtd;
            subItem += subAdicional;
            htmlAdicionaisItem += `
              <div style="font-size:0.8rem;color:var(--texto-2);margin-left:8px">
                + ${adic.qtd}× ${adic.nome} (R$ ${subAdicional.toFixed(2)})
              </div>`;
          });
          htmlAdicionaisItem += '</div>';
        }

        const htmlObsItem = i.observacoes ? `<div style="font-size:0.8rem;color:var(--texto-2);margin-top:4px;font-style:italic">📝 ${i.observacoes}</div>` : '';

        return `
          <div class="pedido-item">
            <div>
              <span>${i.qtd}× ${i.nome}</span>
              <span style="color:var(--laranja);font-weight:500;margin-left:8px">R$ ${subItem.toFixed(2)}</span>
            </div>
            ${htmlAdicionaisItem}
            ${htmlObsItem}
          </div>`;
      }).join('');

      // Mapa de labels e classes CSS por status
      const statusMap = {
        aguardando: { label: 'Aguardando', cls: 'status-aguardando' },
        preparo:    { label: 'Em Preparo', cls: 'status-preparo' },
        pronto:     { label: 'Pronto',     cls: 'status-pronto' },
        cancelado:  { label: 'Cancelado',  cls: 'status-cancelado' }
      };
      const st = statusMap[p.status] || statusMap.aguardando;

      // Botões de ação variam por status e perfil
      let acoes = '';

      if (p.status === 'aguardando') {
        // Atendente e gerente podem mover para "em preparo"
        acoes += `<button class="btn-sm" onclick="mudarStatusPedido('${p.id}','preparo')">🔥 Em Preparo</button>`;
        acoes += `<button class="btn-sm-vermelho" onclick="mudarStatusPedido('${p.id}','cancelado')">❌ Cancelar</button>`;
      }
      if (p.status === 'preparo') {
        acoes += `<button class="btn-sm-verde" onclick="mudarStatusPedido('${p.id}','pronto')">✅ Pronto</button>`;
        acoes += `<button class="btn-sm-vermelho" onclick="mudarStatusPedido('${p.id}','cancelado')">❌ Cancelar</button>`;
      }
      if (p.status === 'pronto') {
        // Botão para ver o comprovante do pedido finalizado (RNF7)
        acoes += `<button class="btn-sm" onclick='verComprovante(${JSON.stringify(p)})'>🧾 Comprovante</button>`;
      }
      // Gerente pode excluir qualquer pedido
      if (perfilAtual === 'gerente') {
        acoes += `<button class="btn-sm-vermelho" onclick="excluirPedido('${p.id}')">🗑️</button>`;
      }

      return `
        <div class="pedido-card">
          <div class="pedido-header">
            <div>
              <div class="pedido-num">Pedido #${p.id.slice(-4).toUpperCase()}</div>
              <div class="pedido-hora">⏰ ${hora} · 🪑 ${p.mesa} · 👤 ${p.cliente}</div>
              <div class="pedido-hora" style="margin-top:2px">💳 ${p.pagamento} · 👨‍💼 ${p.atendente}</div>
            </div>
            <div><span class="status-badge ${st.cls}">${st.label}</span></div>
          </div>
          <div class="pedido-itens">${itensHtml}</div>
          <div style="text-align:right;font-weight:700;color:var(--laranja)">Total: R$ ${p.total.toFixed(2)}</div>
          ${p.obs ? `<div class="pedido-obs">📝 ${p.obs}</div>` : ''}
          <div class="pedido-acoes">${acoes}</div>
        </div>`;
    }).join('');
  }

  /**
   * mudarStatusPedido(id, novoStatus)
   * Atualiza o campo 'status' do pedido no Firestore.
   * O onSnapshot propaga a mudança para todos os dispositivos em tempo real.
   */
  async function mudarStatusPedido(id, novoStatus) {
    // update() modifica apenas os campos especificados (não sobrescreve tudo)
    await db.collection('pedidos').doc(id).update({
      status: novoStatus,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    mostrarToast('Status atualizado!');
  }

  /**
   * excluirPedido(id)
   * Remove o pedido do Firestore (apenas gerente)
   */
  async function excluirPedido(id) {
    if (!confirm('Excluir este pedido permanentemente?')) return;
    await db.collection('pedidos').doc(id).delete();
    mostrarToast('Pedido removido.');
  }

  /**
   * filtrarPedidos(filtro, btn)
   * Atualiza o filtro ativo e re-renderiza a lista de pedidos
   */
  function filtrarPedidos(filtro, btn) {
    filtroAtivo = filtro;
    // Atualiza aparência dos botões de filtro
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    renderizarPedidos();
  }

  /* =========================================================================
     BLOCO 11 – COMPROVANTE DE VENDA (RNF7)
     ========================================================================= */

  /**
   * exibirComprovante(pedido)
   * Gera o HTML do comprovante e abre o modal
   */
  function exibirComprovante(pedido) {
    const agora = new Date().toLocaleString('pt-BR');
    const itensHtml = pedido.itens.map(i =>
      `<div style="display:flex;justify-content:space-between">
         <span>${i.qtd}× ${i.nome}</span>
         <span>R$ ${(i.preco * i.qtd).toFixed(2)}</span>
       </div>`
    ).join('');

    document.getElementById('comprovante-conteudo').innerHTML = `
      <div class="comprovante">
        <div class="comprovante-logo">🥤 BATIDÃO</div>
        <div style="text-align:center;font-size:0.75rem">Casa de Sucos Naturais</div>
        <div class="comprovante-linha"></div>
        <div>Data: ${agora}</div>
        <div>Pedido: #${pedido.id.slice(-4).toUpperCase()}</div>
        <div>Cliente: ${pedido.cliente}</div>
        <div>Mesa: ${pedido.mesa}</div>
        <div class="comprovante-linha"></div>
        <div style="font-weight:700;margin-bottom:4px">ITENS</div>
        ${itensHtml}
        <div class="comprovante-linha"></div>
        <div style="display:flex;justify-content:space-between;font-weight:900">
          <span>TOTAL</span>
          <span>R$ ${pedido.total.toFixed(2)}</span>
        </div>
        <div>Pagamento: ${pedido.pagamento}</div>
        ${pedido.obs ? `<div class="comprovante-linha"></div><div>Obs: ${pedido.obs}</div>` : ''}
        <div class="comprovante-linha"></div>
        <div style="text-align:center;font-size:0.75rem">Obrigado pela preferência! 😊</div>
      </div>`;

    document.getElementById('modal-comprovante').classList.add('aberto');
  }

  /**
   * verComprovante(pedido)
   * Chamado ao clicar em "🧾 Comprovante" de um pedido pronto
   */
  function verComprovante(pedido) {
    exibirComprovante(pedido);
  }

  /* =========================================================================
     BLOCO 12 – CLIENTES (RNF8, RNF9)
     Cadastro e histórico de compras dos clientes
     ========================================================================= */

  let todosClientes    = []; // cache local dos clientes
  let clientesFiltrados = []; // resultado da busca

  /**
   * carregarClientes()
   * Listener em tempo real da coleção 'clientes' no Firestore
   */
  function carregarClientes() {
    db.collection('clientes')
      .orderBy('nome') // ordem alfabética
      .onSnapshot(snap => {
        todosClientes     = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        clientesFiltrados = todosClientes;
        renderizarClientes(todosClientes);
      });
  }

  /**
   * renderizarClientes(lista)
   * Renderiza a lista de clientes na tela
   */
  function renderizarClientes(lista) {
    const container = document.getElementById('lista-clientes');
    if (lista.length === 0) {
      container.innerHTML = `<div class="empty">
        <div class="empty-icon">👥</div>
        <div class="empty-msg">Nenhum cliente cadastrado.</div>
      </div>`;
      return;
    }
    container.innerHTML = lista.map(c => `
      <div class="cliente-item">
        <div>
          <div class="cliente-nome">${c.nome}</div>
          <div class="cliente-tel">${c.telefone || '—'}</div>
        </div>
        <div style="display:flex;gap:6px">
          <!-- Botão histórico: abre modal com pedidos do cliente (RNF9) -->
          <button class="btn-sm" onclick="verHistorico('${c.id}','${escapeJS(c.nome)}')">📋</button>
          <button class="btn-sm-vermelho" onclick="excluirCliente('${c.id}','${escapeJS(c.nome)}')">🗑️</button>
        </div>
      </div>`).join('');
  }

  /**
   * buscarCliente(termo)
   * Filtra a lista local de clientes conforme o usuário digita
   */
  function buscarCliente(termo) {
    const t = termo.toLowerCase();
    // filter() retorna apenas clientes cujo nome contém o termo
    const resultado = todosClientes.filter(c => c.nome.toLowerCase().includes(t));
    renderizarClientes(resultado);
  }

  /**
   * abrirModalCliente()
   * Abre o modal para cadastrar um novo cliente
   */
  function abrirModalCliente() {
    document.getElementById('cli-nome').value = '';
    document.getElementById('cli-tel').value  = '';
    document.getElementById('modal-cliente').classList.add('aberto');
  }

  /**
   * salvarCliente()
   * Salva um novo cliente no Firestore
   */
  async function salvarCliente() {
    const nome     = document.getElementById('cli-nome').value.trim();
    const telefone = document.getElementById('cli-tel').value.trim();

    if (!nome) { mostrarToast('Informe o nome do cliente.', 'erro'); return; }

    await db.collection('clientes').add({
      nome,
      telefone,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    fecharModal('modal-cliente');
    mostrarToast('Cliente cadastrado!');
  }

  /**
   * excluirCliente(id, nome)
   * Remove o cliente do Firestore
   */
  async function excluirCliente(id, nome) {
    if (!confirm(`Excluir cliente "${nome}"?`)) return;
    await db.collection('clientes').doc(id).delete();
    mostrarToast('Cliente removido.');
  }

  /**
   * verHistorico(clienteId, nome)
   * Busca todos os pedidos do cliente e exibe no modal (RNF9)
   * IMPORTANTE: Usa clienteId em vez de nome para evitar conflitos
   */
  async function verHistorico(clienteId, nome) {
    document.getElementById('historico-titulo').textContent = '📋 ' + nome;
    document.getElementById('historico-conteudo').innerHTML = '<p style="color:var(--texto-2)">Carregando…</p>';
    document.getElementById('modal-historico').classList.add('aberto');

    // Busca todos os pedidos e filtra pelo nome do cliente localmente
    // NOTA: Em uma versão melhorada, o pedido armazenaria 'clienteId' como referência
    const snap = await db.collection('pedidos')
      .where('cliente', '==', nome)
      .orderBy('criadoEm', 'desc')
      .get();

    if (snap.empty) {
      document.getElementById('historico-conteudo').innerHTML =
        '<div class="empty"><div class="empty-msg">Nenhum pedido encontrado.</div></div>';
      return;
    }

    const pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    let totalGasto = 0;
    let html = '';

    pedidos.forEach(p => {
      totalGasto += p.total;
      const hora = p.criadoEm?.toDate
        ? p.criadoEm.toDate().toLocaleDateString('pt-BR') : '—';
      html += `
        <div class="relatorio-item">
          <div>
            <div style="font-weight:600">#${p.id.slice(-4).toUpperCase()} · ${hora}</div>
            <div style="font-size:0.78rem;color:var(--texto-2)">${p.itens.map(i=>i.qtd+'× '+i.nome).join(', ')}</div>
          </div>
          <span class="relatorio-valor">R$ ${p.total.toFixed(2)}</span>
        </div>`;
    });

    // Resumo total gasto pelo cliente
    html = `<div style="padding:10px;background:var(--fundo);border-radius:var(--raio-sm);margin-bottom:12px">
      <span style="color:var(--texto-2);font-size:0.8rem">Total gasto</span>
      <div style="font-family:'Syne',sans-serif;font-size:1.4rem;color:var(--laranja)">${pedidos.length} pedidos · R$ ${totalGasto.toFixed(2)}</div>
    </div>` + html;

    document.getElementById('historico-conteudo').innerHTML = html;
  }

  /* =========================================================================
     BLOCO 13 – RELATÓRIOS (RNF10, RNF11, RNF12)
     Calcula estatísticas de vendas com base nos pedidos do Firestore
     ========================================================================= */

  /**
   * carregarRelatorio()
   * Filtra pedidos pelo período selecionado e calcula estatísticas
   */
  async function carregarRelatorio() {
    const periodo = document.getElementById('rel-periodo').value;

    // Define a data de início do período
    const agora  = new Date();
    let dataInicio = new Date();

    if (periodo === 'hoje') {
      // Início do dia atual: meia-noite
      dataInicio.setHours(0, 0, 0, 0);
    } else if (periodo === 'semana') {
      // 7 dias atrás
      dataInicio.setDate(agora.getDate() - 7);
    } else {
      // Início do mês atual
      dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    }

    // Converte a data JS para Timestamp do Firebase
    const tsInicio = firebase.firestore.Timestamp.fromDate(dataInicio);

    // Busca pedidos a partir da data de início
    const snap = await db.collection('pedidos')
      .where('criadoEm', '>=', tsInicio)
      .get();

    const pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Pedidos que não foram cancelados (para cálculo de receita)
    const validos     = pedidos.filter(p => p.status !== 'cancelado');
    const cancelados  = pedidos.filter(p => p.status === 'cancelado');
    const receita     = validos.reduce((acc, p) => acc + p.total, 0);
    const ticketMedio = validos.length > 0 ? receita / validos.length : 0;

    // Atualiza os cards de stats
    document.getElementById('rel-total-pedidos').textContent = pedidos.length;
    document.getElementById('rel-receita').textContent       = receita.toFixed(2);
    document.getElementById('rel-ticket').textContent        = ticketMedio.toFixed(2);
    document.getElementById('rel-cancelados').textContent    = cancelados.length;

    // Produtos mais vendidos (RNF12)
    // Conta quantas vezes cada produto apareceu em pedidos
    const contagem = {};
    validos.forEach(p => {
      p.itens.forEach(i => {
        // Se já existe, soma; senão inicializa
        contagem[i.nome] = (contagem[i.nome] || 0) + i.qtd;
      });
    });

    // Ordena do mais vendido para o menos
    const ranking = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1]) // ordena por quantidade decrescente
      .slice(0, 10); // pega apenas os 10 primeiros

    const maisVendidos = document.getElementById('rel-mais-vendidos');
    if (ranking.length === 0) {
      maisVendidos.innerHTML = '<div class="empty"><div class="empty-msg">Sem dados no período.</div></div>';
      return;
    }

    maisVendidos.innerHTML = ranking.map(([nome, qtd], idx) => `
      <div class="relatorio-item">
        <span>${idx + 1}. ${nome}</span>
        <span class="relatorio-valor">${qtd} vendidos</span>
      </div>`).join('');
  }

  /* =========================================================================
     BLOCO 14 – UTILITÁRIOS
     Funções auxiliares usadas em vários lugares do app
     ========================================================================= */

  /**
   * fecharModal(id)
   * Remove a classe 'aberto' do overlay do modal, ocultando-o
   */
  function fecharModal(id) {
    document.getElementById(id).classList.remove('aberto');
  }

  /**
   * mostrarToast(msg, tipo)
   * Exibe uma notificação breve na parte superior da tela
   * tipo: 'sucesso' (padrão, verde) ou 'erro' (vermelho)
   */
  function mostrarToast(msg, tipo = 'sucesso') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;

    // Define cor de fundo de acordo com o tipo
    toast.style.background = tipo === 'erro' ? 'var(--vermelho)' : 'var(--verde)';

    // Adiciona classe para tornar visível (CSS faz a animação)
    toast.classList.add('visivel');

    // Remove após 2.5 segundos
    setTimeout(() => toast.classList.remove('visivel'), 2500);
  }

  /* =========================================================================
     BLOCO 15 – FECHAR MODAL AO CLICAR FORA (UX)
     Ao clicar no overlay escuro, o modal é fechado
     ========================================================================= */
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      // Fecha apenas se o clique foi no próprio overlay (não no conteúdo do modal)
      if (e.target === overlay) {
        overlay.classList.remove('aberto');
      }
    });
  });

  /* =========================================================================
     BLOCO 16 – SUBMIT POR ENTER NOS CAMPOS DE LOGIN
     Permite pressionar Enter no campo de senha para fazer login
     ========================================================================= */
  document.getElementById('input-senha').addEventListener('keydown', e => {
    if (e.key === 'Enter') fazerLogin(); // Enter dispara o login
  });

  /* =========================================================================
     BLOCO 17 – ADICIONAIS DOS PRODUTOS (modal ao clicar no produto)
     ========================================================================= */

  let produtoAtualAdicionais = null;          // produto selecionado para adicionais
  let adicionaisTemp = {};                    // objeto para rastrear qtd de adicionais {adicionalId: qtd}

  /**
   * abrirModalAdicionais(produtoId)
   * Abre o modal de adicionais ao clicar em um produto
   */
  function abrirModalAdicionais(produtoId) {
    const produto = todosProdutos.find(p => p.id === produtoId);
    if (!produto) return;

    produtoAtualAdicionais = produto;
    adicionaisTemp = {}; // reseta adicionais temporários

    // Preenche os dados do produto no modal
    document.getElementById('modal-adicionais-titulo').textContent = `Adicionais - ${produto.nome}`;
    document.getElementById('modal-adicionais-produto').textContent = produto.nome;
    document.getElementById('modal-adicionais-preco').textContent = `R$ ${Number(produto.preco).toFixed(2)}`;
    document.getElementById('modal-adicionais-obs').value = '';

    // Renderiza a lista de adicionais (por enquanto vazia, pode ser preenchida depois)
    renderizarAdicionais();

    // Abre o modal
    document.getElementById('modal-adicionais').classList.add('aberto');
  }

  /**
   * renderizarAdicionais()
   * Renderiza a lista de adicionais do produto
   * Se não houver adicionais, mostra mensagem
   */
  function renderizarAdicionais() {
    const lista = document.getElementById('modal-adicionais-lista');

    // Por enquanto, adicionais podem ser adicionados manualmente
    // Estrutura futura: cada produto pode ter um array de adicionais
    if (!produtoAtualAdicionais?.adicionais || produtoAtualAdicionais.adicionais.length === 0) {
      lista.innerHTML = `
        <div class="empty" style="padding:20px 0">
          <div class="empty-icon">✨</div>
          <div class="empty-msg">Sem adicionais para este produto</div>
        </div>`;
      return;
    }

    let html = '';
    produtoAtualAdicionais.adicionais.forEach(adic => {
      const qtdAdicional = adicionaisTemp[adic.id] || 0;

      html += `
        <div style="padding:12px;background:var(--superficie);border-radius:var(--raio-sm);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:500">${adic.nome}</div>
            <div style="color:var(--laranja);font-size:0.9rem">+ R$ ${Number(adic.preco).toFixed(2)}</div>
          </div>
          <div class="qty-ctrl">
            <button class="qty-btn" onclick="alterarQtyAdicional('${adic.id}',-1)">−</button>
            <span class="qty-num" style="min-width:24px">${qtdAdicional}</span>
            <button class="qty-btn" onclick="alterarQtyAdicional('${adic.id}',+1)">+</button>
          </div>
        </div>`;
    });

    lista.innerHTML = html;
  }

  /**
   * alterarQtyAdicional(adicionalId, delta)
   * Aumenta ou diminui a quantidade de um adicional
   */
  function alterarQtyAdicional(adicionalId, delta) {
    adicionaisTemp[adicionalId] = (adicionaisTemp[adicionalId] || 0) + delta;
    if (adicionaisTemp[adicionalId] < 0) adicionaisTemp[adicionalId] = 0;
    renderizarAdicionais();
  }

  /**
   * adicionarAoCarrinhoComAdicionais()
   * Adiciona o produto ao carrinho com os adicionais e observações
   */
  function adicionarAoCarrinhoComAdicionais() {
    if (!produtoAtualAdicionais) return;

    const prodId = produtoAtualAdicionais.id;
    const obs = document.getElementById('modal-adicionais-obs').value.trim();

    // Se o produto não está no carrinho, cria nova entrada
    if (!carrinho[prodId]) {
      carrinho[prodId] = {
        nome: produtoAtualAdicionais.nome,
        preco: produtoAtualAdicionais.preco,
        qtd: 1,
        adicionais: [], // array de adicionais selecionados
        observacoes: obs
      };
    } else {
      // Se o produto já está, apenas incrementa a quantidade
      carrinho[prodId].qtd += 1;
      carrinho[prodId].observacoes = obs;
    }

    // Adiciona os adicionais selecionados
    Object.entries(adicionaisTemp).forEach(([adicionalId, qtdAdicional]) => {
      if (qtdAdicional > 0) {
        const adicional = produtoAtualAdicionais.adicionais.find(a => a.id === adicionalId);
        if (adicional) {
          carrinho[prodId].adicionais.push({
            nome: adicional.nome,
            preco: adicional.preco,
            qtd: qtdAdicional
          });
        }
      }
    });

    // Atualiza visualização
    atualizarBarraCarrinho();
    renderizarMenuPedido();
    mostrarToast(`✅ ${produtoAtualAdicionais.nome} adicionado ao carrinho!`);

    // Fecha o modal
    fecharModal('modal-adicionais');
  }

  /* =========================================================================
     BLOCO 17.5 – DEFINIR DESTAQUES PADRÃO
     Marca os produtos mais vendidos e promoções automaticamente
     ========================================================================= */

  /**
   * definirDestaquesPadrao()
   * Percorre os produtos cadastrados e marca como "maisVendido" os 6 mais pedidos
   * da foto (Linguiça Trad., Linguiça Completão, Laranja c/ Morango, Frango,
   * Misto Quente, Maracujá 500ml) e marca os combos como promoção.
   * Execute uma vez pelo gerente em Config → Funções Admin.
   */
  async function definirDestaquesPadrao() {
    if (!usuarioAtual || perfilAtual !== 'gerente') {
      alert('❌ Apenas gerentes podem fazer isso.');
      return;
    }
    if (!confirm('Isso vai marcar automaticamente os "Mais Pedidos" e "Promoções" no cardápio. Continuar?')) return;

    // Nomes parciais dos produtos que viram "Mais Pedidos" (⭐)
    const maisVendidosChaves = [
      'linguiça (tradicional)', 'linguica (tradicional)',
      'linguiça completao', 'linguica completao',
      'laranja c/ morango',
      'frango',
      'misto quente',
      'maracujá 500ml', 'maracuja 500ml'
    ];

    // Categorias que viram "Promoção" (🔥) — combos são sempre promoção
    const categoriasPromo = ['combos'];

    let atualizados = 0;
    const batch = db.batch();

    todosProdutos.forEach(p => {
      const n = (p.nome || '').toLowerCase();
      const c = (p.categoria || '').toLowerCase();

      const ehMaisVendido = maisVendidosChaves.some(chave => n.includes(chave));
      const ehPromocao    = categoriasPromo.some(cat => c.includes(cat));

      if (ehMaisVendido || ehPromocao) {
        const ref = db.collection('produtos').doc(p.id);
        batch.update(ref, {
          maisVendido: ehMaisVendido,
          promocao: ehPromocao
        });
        atualizados++;
      }
    });

    await batch.commit();
    mostrarToast('✅ ' + atualizados + ' produtos marcados! As seções já aparecem no cardápio.', 'sucesso');
    carregarProdutos();
  }

  /* =========================================================================
     BLOCO 18 – FUNÇÃO PARA POPULAR PRODUTOS DO ANOTA.AI
     Execute apenas UMA VEZ no console: popularProdutosComDados()
     Adiciona todos os produtos do cardápio da BATIDÃO ao Firestore
     ========================================================================= */
  
  async function popularProdutosComDados() {
    const produtosCompletos = [
      // LANCHES NO PÃO FRANCES
      { nome: 'PAO COM LINGUIÇA (Tradicional)', categoria: 'LANCHES NO PÃO FRANCES', preco: 15.90, descricao: 'Linguiça de Pernil, Mix de Alface e Rúcula, Tomate e Molho especial' },
      { nome: 'PÃO COM LINGUIÇA COMPLETAO', categoria: 'LANCHES NO PÃO FRANCES', preco: 22.90, descricao: 'LINGUIÇA TRADICIONAL COM ADICINAL DE OVO QUIJO E PRESUNTO' },
      { nome: 'PAO COM LINGUIÇA DUPLO', categoria: 'LANCHES NO PÃO FRANCES', preco: 22.90, descricao: '150g de Linguiça de Pernil, Mix de Alface e Rúcula, Tomate e Molho especial' },
      { nome: 'Frango', categoria: 'LANCHES NO PÃO FRANCES', preco: 17.90, descricao: '100g Frango Desfiado, Mix de Alface e Rúcula, Tomate e Molho especial' },
      { nome: 'Pernil', categoria: 'LANCHES NO PÃO FRANCES', preco: 17.90, descricao: '100g Pernil Desfiado, Mix de Alface e Rúcula, Tomate e Molho especial' },
      { nome: 'Linguiça Artesanal Apimentada', categoria: 'LANCHES NO PÃO FRANCES', preco: 22.90, descricao: '150g de Linguiça Artesanal Apimentada (ardor médio), acompanha Queijo Provolone, Tomate, Rúcula e molho da casa' },
      { nome: 'Carne Louca', categoria: 'LANCHES NO PÃO FRANCES', preco: 20.90, descricao: '100g Carne bovina Desfiada com tempero da casa, Mix de Alface e Rúcula, Tomate e Molho especial' },
      { nome: 'Misto Quente', categoria: 'LANCHES NO PÃO FRANCES', preco: 11.90, descricao: '3 fatias de Presunto, Queijo e molho especial da casa' },
      { nome: 'Ovo e Queijo', categoria: 'LANCHES NO PÃO FRANCES', preco: 11.90, descricao: '3 Ovos com Queijo' },
      { nome: 'Misto Quente COM SALADA', categoria: 'LANCHES NO PÃO FRANCES', preco: 15.90, descricao: 'Pão Frances, Presunto e Queijo, Alface, Rucúla, Tomate e Molhos' },
      { nome: 'Ovo Queijo COM SALADA', categoria: 'LANCHES NO PÃO FRANCES', preco: 15.90, descricao: 'Pão Frances, 3 ovos, queijo mussarela, Alface, Rucula, Tomate e molhos' },
      
      // COMBOS MATA FOME
      { nome: '2 LINGUICA TRADICIONAL + 1 LITRO SUCO DE LARANJA COM MORANGO', categoria: 'COMBOS MATA FOME', preco: 47.90, descricao: 'O lanche e o suco mais vendidos em uma combinação perfeita' },
      { nome: '2 LINGUICA COMPLETÃO + 1 LITRO SUCO DE LARANJA COM MORANGO', categoria: 'COMBOS MATA FOME', preco: 65.90, descricao: 'O lanche de linguiça turbinado e o suco mais vendidos em uma combinação perfeita' },
      
      // SUCOS ESPECIAIS
      { nome: 'Laranja c/ Morango 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja e Acerola 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'FRUTAS VERMELHAS COM LARANJA', categoria: 'SUCOS ESPECIAIS', preco: 14.90, descricao: 'Morango, Laranja e Amora 500ml + chorinho' },
      { nome: 'Abacaxi c/ Hortelã 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Morango c/ Maracujá 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Abacaxi c/ Limão 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Abacaxi c/ Gengibre 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja, Manga e Banana 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 14.90, descricao: '500ml + chorinho' },
      { nome: 'Abacaxi c/ Melancia 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Agua de Coco c/ Abacaxi e Hortelã 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 16.90, descricao: '500ml + chorinho' },
      { nome: 'Abacaxi c/ Uva 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Agua de Coco c/ Goiaba 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 16.90, descricao: '500ml + chorinho' },
      { nome: 'Coco Suíço 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 15.90, descricao: 'Preparado com leite e leite condensado' },
      { nome: 'LaraCreme 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 15.90, descricao: 'Suco de Laranja com Sorvete de Creme' },
      { nome: 'Laranja, Acerola e Mamão 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 14.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja, Acerola e Morango 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 14.90, descricao: '500ml + chorinho' },
      { nome: 'Agua de Coco c/ Mamão 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 16.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja, Acerola, Hortelã e Mel 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 15.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja c/ Abacaxi 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja c/ Cenoura 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja c/ Maracujá 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja c/ Mamão 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja c/ Manga 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'LaraCreme COM MORANGO 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 17.90, descricao: 'Suco de Laranja com Sorvete de Creme artesanal batido com morangos' },
      { nome: 'Laranja, Cenoura e Beterraba 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 14.90, descricao: '500ml + chorinho' },
      { nome: 'FRUTAS VERMELHAS - Amora com Morango', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: 'As frutas mais gostosas e doces em uma combinação perfeita' },
      { nome: 'Laranja c/ Goiaba 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja c/ Pêssego 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Laranjada Suíça 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 15.90, descricao: 'Laranja e Leite Condensado' },
      { nome: 'Laranja, Limão e Maracujá 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 14.90, descricao: '500ml + chorinho' },
      { nome: 'Laranja e Beterraba 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Limonada Suíça 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 15.90, descricao: 'Preparado com Leite e Leite Condensado' },
      { nome: 'Manga c/ Acerola 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Maracuja c/ Manga 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Melancia c/ Gengibre 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 13.90, descricao: '500ml + chorinho' },
      { nome: 'Melancia, Morango e Hortelã 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 14.90, descricao: '500ml + chorinho' },
      { nome: 'Maracujá 500ml + chorinho', categoria: 'SUCOS ESPECIAIS', preco: 11.90, descricao: '500ml + chorinho' }
    ];

    if (!usuarioAtual || perfilAtual !== 'gerente') {
      alert('❌ Apenas gerentes podem popular produtos. Faça login como gerente!');
      return;
    }

    let adicionados = 0;
    let erros = 0;

    for (const produto of produtosCompletos) {
      try {
        await db.collection('produtos').add({
          nome: produto.nome,
          preco: produto.preco,
          categoria: produto.categoria,
          descricao: produto.descricao || '',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        adicionados++;
      } catch (erro) {
        console.error('Erro ao adicionar', produto.nome, erro);
        erros++;
      }
    }

    mostrarToast(`✅ ${adicionados} produtos adicionados! ${erros > 0 ? `(${erros} erros)` : ''}`, 'sucesso');
    carregarProdutos(); // Recarrega a lista
  }

  // INSTRUÇÕES: No console do navegador (F12), execute: popularProdutosComDados()
