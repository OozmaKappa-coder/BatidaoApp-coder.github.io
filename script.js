/* =========================================================================
   BLOCO 1 – CONFIGURAÇÃO DO FIREBASE
   ========================================================================= */

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

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();


/* =========================================================================
   BLOCO 2 – ESTADO GLOBAL
   ========================================================================= */

let usuarioAtual = null;
let perfilAtual = null;
let dadosClienteAtual = null;

let carrinho = {};
let todosProdutos = [];
let todosPedidos = [];

let filtroAtivo = 'todos';
let unsubPedidos = null;

let perfilSelecionado = 'gerente';


/* =========================================================================
   BLOCO 3 – AUTENTICAÇÃO
   ========================================================================= */

auth.onAuthStateChanged(async (usuario) => {

  const loading = document.getElementById('tela-loading');

  if (loading) {
    loading.style.display = 'none';
  }

  if (usuario) {

    usuarioAtual = usuario;

    /*
     * Cliente utiliza autenticação anônima.
     * Não criamos documento em /usuarios para clientes.
     */
    if (usuario.isAnonymous) {

      perfilAtual = 'cliente';

      dadosClienteAtual =
        obterDadosClienteLocal();

    } else {

      try {

        await carregarPerfilUsuario(usuario.uid);

      } catch (erro) {

        console.error(
          'Erro ao carregar perfil:',
          erro
        );

        mostrarToast(
          'Não foi possível carregar o perfil.',
          'erro'
        );

        await auth.signOut();

        return;
      }
    }

    mostrarApp();

  } else {

    usuarioAtual = null;
    perfilAtual = null;

    const login =
      document.getElementById('tela-login');

    if (login) {
      login.style.display = 'flex';
    }

    const app =
      document.getElementById('app');

    if (app) {
      app.style.display = 'none';
    }

  }

});


/* =========================================================================
   BLOCO 4 – SELEÇÃO DE PERFIL
   ========================================================================= */

function selecionarPerfil(perfil) {

  perfilSelecionado = perfil;

  document
    .querySelectorAll('.tab-btn')
    .forEach(function (botao) {

      botao.classList.remove('ativo');

    });

  const tab =
    document.getElementById(
      'tab-' + perfil
    );

  if (tab) {
    tab.classList.add('ativo');
  }


  const formFuncionario =
    document.getElementById(
      'form-login-funcionario'
    );

  const formCliente =
    document.getElementById(
      'form-login-cliente'
    );

  const erro =
    document.getElementById(
      'erro-login'
    );


  if (erro) {

    erro.textContent = '';

    erro.style.display = 'none';

  }


  if (perfil === 'cliente') {

    if (formFuncionario) {
      formFuncionario.style.display =
        'none';
    }

    if (formCliente) {
      formCliente.style.display =
        'block';
    }


    const dados =
      obterDadosClienteLocal();

    if (dados) {

      const nome =
        document.getElementById(
          'cliente-login-nome'
        );

      const sobrenome =
        document.getElementById(
          'cliente-login-sobrenome'
        );

      const telefone =
        document.getElementById(
          'cliente-login-telefone'
        );


      if (nome) {
        nome.value =
          dados.nome || '';
      }

      if (sobrenome) {
        sobrenome.value =
          dados.sobrenome || '';
      }

      if (telefone) {
        telefone.value =
          dados.telefone || '';
      }

    }

  } else {

    if (formFuncionario) {
      formFuncionario.style.display =
        'block';
    }

    if (formCliente) {
      formCliente.style.display =
        'none';
    }

  }

}


/* =========================================================================
   BLOCO 5 – DADOS DO CLIENTE
   ========================================================================= */

function obterDadosClienteLocal() {

  try {

    return JSON.parse(
      localStorage.getItem(
        'batidao_cliente_perfil'
      ) || 'null'
    );

  } catch (erro) {

    console.error(
      'Erro ao ler cliente local:',
      erro
    );

    return null;

  }

}


function salvarDadosClienteLocal(dados) {

  dadosClienteAtual = dados;

  localStorage.setItem(
    'batidao_cliente_perfil',
    JSON.stringify(dados)
  );

}


function telefoneNormalizado(telefone) {

  return String(
    telefone || ''
  ).replace(/\D/g, '');

}


/* =========================================================================
   BLOCO 6 – ENTRADA DO CLIENTE
   ========================================================================= */

async function entrarComoCliente() {

  const nomeEl =
    document.getElementById(
      'cliente-login-nome'
    );

  const sobrenomeEl =
    document.getElementById(
      'cliente-login-sobrenome'
    );

  const telefoneEl =
    document.getElementById(
      'cliente-login-telefone'
    );

  const erroEl =
    document.getElementById(
      'erro-login'
    );


  const nome =
    nomeEl
      ? nomeEl.value.trim()
      : '';

  const sobrenome =
    sobrenomeEl
      ? sobrenomeEl.value.trim()
      : '';

  const telefone =
    telefoneEl
      ? telefoneEl.value.trim()
      : '';

  const telefoneNormal =
    telefoneNormalizado(
      telefone
    );


  if (erroEl) {

    erroEl.textContent = '';

    erroEl.style.display =
      'none';

  }


  if (
    !nome ||
    !sobrenome ||
    !telefone
  ) {

    if (erroEl) {

      erroEl.textContent =
        'Preencha nome, sobrenome e telefone.';

      erroEl.style.display =
        'block';

    }

    return;

  }


  if (telefoneNormal.length < 10) {

    if (erroEl) {

      erroEl.textContent =
        'Digite um telefone válido com DDD.';

      erroEl.style.display =
        'block';

    }

    return;

  }


  const dados = {

    nome: nome,

    sobrenome: sobrenome,

    telefone: telefone,

    telefoneNormalizado:
      telefoneNormal

  };


  salvarDadosClienteLocal(
    dados
  );


  try {

    let usuario =
      auth.currentUser;


    /*
     * Se um funcionário estiver conectado,
     * encerra a sessão antes de entrar como cliente.
     */
    if (
      usuario &&
      !usuario.isAnonymous
    ) {

      await auth.signOut();

      usuario = null;

    }


    /*
     * Reutiliza a sessão anônima se ela já existir.
     */
    if (!usuario) {

      const resultado =
        await auth.signInAnonymously();

      usuario =
        resultado.user;

    }


    if (!usuario) {

      throw new Error(
        'O Firebase não retornou um usuário.'
      );

    }


    usuarioAtual =
      usuario;

    perfilAtual =
      'cliente';

    dadosClienteAtual =
      dados;


    mostrarApp();


  } catch (erro) {

    console.error(
      'Erro ao entrar como cliente:',
      erro
    );


    let mensagem =
      'Não foi possível entrar como cliente.';


    if (
      erro.code ===
      'auth/operation-not-allowed'
    ) {

      mensagem =
        'Ative o login Anônimo no Firebase Authentication.';

    } else if (
      erro.code ===
      'auth/network-request-failed'
    ) {

      mensagem =
        'Sem conexão com a internet.';

    } else if (
      erro.code ===
      'auth/admin-restricted-operation'
    ) {

      mensagem =
        'O login Anônimo está bloqueado no Firebase.';

    } else if (
      erro.code ===
      'auth/too-many-requests'
    ) {

      mensagem =
        'Muitas tentativas. Aguarde um pouco e tente novamente.';

    } else if (
      erro.message
    ) {

      mensagem +=
        ' ' + erro.message;

    }


    if (erroEl) {

      erroEl.textContent =
        mensagem;

      erroEl.style.display =
        'block';

    }

  }

}


/* =========================================================================
   BLOCO 7 – LOGIN DE GERENTE / ATENDENTE
   ========================================================================= */

