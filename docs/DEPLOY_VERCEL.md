# Publicação do Minex na Vercel

A branch `feat/nfc-verde-tipografia` contém o frontend, a função da API e a configuração `vercel.json`. O projeto deve ser importado pela raiz do repositório.

## O que precisa existir

- Conta Vercel conectada ao GitHub ou à integração Vercel nesta conversa.
- Banco MySQL online, acessível pela Vercel e com TLS válido.
- Dados atuais importados e migrations até a versão 5 aplicadas.

O arquivo `minex.db` é uma cópia SQLite dos dados. O runtime da Vercel não mantém um disco persistente compartilhado entre as funções. Esse arquivo fica fora do pacote de publicação. As novas fotos ficam no MySQL, junto dos metadados; fotos antigas podem ser importadas e verificadas por SHA-256.

## Variáveis do projeto na Vercel

Configure nas variáveis privadas do projeto, tanto no ambiente de preview usado quanto em produção:

| Variável | Configuração |
| --- | --- |
| `DB_CLIENT` | `mysql` |
| `MYSQL_HOST` | Host público do banco |
| `MYSQL_PORT` | Porta fornecida pelo provedor |
| `MYSQL_DATABASE` | Banco de dados do Minex |
| `MYSQL_USER` | Conta da aplicação com SELECT, INSERT, UPDATE e DELETE |
| `MYSQL_PASSWORD` | Senha da conta da aplicação |
| `MYSQL_SSL` | `true` |
| `MYSQL_SSL_CA` | Certificado CA, quando exigido pelo provedor |
| `JWT_SECRET` | Segredo aleatório de pelo menos 32 caracteres |
| `DB_POOL_SIZE` | `2` inicialmente |
| `APP_TIMEZONE` | `America/Sao_Paulo` |

A API retorna 503 enquanto faltar a configuração ou a estrutura do banco. Ela não executa migrations nem tarefas de backup em cada requisição. O endpoint `/api/health` confirma a inicialização e a versão do banco sem expor dados dos usuários.

## Importar os dados existentes

Use credenciais administrativas somente no processo de migração. A conta usada pela aplicação em produção deve ter apenas as permissões de leitura e gravação.

Para uma origem MySQL atualizada:

1. Aplique as migrations na origem, importe as fotos locais com `node backend/dist/database/importPhotoFiles.js` e gere um backup com `node backend/dist/database/backup.js`.
2. Prepare as credenciais do destino em `backend/.runtime/cloud.env`, arquivo local ignorado pelo Git.
3. Restaure o backup em um banco online vazio. Carregue as variáveis desse arquivo, incluindo `DB_CLIENT=mysql`, as variáveis `MYSQL_*`, `MYSQL_SSL=true` e `RESTORE_EMPTY_DATABASE=1`. Com o dotenv instalado no projeto, o comando é:

```powershell
node -r ./backend/node_modules/dotenv/config backend/dist/database/backup.js restore CAMINHO_DO_BACKUP dotenv_config_path=backend/.runtime/cloud.env
```

O restaurador valida contagens, conteúdo, sequências e fotografias. Se o backup for antigo e suas fotos estiverem apenas em arquivos, execute o importador de fotos com as variáveis do destino depois da restauração.

Se a única origem disponível for o SQLite do repositório, use `backend/dist/database/migrateToMysql.js` com o destino vazio, `SQLITE_SOURCE` apontando para a cópia correta e `MIGRATION_OFFLINE=1`. A transferência preserva a origem e produz um relatório de conferência.

## Publicar e conferir

1. Importe `welingtonpaiiva/minex` na Vercel pela raiz, selecionando a branch preparada.
2. Cadastre as variáveis privadas antes de liberar a aplicação.
3. Execute o deploy com a configuração do repositório e confirme `/api/health`, login, NFC e gravação/leitura de uma foto.
4. Configure os backups do banco no provedor ou em um processo externo. O temporizador de backups do servidor local não é executado na função da Vercel.

A câmera precisa de HTTPS. O leitor NFC USB deve transmitir o código como teclado e finalizar com Enter, como no ambiente local.

Referências: [Express na Vercel](https://vercel.com/docs/frameworks/backend/express), [persistência e SQLite](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).
