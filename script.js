/* script.js */

const firebaseConfig = {
  apiKey: "1:1086945887838:web:10329855c2299b5d3556cf",
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

let usuarioAtual = null;
let perfilAtual = null;
let dadosClienteAtual = null;

let carrinho = {};
let todosProdutos = [];
let todosPedidos = [];
let filtroAtivo = 'todos';
let unsubPedidos = null;

let perfilSelecionado = 'gerente';

function obterDadosClienteLocal() {
  try {
    return JSON.parse(
      localStorage.getItem('batidao_cliente_perfil') || 'null'
    );
  } catch (e) {
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
  return String(telefone || '').replace(/\D/g, '');
}

auth.onAuthStateChanged(async (usuario) => {

  document.getElementById('tela-loading').style.display = 'none';

  if (usuario) {

    usuarioAtual = usuario;

    try {
      await carregarPerfilUsuario(usuario.uid);
      mostrarApp();
    } catch (erro) {
      console.error('Erro ao carregar perfil:', erro);

      if (usuario.isAnonymous) {
        await auth.signOut();
      }

      document.querySelector('.tela-login-container').style.display = 'flex';
    }

  } else {

    usuarioAtual = null;
    perfilAtual = null;

    document.querySelector('.app-container').style.display = 'none';
    document.querySelector('.tela-login-container').style.display = 'flex';

  }

});

function selecionarPerfil(perfil) {

  perfilSelecionado = perfil;

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('ativo');
  });

  const tab = document.getElementById('tab-' + perfil);

  if (tab) {
    tab.classList.add('ativo');
  }

  const formFuncionario =
    document.getElementById('form-login-funcionario');

  const formCliente =
    document.getElementById('form-login-cliente');

  const erroEl =
    document.getElementById('erro-login');

  if (erroEl) {
    erroEl.style.display = 'none';
  }

  if (perfil === 'cliente') {

    if (formFuncionario) {
      formFuncionario.style.display = 'none';
    }

    if (formCliente) {
      formCliente.style.display = 'block';
    }

    const dados = obterDadosClienteLocal();

    if (dados) {

      document.getElementById('cliente-login-nome').value =
        dados.nome || '';

      document.getElementById('cliente-login-sobrenome').value =
        dados.sobrenome || '';

      document.getElementById('cliente-login-telefone').value =
        dados.telefone || '';
    }

  } else {

    if (formFuncionario) {
      formFuncionario.style.display = 'block';
    }

    if (formCliente) {
      formCliente.style.display = 'none';
    }

    document.getElementById('input-email').value = '';
    document.getElementById('input-senha').value = '';
  }
}

async function entrarComoCliente() {

  const nome =
    document.getElementById('cliente-login-nome').value.trim();

  const sobrenome =
    document.getElementById('cliente-login-sobrenome').value.trim();

  const telefone =
    document.getElementById('cliente-login-telefone').value.trim();

  const erroEl =
    document.getElementById('erro-login');

  erroEl.style.display = 'none';

  if (!nome || !sobrenome || !telefone) {

    erroEl.textContent =
      'Preencha nome, sobrenome e telefone.';

    erroEl.style.display = 'block';

    return;
  }

  if (telefoneNormalizado(telefone).length < 10) {

    erroEl.textContent =
      'Informe um telefone válido com DDD.';

    erroEl.style.display = 'block';

    return;
  }

  const dadosCliente = {
    nome,
    sobrenome,
    telefone,
    telefoneNormalizado: telefoneNormalizado(telefone)
  };

  salvarDadosClienteLocal(dadosCliente);

  try {

    let credencial;

    if (
      auth.currentUser &&
      auth.currentUser.isAnonymous
    ) {

      credencial = {
        user: auth.currentUser
      };

    } else {

      credencial = await auth.signInAnonymously();

    }

    usuarioAtual = credencial.user;
    perfilAtual = 'cliente';

    await db
      .collection('usuarios')
      .doc(usuarioAtual.uid)
      .set({
        perfil: 'cliente',
        nome,
        sobrenome,
        telefone,
        telefoneNormalizado: telefoneNormalizado(telefone),
        atualizadoEm:
          firebase.firestore.FieldValue.serverTimestamp()
      }, {
        merge: true
      });

    mostrarApp();

  } catch (erro) {

    console.error(
      'Erro ao entrar como cliente:',
      erro.code,
      erro.message
    );

    let msg =
      'Não foi possível entrar como cliente.';

    if (
      erro.code === 'auth/operation-not-allowed'
    ) {
      msg =
        'Ative o login anônimo no Firebase Authentication.';
    }

    if (
      erro.code === 'auth/network-request-failed'
    ) {
      msg =
        '⚠️ Sem conexão. Verifique sua internet.';
    }

    erroEl.textContent = msg;
    erroEl.style.display = 'block';
  }
}

async function fazerLogin() {

  const email =
    document.getElementById('input-email').value.trim();

  const senha =
    document.getElementById('input-senha').value.trim();

  const erroEl =
    document.getElementById('erro-login');

  erroEl.style.display = 'none';

  if (!email || !senha) {

    erroEl.textContent =
      'Preencha e-mail e senha.';

    erroEl.style.display = 'block';

    return;
  }

  try {

    await auth.signInWithEmailAndPassword(
      email,
      senha
    );

  } catch (erro) {

    console.error(
      '❌ Erro Firebase:',
      erro.code,
      erro.message
    );

    let msg =
      'Erro ao entrar. Verifique e-mail e senha.';

    if (erro.code === 'auth/user-not-found')
      msg = 'Usuário não encontrado.';

    if (erro.code === 'auth/wrong-password')
      msg = 'Senha incorreta.';

    if (erro.code === 'auth/invalid-email')
      msg = 'E-mail inválido.';

    if (erro.code === 'auth/too-many-requests')
      msg = 'Muitas tentativas. Tente mais tarde.';

    if (erro.code === 'auth/network-request-failed')
      msg = '⚠️ Sem conexão. Verifique sua internet.';

    erroEl.textContent = msg;
    erroEl.style.display = 'block';
  }
}

async function fazerLogout() {

  if (unsubPedidos) {
    unsubPedidos();
    unsubPedidos = null;
  }

  await auth.signOut();

  usuarioAtual = null;
  perfilAtual = null;
  carrinho = {};
  todosProdutos = [];
  todosPedidos = [];

  document.querySelector('.app-container').style.display = 'none';

  document.querySelector('.tela-login-container').style.display =
    'flex';

  selecionarPerfil('gerente');
}

async function carregarPerfilUsuario(uid) {

  const snap =
    await db.collection('usuarios').doc(uid).get();

  if (snap.exists) {

    const dados = snap.data();

    perfilAtual = dados.perfil;

    if (perfilAtual === 'cliente') {

      dadosClienteAtual = {
        nome: dados.nome || '',
        sobrenome: dados.sobrenome || '',
        telefone: dados.telefone || '',
        telefoneNormalizado:
          dados.telefoneNormalizado ||
          telefoneNormalizado(dados.telefone)
      };

      salvarDadosClienteLocal(
        dadosClienteAtual
      );
    }

  } else if (usuarioAtual?.isAnonymous) {

    const dadosLocal =
      obterDadosClienteLocal();

    if (!dadosLocal) {

      await auth.signOut();

      throw new Error(
        'Perfil de cliente não encontrado.'
      );
    }

    perfilAtual = 'cliente';

    dadosClienteAtual = dadosLocal;

    await db
      .collection('usuarios')
      .doc(uid)
      .set({
        ...dadosLocal,
        perfil: 'cliente',
        criadoEm:
          firebase.firestore.FieldValue.serverTimestamp()
      }, {
        merge: true
      });

  } else {

    perfilAtual = perfilSelecionado;

    await db
      .collection('usuarios')
      .doc(uid)
      .set({
        email: usuarioAtual.email || '',
        perfil: perfilAtual,
        criadoEm:
          firebase.firestore.FieldValue.serverTimestamp()
      }, {
        merge: true
      });
  }
}

