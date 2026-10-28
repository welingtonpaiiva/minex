# Painel de monitoramento da mina

`/dashboard` é uma tela passiva autenticada: não tem navegação, simulação, filtros ou ações de escrita. O registro operacional permanece em `/acessos`.

## Dados e relógio

- A consulta `GET /api/operacao/monitoramento` usa os registros abertos de `acessos_mina`, vinculados ao identificador do colaborador.
- A posição é consultada a cada 10 segundos, sem consultas sobrepostas. Em falhas, há reconexão automática entre 5 e 30 segundos e sinalização de dados desatualizados.
- O relógio e os contadores compartilham uma atualização local a cada segundo, ancorada no horário recebido do servidor. A apresentação usa `APP_TIMEZONE` (padrão: `America/Sao_Paulo`), independentemente do fuso do navegador.
- Até `06h00m00s`, a permanência está dentro do limite visual. A partir de `06h00m01s`, o cartão fica crítico. A classificação do painel não grava dados nem modifica a autorização de entrada/saída ou os alertas legados das outras telas.
- Horários ausentes, inválidos ou incompatíveis são identificados como inconsistentes e não são contabilizados como permanência normal.

## Cadastros e fotografias

Empresa, turma, identificação de brigadista, especialidade e validade da habilitação estão disponíveis no formulário de colaboradores. O cadastro é protegido pelas permissões existentes. Os novos campos são adicionados de forma aditiva pelas migrações; em ambientes sem migração automática, executar `npm run migrate --prefix backend` antes da atualização.

Ninguém é classificado como brigadista a partir de nome, função ou aproximação textual. Presença física vem do acesso aberto; habilitação vigente, vencida ou não informada é apresentada separadamente. Os totais da brigada representam todos os cadastros identificados como brigadistas, incluindo os que estejam fora da mina.

Dados não cadastrados aparecem como não informados. Turmas legadas explicitamente registradas no setor como `TURMA A` a `TURMA D` podem ser apresentadas a partir desse campo. Importações futuras da planilha preservam empresa e turma em seus campos próprios; o redesign não reexecuta importações nem preenche informações por suposição.

Fotografias são obtidas pelo vínculo cadastrado por identificador, autenticadas e armazenadas temporariamente em um cache limitado do navegador. Quando não existe fotografia, o painel mostra um ícone e as iniciais. Não há associação por nome aproximado.

O fundo `/images/mina-subterranea.webp` é uma versão otimizada da fotografia já existente no projeto (`20250218LD0126.jpg`). Nenhuma fotografia ilustrativa é atribuída a uma pessoa real.

## Organização da TV

O painel calcula a capacidade da tela e alterna automaticamente as páginas regulares e a lista de brigadistas a cada 12 segundos. Os cartões críticos e os registros com horário inconsistente permanecem fixos enquanto os regulares alternam. Os contadores não reiniciam na troca de páginas.

Se a quantidade de registros prioritários exceder a capacidade física da tela, o rodapé informa **capacidade visual excedida**. Nesse caso, a lista prioritária percorre automaticamente a área disponível, sem incluir essas pessoas na paginação regular e sem reduzir indefinidamente os cartões. Não é possível manter um número ilimitado de cartões simultaneamente legíveis em uma única TV. O alerta e os totais permanecem visíveis.

O dashboard ocupa toda a área do navegador. Para ocultar a interface do próprio navegador, utilizar a configuração de quiosque/tela cheia do equipamento; o painel não depende de um botão de tela cheia.

## Validação

Os testes cobrem horários legados, limite exato de seis horas, ordenação/paginação, presença versus habilitação, entradas/saídas, autenticação, ausência de escritas, falhas/reconexão e apresentação em Full HD, 4K e tablet. Dados de demonstração só existem em bancos temporários isolados dos testes.
