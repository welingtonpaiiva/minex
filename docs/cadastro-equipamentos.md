# Equipamentos, patrimônio e códigos de barras

## Estado atual — 30/10/2026

Os códigos de barras foram reincluídos por solicitação do usuário. Permanecem os 770 itens, as TAGs padronizadas, as 300 lanternas LM-001 a LM-300 e o patrimônio MINA-UG. A reinclusão não alterou equipamentos, situações, empréstimos, kits ou histórico no banco operacional.

## Leitura com leitor USB HID

Na entrada, o leitor NFC abre inicialmente para identificar o colaborador. Para usar etiquetas de materiais, feche o leitor NFC e escolha Devolver por código. Fora de campos de texto e de diálogos, uma sequência rápida enviada pelo leitor também abre a identificação por código automaticamente. A captura aceita Enter, Tab ou uma pausa ao fim da leitura; o código aparece no campo e o item é consultado. A consulta nunca confirma a devolução ou libera estoque automaticamente.

O usuário informou que o leitor Elgin/Bematech escreve no Bloco de Notas. A integração recebe esse modo de teclado USB, sem instalar drivers nem reconfigurar o leitor. Não há acesso remoto ao ato físico de apontar o equipamento para o papel; a validação de captura usa eventos de teclado reais do navegador simulados com Playwright.

O hook useBarcodeScanner reconhece sequências com intervalo de até 80 ms entre teclas, finalizando após 180 ms sem novas teclas. Ele protege outros campos de texto e diálogos NFC. Leituras repetidas não concatenam códigos no campo nem repetem consultas em sequência; uma nova devolução ainda exige confirmação explícita. Para leitores configurados com atraso maior, use Enter no campo ou ajuste o intervalo no hook após medir o dispositivo.

## Retirada, devolução e conferência

- Retirada: após identificar o colaborador, leia o código de barras, digite a TAG ou selecione o item disponível. A leitura adiciona à lista e a retirada depende de confirmação.
- Devolução por código: TAG e código de barras localizam o equipamento e o responsável no banco. Este fluxo não exige NFC. Materiais por quantidade exigem escolher o empréstimo e a quantidade recebida.
- Pessoas e materiais: a primeira leitura do crachá abre todos os itens pendentes daquela pessoa, incluindo equipamentos e quantidades, mesmo fora da página atual da lista. Selecione os itens recebidos e ajuste quantidades e condição. Confirmar baixa solicita uma nova leitura do NFC e só então registra a devolução. Crachá de outra pessoa e matrícula são rejeitados. Cancelar a confirmação mantém a seleção. O botão Rastrear pelo crachá NFC inicia outro atendimento.
- Fluxos tradicionais de equipamentos e quantidades também exigem nova leitura NFC na confirmação. O NFC manual continua disponível; colaboradores inativos podem devolver materiais. A etiqueta pode identificar e selecionar um item do colaborador automaticamente, sem tornar obrigatória a leitura de todas as etiquetas.
- Conferência: operadores podem liberar itens devolvidos pendentes, com justificativa e confirmação de aptidão. Ajuste arbitrário de saldo e liberação de manutenção permanecem restritos a supervisor/administrador.
- Kits: o leitor identifica os materiais pelo código vinculado; as reservas e a entrega por NFC permanecem preservadas.

## Cadastro, etiquetas e integridade

### Fotos dos equipamentos

Cada material pode ter uma foto própria. Em Cadastros → Materiais → Editar, escolha uma foto do catálogo, selecione um arquivo JPEG/PNG/WebP ou use a câmera e salve o cadastro. A foto aparece junto da TAG no cadastro, estoque e consultas, seleção de retirada, devolução rápida, devolução por código, equipamentos por quantidade e kits. Itens sem foto mostram um símbolo de equipamento.

Fotos anexadas ficam no banco, com verificação de integridade, acesso autenticado e auditoria. O cadastro e a troca de fotos respeitam os perfis de cadastro; consulta e operação podem visualizar. A migration 008 cria o armazenamento sem alterar empréstimos ou estoque. Fotos de um mesmo modelo podem ser compartilhadas entre itens.

Foi localizado o arquivo original do medidor de gás e associado aos 50 itens MG, com backup em `backups/fotos-equipamentos-2026-10-30T16-33-46-927Z/`. Os arquivos originais das outras quatro fotos enviadas ainda precisam ser localizados para completar a associação automática das demais famílias.

Cadastros → Materiais oferece o campo Código de barras, a vinculação de uma etiqueta a um item, Etiquetas PDF A4 e Teste de leitura. Códigos são strings e mantêm zeros à esquerda. TAGs e códigos não podem colidir entre equipamentos. Cada alteração é auditada; os perfis de consulta não podem vincular códigos. O cadastro em lote administrativo mantém prévia, confirmação e idempotência.

O PDF Code 128 é vetorial, com módulo de 0,508 mm, altura aproximada de 18 mm e margem lateral de 12 módulos. O catálogo padrão imprime 14 etiquetas por A4 em tamanho real / 100%, sem ajustar à página. Códigos maiores usam uma coluna, sem reduzir as barras.

Arquivos atualizados em backups/codigos-barras-restaurados-2026-10-30/: etiquetas-todos-mina-ug.pdf (770 etiquetas, 55 páginas), teste-leitura-code128.pdf (uma página) e validacao-leitura.json. Todas as 770 etiquetas foram renderizadas e decodificadas por ZXing a 203 dpi; uma amostra de 14 foi também decodificada a 300 dpi, preservando exatamente os valores cadastrados.

## Validação automatizada

- npm run build
- node --test backend/tests/*.test.cjs
- node frontend/tests/barcode-functional.cjs: leitura USB HID sem foco, Enter, Tab, pausa sem sufixo, repetição, zeros à esquerda, proteção de justificativa/busca, NFC, seleção por etiqueta, retirada, devolução, conferência, cadastro, vinculação e download PDF.
- node frontend/tests/quick-returns.cjs: identificação NFC manual, seleção manual, devoluções individuais e por quantidade e reinício da condição entre atendimentos.
- node frontend/tests/nfc-return-tracking.cjs: rastreio inicial e segunda leitura de confirmação, paginação, pendências mistas, devolução parcial, crachá alheio, cancelamento e nova tentativa após falha.
- node frontend/tests/material-photos.cjs e node --test backend/tests/material-photos.test.cjs: catálogo, anexo e remoção de fotos, visualização autenticada nos quatro fluxos, integridade, permissões e preservação dos empréstimos.
- node frontend/tests/material-batch.cjs e node frontend/tests/stock-categories.cjs: patrimônio, lote, categorias, perfis e recursos restaurados.
- backend/tests/barcode-reading.test.cjs: decodificação independente do PDF final em 203 e 300 dpi. As bibliotecas de renderização/decodificação são dependências apenas de desenvolvimento.
