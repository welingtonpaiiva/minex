# Minex na Vercel com TiDB Cloud Starter

## Criar o banco

1. Entre em https://tidbcloud.com/ e crie sua conta.
2. Em **Create Resource**, escolha **Starter** e **MySQL Compatible**.
3. Use o nome `minex` e mantenha **Spending Limit = 0** para ficar no plano gratuito, sujeito à cota.
4. Depois de criar a instância, abra **Connect**: **Public**, branch **main**, **General**.
5. Gere uma senha e guarde os parâmetros de conexão. Preserve o usuário completo, incluindo o prefixo antes de `.root`.

## Preparar a conexão local

O arquivo privado `backend/.runtime/cloud.env` já foi preparado e está ignorado pelo Git. Ele não altera o servidor local.

Preencha os campos com os valores mostrados em **Connect**:

| Campo do painel TiDB | Campo do Minex |
| --- | --- |
| Host | `MYSQL_HOST` |
| Port | `MYSQL_PORT` (normalmente `4000`) |
| User | `MYSQL_USER` (inclua o prefixo) |
| Password | `MYSQL_PASSWORD` |
| Database | `MYSQL_DATABASE` (`minex` após criar o banco da aplicação) |

Mantenha `DB_CLIENT=mysql`, `MYSQL_SSL=true` e `DB_POOL_SIZE=2`. O arquivo já contém um `JWT_SECRET` aleatório. Não publique esse arquivo no Git.

`backend/.runtime/cloud.env` usa o usuário administrativo apenas para a preparação e migração. `backend/.runtime/vercel.env` contém o usuário da aplicação, limitado a SELECT, INSERT, UPDATE e DELETE em `minex`.

## Importar e publicar

Com a conexão configurada, a próxima etapa é verificar o acesso com TLS, conferir que o destino está vazio e validar a compatibilidade das migrations e dos fluxos do Minex no TiDB.

A transferência usa `backend/src/database/migrateToMysql.ts`, com uma cópia consistente do SQLite e as gravações suspensas durante a transferência definitiva. O importador valida contagens e hashes e preserva o arquivo de origem. Os dados atuais devem ser conferidos novamente no momento da transferência; o backup de preparação não substitui essa conferência.

Depois da validação, configure as variáveis da aplicação no ambiente **Production** do projeto `paiva10/minex` na Vercel e faça um novo deploy da versão revisada. Use o endereço da nova publicação ou o domínio de produção para testar `/api/health`, login, consultas, retirada e devolução.

## Preparação validada em 18/11/2026

- Banco `minex` criado com TLS e migrations de 1 a 8.
- 5 usuários, 2.185 colaboradores, 1.000 materiais (820 ativos) e históricos transferidos e conferidos por contagem e SHA-256.
- Testes de operações executados em bancos isolados no TiDB; o teste de envio repetido foi reexecutado após a correção de leitura de requisições concorrentes.
- `/api/health`, autenticação por token e consulta de pendências validados com o usuário da aplicação.
- Servidor local reiniciado com `backend/.runtime/local-cloud.env`, usando o mesmo banco online. O arquivo SQLite original e os snapshots continuam preservados.
- As 11 variáveis do arquivo privado `vercel.env` foram aplicadas como Secret nos ambientes Production e Preview da Vercel.
- A branch `main` contém as correções de compatibilidade e publica em produção pelo GitHub conectado ao projeto `paiva10/minex`.
- Produção validada em https://minex-tan.vercel.app: `/api/health` retorna `{"status":"ok"}`, a página de login abre e as consultas autenticadas de pendências e resumo operacional respondem com HTTP 200.

## Exportar as etiquetas compactas

Execute `node backend/scripts/exportBarcodeGrid.cjs [diretorio-de-saida]` pela raiz do projeto para gerar PDFs a partir do SQLite local, sem alterar o banco. O exportador usa 5 colunas por 10 linhas e, para máscaras de fuga, 4 colunas por 9 linhas. Cada etiqueta contém o nome próximo às barras e o código abaixo, sem repetir a linha TAG.

O script gera sete PDFs por categoria, um PDF completo, um ZIP e um relatório que confere a leitura de todos os códigos em 203 e 300 dpi. Essa exportação lê o arquivo SQLite local; alterações posteriores feitas no banco online não são incluídas automaticamente nesse arquivo.

As tabelas com autoincremento usam o comentário condicional `/*T![auto_id_cache] AUTO_ID_CACHE=1 */`: o TiDB mantém IDs crescentes entre seus servidores e o MySQL ignora o comentário. Isso preserva a ordenação das operações que consultam o último identificador da auditoria.

Referências:

- https://docs.pingcap.com/tidbcloud/create-tidb-cluster-serverless/
- https://docs.pingcap.com/developer/dev-guide-sample-application-nodejs-mysql2/
- https://docs.pingcap.com/tidbcloud/auto-increment/
- https://vercel.com/docs/environment-variables/managing-environment-variables