function mostrarApp() {

  document.querySelector(
    '.tela-login-container'
  ).style.display = 'none';

  document.querySelector(
    '.app-container'
  ).style.display = 'flex';

  const badge =
    document.getElementById('badge-perfil');

  const nomesPerfil = {
    gerente: '👔 Gerente',
    atendente: '🧃 Atendente',
    cliente: '👤 Cliente'
  };

  badge.textContent =
    nomesPerfil[perfilAtual] || 'Usuário';

  badge.className =
    'badge-perfil badge-' + perfilAtual;

  const cfgEmail =
    document.getElementById('cfg-email');

  const cfgPerfil =
    document.getElementById('cfg-perfil');

  if (cfgEmail) {

    cfgEmail.textContent =
      perfilAtual === 'cliente'
        ? (dadosClienteAtual?.telefone || 'Cliente')
        : (usuarioAtual?.email || '—');
  }

  if (cfgPerfil) {
    cfgPerfil.textContent =
      'Perfil: ' + perfilAtual;
  }

  const ids = [
    'nav-acompanhamento',
    'nav-cardapio',
    'nav-clientes',
    'nav-relatorios',
    'nav-config'
  ];

  ids.forEach(id => {

    const el =
      document.getElementById(id);

    if (el) {

      el.style.display =
        perfilAtual === 'cliente'
          ? 'none'
          : '';
    }
  });

  const cardAdmin =
    document.getElementById(
      'card-popular-produtos'
    );

  if (cardAdmin) {

    cardAdmin.style.display =
      perfilAtual === 'gerente'
        ? 'block'
        : 'none';
  }

  const campoMesa =
    document.getElementById('campo-mesa');

  const campoEndereco =
    document.getElementById(
      'campo-endereco-entrega'
    );

  const campoCliente =
    document.getElementById('np-cliente');

  if (perfilAtual === 'cliente') {

    if (campoMesa) {
      campoMesa.style.display = 'none';
    }

    if (campoEndereco) {
      campoEndereco.style.display = 'block';
    }

    if (campoCliente) {

      campoCliente.value =
        [
          dadosClienteAtual?.nome,
          dadosClienteAtual?.sobrenome
        ]
        .filter(Boolean)
        .join(' ');

      campoCliente.readOnly = true;
    }

  } else {

    if (campoMesa) {
      campoMesa.style.display = '';
    }

    if (campoEndereco) {
      campoEndereco.style.display = 'none';
    }

    if (campoCliente) {
      campoCliente.readOnly = false;
    }
  }

  carregarProdutos();

  if (perfilAtual !== 'cliente') {

    escutarPedidos();
    carregarClientes();
  }

  if (perfilAtual === 'cliente') {

    mudarTela(
      'pedido',
      'Novo Pedido',
      document.getElementById('nav-pedido')
    );
  }
}

function mudarTela(
  nomeTela,
  titulo,
  btnClicado
) {

  if (
    perfilAtual === 'cliente' &&
    nomeTela !== 'pedido'
  ) {

    mostrarToast(
      'Essa área é exclusiva da equipe.',
      'erro'
    );

    return;
  }

  document.querySelectorAll('.tela').forEach(t => {
    t.classList.remove('ativa');
  });

  const tela =
    document.getElementById(
      'tela-' + nomeTela
    );

  if (!tela) return;

  tela.classList.add('ativa');

  document.getElementById(
    'titulo-tela'
  ).textContent = titulo;

  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.remove('ativo');
  });

  if (btnClicado) {
    btnClicado.classList.add('ativo');
  }

  if (nomeTela === 'relatorios')
    carregarRelatorio();

  if (nomeTela === 'cardapio')
    renderizarProdutosAdmin();

  if (nomeTela === 'acompanhamento')
    renderizarPedidos();
}

function carregarProdutos() {

  db.collection('produtos')
    .orderBy('categoria')
    .onSnapshot(snap => {

      todosProdutos =
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

      renderizarMenuPedido();

    }, erro => {

      console.error(
        'Erro ao carregar produtos:',
        erro
      );

      mostrarToast(
        'Erro ao carregar o cardápio.',
        'erro'
      );
    });
}

function getImagemProduto(
  nome,
  categoria,
  imagemCampo
) {

  if (imagemCampo) {

    const src =
      imagemCampo.startsWith('data:')
        ? imagemCampo
        : 'img/' + imagemCampo;

    const nomeEsc =
      (nome || '').replace(
        /"/g,
        '&quot;'
      );

    return `
      <img
        src="${src}"
        alt="${nomeEsc}"
        style="width:100%;height:100%;object-fit:cover;border-radius:10px"
        onerror="this.style.display='none'"
      >
    `;
  }

  return getEmojiProduto(
    nome,
    categoria
  );
}

function getEmojiProduto(
  nome,
  categoria
) {

  const n =
    (nome || '').toLowerCase();

  const c =
    (categoria || '').toLowerCase();

  if (
    n.includes('laranja') &&
    n.includes('morango')
  ) return '🍊🍓';

  if (
    n.includes('laranja') &&
    n.includes('cenoura') &&
    n.includes('beterraba')
  ) return '🥕🍊';

  if (
    n.includes('laranja') &&
    n.includes('manga')
  ) return '🍊🥭';

  if (
    n.includes('laranja') &&
    n.includes('acerola')
  ) return '🍊🍒';

  if (
    n.includes('laranja') &&
    n.includes('abacaxi')
  ) return '🍊🍍';

  if (
    n.includes('laranja') &&
    (
      n.includes('maracujá') ||
      n.includes('maracuja')
    )
  ) return '🍊🌸';

  if (
    n.includes('laranja') &&
    (
      n.includes('mamão') ||
      n.includes('mamao')
    )
  ) return '🍊🫐';

  if (
    n.includes('laranja') &&
    n.includes('goiaba')
  ) return '🍊🟡';

  if (
    n.includes('laranja') &&
    (
      n.includes('pêssego') ||
      n.includes('pessego')
    )
  ) return '🍊🍑';

  if (
    n.includes('laracreme') ||
    (
      n.includes('laranja') &&
      n.includes('sorvete')
    )
  ) return '🍊🍦';

  if (
    n.includes('coco') &&
    n.includes('abacaxi')
  ) return '🥥🍍';

  if (
    n.includes('coco') &&
    n.includes('goiaba')
  ) return '🥥🟡';

  if (
    n.includes('coco') &&
    (
      n.includes('mamão') ||
      n.includes('mamao') ||
      n.includes('coco suíço')
    )
  ) return '🥥';

  if (
    n.includes('abacaxi') &&
    (
      n.includes('hortelã') ||
      n.includes('hortela')
    )
  ) return '🍍🌿';

  if (
    n.includes('abacaxi') &&
    n.includes('melancia')
  ) return '🍍🍉';

  if (
    n.includes('abacaxi') &&
    (
      n.includes('limão') ||
      n.includes('limao')
    )
  ) return '🍍🍋';

  if (
    n.includes('abacaxi') &&
    n.includes('gengibre')
  ) return '🍍🫚';

  if (
    n.includes('abacaxi') &&
    n.includes('uva')
  ) return '🍍🍇';

  if (
    n.includes('morango') &&
    (
      n.includes('maracujá') ||
      n.includes('maracuja')
    )
  ) return '🍓🌸';

  if (
    n.includes('melancia') &&
    n.includes('morango')
  ) return '🍉🍓';

  if (
    n.includes('melancia') &&
    n.includes('gengibre')
  ) return '🍉🫚';

  if (
    n.includes('melancia') &&
    (
      n.includes('hortelã') ||
      n.includes('hortela')
    )
  ) return '🍉🌿';

  if (n.includes('melancia'))
    return '🍉';

  if (n.includes('frutas vermelhas'))
    return '🍓🫐';

  if (
    n.includes('amora') &&
    n.includes('morango')
  ) return '🫐🍓';

  if (n.includes('morango'))
    return '🍓';

  if (
    n.includes('manga') &&
    n.includes('acerola')
  ) return '🥭🍒';

  if (
    n.includes('maracuja') &&
    n.includes('manga')
  ) return '🌸🥭';

  if (
    n.includes('maracujá') &&
    n.includes('manga')
  ) return '🌸🥭';

  if (
    n.includes('limonada') ||
    (
      n.includes('limão') &&
      n.includes('leite')
    )
  ) return '🍋🥛';

  if (
    n.includes('limonada') ||
    n.includes('limão') ||
    n.includes('limao')
  ) return '🍋';

  if (
    n.includes('laranjada suíça') ||
    n.includes('laranjadasuica')
  ) return '🍊🥛';

  if (n.includes('laranja'))
    return '🍊';

  if (n.includes('uva'))
    return '🍇';

  if (n.includes('abacaxi'))
    return '🍍';

  if (
    n.includes('maracujá') ||
    n.includes('maracuja')
  ) return '🌸';

  if (n.includes('manga'))
    return '🥭';

  if (
    n.includes('mamão') ||
    n.includes('mamao')
  ) return '🍈';

  if (n.includes('goiaba'))
    return '🟡';

  if (n.includes('acerola'))
    return '🍒';

  if (n.includes('coco'))
    return '🥥';

  if (n.includes('beterraba'))
    return '🫐';

  if (n.includes('cenoura'))
    return '🥕';

  if (
    n.includes('linguiça') ||
    n.includes('linguica')
  ) return '🌭';

  if (n.includes('frango'))
    return '🥙';

  if (n.includes('pernil'))
    return '🥩';

  if (n.includes('carne louca'))
    return '🥩';

  if (n.includes('misto quente'))
    return '🥪';

  if (n.includes('ovo'))
    return '🍳';

  if (n.includes('salada'))
    return '🥗';

  if (
    n.includes('sanduíche') ||
    n.includes('sanduiche')
  ) return '🥪';

  if (c.includes('combo'))
    return '🎯';

  if (c.includes('suco'))
    return '🥤';

  if (c.includes('lanche'))
    return '🥪';

  if (c.includes('salada'))
    return '🥗';

  if (c.includes('bebida'))
    return '🧃';

  if (c.includes('adicional'))
    return '➕';

  return '🍽️';
}

