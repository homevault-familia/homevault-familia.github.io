# HomeVault — guia de instalação

O HomeVault é um app de finanças da casa:

- cada pessoa cria a própria conta (e-mail e senha);
- cada família tem uma **casa** protegida por uma **senha da casa**;
- todos os lançamentos são **criptografados no aparelho** antes de irem para o banco;
- nem o administrador (você) consegue ler os dados das famílias.

Este é um ambiente **totalmente separado** do app atual (`luizkatiu62.github.io`). O guia não pede nenhuma mudança no app atual, no repositório dele ou no Firebase `gastos-casa-7f431`.

Leva uns 20 minutos. Faça de preferência no computador.

---

## Parte 1 — Criar o Firebase novo

1. Acesse **console.firebase.google.com** e toque em **Adicionar projeto** (ou "Criar um projeto").
2. Nome: `homevault`. O Google Analytics pode ser desativado. Toque em **Criar projeto**.
3. **Ativar o login por e-mail**
   - No menu, abra **Criação → Authentication → Vamos começar**.
   - Em **Método de login**, escolha **E-mail/senha**, ative a primeira opção e toque em **Salvar**.
   - ⚠️ **Não** ative o login "Anônimo".
4. **Criar o banco**
   - No menu, abra **Criação → Realtime Database → Criar banco de dados**.
   - Local: **Estados Unidos (us-central1)**.
   - Escolha **Iniciar no modo bloqueado** e toque em **Ativar**.
5. **Colar as regras de segurança**
   - Ainda no Realtime Database, abra a aba **Regras**.
   - Apague tudo e cole o conteúdo do arquivo **`database.rules.json`**.
   - Toque em **Publicar**.
6. **Pegar a configuração do app**
   - Toque na ⚙️ → **Configurações do projeto**.
   - Em **Seus apps**, toque no ícone **`</>`** (Web). Apelido: `HomeVault`. **Não** marque o Firebase Hosting. Toque em **Registrar app**.
   - Vai aparecer um bloco `firebaseConfig` com `apiKey`, `authDomain` etc.
   - Abra o arquivo **`config.js`** e substitua cada `COLE_AQUI` pelos valores correspondentes.
   - Se o `databaseURL` não aparecer no bloco, copie o endereço mostrado no topo da página do Realtime Database (algo como `https://homevault-xxxxx-default-rtdb.firebaseio.com`).
7. **E-mails em português** (opcional): em **Authentication → Modelos**, troque o idioma para Português.

> Os valores do `config.js` são públicos por natureza (todo app web do Firebase os expõe). Quem protege os dados são as regras do passo 5 e a criptografia.

---

## Parte 2 — Publicar o app no GitHub (num endereço próprio)

O app atual usa um service worker que controla todo o endereço `luizkatiu62.github.io/…`. Por isso o HomeVault deve ficar em **outro endereço**. Assim, um app não interfere no outro. Para isso, use uma organização gratuita do GitHub.

1. No GitHub, toque no **+** (canto superior direito) → **New organization** → plano **Free**.
   - Nome da organização: por exemplo `homevault-app`. Se já estiver em uso, tente outro nome, como `homevault-familia`.
2. Dentro da organização, crie um repositório **público** com o nome exato **`<nome-da-organização>.github.io`** (exemplo: `homevault-app.github.io`).
3. No repositório, toque em **Add file → Upload files**. Arraste **todos os arquivos** desta pasta (o conteúdo, não a pasta) e toque em **Commit changes**.
   - Arquivos: `index.html`, `app.js`, `config.js` (já preenchido), `sw.js`, `manifest.json`, `icon.svg`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `database.rules.json`, `README.md`.
4. Em **Settings → Pages**: Source = **Deploy from a branch**, Branch = **main** e **/(root)**. Toque em **Save**.
5. Depois de 1 ou 2 minutos, o app estará em **`https://homevault-app.github.io`** (com o nome que você escolheu).
6. De volta ao Firebase, abra **Authentication → Configurações → Domínios autorizados → Adicionar domínio** e adicione `homevault-app.github.io`.

> O repositório é público, mas ele só contém o código. Nenhum dado de nenhuma família fica no GitHub.

---

## Parte 3 — Primeiro teste

1. Abra o endereço do app, toque em **Criar conta** e depois em **Criar casa** (use uma casa de teste sua).
2. Faça alguns lançamentos. Teste as categorias e o resumo.
3. Abra o Firebase, vá em **Realtime Database** e confira que lá só aparecem códigos ilegíveis (`iv`, `d`), sem valores nem nomes.
4. Se quiser, apague essa casa de teste pelo próprio console (você é o dono do Firebase).

## Parte 4 — Convidar sua filha

1. Mande para ela o endereço do app.
2. No iPhone, ela abre no **Safari** e toca em **Compartilhar → Adicionar à Tela de Início**.
3. Ela toca em **Criar conta** e depois em **Criar casa**, com a senha da casa **dela**. Você não precisa saber essa senha.
4. Para o marido dela entrar na mesma casa: ela abre **Ajustes → Convidar**, envia o código e passa a senha da casa separadamente. Ele cria a conta dele e toca em **Tenho um convite**.

---

## Como a privacidade funciona

| Quem | O que consegue ver |
|---|---|
| Membros da casa (com a senha da casa) | Tudo da própria casa |
| Outros usuários do HomeVault | Nada: as regras do banco bloqueiam o acesso |
| Você, como dono do Firebase | Só dados criptografados (ilegíveis) |
| Quem lê o código no GitHub | Só o código, nenhum dado |

- **Criptografia:** AES-GCM de 256 bits. A chave é derivada da senha da casa com PBKDF2-SHA256 (310.000 iterações). A senha da casa nunca sai do aparelho.
- **Fica visível para o dono do Firebase:** o e-mail das contas (em Authentication), quantos lançamentos cada casa tem e quando foram criados. Valores, categorias, descrições e nomes ficam todos criptografados.
- **Senha da casa esquecida = dados perdidos.** Por isso, recomende que cada família faça o **Backup (JSON)** de vez em quando (em Ajustes).
- **Senha da conta esquecida:** a pessoa usa "Esqueci minha senha" e recebe um e-mail de redefinição. A senha da casa não muda.

## Atualizações

Para publicar uma nova versão, substitua os arquivos no repositório. Os aparelhos pegam a versão nova na próxima vez que o app for aberto com internet.

## Limites do plano gratuito do Firebase (Spark)

Para dezenas de famílias, o plano gratuito sobra: 1 GB de dados, 10 GB de download por mês e 100 conexões simultâneas.
