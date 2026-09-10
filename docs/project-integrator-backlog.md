# Projeto Integrador — Épicos e Histórias de Usuário

Este documento define o recorte funcional do **star_byte** utilizado no Projeto Integrador.

O backlog geral do repositório contém funcionalidades de produto, infraestrutura, distribuição, self-hosting e evoluções futuras. Para o Projeto Integrador, o escopo foi reduzido aos fluxos que representam diretamente a experiência do usuário e que permitem demonstrar o funcionamento da plataforma de ponta a ponta.

## Visão do produto

O star_byte é uma plataforma de comunicação privada voltada a comunidades fechadas. O sistema é desktop-first e permite organizar usuários em Rooms, dividir conversas em Text Threads, trocar mensagens privadas por Whispers e utilizar recursos como perfis, respostas, anexos, menções e notificações.

## Épicos do Projeto Integrador

| ID | Épico | Relação com o backlog do GitHub |
| --- | --- | --- |
| EP-01 | Gerenciamento de Contas e Acesso | #4 — Core usability and account safety |
| EP-02 | Gerenciamento de Perfil e Identidade | #42 — Profiles and identity |
| EP-03 | Gerenciamento de Comunidades e Conversas | #23 — Organization and discovery / #55 — Community features |
| EP-04 | Comunicação entre Usuários | #14 — Messaging and expression |
| EP-05 | Sistema de Notificações | #31 — Notifications |
| EP-06 | Administração e Controle de Acesso | #36 — Permissions and moderation |

## Prioridades

- **Alta:** necessária para o fluxo principal e para a demonstração do Projeto Integrador.
- **Média:** importante para completar a experiência do usuário, mas não bloqueia o fluxo principal.
- **Baixa:** evolução complementar que pode ser implementada após o núcleo do sistema.

---

## EP-01 — Gerenciamento de Contas e Acesso

### HU-01 — Criar conta

**Como** visitante,  
**quero** criar uma conta no star_byte,  
**para** poder acessar a plataforma.

**Prioridade:** Alta

**Critérios de aceitação:**

1. O usuário deve informar os dados obrigatórios para cadastro.
2. O sistema deve impedir o cadastro quando os dados obrigatórios forem inválidos ou estiverem ausentes.
3. O sistema não deve permitir a criação de uma conta com identificador já utilizado.
4. Após um cadastro válido, a conta deve poder ser utilizada para autenticação.

### HU-02 — Realizar login

**Como** usuário cadastrado,  
**quero** autenticar-me na plataforma,  
**para** acessar minhas Rooms, Threads e Whispers.

**Prioridade:** Alta

**Critérios de aceitação:**

1. O sistema deve aceitar credenciais válidas.
2. Credenciais inválidas devem gerar uma mensagem de erro sem iniciar uma sessão.
3. Após o login, o usuário deve ter acesso somente aos recursos permitidos para sua conta.
4. A sessão deve permanecer válida durante a utilização normal do cliente.

### HU-03 — Encerrar sessão

**Como** usuário autenticado,  
**quero** encerrar minha sessão,  
**para** impedir que outra pessoa continue utilizando minha conta no dispositivo.

**Prioridade:** Média

**Critérios de aceitação:**

1. Deve existir uma ação para sair da conta.
2. Ao sair, as credenciais locais da sessão devem deixar de ser utilizadas.
3. Recursos autenticados não devem permanecer acessíveis após o logout.

---

## EP-02 — Gerenciamento de Perfil e Identidade

### HU-04 — Editar perfil

**Como** usuário,  
**quero** editar minhas informações de perfil,  
**para** personalizar minha identidade na plataforma.

**Prioridade:** Alta

**Critérios de aceitação:**

1. O usuário deve poder alterar as informações de perfil disponibilizadas pelo sistema.
2. O usuário deve poder atualizar seu avatar.
3. As alterações devem permanecer disponíveis após sair e entrar novamente no sistema.
4. Outros usuários devem visualizar os dados públicos atualizados.

### HU-05 — Visualizar perfil de outro usuário

**Como** usuário,  
**quero** visualizar o perfil de outro participante,  
**para** identificá-lo e consultar suas informações públicas.

**Prioridade:** Média

**Critérios de aceitação:**

1. O perfil deve poder ser aberto a partir de uma área em que o usuário esteja identificado.
2. O sistema deve apresentar as informações públicas disponíveis daquele participante.
3. A visualização de um perfil não deve permitir a alteração dos dados de outro usuário.

---

## EP-03 — Gerenciamento de Comunidades e Conversas

### HU-06 — Criar uma Room

**Como** usuário,  
**quero** criar uma Room,  
**para** reunir participantes em uma comunidade própria.

**Prioridade:** Alta

**Critérios de aceitação:**