function renderCardProduto(p) {

  const qtd =
    carrinho[p.id]?.qtd || 0;

  const imgConteudo =
    getImagemProduto(
      p.nome,
      p.categoria,
      p.imagem || ''
    );

  return `
    <div
      class="produto-item ${qtd > 0 ? 'selecionado' : ''}"
      id="prod-${p.id}"
      onclick="abrirModalAdicionais('${p.id}')"
    >

      <div class="produto-img-wrap">
        ${imgConteudo}
      </div>

      <div class="produto-info-col">

        <div class="produto-nome">
          ${p.nome}
        </div>

        ${
          p.descricao
            ? `
              <div
                style="font-size:0.75rem;color:var(--texto-2);margin-top:2px;line-height:1.3"
              >
                ${p.descricao}
              </div>
            `
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
            ? `
              <span
                style="font-size:0.75rem;color:var(--verde);font-weight:700;background:var(--verde-bg);padding:2px 7px;border-radius:20px"
              >
                ${qtd}x
              </span>
            `
            : ''
        }

      </div>

    </div>
  `;
}

function renderizarMenuPedido() {

  const container =
    document.getElementById(
      'menu-container'
    );

  if (todosProdutos.length === 0) {

    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🍹</div>
        <div class="empty-msg">
          Nenhum produto no cardápio.<br>
          ${
            perfilAtual === 'gerente'
              ? 'Vá em Cardápio para adicionar.'
              : 'Aguarde o gerente adicionar produtos.'
          }
        </div>
      </div>
    `;

    return;
  }

  let html = '';

  const maisPedidos =
    todosProdutos.filter(
      p => p.maisVendido
    );

  if (maisPedidos.length > 0) {

    html += `
      <div class="secao-destaque-titulo">
        ⭐ Os Mais Pedidos
      </div>

      <div class="scroll-horizontal">
    `;

    maisPedidos.forEach(p => {

      const imgConteudo =
        getImagemProduto(
          p.nome,
          p.categoria,
          p.imagem || ''
        );

      const qtd =
        carrinho[p.id]
          ? carrinho[p.id].qtd
          : 0;

      html += `
        <div
          class="card-destaque ${qtd > 0 ? 'selecionado' : ''}"
          onclick="abrirModalAdicionais('${p.id}')"
        >

          <div class="card-destaque-img">
            ${imgConteudo}
          </div>

          <div class="card-destaque-nome">
            ${p.nome}
          </div>

          <div class="card-destaque-preco">
            R$ ${Number(p.preco).toFixed(2)}
          </div>

          ${
            qtd > 0
              ? `
                <div
                  style="font-size:0.7rem;color:var(--verde);font-weight:700"
                >
                  ${qtd}x no carrinho
                </div>
              `
              : ''
          }

        </div>
      `;
    });

    html += '</div>';
  }

  const emPromocao =
    todosProdutos.filter(
      p => p.promocao
    );

  if (emPromocao.length > 0) {

    html += `
      <div
        class="secao-destaque-titulo"
        style="color:var(--vermelho)"
      >
        🔥 Promoções
      </div>
    `;

    emPromocao.forEach(p => {
      html += renderCardProduto(p);
    });
  }

  const grupos =
    todosProdutos.reduce(
      function(acc, p) {

        const cat =
          p.categoria || 'Outros';

        if (!acc[cat])
          acc[cat] = [];

        acc[cat].push(p);

        return acc;

      },
      {}
    );

  function iconCategoria(cat) {

    const c =
      cat.toLowerCase();

    if (c.includes('suco'))
      return '🥤';

    if (
      c.includes('lanche') ||
      c.includes('pão') ||
      c.includes('pao')
    ) return '🥪';

    if (c.includes('combo'))
      return '🎯';

    if (c.includes('salada'))
      return '🥗';

    if (c.includes('bebida'))
      return '🧃';

    if (c.includes('adicional'))
      return '➕';

    return '🍽️';
  }

  for (
    const [cat, produtos]
    of Object.entries(grupos)
  ) {

    html += `
      <div class="categoria-titulo">
        ${iconCategoria(cat)} ${cat}
      </div>
    `;

    produtos.forEach(p => {
      html += renderCardProduto(p);
    });
  }

  container.innerHTML = html;
}

function escapeJS(str) {

  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function renderizarProdutosAdmin() {

  const container =
    document.getElementById(
      'lista-produtos-admin'
    );

  if (todosProdutos.length === 0) {

    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🍹</div>
        <div class="empty-msg">
          Nenhum produto. Clique em "+ Produto".
        </div>
      </div>
    `;

    return;
  }

  container.innerHTML =
    todosProdutos.map(p => {

      const dadosBtn =
        JSON.stringify({
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

          <div
            style="display:flex;align-items:center;gap:10px;flex:1;min-width:0"
          >

            <div
              class="produto-img-wrap"
              style="width:44px;height:44px;font-size:1.3rem;flex-shrink:0"
            >
              ${getImagemProduto(
                p.nome,
                p.categoria,
                p.imagem || ''
              )}
            </div>

            <div style="min-width:0">

              <div class="produto-nome">
                ${p.nome}
              </div>

              <div
                style="font-size:0.75rem;color:var(--texto-2)"
              >
                ${p.categoria} · R$ ${Number(p.preco).toFixed(2)}
              </div>

              <div
                style="display:flex;gap:6px;margin-top:3px"
              >

                ${
                  p.maisVendido
                    ? '<span style="font-size:0.65rem;background:var(--laranja);color:#fff;padding:1px 5px;border-radius:4px;font-weight:700">⭐ TOP</span>'
                    : ''
                }

                ${
                  p.promocao
                    ? '<span style="font-size:0.65rem;background:var(--vermelho);color:#fff;padding:1px 5px;border-radius:4px;font-weight:700">🔥 PROMO</span>'
                    : ''
                }

              </div>

            </div>

          </div>

          <div
            style="display:flex;gap:6px;flex-shrink:0"
          >

            <button
              class="btn-sm"
              onclick='editarProduto(${dadosBtn})'
            >
              ✏️
            </button>

            <button
              class="btn-sm-vermelho"
              onclick="excluirProduto('${p.id}','${escapeJS(p.nome)}')"
            >
              🗑️
            </button>

          </div>

        </div>
      `;

    }).join('');
}

function abrirModalProduto() {

  document.getElementById(
    'modal-produto-titulo'
  ).textContent =
    '+ Novo Produto';

  document.getElementById('prod-id').value = '';
  document.getElementById('prod-nome').value = '';
  document.getElementById('prod-categoria').value = '';
  document.getElementById('prod-preco').value = '';
  document.getElementById('prod-desc').value = '';
  document.getElementById('prod-imagem').value = '';

  document.getElementById(
    'prod-mais-vendido'
  ).checked = false;

  document.getElementById(
    'prod-promocao'
  ).checked = false;

  const preview =
    document.getElementById(
      'prod-img-preview'
    );

  if (preview)
    preview.innerHTML = '🖼️';

  const manualEl =
    document.getElementById(
      'prod-imagem-manual'
    );

  if (manualEl)
    manualEl.value = '';

  const fileEl =
    document.getElementById(
      'prod-imagem-file'
    );

  if (fileEl)
    fileEl.value = '';

  document.getElementById(
    'btn-gerenciar-adicionais'
  ).style.display = 'none';

  document.getElementById(
    'modal-produto'
  ).classList.add('aberto');
}

function editarProduto(p) {

  document.getElementById(
    'modal-produto-titulo'
  ).textContent =
    '✏️ Editar Produto';

  document.getElementById('prod-id').value =
    p.id;

  document.getElementById('prod-nome').value =
    p.nome;

  document.getElementById('prod-categoria').value =
    p.categoria;

  document.getElementById('prod-preco').value =
    p.preco;

  document.getElementById('prod-desc').value =
    p.descricao || '';

  document.getElementById('prod-imagem').value =
    p.imagem || '';

  document.getElementById(
    'prod-mais-vendido'
  ).checked =
    p.maisVendido || false;

  document.getElementById(
    'prod-promocao'
  ).checked =
    p.promocao || false;

  const preview =
    document.getElementById(
      'prod-img-preview'
    );

  const manualEl =
    document.getElementById(
      'prod-imagem-manual'
    );

  if (manualEl) {

    manualEl.value =
      (
        p.imagem &&
        !p.imagem.startsWith('data:')
      )
        ? p.imagem
        : '';
  }

  if (preview) {

    if (p.imagem) {

      const src =
        p.imagem.startsWith('data:')
          ? p.imagem
          : 'img/' + p.imagem;

      preview.innerHTML = `
        <img
          src="${src}"
          style="width:100%;height:100%;object-fit:cover;border-radius:8px"
          onerror="this.parentElement.innerHTML='❌'"
        >
      `;

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

  const file =
    input.files[0];

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload =
    function(e) {

      const base64 =
        e.target.result;

      document.getElementById(
        'prod-imagem'
      ).value = base64;

      const preview =
        document.getElementById(
          'prod-img-preview'
        );

      if (preview) {

        preview.innerHTML = `
          <img
            src="${base64}"
            style="width:100%;height:100%;object-fit:cover;border-radius:8px"
          >
        `;
      }
    };

  reader.readAsDataURL(file);
}

function previewImagemManual(valor) {

  const nome =
    (valor || '').trim();

  document.getElementById(
    'prod-imagem'
  ).value = nome;

  const preview =
    document.getElementById(
      'prod-img-preview'
    );

  if (!preview) return;

  if (nome) {

    preview.innerHTML = `
      <img
        src="img/${nome}"
        style="width:100%;height:100%;object-fit:cover;border-radius:8px"
        onerror="this.parentElement.innerHTML='❌'"
      >
    `;

  } else {

    preview.innerHTML = '🖼️';
  }
}

async function salvarProduto() {

  if (perfilAtual !== 'gerente') {

    mostrarToast(
      'Apenas o gerente pode alterar o cardápio.',
      'erro'
    );

    return;
  }

  const id =
    document.getElementById(
      'prod-id'
    ).value;

  const nome =
    document.getElementById(
      'prod-nome'
    ).value.trim();

  const categoria =
    document.getElementById(
      'prod-categoria'
    ).value.trim();

  const preco =
    parseFloat(
      document.getElementById(
        'prod-preco'
      ).value
    );

  const descricao =
    document.getElementById(
      'prod-desc'
    ).value.trim();

  const imagem =
    document.getElementById(
      'prod-imagem'
    ).value.trim();

  const maisVendido =
    document.getElementById(
      'prod-mais-vendido'
    ).checked;

  const promocao =
    document.getElementById(
      'prod-promocao'
    ).checked;

  if (
    !nome ||
    !categoria ||
    isNaN(preco)
  ) {

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

      mostrarToast(
        'Produto atualizado!'
      );

    } else {

      dados.criadoEm =
        firebase.firestore.FieldValue.serverTimestamp();

      await db
        .collection('produtos')
        .add(dados);

      mostrarToast(
        'Produto adicionado!'
      );
    }

    fecharModal(
      'modal-produto'
    );

  } catch (erro) {

    console.error(erro);

    mostrarToast(
      'Erro ao salvar produto.',
      'erro'
    );
  }
}

async function excluirProduto(
  id,
  nome
) {

  if (perfilAtual !== 'gerente') {
    mostrarToast(
      'Apenas o gerente pode excluir produtos.',
      'erro'
    );
    return;
  }

  if (
    !confirm(
      `Excluir "${nome}"?`
    )
  ) return;

  try {

    await db
      .collection('produtos')
      .doc(id)
      .delete();

    mostrarToast(
      'Produto removido.'
    );

  } catch (erro) {

    console.error(erro);

    mostrarToast(
      'Erro ao remover produto.',
      'erro'
    );
  }
}

let produtoAtualGerenciando = null;

function abrirModalAdicionaisProduto() {

  if (perfilAtual !== 'gerente') {
    mostrarToast(
      'Apenas o gerente pode gerenciar adicionais.',
      'erro'
    );
    return;
  }

  const prodId =
    document.getElementById(
      'prod-id'
    ).value;

  const prodNome =
    document.getElementById(
      'prod-nome'
    ).value;

  if (!prodId) {

    mostrarToast(
      'Salve o produto primeiro.',
      'erro'
    );

    return;
  }

  produtoAtualGerenciando =
    todosProdutos.find(
      p => p.id === prodId
    );

  if (!produtoAtualGerenciando)
    return;

  document.getElementById(
    'modal-adic-prod-nome'
  ).textContent =
    prodNome;

  document.getElementById(
    'adic-id'
  ).value = '';

  document.getElementById(
    'adic-nome'
  ).value = '';

  document.getElementById(
    'adic-preco'
  ).value = '';

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
      <div
        class="empty"
        style="padding:20px 0"
      >
        <div class="empty-icon">✨</div>
        <div class="empty-msg">
          Nenhum adicional cadastrado
        </div>
      </div>
    `;

    return;
  }

  let html = '';

  produtoAtualGerenciando.adicionais
    .forEach(adic => {

      html += `
        <div
          style="padding:12px;background:var(--superficie);border-radius:var(--raio-sm);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"
        >

          <div>

            <div style="font-weight:500">
              ${adic.nome}
            </div>

            <div
              style="color:var(--laranja);font-size:0.9rem"
            >
              R$ ${Number(adic.preco).toFixed(2)}
            </div>

          </div>

          <div style="display:flex;gap:8px">

            <button
              class="btn-sm"
              onclick="editarAdicional('${adic.id}','${escapeJS(adic.nome)}',${adic.preco})"
              style="padding:6px 12px"
            >
              ✏️
            </button>

            <button
              class="btn-sm-vermelho"
              onclick="excluirAdicional('${adic.id}','${escapeJS(adic.nome)}')"
              style="padding:6px 12px"
            >
              🗑️
            </button>

          </div>

        </div>
      `;
    });

  container.innerHTML = html;
}

function abrirFormAdicional() {

  document.getElementById(
    'adic-id'
  ).value = '';

  document.getElementById(
    'adic-nome'
  ).value = '';

  document.getElementById(
    'adic-preco'
  ).value = '';

  document.getElementById(
    'form-adicional'
  ).style.display = 'block';
}

function cancelarFormAdicional() {

  document.getElementById(
    'form-adicional'
  ).style.display = 'none';
}

function editarAdicional(
  id,
  nome,
  preco
) {

  document.getElementById(
    'adic-id'
  ).value = id;

  document.getElementById(
    'adic-nome'
  ).value = nome;

  document.getElementById(
    'adic-preco'
  ).value = preco;

  document.getElementById(
    'form-adicional'
  ).style.display = 'block';
}

async function salvarAdicional() {

  if (perfilAtual !== 'gerente') {
    mostrarToast(
      'Apenas o gerente pode alterar adicionais.',
      'erro'
    );
    return;
  }

  const adicId =
    document.getElementById(
      'adic-id'
    ).value;

  const nome =
    document.getElementById(
      'adic-nome'
    ).value.trim();

  const preco =
    parseFloat(
      document.getElementById(
        'adic-preco'
      ).value
    );

  if (!nome || isNaN(preco)) {

    mostrarToast(
      'Preencha nome e preço.',
      'erro'
    );

    return;
  }

  if (!produtoAtualGerenciando)
    return;

  if (!adicId) {

    const novoId =
      'adic_' + Date.now();

    if (
      !produtoAtualGerenciando.adicionais
    ) {
      produtoAtualGerenciando.adicionais = [];
    }

    produtoAtualGerenciando.adicionais.push({
      id: novoId,
      nome,
      preco
    });

  } else {

    const adic =
      produtoAtualGerenciando.adicionais
        .find(a => a.id === adicId);

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

    mostrarToast(
      '✅ Adicional salvo!'
    );

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

async function excluirAdicional(
  id,
  nome
) {

  if (perfilAtual !== 'gerente') {
    mostrarToast(
      'Apenas o gerente pode excluir adicionais.',
      'erro'
    );
    return;
  }

  if (
    !confirm(
      `Excluir adicional "${nome}"?`
    )
  ) return;

  if (!produtoAtualGerenciando)
    return;

  produtoAtualGerenciando.adicionais =
    produtoAtualGerenciando.adicionais
      .filter(a => a.id !== id);

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

function alterarQtd(
  id,
  nome,
  preco,
  delta
) {

  if (!carrinho[id]) {

    carrinho[id] = {
      nome,
      preco,
      qtd: 0,
      adicionais: [],
      observacoes: ''
    };
  }

  carrinho[id].qtd += delta;

  if (carrinho[id].qtd <= 0) {
    delete carrinho[id];
  }

  const el =
    document.getElementById(
      'qty-' + id
    );

  if (el) {
    el.textContent =
      carrinho[id]?.qtd || 0;
  }

  const prodEl =
    document.getElementById(
      'prod-' + id
    );

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
        acc + (
          i.preco * i.qtd
        ) +
        (i.adicionais || [])
          .reduce(
            (a, ad) =>
              a +
              ad.preco * ad.qtd,
            0
          ),
      0
    );

  const barra =
    document.getElementById(
      'carrinho-bar'
    );

  if (qtdTotal > 0) {

    barra.style.display =
      'flex';

    document.getElementById(
      'carrinho-qtd'
    ).textContent =
      qtdTotal +
      (
        qtdTotal === 1
          ? ' item'
          : ' itens'
      );

    document.getElementById(
      'carrinho-total-bar'
    ).textContent =
      'R$ ' +
      total.toFixed(2);

  } else {

    barra.style.display =
      'none';
  }
}

function abrirModalCarrinho() {

  const itens =
    Object.values(carrinho);

  if (itens.length === 0) {

    mostrarToast(
      'Adicione pelo menos um produto.',
      'erro'
    );

    return;
  }

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

      htmlAdicionais += `
        <div
          style="margin-top:8px;padding-top:8px;border-top:1px solid var(--borda)"
        >
      `;

      i.adicionais.forEach(adic => {

        const subAdicional =
          adic.preco * adic.qtd;

        subAdicionais +=
          subAdicional;

        htmlAdicionais += `
          <div
            style="font-size:0.85rem;color:var(--texto-2);display:flex;justify-content:space-between;margin-bottom:4px"
          >
            <span>
              + ${adic.qtd}× ${adic.nome}
            </span>

            <span>
              R$ ${subAdicional.toFixed(2)}
            </span>
          </div>
        `;
      });

      htmlAdicionais += '</div>';
    }

    const htmlObs =
      i.observacoes
        ? `
          <div
            style="margin-top:8px;font-size:0.8rem;color:var(--texto-2);font-style:italic"
          >
            📝 ${i.observacoes}
          </div>
        `
        : '';

    total +=
      sub +
      subAdicionais;

    html += `
      <div
        class="relatorio-item"
        style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--borda)"
      >

        <div
          style="display:flex;justify-content:space-between"
        >

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

async function confirmarPedido() {

  const cliente =
    document.getElementById(
      'np-cliente'
    ).value.trim();

  const mesaFuncionario =
    document.getElementById(
      'np-mesa'
    )?.value.trim() || '';

  const endereco =
    document.getElementById(
      'np-endereco'
    )?.value.trim() || '';

  const pagamento =
    document.getElementById(
      'np-pagamento'
    ).value;

  const obs =
    document.getElementById(
      'np-obs'
    ).value.trim();

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
    !endereco
  ) {

    mostrarToast(
      'Informe o endereço de entrega.',
      'erro'
    );

    return;
  }

  const total =
    itens.reduce(
      (acc, i) => {

        let subItem =
          i.preco * i.qtd;

        (i.adicionais || [])
          .forEach(adic => {

            subItem +=
              adic.preco *
              adic.qtd;
          });

        return acc + subItem;

      },
      0
    );

  const nomeCliente =
    dadosClienteAtual?.nome || '';

  const sobrenomeCliente =
    dadosClienteAtual?.sobrenome || '';

  const telefoneCliente =
    dadosClienteAtual?.telefone || '';

  const pedido = {

    cliente:
      cliente || 'Cliente',

    clienteNome:
      perfilAtual === 'cliente'
        ? nomeCliente
        : cliente,

    clienteSobrenome:
      perfilAtual === 'cliente'
        ? sobrenomeCliente
        : '',

    clienteTelefone:
      perfilAtual === 'cliente'
        ? telefoneCliente
        : '',

    clienteTelefoneNormalizado:
      perfilAtual === 'cliente'
        ? telefoneNormalizado(
            telefoneCliente
          )
        : '',

    clienteUid:
      perfilAtual === 'cliente'
        ? usuarioAtual.uid
        : '',

    mesa:
      perfilAtual === 'cliente'
        ? 'Delivery'
        : (
            mesaFuncionario ||
            '—'
          ),

    enderecoEntrega:
      perfilAtual === 'cliente'
        ? endereco
        : '',

    pagamento,

    obs,

    itens,

    total,

    status:
      'aguardando',

    origem:
      perfilAtual === 'cliente'
        ? 'cliente'
        : 'atendente',

    atendente:
      perfilAtual === 'cliente'
        ? ''
        : (
            usuarioAtual?.email ||
            ''
          ),

    criadoEm:
      firebase.firestore.FieldValue
        .serverTimestamp()
  };

  try {

    if (
      perfilAtual === 'cliente'
    ) {

      const telefoneId =
        telefoneNormalizado(
          telefoneCliente
        );

      if (telefoneId) {

        await db
          .collection('clientes')
          .doc(telefoneId)
          .set({

            nome:
              [
                nomeCliente,
                sobrenomeCliente
              ]
              .filter(Boolean)
              .join(' '),

            nomePrincipal:
              nomeCliente,

            sobrenome:
              sobrenomeCliente,

            telefone:
              telefoneCliente,

            telefoneNormalizado:
              telefoneId,

            uidCliente:
              usuarioAtual.uid,

            enderecos:
              firebase.firestore.FieldValue
                .arrayUnion(
                  endereco
                ),

            atualizadoEm:
              firebase.firestore.FieldValue
                .serverTimestamp()

          }, {
            merge: true
          });
      }
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
      'Erro ao salvar pedido:',
      erro
    );

    mostrarToast(
      'Não foi possível enviar o pedido.',
      'erro'
    );
  }
}

function limparFormularioPedido() {

  const clienteEl =
    document.getElementById(
      'np-cliente'
    );

  const mesaEl =
    document.getElementById(
      'np-mesa'
    );

  const enderecoEl =
    document.getElementById(
      'np-endereco'
    );

  const obsEl =
    document.getElementById(
      'np-obs'
    );

  if (
    perfilAtual === 'cliente'
  ) {

    if (clienteEl) {

      clienteEl.value =
        [
          dadosClienteAtual?.nome,
          dadosClienteAtual?.sobrenome
        ]
        .filter(Boolean)
        .join(' ');
    }

    if (mesaEl)
      mesaEl.value = '';

    if (enderecoEl)
      enderecoEl.value = '';

  } else {

    if (clienteEl)
      clienteEl.value = '';

    if (mesaEl)
      mesaEl.value = '';
  }

  if (obsEl)
    obsEl.value = '';

  carrinho = {};

  document.querySelectorAll(
    '.qty-num'
  ).forEach(el => {
    el.textContent = '0';
  });

  document.querySelectorAll(
    '.produto-item'
  ).forEach(el => {
    el.classList.remove(
      'selecionado'
    );
  });

  const barra =
    document.getElementById(
      'carrinho-bar'
    );

  if (barra)
    barra.style.display = 'none';
}

function escutarPedidos() {

  if (unsubPedidos)
    unsubPedidos();

  unsubPedidos =
    db.collection('pedidos')
      .orderBy(
        'criadoEm',
        'desc'
      )
      .onSnapshot(
        snap => {

          todosPedidos =
            snap.docs.map(d => ({
              id: d.id,
              ...d.data()
            }));

          renderizarPedidos();

        },
        erro => {

          console.error(
            'Erro ao escutar pedidos:',
            erro
          );

          mostrarToast(
            'Erro ao sincronizar pedidos.',
            'erro'
          );
        }
      );
}

function renderizarPedidos() {

  const container =
    document.getElementById(
      'lista-pedidos'
    );

  const pedidos =
    filtroAtivo === 'todos'
      ? todosPedidos
      : todosPedidos.filter(
          p =>
            p.status ===
            filtroAtivo
        );

  if (pedidos.length === 0) {

    container.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          📋
        </div>

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
        (p.itens || [])
          .map(i => {

            let subItem =
              i.preco * i.qtd;

            let htmlAdicionaisItem =
              '';

            if (
              i.adicionais &&
              i.adicionais.length > 0
            ) {

              htmlAdicionaisItem += `
                <div
                  style="margin-top:4px;padding-top:4px;border-top:1px solid var(--borda)"
                >
              `;

              i.adicionais
                .forEach(adic => {

                  const subAdicional =
                    adic.preco *
                    adic.qtd;

                  subItem +=
                    subAdicional;

                  htmlAdicionaisItem += `
                    <div
                      style="font-size:0.8rem;color:var(--texto-2);margin-left:8px"
                    >
                      + ${adic.qtd}× ${adic.nome}
                      (R$ ${subAdicional.toFixed(2)})
                    </div>
                  `;
                });

              htmlAdicionaisItem +=
                '</div>';
            }

            const htmlObsItem =
              i.observacoes
                ? `
                  <div
                    style="font-size:0.8rem;color:var(--texto-2);margin-top:4px;font-style:italic"
                  >
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

                  <span
                    style="color:var(--laranja);font-weight:500;margin-left:8px"
                  >
                    R$ ${subItem.toFixed(2)}
                  </span>
                </div>

                ${htmlAdicionaisItem}
                ${htmlObsItem}

              </div>
            `;
          })
          .join('');

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
        p.status === 'aguardando'
      ) {

        acoes += `
          <button
            class="btn-sm"
            onclick="mudarStatusPedido('${p.id}','preparo')"
          >
            🔥 Em Preparo
          </button>
        `;

        acoes += `
          <button
            class="btn-sm-vermelho"
            onclick="mudarStatusPedido('${p.id}','cancelado')"
          >
            ❌ Cancelar
          </button>
        `;
      }

      if (
        p.status === 'preparo'
      ) {

        acoes += `
          <button
            class="btn-sm-verde"
            onclick="mudarStatusPedido('${p.id}','pronto')"
          >
            ✅ Pronto
          </button>
        `;

        acoes += `
          <button
            class="btn-sm-vermelho"
            onclick="mudarStatusPedido('${p.id}','cancelado')"
          >
            ❌ Cancelar
          </button>
        `;
      }

      if (
        p.status === 'pronto'
      ) {

        acoes += `
          <button
            class="btn-sm"
            onclick='verComprovante(${JSON.stringify(p)})'
          >
            🧾 Comprovante
          </button>
        `;
      }

      if (
        perfilAtual === 'gerente'
      ) {

        acoes += `
          <button
            class="btn-sm-vermelho"
            onclick="excluirPedido('${p.id}')"
          >
            🗑️
          </button>
        `;
      }

      return `
        <div class="pedido-card">

          <div class="pedido-header">

            <div>

              <div class="pedido-num">
                Pedido #${p.id.slice(-4).toUpperCase()}
              </div>

              <div class="pedido-hora">
                ⏰ ${hora}
                · 🪑 ${p.mesa || '—'}
                · 👤 ${p.cliente || 'Cliente'}
              </div>

              <div
                class="pedido-hora"
                style="margin-top:2px"
              >
                💳 ${p.pagamento || '—'}
                · 👨‍💼 ${
                  p.atendente ||
                  (
                    p.origem === 'cliente'
                      ? 'Cliente'
                      : '—'
                  )
                }
              </div>

              ${
                p.enderecoEntrega
                  ? `
                    <div
                      class="pedido-hora"
                      style="margin-top:2px"
                    >
                      📍 ${p.enderecoEntrega}
                    </div>
                  `
                  : ''
              }

            </div>

            <div>
              <span
                class="status-badge ${st.cls}"
              >
                ${st.label}
              </span>
            </div>

          </div>

          <div class="pedido-itens">
            ${itensHtml}
          </div>

          <div
            style="text-align:right;font-weight:700;color:var(--laranja)"
          >
            Total:
            R$ ${Number(p.total || 0).toFixed(2)}
          </div>

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

  if (
    perfilAtual !== 'gerente' &&
    perfilAtual !== 'atendente'
  ) {
    return;
  }

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
      'Erro ao atualizar status.',
      'erro'
    );
  }
}

async function excluirPedido(id) {

  if (perfilAtual !== 'gerente')
    return;

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
      'Erro ao excluir pedido.',
      'erro'
    );
  }
}

