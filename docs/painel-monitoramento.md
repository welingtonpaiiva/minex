# Painel de monitoramento da mina

`/dashboard` é uma tela autenticada de consulta, com atalhos ao menu e a Acesso à Mina, demonstração e modo TV. O registro operacional permanece em `/acessos`; o dashboard não grava entradas ou saídas.

## Navegação, perfis e demonstração

- Dashboard e Acesso à Mina consultam `/api/operacao/monitoramento`: os registros, horários e o limite visual de seis horas são os mesmos nas duas telas. As regras de autorização para registrar entradas e saídas foram preservadas.
- Clicar no cartão de uma pessoa ou brigadista abre o perfil, inclusive em modo TV. O perfil mostra foto, matrícula, empresa, turma, brigada, presença e os dez últimos acessos. `GET /api/operacao/monitoramento/perfil/:id` exige autenticação, não retorna o identificador NFC e não grava dados.
- O perfil oferece um atalho à mesma pessoa em Acesso à Mina. Essa tela também permite abrir perfis e retornar ao dashboard.
- **Dados de teste** ativa uma demonstração com 25 pessoas, quatro permanências críticas, três brigadistas presentes e fotografias fictícias. O modo é identificado permanentemente na tela. Seus identificadores são negativos e não correspondem a cadastros reais. Não há importação, inserção ou simulação de acessos no banco, nem consulta de perfis fictícios à API. **Voltar aos dados reais** retoma a consulta autenticada.
- **Modo TV** usa a área inteira da tela e solicita tela cheia do navegador quando disponível. Os controles se ocultam após três segundos; aproximar o ponteiro do topo ou usar o teclado permite sair. `Esc` fecha o perfil ou sai do modo TV. O modo teste pode ser apresentado na TV e mantém sua identificação visível.
- Links diretos: `/dashboard?demo=1` para demonstração, `/dashboard?tv=1` para apresentação real e `/dashboard?demo=1&tv=1` para apresentação fictícia. Todos continuam exigindo login.

## Dados e relógio

- A consulta `GET /api/operacao/monitoramento` combina acessos abertos com empréstimos pendentes de máscaras de fuga, individuais ou por quantidade. Cada colaborador aparece uma vez. A máscara é identificada pela categoria Máscaras de Fuga ou pelo nome Máscara de Fuga (com ou sem acentos e variações de caixa). Sem acesso manual aberto, o horário é a retirada mais antiga entre as máscaras ainda em posse; com acesso manual, vale o horário desse acesso. A devolução de todas as máscaras encerra a presença automática; eventual acesso manual aberto continua válido. A leitura não cria entradas ou saídas no histórico. O perfil e o alerta geral usam a mesma regra.
- A posição é consultada a cada 10 segundos, sem consultas sobrepostas. Em falhas, há reconexão automática entre 5 e 30 segundos e sinalização de dados desatualizados.
- Uma operação registrada em outra aba da mesma aplicação sinaliza a atualização imediatamente, inclusive para um perfil que esteja aberto. A sinalização usa apenas um marcador no armazenamento do navegador; cada aba consulta a API com sua autenticação. Se uma consulta já estiver em andamento, uma nova consulta é executada assim que ela terminar. Na ausência de armazenamento disponível, a consulta periódica continua funcionando. O modo de demonstração ignora esses avisos.
- O relógio e os contadores compartilham uma atualização local a cada segundo, ancorada no horário recebido do servidor. A apresentação usa `APP_TIMEZONE` (padrão: `America/Sao_Paulo`), independentemente do fuso do navegador.
- Até `06h00m00s`, a permanência está dentro do limite visual. A partir de `06h00m01s`, o cartão fica crítico. A classificação do dashboard e de Acesso à Mina não grava dados nem modifica a autorização de entrada/saída. O alerta de apoio legado do cabeçalho geral continua com seu limite anterior.
- Horários ausentes, inválidos ou incompatíveis são identificados como inconsistentes e não são contabilizados como permanência normal.

## Cadastros e fotografias

Empresa, turma, identificação de brigadista, especialidade e validade da habilitação estão disponíveis no formulário de colaboradores. O cadastro é protegido pelas permissões existentes. Os novos campos são adicionados de forma aditiva pelas migrações; em ambientes sem migração automática, executar `npm run migrate --prefix backend` antes da atualização.

Ninguém é classificado como brigadista a partir de nome, função ou aproximação textual. A presença considerada no sistema vem de acesso aberto ou máscara de fuga em posse; habilitação vigente, vencida ou não informada é apresentada separadamente. Os totais da brigada representam todos os cadastros identificados como brigadistas, incluindo os que estejam fora da mina.

Dados não cadastrados aparecem como não informados. Turmas legadas explicitamente registradas no setor como `TURMA A` a `TURMA D` podem ser apresentadas a partir desse campo. Importações futuras da planilha preservam empresa e turma em seus campos próprios; o redesign não reexecuta importações nem preenche informações por suposição.

Fotografias são obtidas pelo vínculo cadastrado por identificador, autenticadas e armazenadas temporariamente em um cache limitado do navegador. Quando não existe fotografia, o painel mostra um ícone e as iniciais. Não há associação por nome aproximado.

O fundo `/images/mina-subterranea.webp` é uma versão otimizada da fotografia já existente no projeto (`20250218LD0126.jpg`). Nenhuma fotografia ilustrativa é atribuída a uma pessoa real.

## Organização da TV

O painel calcula a capacidade da tela e alterna automaticamente as páginas regulares e a lista de brigadistas a cada 12 segundos. Os cartões críticos e os registros com horário inconsistente permanecem fixos enquanto os regulares alternam. Os contadores não reiniciam na troca de páginas.

Se a quantidade de registros prioritários exceder a capacidade física da tela, o rodapé informa **capacidade visual excedida**. Nesse caso, a lista prioritária percorre automaticamente a área disponível, sem incluir essas pessoas na paginação regular e sem reduzir indefinidamente os cartões. Não é possível manter um número ilimitado de cartões simultaneamente legíveis em uma única TV. O alerta e os totais permanecem visíveis.

O dashboard adapta a capacidade de cartões ao espaço disponível. Em modo TV, ocupa toda a área do navegador e preserva a rotação automática; abrir um perfil pausa a troca de páginas e a rolagem da lista prioritária até o fechamento. Navegar do perfil para Acesso à Mina encerra a tela cheia do navegador.

## Validação

Os testes cobrem horários legados, limite exato de seis horas, ordenação/paginação, presença versus habilitação, entradas/saídas, autenticação, ausência de escritas pelo dashboard, sincronização entre abas, atualização durante consultas em andamento, falhas/reconexão e apresentação em Full HD, 4K e tablet. A demonstração da interface existe apenas na memória do navegador. Os acessos usados nos testes automatizados pertencem a bancos temporários isolados.