1. O usuário deve poder informar os dados necessários para criar a Room.
2. A Room criada deve aparecer na lista de Rooms do criador.
3. O criador deve ser registrado como participante da Room.
4. A Room deve permanecer disponível após reiniciar o cliente.

### HU-07 — Entrar em uma Room

**Como** usuário,  
**quero** entrar em uma Room utilizando um Room Pass válido,  
**para** participar de uma comunidade à qual fui convidado.

**Prioridade:** Alta

**Critérios de aceitação:**

1. O sistema deve permitir informar um Room Pass.
2. Um Room Pass válido deve adicionar o usuário à Room correspondente.
3. Um Room Pass inválido deve ser rejeitado.
4. Após entrar, a Room deve aparecer na lista do usuário sem necessidade de um novo login.

### HU-08 — Visualizar participantes de uma Room

**Como** membro de uma Room,  
**quero** visualizar seus participantes,  
**para** saber quem faz parte da comunidade.

**Prioridade:** Média

**Critérios de aceitação:**

1. A Room deve disponibilizar sua lista de participantes.
2. Novos membros devem aparecer na lista após ingressarem.
3. Usuários que não fazem mais parte da Room não devem continuar sendo apresentados como membros ativos.

### HU-09 — Utilizar Text Threads

**Como** membro de uma Room,  
**quero** acessar Text Threads,  
**para** separar conversas por contexto ou assunto.

**Prioridade:** Alta

**Critérios de aceitação:**

1. A Room deve apresentar seus Text Threads disponíveis.
2. O usuário deve poder selecionar um Thread e visualizar suas mensagens.
3. Ao trocar de Thread, o conteúdo exibido deve corresponder ao Thread selecionado.
4. O acesso aos Threads deve respeitar a participação do usuário na Room.

---

## EP-04 — Comunicação entre Usuários

### HU-10 — Enviar mensagem

**Como** usuário,  
**quero** enviar mensagens em um Text Thread,  
**para** conversar com outros participantes.

**Prioridade:** Alta

**Critérios de aceitação:**

1. O usuário deve poder escrever e enviar uma mensagem.
2. A mensagem enviada deve aparecer no Thread correspondente.
3. Outros participantes conectados devem receber a nova mensagem.
4. A mensagem deve permanecer disponível após recarregar ou reconectar o cliente.

### HU-11 — Editar mensagem

**Como** usuário,  
**quero** editar uma mensagem que enviei,  
**para** corrigir ou atualizar seu conteúdo.

**Prioridade:** Média

**Critérios de aceitação:**

1. Somente o autor deve poder utilizar a edição normal de sua mensagem.
2. O novo conteúdo deve substituir o conteúdo anterior na interface.
3. A alteração deve ser sincronizada com os demais participantes conectados.

### HU-12 — Excluir mensagem

**Como** usuário,  
**quero** excluir uma mensagem que enviei,  
**para** remover um conteúdo que não desejo mais manter na conversa.

**Prioridade:** Média

**Critérios de aceitação:**

1. O autor deve poder solicitar a exclusão de sua própria mensagem.
2. A mensagem excluída não deve continuar disponível como uma mensagem comum no Thread.
3. A alteração deve ser refletida para os demais participantes.

### HU-13 — Responder a uma mensagem

**Como** usuário,  
**quero** responder diretamente a uma mensagem,  
**para** preservar o contexto da conversa.

**Prioridade:** Alta

**Critérios de aceitação:**

1. O usuário deve poder selecionar uma mensagem como referência de resposta.
2. A nova mensagem deve indicar visualmente qual mensagem está sendo respondida.
3. A relação entre a resposta e a mensagem original deve permanecer após recarregar o Thread.

### HU-14 — Enviar anexos

**Como** usuário,  
**quero** anexar arquivos ou imagens às mensagens,  
**para** compartilhar conteúdo com outros participantes.

**Prioridade:** Média

**Critérios de aceitação:**

1. O usuário deve poder selecionar um arquivo suportado para envio.
2. O anexo deve ficar associado à mensagem correspondente.
3. Participantes autorizados devem conseguir visualizar ou acessar o anexo.
4. Falhas de upload devem ser informadas sem criar uma mensagem inconsistente.

### HU-15 — Mencionar um usuário

**Como** usuário,  
**quero** mencionar outro participante em uma mensagem,  
**para** direcionar sua atenção para aquela conversa.

**Prioridade:** Alta

**Critérios de aceitação:**

1. O sistema deve reconhecer menções a usuários válidos no contexto da conversa.
2. A menção deve ficar identificável visualmente na mensagem.
3. O usuário mencionado deve poder receber a notificação correspondente.
4. Uma referência a um usuário inexistente não deve ser tratada como uma menção válida.

### HU-16 — Conversar por Whisper