function filtrarPedidos(
  filtro,
  btn
) {

  filtroAtivo = filtro;

  document.querySelectorAll(
    '.filtro-btn'
  ).forEach(b => {
    b.classList.remove(
      'ativo'
    );
  });

  if (btn)
    btn.classList.add('ativo');

  renderizarPedidos();
}

function exibirComprovante(
  pedido
) {

  const agora =
    new Date()
      .toLocaleString('pt-BR');

  const itensHtml =
    (pedido.itens || [])
      .map(i => `
        <div
          style="display:flex;justify-content:space-between"
        >
          <span>
            ${i.qtd}× ${i.nome}
          </span>

          <span>
            R$ ${(i.preco * i.qtd).toFixed(2)}
          </span>
        </div>
      `)
      .join('');

  document.getElementById(
    'comprovante-conteudo'
  ).innerHTML = `

    <div class="comprovante">

      <div class="comprovante-logo">
        🥤 BATIDÃO
      </div>

      <div
        style="text-align:center;font-size:0.75rem"
      >
        Casa de Sucos Naturais
      </div>

      <div class="comprovante-linha"></div>

      <div>
        Data: ${agora}
      </div>

      <div>
        Pedido:
        #${pedido.id.slice(-4).toUpperCase()}
      </div>

      <div>
        Cliente:
        ${pedido.cliente}
      </div>

      <div>
        Mesa:
        ${pedido.mesa || '—'}
      </div>

      ${
        pedido.enderecoEntrega
          ? `
            <div>
              Endereço:
              ${pedido.enderecoEntrega}
            </div>
          `
          : ''
      }

      <div class="comprovante-linha"></div>

      <div
        style="font-weight:700;margin-bottom:4px"
      >
        ITENS
      </div>

      ${itensHtml}

      <div class="comprovante-linha"></div>

      <div
        style="display:flex;justify-content:space-between;font-weight:900"
      >
        <span>TOTAL</span>

        <span>
          R$ ${Number(
            pedido.total || 0
          ).toFixed(2)}
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

      <div
        style="text-align:center;font-size:0.75rem"
      >
        Obrigado pela preferência! 😊
      </div>

    </div>
  `;

  document.getElementById(
    'modal-comprovante'
  ).classList.add('aberto');
}