async function fazerLogin() {

  const emailEl =
    document.getElementById(
      'input-email'
    );

  const senhaEl =
    document.getElementById(
      'input-senha'
    );

  const erroEl =
    document.getElementById(
      'erro-login'
    );


  const email =
    emailEl
      ? emailEl.value.trim()
      : '';

  const senha =
    senhaEl
      ? senhaEl.value.trim()
      : '';


  if (erroEl) {

    erroEl.textContent = '';

    erroEl.style.display =
      'none';

  }


  if (!email || !senha) {

    if (erroEl) {

      erroEl.textContent =
        'Preencha e-mail e senha.';

      erroEl.style.display =
        'block';

    }

    return;

  }


  try {

    /*
     * Caso exista uma sessão anônima,
     * ela é encerrada antes do login de funcionário.
     */
    if (
      auth.currentUser &&
      auth.currentUser.isAnonymous
    ) {

      await auth.signOut();

    }


    await auth.signInWithEmailAndPassword(
      email,
      senha
    );


  } catch (erro) {

    console.error(
      'Erro Firebase:',
      erro.code,
      erro.message
    );


    let mensagem =
      'Erro ao entrar.';


    switch (erro.code) {

      case 'auth/user-not-found':
        mensagem =
          'Usuário não encontrado.';
        break;

      case 'auth/wrong-password':
        mensagem =
          'Senha incorreta.';
        break;

      case 'auth/invalid-login-credentials':
        mensagem =
          'E-mail ou senha incorretos.';
        break;

      case 'auth/invalid-email':
        mensagem =
          'E-mail inválido.';
        break;

      case 'auth/too-many-requests':
        mensagem =
          'Muitas tentativas. Aguarde um pouco.';
        break;

      case 'auth/network-request-failed':
        mensagem =
          'Verifique sua conexão com a internet.';
        break;

      default:

        if (erro.message) {
          mensagem +=
            ' ' + erro.message;
        }

    }


    if (erroEl) {

      erroEl.textContent =
        mensagem;

      erroEl.style.display =
        'block';

    }

  }

}


/* =========================================================================
   BLOCO 8 – LOGOUT
   ========================================================================= */

async function fazerLogout() {

  try {

    if (unsubPedidos) {

      unsubPedidos();

      unsubPedidos = null;

    }


    await auth.signOut();

    usuarioAtual = null;

    perfilAtual = null;

    dadosClienteAtual = null;

    carrinho = {};

    const app =
      document.getElementById(
        'app'
      );

    const login =
      document.getElementById(
        'tela-login'
      );


    if (app) {
      app.style.display =
        'none';
    }

    if (login) {
      login.style.display =
        'flex';
    }


    selecionarPerfil(
      'gerente'
    );


  } catch (erro) {

    console.error(
      'Erro ao sair:',
      erro
    );

  }

}


/* =========================================================================
   BLOCO 9 – PERFIL DO FUNCIONÁRIO
   ========================================================================= */

async function carregarPerfilUsuario(uid) {

  const referencia =
    db
      .collection('usuarios')
      .doc(uid);


  const snap =
    await referencia.get();


  if (snap.exists) {

    const dados =
      snap.data();


    perfilAtual =
      dados.perfil ||
      perfilSelecionado ||
      'atendente';


    /*
     * Nunca transforma usuário anônimo em funcionário.
     */
    if (
      usuarioAtual &&
      usuarioAtual.isAnonymous
    ) {

      perfilAtual =
        'cliente';

    }


    return;

  }


  /*
   * Se não existe perfil e o usuário é anônimo,
   * não tenta criar /usuarios.
   */
  if (
    usuarioAtual &&
    usuarioAtual.isAnonymous
  ) {

    perfilAtual =
      'cliente';

    dadosClienteAtual =
      obterDadosClienteLocal();

    return;

  }


  /*
   * Para funcionários antigos que ainda não possuem
   * documento em /usuarios.
   */
  perfilAtual =
    perfilSelecionado === 'gerente'
      ? 'gerente'
      : 'atendente';


  await referencia.set({

    email:
      usuarioAtual?.email || '',

    perfil:
      perfilAtual,

    criadoEm:
      firebase.firestore.FieldValue.serverTimestamp()

  });

}


/* =========================================================================
   BLOCO 10 – MOSTRAR APLICAÇÃO
   ========================================================================= */