**Como** usuário,  
**quero** iniciar um Whisper com outro usuário,  
**para** manter uma conversa privada fora dos Text Threads públicos da Room.

**Prioridade:** Alta

**Critérios de aceitação:**

1. O usuário deve poder iniciar ou acessar uma conversa privada permitida com outro participante.
2. As mensagens do Whisper devem ser visíveis somente aos participantes daquela conversa.
3. O histórico deve permanecer disponível após reconexão.
4. Mensagens novas devem ser sincronizadas entre os participantes conectados.

---

## EP-05 — Sistema de Notificações

### HU-17 — Receber notificação de menção

**Como** usuário,  
**quero** ser notificado quando for mencionado,  
**para** não perder mensagens direcionadas a mim.

**Prioridade:** Alta

**Critérios de aceitação:**

1. Uma menção válida deve gerar um registro de notificação para o usuário mencionado.
2. A notificação deve identificar a origem da menção.
3. O usuário deve conseguir reconhecer quais notificações ainda não foram lidas.

### HU-18 — Consultar menções pendentes

**Como** usuário,  
**quero** consultar minhas menções e notificações pendentes,  
**para** localizar rapidamente conversas que exigem minha atenção.

**Prioridade:** Média

**Critérios de aceitação:**

1. O sistema deve disponibilizar uma área de consulta das notificações do usuário.
2. As notificações devem indicar seu estado de leitura quando aplicável.
3. O usuário deve conseguir identificar a conversa relacionada à notificação.
4. O estado de leitura deve permanecer consistente após reconexão.

---

## EP-06 — Administração e Controle de Acesso

### HU-19 — Gerar Room Pass

**Como** responsável por uma Room,  
**quero** gerar um Room Pass,  
**para** permitir a entrada controlada de novos participantes.

**Prioridade:** Alta

**Critérios de aceitação:**

1. Apenas usuários autorizados devem poder gerar um Room Pass.
2. O Room Pass deve estar associado à Room que o originou.
3. Um usuário que utilizar um passe válido deve ingressar na Room correta.
4. Um valor inexistente ou inválido deve ser rejeitado.

### HU-20 — Remover participante da Room

**Como** responsável por uma Room,  
**quero** remover um participante,  
**para** administrar quem pode continuar fazendo parte da comunidade.

**Prioridade:** Média

**Critérios de aceitação:**

1. Somente um usuário com permissão administrativa adequada deve poder remover outro participante.
2. O participante removido deve deixar de aparecer como membro ativo da Room.
3. O participante removido não deve continuar acessando os conteúdos restritos da Room.
4. Os demais participantes devem receber o estado atualizado da lista de membros.

---

## Backlog resumido

| ID | História | Épico | Prioridade |
| --- | --- | --- | --- |
| HU-01 | Criar conta | EP-01 | Alta |
| HU-02 | Realizar login | EP-01 | Alta |
| HU-03 | Encerrar sessão | EP-01 | Média |
| HU-04 | Editar perfil | EP-02 | Alta |
| HU-05 | Visualizar perfil de outro usuário | EP-02 | Média |
| HU-06 | Criar uma Room | EP-03 | Alta |
| HU-07 | Entrar em uma Room | EP-03 | Alta |
| HU-08 | Visualizar participantes de uma Room | EP-03 | Média |
| HU-09 | Utilizar Text Threads | EP-03 | Alta |
| HU-10 | Enviar mensagem | EP-04 | Alta |
| HU-11 | Editar mensagem | EP-04 | Média |
| HU-12 | Excluir mensagem | EP-04 | Média |
| HU-13 | Responder a uma mensagem | EP-04 | Alta |
| HU-14 | Enviar anexos | EP-04 | Média |
| HU-15 | Mencionar um usuário | EP-04 | Alta |
| HU-16 | Conversar por Whisper | EP-04 | Alta |
| HU-17 | Receber notificação de menção | EP-05 | Alta |
| HU-18 | Consultar menções pendentes | EP-05 | Média |
| HU-19 | Gerar Room Pass | EP-06 | Alta |
| HU-20 | Remover participante da Room | EP-06 | Média |

## Fora do escopo principal do Projeto Integrador

Os seguintes grupos permanecem no backlog geral do star_byte, mas não fazem parte do núcleo funcional definido neste documento:

- internacionalização completa;
- autenticação de dois fatores;
- sistema avançado de busca e tags;
- níveis avançados de notificação;
- moderação e auditoria completas;
- acesso IRC e modo de baixo consumo;
- dashboards de uso e transparência;
- exportação e políticas de retenção de dados;
- self-hosting e administração da instância;
- pipelines de release, publicação e distribuição do cliente.

Esses itens continuam relevantes para a evolução do star_byte, mas não são necessários para demonstrar o fluxo principal selecionado para o Projeto Integrador.