function verComprovante(
  pedido
) {
  exibirComprovante(
    pedido
  );
}

let todosClientes = [];
let clientesFiltrados = [];

function carregarClientes() {

  db.collection('clientes')
    .orderBy('nome')
    .onSnapshot(
      snap => {

        todosClientes =
          snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }));

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

        mostrarToast(
          'Erro ao carregar clientes.',
          'erro'
        );
      }
    );
}

function renderizarClientes(
  lista
) {

  const container =
    document.getElementById(
      'lista-clientes'
    );

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
            ${c.nome}
          </div>

          <div class="cliente-tel">
            ${c.telefone || '—'}
          </div>

          ${
            c.enderecos &&
            c.enderecos.length
              ? `
                <div
                  style="font-size:0.72rem;color:var(--texto-2);margin-top:3px"
                >
                  📍 ${c.enderecos.length}
                  endereço(s)
                </div>
              `
              : ''
          }

        </div>

        <div
          style="display:flex;gap:6px"
        >

          <button
            class="btn-sm"
            onclick="verHistorico('${c.id}','${escapeJS(c.nome)}')"
          >
            📋
          </button>

          <button
            class="btn-sm-vermelho"
            onclick="excluirCliente('${c.id}','${escapeJS(c.nome)}')"
          >
            🗑️
          </button>

        </div>

      </div>

    `).join('');
}

function buscarCliente(
  termo
) {

  const t =
    termo.toLowerCase();

  const resultado =
    todosClientes.filter(
      c =>
        (c.nome || '')
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

  if (
    perfilAtual !== 'gerente' &&
    perfilAtual !== 'atendente'
  ) {
    return;
  }

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

  const dados = {

    nome,

    telefone,

    telefoneNormalizado:
      telefoneNormalizado(
        telefone
      ),

    enderecos: [],

    criadoEm:
      firebase.firestore.FieldValue
        .serverTimestamp()
  };

  try {

    const id =
      telefoneNormalizado(
        telefone
      );

    if (id) {

      await db
        .collection('clientes')
        .doc(id)
        .set(
          dados,
          {
            merge: true
          }
        );

    } else {

      await db
        .collection('clientes')
        .add(dados);
    }

    fecharModal(
      'modal-cliente'
    );

    mostrarToast(
      'Cliente cadastrado!'
    );

  } catch (erro) {

    console.error(erro);

    mostrarToast(
      'Erro ao cadastrar cliente.',
      'erro'
    );
  }
}

async function excluirCliente(
  id,
  nome
) {

  if (
    perfilAtual !== 'gerente' &&
    perfilAtual !== 'atendente'
  ) return;

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
      'Erro ao remover cliente.',
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

    const cliente =
      todosClientes.find(
        c => c.id === clienteId
      );

    let snap;

    if (
      cliente?.telefoneNormalizado
    ) {

      snap =
        await db
          .collection('pedidos')
          .where(
            'clienteTelefoneNormalizado',
            '==',
            cliente.telefoneNormalizado
          )
          .orderBy(
            'criadoEm',
            'desc'
          )
          .get();

    } else {

      snap =
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
    }

    if (snap.empty) {

      document.getElementById(
        'historico-conteudo'
      ).innerHTML = `
        <div class="empty">
          <div class="empty-msg">
            Nenhum pedido encontrado.
          </div>
        </div>
      `;

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

    pedidos.forEach(p => {

      totalGasto +=
        Number(p.total || 0);

      const hora =
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

            <div
              style="font-weight:600"
            >
              #${p.id.slice(-4).toUpperCase()}
              · ${hora}
            </div>

            <div
              style="font-size:0.78rem;color:var(--texto-2)"
            >
              ${(p.itens || [])
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
    });

    html = `
      <div
        style="padding:10px;background:var(--fundo);border-radius:var(--raio-sm);margin-bottom:12px"
      >

        <span
          style="color:var(--texto-2);font-size:0.8rem"
        >
          Total gasto
        </span>

        <div
          style="font-family:'Syne',sans-serif;font-size:1.4rem;color:var(--laranja)"
        >
          ${pedidos.length}
          pedidos ·
          R$ ${totalGasto.toFixed(2)}
        </div>

      </div>
    ` + html;

    document.getElementById(
      'historico-conteudo'
    ).innerHTML = html;

  } catch (erro) {

    console.error(
      'Erro no histórico:',
      erro
    );

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

async function carregarRelatorio() {

  if (perfilAtual !== 'gerente')
    return;

  const periodo =
    document.getElementById(
      'rel-periodo'
    ).value;

  const agora =
    new Date();

  let dataInicio =
    new Date();

  if (
    periodo === 'hoje'
  ) {

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

  try {

    const tsInicio =
      firebase.firestore.Timestamp
        .fromDate(
          dataInicio
        );

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

    validos.forEach(p => {

      (p.itens || [])
        .forEach(i => {

          contagem[i.nome] =
            (
              contagem[i.nome] ||
              0
            ) + i.qtd;
        });
    });

    const ranking =
      Object.entries(contagem)
        .sort(
          (a, b) =>
            b[1] - a[1]
        )
        .slice(0, 10);

    const maisVendidos =
      document.getElementById(
        'rel-mais-vendidos'
      );

    if (
      ranking.length === 0
    ) {

      maisVendidos.innerHTML = `
        <div class="empty">
          <div class="empty-msg">
            Sem dados no período.
          </div>
        </div>
      `;

      return;
    }

    maisVendidos.innerHTML =
      ranking.map(
        ([nome, qtd], idx) => `
          <div class="relatorio-item">

            <span>
              ${idx + 1}. ${nome}
            </span>

            <span class="relatorio-valor">
              ${qtd} vendidos
            </span>

          </div>
        `
      ).join('');

  } catch (erro) {

    console.error(
      'Erro no relatório:',
      erro
    );

    mostrarToast(
      'Erro ao carregar relatório.',
      'erro'
    );
  }
}

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

  toast.textContent =
    msg;

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

document.querySelectorAll(
  '.modal-overlay'
).forEach(
  overlay => {

    overlay.addEventListener(
      'click',
      e => {

        if (
          e.target ===
          overlay
        ) {

          overlay.classList.remove(
            'aberto'
          );
        }
      }
    );
  }
);

document.getElementById(
  'input-senha'
).addEventListener(
  'keydown',
  e => {

    if (e.key === 'Enter') {
      fazerLogin();
    }
  }
);

document.getElementById(
  'cliente-login-telefone'
).addEventListener(
  'keydown',
  e => {

    if (e.key === 'Enter') {
      entrarComoCliente();
    }
  }
);

let produtoAtualAdicionais = null;
let adicionaisTemp = {};

function abrirModalAdicionais(
  produtoId
) {

  const produto =
    todosProdutos.find(
      p => p.id === produtoId
    );

  if (!produto)
    return;

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
  ).classList.add('aberto');
}

function renderizarAdicionais() {

  const lista =
    document.getElementById(
      'modal-adicionais-lista'
    );

  if (
    !produtoAtualAdicionais?.adicionais ||
    produtoAtualAdicionais.adicionais.length === 0
  ) {

    lista.innerHTML = `
      <div
        class="empty"
        style="padding:20px 0"
      >

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

  produtoAtualAdicionais.adicionais
    .forEach(adic => {

      const qtdAdicional =
        adicionaisTemp[adic.id] ||
        0;

      html += `
        <div
          style="padding:12px;background:var(--superficie);border-radius:var(--raio-sm);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"
        >

          <div>

            <div style="font-weight:500">
              ${adic.nome}
            </div>

            <div
              style="color:var(--laranja);font-size:0.9rem"
            >
              + R$ ${Number(
                adic.preco
              ).toFixed(2)}
            </div>

          </div>

          <div class="qty-ctrl">

            <button
              class="qty-btn"
              onclick="alterarQtyAdicional('${adic.id}',-1)"
            >
              −
            </button>

            <span
              class="qty-num"
              style="min-width:24px"
            >
              ${qtdAdicional}
            </span>

            <button
              class="qty-btn"
              onclick="alterarQtyAdicional('${adic.id}',+1)"
            >
              +
            </button>

          </div>

        </div>
      `;
    });

  lista.innerHTML =
    html;
}