function mostrarApp() {

  const login =
    document.getElementById(
      'tela-login'
    );

  const app =
    document.getElementById(
      'app'
    );


  if (login) {
    login.style.display =
      'none';
  }

  if (app) {
    app.style.display =
      'flex';
  }


  const badge =
    document.getElementById(
      'badge-perfil'
    );


  if (badge) {

    if (perfilAtual === 'cliente') {

      badge.textContent =
        '👤 Cliente';

    } else if (
      perfilAtual === 'gerente'
    ) {

      badge.textContent =
        '👔 Gerente';

    } else {

      badge.textContent =
        '🧃 Atendente';

    }

    badge.className =
      'badge-perfil badge-' +
      perfilAtual;

  }


  /*
   * Restaura a navegação antes de aplicar
   * as restrições do cliente.
   */
  [
    'nav-acompanhamento',
    'nav-cardapio',
    'nav-clientes',
    'nav-relatorios',
    'nav-config'
  ].forEach(function(id) {

    const elemento =
      document.getElementById(id);

    if (elemento) {
      elemento.style.display =
        '';
    }

  });


  /*
   * CLIENTE:
   * pode fazer pedido,
   * mas não pode acessar informações internas.
   */
  if (
    perfilAtual === 'cliente'
  ) {

    [
      'nav-acompanhamento',
      'nav-cardapio',
      'nav-clientes',
      'nav-relatorios',
      'nav-config'
    ].forEach(function(id) {

      const elemento =
        document.getElementById(id);

      if (elemento) {
        elemento.style.display =
          'none';
      }

    });


    const campoMesa =
      document.getElementById(
        'campo-mesa'
      );

    const campoEndereco =
      document.getElementById(
        'campo-endereco-entrega'
      );


    if (campoMesa) {
      campoMesa.style.display =
        'none';
    }

    if (campoEndereco) {
      campoEndereco.style.display =
        'block';
    }


    const nomeCliente =
      document.getElementById(
        'np-cliente'
      );


    if (nomeCliente) {

      nomeCliente.value =
        (
          (dadosClienteAtual?.nome || '') +
          ' ' +
          (dadosClienteAtual?.sobrenome || '')
        ).trim();

      nomeCliente.readOnly =
        true;

    }


    const mesa =
      document.getElementById(
        'np-mesa'
      );

    if (mesa) {
      mesa.value =
        'Delivery';
    }


  } else {

    const campoMesa =
      document.getElementById(
        'campo-mesa'
      );

    const campoEndereco =
      document.getElementById(
        'campo-endereco-entrega'
      );


    if (campoMesa) {
      campoMesa.style.display =
        'block';
    }

    if (campoEndereco) {
      campoEndereco.style.display =
        'none';
    }


    const nomeCliente =
      document.getElementById(
        'np-cliente'
      );

    if (nomeCliente) {
      nomeCliente.readOnly =
        false;
    }

  }


  carregarProdutos();


  /*
   * Somente funcionários recebem
   * todos os pedidos e clientes.
   */
  if (
    perfilAtual !== 'cliente'
  ) {

    escutarPedidos();

    carregarClientes();

  }

}

  /* =========================================================================
     BLOCO 8 – CARDÁPIO / PRODUTOS (RF9, RNF4)
     Carrega e gerencia produtos no Firestore
     ========================================================================= */

  function carregarProdutos() {
    db.collection('produtos')
      .orderBy('categoria')
      .onSnapshot(snap => {
        todosProdutos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        renderizarMenuPedido();
      }, erro => {
        console.error('❌ Erro ao carregar cardápio:', erro.code, erro.message);

        if (erro.code === 'permission-denied') {
          mostrarToast(
            'O Firebase bloqueou a leitura do cardápio. Verifique as regras do Firestore.',
            'erro'
          );
        } else {
          mostrarToast('Não foi possível carregar o cardápio.', 'erro');
        }
      });
  }

  function getImagemProduto(nome, categoria, imagemCampo) {
    if (imagemCampo) {
      const src = imagemCampo.startsWith('data:')
        ? imagemCampo
        : 'img/' + imagemCampo;

      const nomeEsc = (nome || '').replace(/"/g, '&quot;');

      return '<img src="' + src + '" alt="' + nomeEsc +
        '" style="width:100%;height:100%;object-fit:cover;border-radius:10px" ' +
        'onerror="this.style.display=\'none\'">';
    }

    return getEmojiProduto(nome, categoria);
  }

  function getEmojiProduto(nome, categoria) {
    const n = (nome || '').toLowerCase();
    const c = (categoria || '').toLowerCase();

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

    if (n.includes('linguiça') || n.includes('linguica')) return '🌭';
    if (n.includes('frango')) return '🥙';
    if (n.includes('pernil')) return '🥩';
    if (n.includes('carne louca')) return '🥩';
    if (n.includes('misto quente')) return '🥪';
    if (n.includes('ovo')) return '🍳';
    if (n.includes('salada')) return '🥗';
    if (n.includes('sanduíche') || n.includes('sanduiche')) return '🥪';

    if (c.includes('combo')) return '🎯';

    if (c.includes('suco')) return '🥤';
    if (c.includes('lanche')) return '🥪';
    if (c.includes('salada')) return '🥗';
    if (c.includes('bebida')) return '🧃';
    if (c.includes('adicional')) return '➕';

    return '🍽️';
  }

  function renderCardProduto(p) {
    const qtd = carrinho[p.id]?.qtd || 0;
    const imgConteudo = getImagemProduto(
      p.nome,
      p.categoria,
      p.imagem || ''
    );

    return `
      <div class="produto-item ${qtd > 0 ? 'selecionado' : ''}"
           id="prod-${p.id}"
           onclick="abrirModalAdicionais('${p.id}')">

        <div class="produto-img-wrap">
          ${imgConteudo}
        </div>

        <div class="produto-info-col">
          <div class="produto-nome">${p.nome}</div>

          ${
            p.descricao
              ? '<div style="font-size:0.75rem;color:var(--texto-2);margin-top:2px;line-height:1.3">' +
                p.descricao +
                '</div>'
              : ''
          }
        </div>

        <div class="produto-direita">
          ${
            p.promocao
              ? '<span class="badge-promo">PROMO</span>'
              : ''
          }

          <span class="produto-preco">
            R$ ${Number(p.preco).toFixed(2)}
          </span>

          ${
            qtd > 0
              ? '<span style="font-size:0.75rem;color:var(--verde);font-weight:700;background:var(--verde-bg);padding:2px 7px;border-radius:20px">' +
                qtd +
                'x</span>'
              : ''
          }
        </div>
      </div>
    `;
  }

  function renderizarMenuPedido() {
    const container = document.getElementById('menu-container');

    if (!container) return;

    if (todosProdutos.length === 0) {
      container.innerHTML =
        '<div class="empty">' +
        '<div class="empty-icon">🍹</div>' +
        '<div class="empty-msg">Nenhum produto no cardápio.<br>' +
        (
          perfilAtual === 'gerente'
            ? 'Vá em Cardápio para adicionar.'
            : 'Aguarde o gerente adicionar produtos.'
        ) +
        '</div></div>';

      return;
    }

    let html = '';

    const maisPedidos = todosProdutos.filter(function(p) {
      return p.maisVendido;
    });

    if (maisPedidos.length > 0) {
      html +=
        '<div class="secao-destaque-titulo">⭐ Os Mais Pedidos</div>' +
        '<div class="scroll-horizontal">';

      maisPedidos.forEach(function(p) {
        const imgConteudo = getImagemProduto(
          p.nome,
          p.categoria,
          p.imagem || ''
        );

        const qtd = carrinho[p.id]
          ? carrinho[p.id].qtd
          : 0;

        html +=
          '<div class="card-destaque ' +
          (qtd > 0 ? 'selecionado' : '') +
          '" onclick="abrirModalAdicionais(\'' +
          p.id +
          '\')">' +

          '<div class="card-destaque-img">' +
          imgConteudo +
          '</div>' +

          '<div class="card-destaque-nome">' +
          p.nome +
          '</div>' +

          '<div class="card-destaque-preco">R$ ' +
          Number(p.preco).toFixed(2) +
          '</div>' +

          '</div>';
      });

      html += '</div>';
    }

    const promocoes = todosProdutos.filter(function(p) {
      return p.promocao;
    });

    if (promocoes.length > 0) {
      html +=
        '<div class="secao-destaque-titulo">🔥 Promoções</div>' +
        '<div class="scroll-horizontal">';

      promocoes.forEach(function(p) {
        const imgConteudo = getImagemProduto(
          p.nome,
          p.categoria,
          p.imagem || ''
        );

        html +=
          '<div class="card-destaque" onclick="abrirModalAdicionais(\'' +
          p.id +
          '\')">' +

          '<div class="card-destaque-img">' +
          imgConteudo +
          '</div>' +

          '<div class="card-destaque-nome">' +
          p.nome +
          '</div>' +

          '<div class="card-destaque-preco">R$ ' +
          Number(p.preco).toFixed(2) +
          '</div>' +

          '</div>';
      });

      html += '</div>';
    }

    const categorias = {};

    todosProdutos.forEach(function(p) {
      if (!categorias[p.categoria]) {
        categorias[p.categoria] = [];
      }

      categorias[p.categoria].push(p);
    });

    Object.keys(categorias).forEach(function(categoria) {
      html +=
        '<div class="categoria-titulo">' +
        iconCategoria(categoria) +
        ' ' +
        categoria +
        '</div>';

      html += categorias[categoria]
        .map(function(p) {
          return renderCardProduto(p);
        })
        .join('');
    });

    container.innerHTML = html;
  }

  function iconCategoria(categoria) {
    const c = (categoria || '').toLowerCase();

    if (c.includes('suco')) return '🥤';
    if (c.includes('lanche')) return '🥪';
    if (c.includes('combo')) return '🎯';
    if (c.includes('salada')) return '🥗';
    if (c.includes('bebida')) return '🧃';
    if (c.includes('adicional')) return '➕';

    return '🍽️';
  }

  function escapeJS(texto) {
    return String(texto || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  function renderizarProdutosAdmin() {
    const container = document.getElementById('lista-produtos-admin');

    if (!container) return;

    if (todosProdutos.length === 0) {
      container.innerHTML =
        '<div class="empty">' +
        '<div class="empty-icon">🍽️</div>' +
        '<div class="empty-msg">Nenhum produto cadastrado.</div>' +
        '</div>';

      return;
    }

    container.innerHTML = todosProdutos.map(function(p) {
      return `
        <div class="produto-admin-item">

          <div class="produto-admin-img">
            ${getImagemProduto(p.nome, p.categoria, p.imagem || '')}
          </div>

          <div class="produto-admin-info">
            <div class="produto-admin-nome">
              ${p.nome}
            </div>

            <div class="produto-admin-cat">
              ${p.categoria}
            </div>

            <div class="produto-admin-preco">
              R$ ${Number(p.preco).toFixed(2)}
            </div>
          </div>

          <div class="produto-admin-acoes">
            <button
              class="btn-sm"
              onclick='editarProduto(${JSON.stringify(p)})'>
              ✏️
            </button>

            <button
              class="btn-sm-vermelho"
              onclick="excluirProduto('${p.id}','${escapeJS(p.nome)}')">
              🗑️
            </button>
          </div>

        </div>
      `;
    }).join('');
  }

  function abrirModalProduto() {
    document.getElementById('modal-produto-titulo').textContent =
      '+ Novo Produto';

    document.getElementById('prod-id').value = '';
    document.getElementById('prod-nome').value = '';
    document.getElementById('prod-categoria').value = '';
    document.getElementById('prod-preco').value = '';
    document.getElementById('prod-desc').value = '';
    document.getElementById('prod-imagem').value = '';

    document.getElementById('prod-mais-vendido').checked = false;
    document.getElementById('prod-promocao').checked = false;

    const preview = document.getElementById('prod-img-preview');

    if (preview) {
      preview.innerHTML = '🖼️';
    }

    const manualEl =
      document.getElementById('prod-imagem-manual');

    if (manualEl) {
      manualEl.value = '';
    }

    const fileEl =
      document.getElementById('prod-imagem-file');

    if (fileEl) {
      fileEl.value = '';
    }

    document.getElementById(
      'btn-gerenciar-adicionais'
    ).style.display = 'none';

    document.getElementById(
      'modal-produto'
    ).classList.add('aberto');
  }

  function editarProduto(p) {
    document.getElementById('modal-produto-titulo').textContent =
      '✏️ Editar Produto';

    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-nome').value = p.nome;
    document.getElementById('prod-categoria').value = p.categoria;
    document.getElementById('prod-preco').value = p.preco;
    document.getElementById('prod-desc').value = p.descricao || '';
    document.getElementById('prod-imagem').value = p.imagem || '';

    document.getElementById('prod-mais-vendido').checked =
      p.maisVendido || false;

    document.getElementById('prod-promocao').checked =
      p.promocao || false;

    const preview =
      document.getElementById('prod-img-preview');

    const manualEl =
      document.getElementById('prod-imagem-manual');

    if (manualEl) {
      manualEl.value =
        p.imagem && !p.imagem.startsWith('data:')
          ? p.imagem
          : '';
    }

    if (preview) {
      if (p.imagem) {
        const src =
          p.imagem.startsWith('data:')
            ? p.imagem
            : 'img/' + p.imagem;

        preview.innerHTML =
          '<img src="' +
          src +
          '" style="width:100%;height:100%;object-fit:cover;border-radius:8px" ' +
          'onerror="this.parentElement.innerHTML=\'❌\'">';
      } else {
        preview.innerHTML = '🖼️';
      }
    }

    document.getElementById(
      'btn-gerenciar-adicionais'
    ).style.display = 'block';

    document.getElementById(
      'modal-produto'
    ).classList.add('aberto');
  }

  function previewImagemProduto(input) {
    const file = input.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {
      const base64 = e.target.result;

      document.getElementById(
        'prod-imagem'
      ).value = base64;

      const preview =
        document.getElementById('prod-img-preview');

      if (preview) {
        preview.innerHTML =
          '<img src="' +
          base64 +
          '" style="width:100%;height:100%;object-fit:cover;border-radius:8px">';
      }
    };

    reader.readAsDataURL(file);
  }

  function previewImagemManual(valor) {
    const nome = (valor || '').trim();

    document.getElementById(
      'prod-imagem'
    ).value = nome;

    const preview =
      document.getElementById('prod-img-preview');

    if (!preview) return;

    if (nome) {
      preview.innerHTML =
        '<img src="img/' +
        nome +
        '" style="width:100%;height:100%;object-fit:cover;border-radius:8px" ' +
        'onerror="this.parentElement.innerHTML=\'❌\'">';
    } else {
      preview.innerHTML = '🖼️';
    }
  }

  async function salvarProduto() {
    const id =
      document.getElementById('prod-id').value;

    const nome =
      document.getElementById('prod-nome').value.trim();

    const categoria =
      document.getElementById('prod-categoria').value.trim();

    const preco =
      parseFloat(
        document.getElementById('prod-preco').value
      );

    const descricao =
      document.getElementById('prod-desc').value.trim();

    const imagem =
      document.getElementById('prod-imagem').value.trim();

    const maisVendido =
      document.getElementById('prod-mais-vendido').checked;

    const promocao =
      document.getElementById('prod-promocao').checked;

    if (!nome || !categoria || isNaN(preco)) {
      mostrarToast(
        'Preencha nome, categoria e preço.',
        'erro'
      );
      return;
    }

    const dados = {
      nome,
      categoria,
      preco,
      descricao,
      imagem,
      maisVendido,
      promocao,
      atualizadoEm:
        firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (id) {
        await db
          .collection('produtos')
          .doc(id)
          .update(dados);

        mostrarToast('Produto atualizado!');
      } else {
        dados.criadoEm =
          firebase.firestore.FieldValue.serverTimestamp();

        await db
          .collection('produtos')
          .add(dados);

        mostrarToast('Produto adicionado!');
      }

      fecharModal('modal-produto');

    } catch (erro) {
      console.error(erro);

      mostrarToast(
        'Não foi possível salvar o produto.',
        'erro'
      );
    }
  }

  async function excluirProduto(id, nome) {
    if (!confirm(`Excluir "${nome}"?`)) return;

    try {
      await db
        .collection('produtos')
        .doc(id)
        .delete();

      mostrarToast('Produto removido.');

    } catch (erro) {
      console.error(erro);
      mostrarToast(
        'Não foi possível excluir o produto.',
        'erro'
      );
    }
  }

  /* =========================================================================
     BLOCO 8.5 – GERENCIAMENTO DE ADICIONAIS
     ========================================================================= */

  let produtoAtualGerenciando = null;

  function abrirModalAdicionaisProduto() {
    const prodId =
      document.getElementById('prod-id').value;

    const prodNome =
      document.getElementById('prod-nome').value;

    if (!prodId) {
      mostrarToast(
        'Salve o produto primeiro.',
        'erro'
      );
      return;
    }

    produtoAtualGerenciando =
      todosProdutos.find(p => p.id === prodId);

    if (!produtoAtualGerenciando) return;

    document.getElementById(
      'modal-adic-prod-nome'
    ).textContent = prodNome;

    document.getElementById('adic-id').value = '';
    document.getElementById('adic-nome').value = '';
    document.getElementById('adic-preco').value = '';

    document.getElementById(
      'form-adicional'
    ).style.display = 'none';

    renderizarAdicionaisProduto();

    document.getElementById(
      'modal-adicionais-gerenciar'
    ).classList.add('aberto');
  }

  function renderizarAdicionaisProduto() {
    const container =
      document.getElementById(
        'lista-adicionais-produto'
      );

    if (
      !produtoAtualGerenciando?.adicionais ||
      produtoAtualGerenciando.adicionais.length === 0
    ) {
      container.innerHTML = `
        <div class="empty" style="padding:20px 0">
          <div class="empty-icon">✨</div>
          <div class="empty-msg">
            Nenhum adicional cadastrado
          </div>
        </div>
      `;

      return;
    }

    let html = '';

    produtoAtualGerenciando.adicionais.forEach(adic => {
      html += `
        <div style="
          padding:12px;
          background:var(--superficie);
          border-radius:var(--raio-sm);
          margin-bottom:8px;
          display:flex;
          justify-content:space-between;
          align-items:center">

          <div>
            <div style="font-weight:500">
              ${adic.nome}
            </div>

            <div style="
              color:var(--laranja);
              font-size:0.9rem">
              R$ ${Number(adic.preco).toFixed(2)}
            </div>
          </div>

          <div style="display:flex;gap:8px">

            <button
              class="btn-sm"
              onclick="editarAdicional(
                '${adic.id}',
                '${escapeJS(adic.nome)}',
                ${adic.preco}
              )">
              ✏️
            </button>

            <button
              class="btn-sm-vermelho"
              onclick="excluirAdicional(
                '${adic.id}',
                '${escapeJS(adic.nome)}'
              )">
              🗑️
            </button>

          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function abrirFormAdicional() {
    document.getElementById('adic-id').value = '';
    document.getElementById('adic-nome').value = '';
    document.getElementById('adic-preco').value = '';

    document.getElementById(
      'form-adicional'
    ).style.display = 'block';
  }

  function cancelarFormAdicional() {
    document.getElementById(
      'form-adicional'
    ).style.display = 'none';
  }

  function editarAdicional(id, nome, preco) {
    document.getElementById('adic-id').value = id;
    document.getElementById('adic-nome').value = nome;
    document.getElementById('adic-preco').value = preco;

    document.getElementById(
      'form-adicional'
    ).style.display = 'block';
  }

  async function salvarAdicional() {
    const adicId =
      document.getElementById('adic-id').value;

    const nome =
      document.getElementById('adic-nome').value.trim();

    const preco =
      parseFloat(
        document.getElementById('adic-preco').value
      );

    if (!nome || isNaN(preco)) {
      mostrarToast(
        'Preencha nome e preço.',
        'erro'
      );
      return;
    }

    if (!produtoAtualGerenciando) return;

    if (!adicId) {
      const novoId =
        'adic_' + Date.now();

      if (!produtoAtualGerenciando.adicionais) {
        produtoAtualGerenciando.adicionais = [];
      }

      produtoAtualGerenciando.adicionais.push({
        id: novoId,
        nome,
        preco
      });

    } else {
      const adic =
        produtoAtualGerenciando.adicionais.find(
          a => a.id === adicId
        );

      if (adic) {
        adic.nome = nome;
        adic.preco = preco;
      }
    }

    try {
      await db
        .collection('produtos')
        .doc(produtoAtualGerenciando.id)
        .update({
          adicionais:
            produtoAtualGerenciando.adicionais
        });

      mostrarToast('✅ Adicional salvo!');

      document.getElementById(
        'form-adicional'
      ).style.display = 'none';

      renderizarAdicionaisProduto();

    } catch (erro) {
      console.error(erro);

      mostrarToast(
        'Erro ao salvar adicional.',
        'erro'
      );
    }
  }

  async function excluirAdicional(id, nome) {
    if (
      !confirm(
        `Excluir adicional "${nome}"?`
      )
    ) return;

    if (!produtoAtualGerenciando) return;

    produtoAtualGerenciando.adicionais =
      produtoAtualGerenciando.adicionais.filter(
        a => a.id !== id
      );

    try {
      await db
        .collection('produtos')
        .doc(produtoAtualGerenciando.id)
        .update({
          adicionais:
            produtoAtualGerenciando.adicionais
        });

      mostrarToast(
        '✅ Adicional removido!'
      );

      renderizarAdicionaisProduto();

    } catch (erro) {
      console.error(erro);

      mostrarToast(
        'Erro ao remover adicional.',
        'erro'
      );
    }
  }

  /* =========================================================================
     BLOCO 9 – CARRINHO DE COMPRAS
     ========================================================================= */

  function alterarQtd(id, nome, preco, delta) {
    if (!carrinho[id]) {
      carrinho[id] = {
        nome,
        preco,
        qtd: 0
      };
    }

    carrinho[id].qtd += delta;

    if (carrinho[id].qtd <= 0) {
      delete carrinho[id];
    }

    const el =
      document.getElementById('qty-' + id);

    if (el) {
      el.textContent =
        carrinho[id]?.qtd || 0;
    }

    const prodEl =
      document.getElementById('prod-' + id);

    if (prodEl) {
      prodEl.classList.toggle(
        'selecionado',
        !!carrinho[id]
      );
    }

    atualizarBarraCarrinho();
  }

  function atualizarBarraCarrinho() {
    const itens =
      Object.values(carrinho);

    const qtdTotal =
      itens.reduce(
        (acc, i) => acc + i.qtd,
        0
      );

    const total =
      itens.reduce(
        (acc, i) =>
          acc + i.preco * i.qtd,
        0
      );

    const barra =
      document.getElementById(
        'carrinho-bar'
      );

    if (!barra) return;

    if (qtdTotal > 0) {
      barra.style.display = 'flex';

      document.getElementById(
        'carrinho-qtd'
      ).textContent =
        qtdTotal +
        (qtdTotal === 1
          ? ' item'
          : ' itens');

      document.getElementById(
        'carrinho-total-bar'
      ).textContent =
        'R$ ' + total.toFixed(2);

    } else {
      barra.style.display = 'none';
    }
  }

  function abrirModalCarrinho() {
    const itens =
      Object.values(carrinho);

    let html = '';
    let total = 0;

    itens.forEach(i => {
      const sub =
        i.preco * i.qtd;

      let subAdicionais = 0;
      let htmlAdicionais = '';

      if (
        i.adicionais &&
        i.adicionais.length > 0
      ) {
        htmlAdicionais +=
          '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--borda)">';

        i.adicionais.forEach(adic => {
          const subAdicional =
            adic.preco * adic.qtd;

          subAdicionais +=
            subAdicional;

          htmlAdicionais += `
            <div style="
              font-size:0.85rem;
              color:var(--texto-2);
              display:flex;
              justify-content:space-between;
              margin-bottom:4px">

              <span>
                + ${adic.qtd}× ${adic.nome}
              </span>

              <span>
                R$ ${subAdicional.toFixed(2)}
              </span>

            </div>
          `;
        });

        htmlAdicionais +=
          '</div>';
      }

      const htmlObs =
        i.observacoes
          ? `
            <div style="
              margin-top:8px;
              font-size:0.8rem;
              color:var(--texto-2);
              font-style:italic">
              📝 ${i.observacoes}
            </div>
          `
          : '';

      total +=
        sub + subAdicionais;

      html += `
        <div class="relatorio-item"
             style="
               margin-bottom:12px;
               padding-bottom:12px;
               border-bottom:1px solid var(--borda)">

          <div style="
            display:flex;
            justify-content:space-between">

            <span>
              ${i.qtd}× ${i.nome}
            </span>

            <span class="relatorio-valor">
              R$ ${sub.toFixed(2)}
            </span>

          </div>

          ${htmlAdicionais}
          ${htmlObs}

        </div>
      `;
    });

    document.getElementById(
      'modal-carrinho-itens'
    ).innerHTML = html;

    document.getElementById(
      'modal-total'
    ).textContent =
      'R$ ' + total.toFixed(2);

    document.getElementById(
      'modal-carrinho'
    ).classList.add('aberto');
  }

  /* =========================================================================
     BLOCO 10 – PEDIDOS
     ========================================================================= */

  async function confirmarPedido() {
    const cliente =
      document.getElementById(
        'np-cliente'
      ).value.trim();

    const mesa =
      document.getElementById(
        'np-mesa'
      ).value.trim();

    const pagamento =
      document.getElementById(
        'np-pagamento'
      ).value;

    const obs =
      document.getElementById(
        'np-obs'
      ).value.trim();

    const enderecoEl =
      document.getElementById(
        'np-endereco'
      );

    const enderecoEntrega =
      enderecoEl
        ? enderecoEl.value.trim()
        : '';

    const itens =
      Object.values(carrinho);

    if (itens.length === 0) {
      mostrarToast(
        'Adicione pelo menos um produto.',
        'erro'
      );
      return;
    }

    if (
      perfilAtual === 'cliente' &&
      !enderecoEntrega
    ) {
      mostrarToast(
        'Informe o endereço de entrega.',
        'erro'
      );

      if (enderecoEl) {
        enderecoEl.focus();
      }

      return;
    }

    const total =
      itens.reduce(
        (acc, i) => {
          let subItem =
            i.preco * i.qtd;

          if (
            i.adicionais &&
            i.adicionais.length > 0
          ) {
            i.adicionais.forEach(
              adic => {
                subItem +=
                  adic.preco *
                  adic.qtd;
              }
            );
          }

          return acc + subItem;
        },
        0
      );

    const pedido = {
      cliente:
        cliente || 'Cliente',

      mesa:
        perfilAtual === 'cliente'
          ? 'Delivery'
          : (mesa || '—'),

      pagamento,
      obs,

      enderecoEntrega:
        perfilAtual === 'cliente'
          ? enderecoEntrega
          : '',

      itens,
      total,

      status:
        'aguardando',

      origem:
        perfilAtual === 'cliente'
          ? 'cliente'
          : 'atendente',

      clienteUid:
        perfilAtual === 'cliente'
          ? (usuarioAtual?.uid || '')
          : '',

      clienteNome:
        perfilAtual === 'cliente'
          ? (dadosClienteAtual?.nome || '')
          : '',

      clienteSobrenome:
        perfilAtual === 'cliente'
          ? (dadosClienteAtual?.sobrenome || '')
          : '',

      clienteTelefone:
        perfilAtual === 'cliente'
          ? (dadosClienteAtual?.telefone || '')
          : '',

      clienteTelefoneNormalizado:
        perfilAtual === 'cliente'
          ? (
              dadosClienteAtual?.telefoneNormalizado ||
              telefoneNormalizado(
                dadosClienteAtual?.telefone
              )
            )
          : '',

      atendente:
        perfilAtual === 'cliente'
          ? 'Cliente'
          : (
              usuarioAtual?.email ||
              'Atendente'
            ),

      criadoEm:
        firebase.firestore.FieldValue
          .serverTimestamp()
    };

    try {

      if (
        perfilAtual === 'cliente' &&
        usuarioAtual
      ) {
        const telefoneId =
          pedido.clienteTelefoneNormalizado ||
          usuarioAtual.uid;

        await db
          .collection('clientes')
          .doc(telefoneId)
          .set(
            {
              nome:
                pedido.clienteNome,

              sobrenome:
                pedido.clienteSobrenome,

              telefone:
                pedido.clienteTelefone,

              telefoneNormalizado:
                pedido.clienteTelefoneNormalizado,

              uidCliente:
                usuarioAtual.uid,

              enderecos:
                firebase.firestore.FieldValue
                  .arrayUnion(
                    enderecoEntrega
                  ),

              atualizadoEm:
                firebase.firestore.FieldValue
                  .serverTimestamp()

            },
            {
              merge: true
            }
          );
      }

      const ref =
        await db
          .collection('pedidos')
          .add(pedido);

      if (
        perfilAtual !== 'cliente'
      ) {
        exibirComprovante({
          id: ref.id,
          ...pedido
        });
      }

      limparFormularioPedido();

      fecharModal(
        'modal-carrinho'
      );

      mostrarToast(
        '✅ Pedido enviado para a cozinha!'
      );

    } catch (erro) {

      console.error(
        '❌ Erro ao enviar pedido:',
        erro.code,
        erro.message,
        erro
      );

      let msg =
        'Não foi possível enviar o pedido.';

      if (
        erro.code ===
        'permission-denied'
      ) {
        msg =
          'O Firebase bloqueou este pedido. É necessário atualizar as regras do Firestore para clientes.';
      } else if (
        erro.code ===
        'unavailable'
      ) {
        msg =
          'Firestore temporariamente indisponível. Verifique a internet.';
      }

      mostrarToast(
        msg,
        'erro'
      );
    }
  }

  function limparFormularioPedido() {
    const nomeCliente =
      document.getElementById(
        'np-cliente'
      );

    const mesa =
      document.getElementById(
        'np-mesa'
      );

    const endereco =
      document.getElementById(
        'np-endereco'
      );

    const obs =
      document.getElementById(
        'np-obs'
      );

    if (
      perfilAtual === 'cliente'
    ) {
      if (nomeCliente) {
        nomeCliente.value =
          (
            (dadosClienteAtual?.nome || '') +
            ' ' +
            (dadosClienteAtual?.sobrenome || '')
          ).trim();
      }

      if (mesa) {
        mesa.value = 'Delivery';
      }

      if (endereco) {
        endereco.value = '';
      }

    } else {

      if (nomeCliente) {
        nomeCliente.value = '';
      }

      if (mesa) {
        mesa.value = '';
      }
    }

    if (obs) {
      obs.value = '';
    }

    carrinho = {};

    document
      .querySelectorAll('.qty-num')
      .forEach(
        el => el.textContent = '0'
      );

    document
      .querySelectorAll('.produto-item')
      .forEach(
        el =>
          el.classList.remove(
            'selecionado'
          )
      );

    const barra =
      document.getElementById(
        'carrinho-bar'
      );

    if (barra) {
      barra.style.display = 'none';
    }
  }

  function escutarPedidos() {
    if (unsubPedidos) {
      unsubPedidos();
    }

    unsubPedidos =
      db
        .collection('pedidos')
        .orderBy(
          'criadoEm',
          'desc'
        )
        .onSnapshot(
          snap => {

            todosPedidos =
              snap.docs.map(
                d => ({
                  id: d.id,
                  ...d.data()
                })
              );

            renderizarPedidos();

          },

          erro => {

            console.error(
              '❌ Erro ao acompanhar pedidos:',
              erro.code,
              erro.message
            );

            if (
              erro.code ===
              'permission-denied'
            ) {
              mostrarToast(
                'Sem permissão para consultar os pedidos.',
                'erro'
              );
            }
          }
        );
  }

  function renderizarPedidos() {
    const container =
      document.getElementById(
        'lista-pedidos'
      );

    if (!container) return;

    const pedidos =
      filtroAtivo === 'todos'
        ? todosPedidos
        : todosPedidos.filter(
            p =>
              p.status === filtroAtivo
          );

    if (pedidos.length === 0) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📋</div>
          <div class="empty-msg">
            Nenhum pedido ${
              filtroAtivo !== 'todos'
                ? 'com status "' +
                  filtroAtivo +
                  '"'
                : 'ainda'
            }.
          </div>
        </div>
      `;

      return;
    }

    container.innerHTML =
      pedidos.map(p => {

        const hora =
          p.criadoEm?.toDate
            ? p.criadoEm
                .toDate()
                .toLocaleTimeString(
                  'pt-BR',
                  {
                    hour: '2-digit',
                    minute: '2-digit'
                  }
                )
            : '—';

        const itensHtml =
          p.itens.map(i => {

            let subItem =
              i.preco * i.qtd;

            let htmlAdicionaisItem =
              '';

            if (
              i.adicionais &&
              i.adicionais.length > 0
            ) {

              htmlAdicionaisItem +=
                '<div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--borda)">';

              i.adicionais.forEach(
                adic => {

                  const subAdicional =
                    adic.preco *
                    adic.qtd;

                  subItem +=
                    subAdicional;

                  htmlAdicionaisItem += `
                    <div style="
                      font-size:0.8rem;
                      color:var(--texto-2);
                      margin-left:8px">
                      + ${adic.qtd}×
                      ${adic.nome}
                      (R$ ${subAdicional.toFixed(2)})
                    </div>
                  `;
                }
              );

              htmlAdicionaisItem +=
                '</div>';
            }

            const htmlObsItem =
              i.observacoes
                ? `
                  <div style="
                    font-size:0.8rem;
                    color:var(--texto-2);
                    margin-top:4px;
                    font-style:italic">
                    📝 ${i.observacoes}
                  </div>
                `
                : '';

            return `
              <div class="pedido-item">

                <div>
                  <span>
                    ${i.qtd}× ${i.nome}
                  </span>

                  <span style="
                    color:var(--laranja);
                    font-weight:500;
                    margin-left:8px">
                    R$ ${subItem.toFixed(2)}
                  </span>
                </div>

                ${htmlAdicionaisItem}
                ${htmlObsItem}

              </div>
            `;
          }).join('');

        const statusMap = {
          aguardando: {
            label: 'Aguardando',
            cls: 'status-aguardando'
          },

          preparo: {
            label: 'Em Preparo',
            cls: 'status-preparo'
          },

          pronto: {
            label: 'Pronto',
            cls: 'status-pronto'
          },

          cancelado: {
            label: 'Cancelado',
            cls: 'status-cancelado'
          }
        };

        const st =
          statusMap[p.status] ||
          statusMap.aguardando;

        let acoes = '';

        if (
          p.status ===
          'aguardando'
        ) {
          acoes += `
            <button
              class="btn-sm"
              onclick="mudarStatusPedido(
                '${p.id}',
                'preparo'
              )">
              🔥 Em Preparo
            </button>
          `;

          acoes += `
            <button
              class="btn-sm-vermelho"
              onclick="mudarStatusPedido(
                '${p.id}',
                'cancelado'
              )">
              ❌ Cancelar
            </button>
          `;
        }

        if (
          p.status ===
          'preparo'
        ) {
          acoes += `
            <button
              class="btn-sm-verde"
              onclick="mudarStatusPedido(
                '${p.id}',
                'pronto'
              )">
              ✅ Pronto
            </button>
          `;

          acoes += `
            <button
              class="btn-sm-vermelho"
              onclick="mudarStatusPedido(
                '${p.id}',
                'cancelado'
              )">
              ❌ Cancelar
            </button>
          `;
        }

        if (
          p.status ===
          'pronto'
        ) {
          acoes += `
            <button
              class="btn-sm"
              onclick='verComprovante(${JSON.stringify(p)})'>
              🧾 Comprovante
            </button>
          `;
        }

        if (
          perfilAtual ===
          'gerente'
        ) {
          acoes += `
            <button
              class="btn-sm-vermelho"
              onclick="excluirPedido('${p.id}')">
              🗑️
            </button>
          `;
        }

        return `
          <div class="pedido-card">

            <div class="pedido-header">

              <div>

                <div class="pedido-num">
                  Pedido #${p.id
                    .slice(-4)
                    .toUpperCase()}
                </div>

                <div class="pedido-hora">
                  ⏰ ${hora}
                  · 🪑 ${p.mesa}
                  · 👤 ${p.cliente}
                </div>

                <div
                  class="pedido-hora"
                  style="margin-top:2px">

                  💳 ${p.pagamento}
                  · 👨‍💼 ${p.atendente}

                </div>

              </div>

              <div>
                <span
                  class="status-badge ${st.cls}">
                  ${st.label}
                </span>
              </div>

            </div>

            <div class="pedido-itens">
              ${itensHtml}
            </div>

            <div style="
              text-align:right;
              font-weight:700;
              color:var(--laranja)">

              Total:
              R$ ${p.total.toFixed(2)}

            </div>

            ${
              p.enderecoEntrega
                ? `
                  <div class="pedido-obs">
                    📍 Entrega:
                    ${p.enderecoEntrega}
                  </div>
                `
                : ''
            }

            ${
              p.obs
                ? `
                  <div class="pedido-obs">
                    📝 ${p.obs}
                  </div>
                `
                : ''
            }

            <div class="pedido-acoes">
              ${acoes}
            </div>

          </div>
        `;

      }).join('');
  }

  async function mudarStatusPedido(
    id,
    novoStatus
  ) {
    try {

      await db
        .collection('pedidos')
        .doc(id)
        .update({
          status: novoStatus,
          atualizadoEm:
            firebase.firestore.FieldValue
              .serverTimestamp()
        });

      mostrarToast(
        'Status atualizado!'
      );

    } catch (erro) {
      console.error(erro);

      mostrarToast(
        'Não foi possível atualizar o pedido.',
        'erro'
      );
    }
  }

  async function excluirPedido(id) {
    if (
      !confirm(
        'Excluir este pedido permanentemente?'
      )
    ) return;

    try {

      await db
        .collection('pedidos')
        .doc(id)
        .delete();

      mostrarToast(
        'Pedido removido.'
      );

    } catch (erro) {
      console.error(erro);

      mostrarToast(
        'Não foi possível excluir o pedido.',
        'erro'
      );
    }
  }

  function filtrarPedidos(
    filtro,
    btn
  ) {
    filtroAtivo = filtro;

    document
      .querySelectorAll(
        '.filtro-btn'
      )
      .forEach(
        b =>
          b.classList.remove(
            'ativo'
          )
      );

    if (btn) {
      btn.classList.add('ativo');
    }

    renderizarPedidos();
  }

  /* =========================================================================
     BLOCO 11 – COMPROVANTE DE VENDA
     ========================================================================= */

  function exibirComprovante(pedido) {
    const agora =
      new Date().toLocaleString(
        'pt-BR'
      );

    const itensHtml =
      pedido.itens.map(i =>
        `<div style="
          display:flex;
          justify-content:space-between">

          <span>
            ${i.qtd}× ${i.nome}
          </span>

          <span>
            R$ ${(i.preco * i.qtd).toFixed(2)}
          </span>

        </div>`
      ).join('');

    document.getElementById(
      'comprovante-conteudo'
    ).innerHTML = `
      <div class="comprovante">

        <div class="comprovante-logo">
          🥤 BATIDÃO
        </div>

        <div style="
          text-align:center;
          font-size:0.75rem">
          Casa de Sucos Naturais
        </div>

        <div class="comprovante-linha"></div>

        <div>
          Data: ${agora}
        </div>

        <div>
          Pedido:
          #${pedido.id
            .slice(-4)
            .toUpperCase()}
        </div>

        <div>
          Cliente:
          ${pedido.cliente}
        </div>

        <div>
          Mesa:
          ${pedido.mesa}
        </div>

        ${
          pedido.enderecoEntrega
            ? `
              <div>
                Entrega:
                ${pedido.enderecoEntrega}
              </div>
            `
            : ''
        }

        <div class="comprovante-linha"></div>

        <div style="
          font-weight:700;
          margin-bottom:4px">
          ITENS
        </div>

        ${itensHtml}

        <div class="comprovante-linha"></div>

        <div style="
          display:flex;
          justify-content:space-between;
          font-weight:900">

          <span>TOTAL</span>

          <span>
            R$ ${pedido.total.toFixed(2)}
          </span>

        </div>

        <div>
          Pagamento:
          ${pedido.pagamento}
        </div>

        ${
          pedido.obs
            ? `
              <div class="comprovante-linha"></div>
              <div>
                Obs: ${pedido.obs}
              </div>
            `
            : ''
        }

        <div class="comprovante-linha"></div>

        <div style="
          text-align:center;
          font-size:0.75rem">
          Obrigado pela preferência! 😊
        </div>

      </div>
    `;

    document
      .getElementById(
        'modal-comprovante'
      )
      .classList.add('aberto');
  }

  function verComprovante(pedido) {
    exibirComprovante(pedido);
  }

  /* =========================================================================
     BLOCO 12 – CLIENTES
     ========================================================================= */

  let todosClientes = [];
  let clientesFiltrados = [];

  function carregarClientes() {
    db.collection('clientes')
      .orderBy('nome')
      .onSnapshot(
        snap => {

          todosClientes =
            snap.docs.map(
              d => ({
                id: d.id,
                ...d.data()
              })
            );

          clientesFiltrados =
            todosClientes;

          renderizarClientes(
            todosClientes
          );

        },

        erro => {
          console.error(
            'Erro ao carregar clientes:',
            erro
          );
        }
      );
  }

  function renderizarClientes(lista) {
    const container =
      document.getElementById(
        'lista-clientes'
      );

    if (!container) return;

    if (lista.length === 0) {
      container.innerHTML = `
        <div class="empty">

          <div class="empty-icon">
            👥
          </div>

          <div class="empty-msg">
            Nenhum cliente cadastrado.
          </div>

        </div>
      `;

      return;
    }

    container.innerHTML =
      lista.map(c => `
        <div class="cliente-item">

          <div>

            <div class="cliente-nome">
              ${c.nome || ''}
              ${c.sobrenome || ''}
            </div>

            <div class="cliente-tel">
              ${c.telefone || '—'}
            </div>

          </div>

          <div style="
            display:flex;
            gap:6px">

            <button
              class="btn-sm"
              onclick="verHistorico(
                '${c.id}',
                '${escapeJS(
                  (c.nome || '') +
                  ' ' +
                  (c.sobrenome || '')
                )}'
              )">
              📋
            </button>

            <button
              class="btn-sm-vermelho"
              onclick="excluirCliente(
                '${c.id}',
                '${escapeJS(
                  c.nome || ''
                )}'
              )">
              🗑️
            </button>

          </div>

        </div>
      `).join('');
  }

  function buscarCliente(termo) {
    const t =
      (termo || '')
        .toLowerCase();

    const resultado =
      todosClientes.filter(
        c =>
          (
            (c.nome || '') +
            ' ' +
            (c.sobrenome || '')
          )
            .toLowerCase()
            .includes(t)
      );

    renderizarClientes(
      resultado
    );
  }

  function abrirModalCliente() {
    document.getElementById(
      'cli-nome'
    ).value = '';

    document.getElementById(
      'cli-tel'
    ).value = '';

    document.getElementById(
      'modal-cliente'
    ).classList.add('aberto');
  }

  async function salvarCliente() {
    const nome =
      document.getElementById(
        'cli-nome'
      ).value.trim();

    const telefone =
      document.getElementById(
        'cli-tel'
      ).value.trim();

    if (!nome) {
      mostrarToast(
        'Informe o nome do cliente.',
        'erro'
      );
      return;
    }

    try {

      await db
        .collection('clientes')
        .add({
          nome,
          telefone,
          criadoEm:
            firebase.firestore
              .FieldValue
              .serverTimestamp()
        });

      fecharModal(
        'modal-cliente'
      );

      mostrarToast(
        'Cliente cadastrado!'
      );

    } catch (erro) {
      console.error(erro);

      mostrarToast(
        'Não foi possível cadastrar o cliente.',
        'erro'
      );
    }
  }

  async function excluirCliente(
    id,
    nome
  ) {
    if (
      !confirm(
        `Excluir cliente "${nome}"?`
      )
    ) return;

    try {

      await db
        .collection('clientes')
        .doc(id)
        .delete();

      mostrarToast(
        'Cliente removido.'
      );

    } catch (erro) {
      console.error(erro);

      mostrarToast(
        'Não foi possível remover o cliente.',
        'erro'
      );
    }
  }

  async function verHistorico(
    clienteId,
    nome
  ) {
    document.getElementById(
      'historico-titulo'
    ).textContent =
      '📋 ' + nome;

    document.getElementById(
      'historico-conteudo'
    ).innerHTML =
      '<p style="color:var(--texto-2)">Carregando…</p>';

    document.getElementById(
      'modal-historico'
    ).classList.add('aberto');

    try {

      const snap =
        await db
          .collection('pedidos')
          .where(
            'cliente',
            '==',
            nome
          )
          .orderBy(
            'criadoEm',
            'desc'
          )
          .get();

      if (snap.empty) {

        document.getElementById(
          'historico-conteudo'
        ).innerHTML =
          '<div class="empty">' +
          '<div class="empty-msg">' +
          'Nenhum pedido encontrado.' +
          '</div></div>';

        return;
      }

      const pedidos =
        snap.docs.map(
          d => ({
            id: d.id,
            ...d.data()
          })
        );

      let totalGasto = 0;
      let html = '';

      pedidos.forEach(
        p => {

          totalGasto +=
            Number(p.total || 0);

          const data =
            p.criadoEm?.toDate
              ? p.criadoEm
                  .toDate()
                  .toLocaleDateString(
                    'pt-BR'
                  )
              : '—';

          html += `
            <div class="relatorio-item">

              <div>

                <div style="
                  font-weight:600">
                  #${p.id
                    .slice(-4)
                    .toUpperCase()}
                  · ${data}
                </div>

                <div style="
                  font-size:0.78rem;
                  color:var(--texto-2)">

                  ${p.itens
                    .map(
                      i =>
                        i.qtd +
                        '× ' +
                        i.nome
                    )
                    .join(', ')}

                </div>

              </div>

              <span class="relatorio-valor">
                R$ ${Number(
                  p.total || 0
                ).toFixed(2)}
              </span>

            </div>
          `;
        }
      );

      html =
        `
          <div style="
            padding:10px;
            background:var(--fundo);
            border-radius:var(--raio-sm);
            margin-bottom:12px">

            <span style="
              color:var(--texto-2);
              font-size:0.8rem">
              Total gasto
            </span>

            <div style="
              font-family:'Syne',sans-serif;
              font-size:1.4rem;
              color:var(--laranja)">

              ${pedidos.length}
              pedidos ·
              R$ ${totalGasto.toFixed(2)}

            </div>

          </div>
        ` +
        html;

      document.getElementById(
        'historico-conteudo'
      ).innerHTML = html;

    } catch (erro) {

      console.error(erro);

      document.getElementById(
        'historico-conteudo'
      ).innerHTML = `
        <div class="empty">
          <div class="empty-msg">
            Não foi possível carregar o histórico.
          </div>
        </div>
      `;
    }
  }

  /* =========================================================================
     BLOCO 13 – RELATÓRIOS
     ========================================================================= */

  async function carregarRelatorio() {
    const periodo =
      document.getElementById(
        'rel-periodo'
      ).value;

    const agora =
      new Date();

    let dataInicio =
      new Date();

    if (periodo === 'hoje') {

      dataInicio.setHours(
        0,
        0,
        0,
        0
      );

    } else if (
      periodo === 'semana'
    ) {

      dataInicio.setDate(
        agora.getDate() - 7
      );

    } else {

      dataInicio =
        new Date(
          agora.getFullYear(),
          agora.getMonth(),
          1
        );
    }

    const tsInicio =
      firebase.firestore
        .Timestamp
        .fromDate(
          dataInicio
        );

    try {

      const snap =
        await db
          .collection('pedidos')
          .where(
            'criadoEm',
            '>=',
            tsInicio
          )
          .get();

      const pedidos =
        snap.docs.map(
          d => ({
            id: d.id,
            ...d.data()
          })
        );

      const validos =
        pedidos.filter(
          p =>
            p.status !==
            'cancelado'
        );

      const cancelados =
        pedidos.filter(
          p =>
            p.status ===
            'cancelado'
        );

      const receita =
        validos.reduce(
          (acc, p) =>
            acc +
            Number(p.total || 0),
          0
        );

      const ticketMedio =
        validos.length > 0
          ? receita /
            validos.length
          : 0;

      document.getElementById(
        'rel-total-pedidos'
      ).textContent =
        pedidos.length;

      document.getElementById(
        'rel-receita'
      ).textContent =
        receita.toFixed(2);

      document.getElementById(
        'rel-ticket'
      ).textContent =
        ticketMedio.toFixed(2);

      document.getElementById(
        'rel-cancelados'
      ).textContent =
        cancelados.length;

      const contagem = {};

      validos.forEach(
        p => {

          p.itens.forEach(
            i => {

              contagem[i.nome] =
                (
                  contagem[i.nome] ||
                  0
                ) + i.qtd;

            }
          );
        }
      );

      const ranking =
        Object.entries(
          contagem
        )
          .sort(
            (a, b) =>
              b[1] - a[1]
          )
          .slice(
            0,
            10
          );

      const maisVendidos =
        document.getElementById(
          'rel-mais-vendidos'
        );

      if (
        ranking.length === 0
      ) {

        maisVendidos.innerHTML =
          '<div class="empty">' +
          '<div class="empty-msg">' +
          'Sem dados no período.' +
          '</div></div>';

        return;
      }

      maisVendidos.innerHTML =
        ranking
          .map(
            ([nome, qtd], idx) =>
              `
                <div class="relatorio-item">

                  <span>
                    ${idx + 1}.
                    ${nome}
                  </span>

                  <span class="relatorio-valor">
                    ${qtd}
                    vendidos
                  </span>

                </div>
              `
          )
          .join('');

    } catch (erro) {

      console.error(
        'Erro no relatório:',
        erro
      );

      mostrarToast(
        'Não foi possível carregar o relatório.',
        'erro'
      );
    }
  }

  /* =========================================================================
     BLOCO 14 – UTILITÁRIOS
     ========================================================================= */

  function fecharModal(id) {
    const modal =
      document.getElementById(id);

    if (modal) {
      modal.classList.remove(
        'aberto'
      );
    }
  }

  function mostrarToast(
    msg,
    tipo = 'sucesso'
  ) {
    const toast =
      document.getElementById(
        'toast'
      );

    if (!toast) return;

    toast.textContent = msg;

    toast.style.background =
      tipo === 'erro'
        ? 'var(--vermelho)'
        : 'var(--verde)';

    toast.classList.add(
      'visivel'
    );

    setTimeout(
      () =>
        toast.classList.remove(
          'visivel'
        ),
      2500
    );
  }

  /* =========================================================================
     BLOCO 15 – FECHAR MODAL AO CLICAR FORA
     ========================================================================= */

  document
    .querySelectorAll(
      '.modal-overlay'
    )
    .forEach(
      overlay => {

        overlay.addEventListener(
          'click',
          e => {

            if (
              e.target === overlay
            ) {
              overlay.classList.remove(
                'aberto'
              );
            }

          }
        );

      }
    );

  /* =========================================================================
     BLOCO 16 – ENTER NO LOGIN
     ========================================================================= */

  const campoSenha =
    document.getElementById(
      'input-senha'
    );

  if (campoSenha) {
    campoSenha.addEventListener(
      'keydown',
      e => {
        if (
          e.key === 'Enter'
        ) {
          fazerLogin();
        }
      }
    );
  }

  /* =========================================================================
     BLOCO 17 – ADICIONAIS NO PEDIDO
     ========================================================================= */

  let produtoAtualAdicionais =
    null;

  let adicionaisTemp = {};

  function abrirModalAdicionais(
    produtoId
  ) {
    const produto =
      todosProdutos.find(
        p =>
          p.id === produtoId
      );

    if (!produto) return;

    produtoAtualAdicionais =
      produto;

    adicionaisTemp = {};

    document.getElementById(
      'modal-adicionais-titulo'
    ).textContent =
      `Adicionais - ${produto.nome}`;

    document.getElementById(
      'modal-adicionais-produto'
    ).textContent =
      produto.nome;

    document.getElementById(
      'modal-adicionais-preco'
    ).textContent =
      `R$ ${Number(
        produto.preco
      ).toFixed(2)}`;

    document.getElementById(
      'modal-adicionais-obs'
    ).value = '';

    renderizarAdicionais();

    document.getElementById(
      'modal-adicionais'
    ).classList.add(
      'aberto'
    );
  }

  function renderizarAdicionais() {
    const lista =
      document.getElementById(
        'modal-adicionais-lista'
      );

    if (
      !produtoAtualAdicionais?.adicionais ||
      produtoAtualAdicionais
        .adicionais
        .length === 0
    ) {

      lista.innerHTML = `
        <div class="empty"
             style="padding:20px 0">

          <div class="empty-icon">
            ✨
          </div>

          <div class="empty-msg">
            Sem adicionais para este produto
          </div>

        </div>
      `;

      return;
    }

    let html = '';

    produtoAtualAdicionais
      .adicionais
      .forEach(adic => {

        const qtdAdicional =
          adicionaisTemp[
            adic.id
          ] || 0;

        html += `
          <div style="
            padding:12px;
            background:var(--superficie);
            border-radius:var(--raio-sm);
            margin-bottom:8px;
            display:flex;
            justify-content:space-between;
            align-items:center">

            <div>

              <div style="
                font-weight:500">
                ${adic.nome}
              </div>

              <div style="
                color:var(--laranja);
                font-size:0.9rem">
                + R$
                ${Number(
                  adic.preco
                ).toFixed(2)}
              </div>

            </div>

            <div class="qty-ctrl">

              <button
                class="qty-btn"
                onclick="alterarQtyAdicional(
                  '${adic.id}',
                  -1
                )">
                −
              </button>

              <span
                class="qty-num"
                style="min-width:24px">
                ${qtdAdicional}
              </span>

              <button
                class="qty-btn"
                onclick="alterarQtyAdicional(
                  '${adic.id}',
                  1
                )">
                +
              </button>

            </div>

          </div>
        `;
      });

    lista.innerHTML = html;
  }

  function alterarQtyAdicional(
    adicionalId,
    delta
  ) {
    adicionaisTemp[
      adicionalId
    ] =
      (
        adicionaisTemp[
          adicionalId
        ] || 0
      ) + delta;

    if (
      adicionaisTemp[
        adicionalId
      ] < 0
    ) {
      adicionaisTemp[
        adicionalId
      ] = 0;
    }

    renderizarAdicionais();
  }

  function adicionarAoCarrinhoComAdicionais() {
    if (
      !produtoAtualAdicionais
    ) return;

    const prodId =
      produtoAtualAdicionais.id;

    const obs =
      document.getElementById(
        'modal-adicionais-obs'
      ).value.trim();

    if (!carrinho[prodId]) {

      carrinho[prodId] = {
        nome:
          produtoAtualAdicionais.nome,

        preco:
          produtoAtualAdicionais.preco,

        qtd: 1,

        adicionais: [],

        observacoes: obs
      };

    } else {

      carrinho[prodId].qtd += 1;

      if (obs) {
        carrinho[prodId]
          .observacoes = obs;
      }
    }

    Object.entries(
      adicionaisTemp
    ).forEach(
      ([adicionalId, qtdAdicional]) => {

        if (
          qtdAdicional > 0
        ) {

          const adicional =
            (
              produtoAtualAdicionais
                .adicionais || []
            ).find(
              a =>
                a.id ===
                adicionalId
            );

          if (adicional) {

            carrinho[prodId]
              .adicionais
              .push({
                nome:
                  adicional.nome,

                preco:
                  adicional.preco,

                qtd:
                  qtdAdicional
              });

          }
        }
      }
    );

    atualizarBarraCarrinho();

    renderizarMenuPedido();

    mostrarToast(
      `✅ ${produtoAtualAdicionais.nome} adicionado ao carrinho!`
    );

    fecharModal(
      'modal-adicionais'
    );
  }