function alterarQtyAdicional(
  adicionalId,
  delta
) {

  adicionaisTemp[adicionalId] =
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

  if (!produtoAtualAdicionais)
    return;

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

      observacoes:
        obs
    };

  } else {

    carrinho[prodId].qtd += 1;

    carrinho[prodId].observacoes =
      obs;
  }

  Object.entries(
    adicionaisTemp
  ).forEach(
    ([adicionalId, qtdAdicional]) => {

      if (
        qtdAdicional > 0
      ) {

        const adicional =
          produtoAtualAdicionais
            .adicionais
            .find(
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

async function definirDestaquesPadrao() {

  if (
    !usuarioAtual ||
    perfilAtual !== 'gerente'
  ) {

    alert(
      '❌ Apenas gerentes podem fazer isso.'
    );

    return;
  }

  if (
    !confirm(
      'Isso vai marcar automaticamente os "Mais Pedidos" e "Promoções" no cardápio. Continuar?'
    )
  ) return;

  const maisVendidosChaves = [

    'linguiça (tradicional)',
    'linguica (tradicional)',

    'linguiça completao',
    'linguica completao',

    'laranja c/ morango',

    'frango',

    'misto quente',

    'maracujá 500ml',
    'maracuja 500ml'
  ];

  const categoriasPromo =
    ['combos'];

  let atualizados = 0;

  const batch =
    db.batch();

  todosProdutos.forEach(
    p => {

      const n =
        (p.nome || '')
          .toLowerCase();

      const c =
        (p.categoria || '')
          .toLowerCase();

      const ehMaisVendido =
        maisVendidosChaves.some(
          chave =>
            n.includes(chave)
        );

      const ehPromocao =
        categoriasPromo.some(
          cat =>
            c.includes(cat)
        );

      if (
        ehMaisVendido ||
        ehPromocao
      ) {

        const ref =
          db.collection(
            'produtos'
          ).doc(p.id);

        batch.update(
          ref,
          {
            maisVendido:
              ehMaisVendido,

            promocao:
              ehPromocao
          }
        );

        atualizados++;
      }
    }
  );

  try {

    await batch.commit();

    mostrarToast(
      '✅ ' +
      atualizados +
      ' produtos marcados! As seções já aparecem no cardápio.',
      'sucesso'
    );

  } catch (erro) {

    console.error(erro);

    mostrarToast(
      'Erro ao definir destaques.',
      'erro'
    );
  }
}

async function popularProdutosComDados() {

  if (
    !usuarioAtual ||
    perfilAtual !== 'gerente'
  ) {

    alert(
      '❌ Apenas gerentes podem popular produtos. Faça login como gerente!'
    );

    return;
  }

  const produtosCompletos = [

    {
      nome:
        'PAO COM LINGUIÇA (Tradicional)',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        15.90,
      descricao:
        'Linguiça de Pernil, Mix de Alface e Rúcula, Tomate e Molho especial'
    },

    {
      nome:
        'PÃO COM LINGUIÇA COMPLETAO',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        22.90,
      descricao:
        'LINGUIÇA TRADICIONAL COM ADICIONAL DE OVO QUEIJO E PRESUNTO'
    },

    {
      nome:
        'PAO COM LINGUIÇA DUPLO',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        22.90,
      descricao:
        '150g de Linguiça de Pernil, Mix de Alface e Rúcula, Tomate e Molho especial'
    },

    {
      nome:
        'Frango',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        17.90,
      descricao:
        '100g Frango Desfiado, Mix de Alface e Rúcula, Tomate e Molho especial'
    },

    {
      nome:
        'Pernil',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        17.90,
      descricao:
        '100g Pernil Desfiado, Mix de Alface e Rúcula, Tomate e Molho especial'
    },

    {
      nome:
        'Linguiça Artesanal Apimentada',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        22.90,
      descricao:
        '150g de Linguiça Artesanal Apimentada (ardor médio), acompanha Queijo Provolone, Tomate, Rúcula e molho da casa'
    },

    {
      nome:
        'Carne Louca',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        20.90,
      descricao:
        '100g Carne bovina Desfiada com tempero da casa, Mix de Alface e Rúcula, Tomate e Molho especial'
    },

    {
      nome:
        'Misto Quente',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        11.90,
      descricao:
        '3 fatias de Presunto, Queijo e molho especial da casa'
    },

    {
      nome:
        'Ovo e Queijo',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        11.90,
      descricao:
        '3 Ovos com Queijo'
    },

    {
      nome:
        'Misto Quente COM SALADA',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        15.90,
      descricao:
        'Pão Frances, Presunto e Queijo, Alface, Rucúla, Tomate e Molhos'
    },

    {
      nome:
        'Ovo Queijo COM SALADA',
      categoria:
        'LANCHES NO PÃO FRANCES',
      preco:
        15.90,
      descricao:
        'Pão Frances, 3 ovos, queijo mussarela, Alface, Rucula, Tomate e molhos'
    },

    {
      nome:
        '2 LINGUICA TRADICIONAL + 1 LITRO SUCO DE LARANJA COM MORANGO',
      categoria:
        'COMBOS MATA FOME',
      preco:
        47.90,
      descricao:
        'O lanche e o suco mais vendidos em uma combinação perfeita'
    },

    {
      nome:
        '2 LINGUICA COMPLETÃO + 1 LITRO SUCO DE LARANJA COM MORANGO',
      categoria:
        'COMBOS MATA FOME',
      preco:
        65.90,
      descricao:
        'O lanche de linguiça turbinado e o suco mais vendidos em uma combinação perfeita'
    },

    {
      nome:
        'Laranja c/ Morango 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja e Acerola 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'FRUTAS VERMELHAS COM LARANJA',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        14.90,
      descricao:
        'Morango, Laranja e Amora 500ml + chorinho'
    },

    {
      nome:
        'Abacaxi c/ Hortelã 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Morango c/ Maracujá 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Abacaxi c/ Limão 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Abacaxi c/ Gengibre 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja, Manga e Banana 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        14.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Abacaxi c/ Melancia 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Agua de Coco c/ Abacaxi e Hortelã 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        16.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Abacaxi c/ Uva 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Agua de Coco c/ Goiaba 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        16.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Coco Suíço 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        15.90,
      descricao:
        'Preparado com leite e leite condensado'
    },

    {
      nome:
        'LaraCreme 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        15.90,
      descricao:
        'Suco de Laranja com Sorvete de Creme'
    },

    {
      nome:
        'Laranja, Acerola e Mamão 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        14.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja, Acerola e Morango 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        14.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Agua de Coco c/ Mamão 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        16.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja, Acerola, Hortelã e Mel 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        15.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja c/ Abacaxi 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja c/ Cenoura 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja c/ Maracujá 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja c/ Mamão 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja c/ Manga 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'LaraCreme COM MORANGO 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        17.90,
      descricao:
        'Suco de Laranja com Sorvete de Creme artesanal batido com morangos'
    },

    {
      nome:
        'Laranja, Cenoura e Beterraba 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        14.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'FRUTAS VERMELHAS - Amora com Morango',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        'As frutas mais gostosas e doces em uma combinação perfeita'
    },

    {
      nome:
        'Laranja c/ Goiaba 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja c/ Pêssego 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranjada Suíça 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        15.90,
      descricao:
        'Laranja e Leite Condensado'
    },

    {
      nome:
        'Laranja, Limão e Maracujá 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        14.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Laranja e Beterraba 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Limonada Suíça 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        15.90,
      descricao:
        'Preparado com Leite e Leite Condensado'
    },

    {
      nome:
        'Manga c/ Acerola 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Maracuja c/ Manga 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Melancia c/ Gengibre 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        13.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Melancia, Morango e Hortelã 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        14.90,
      descricao:
        '500ml + chorinho'
    },

    {
      nome:
        'Maracujá 500ml + chorinho',
      categoria:
        'SUCOS ESPECIAIS',
      preco:
        11.90,
      descricao:
        '500ml + chorinho'
    }
  ];

  let adicionados = 0;
  let erros = 0;

  for (
    const produto
    of produtosCompletos
  ) {

    try {

      await db
        .collection('produtos')
        .add({

          nome:
            produto.nome,

          preco:
            produto.preco,

          categoria:
            produto.categoria,

          descricao:
            produto.descricao || '',

          criadoEm:
            firebase.firestore.FieldValue
              .serverTimestamp()
        });

      adicionados++;

    } catch (erro) {

      console.error(
        'Erro ao adicionar',
        produto.nome,
        erro
      );

      erros++;
    }
  }

  mostrarToast(
    `✅ ${adicionados} produtos adicionados! ${
      erros > 0
        ? `(${erros} erros)`
        : ''
    }`,
    'sucesso'
  );
}
