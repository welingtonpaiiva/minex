import { Response } from 'express';
import { query, queryOne, withTransaction } from '../config/db';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { audit } from '../services/OperationalService';
import { EmprestimoService } from '../services/EmprestimoService';
import crypto from 'crypto';

export class KitController {
  /**
   * Listar todos os kits disponíveis com seus respectivos materiais
   */
  static async listarKits(req: AuthenticatedRequest, res: Response) {
    try {
      const status = (req.query.status as string) || 'DISPONIVEL';
      const kits = await query(
        'SELECT k.*, u.nome as criado_por_nome FROM kits k LEFT JOIN usuarios u ON k.criado_por_id = u.id WHERE k.status = ? ORDER BY k.created_at DESC',
        [status]
      );

      for (const kit of kits) {
        const materiais = await query(
          `SELECT m.id, m.nome, m.codigo_interno, m.codigo_barras, m.status, c.nome as categoria_nome
           FROM kit_materiais km
           JOIN materiais m ON km.material_id = m.id
           LEFT JOIN categorias c ON m.categoria_id = c.id
           WHERE km.kit_id = ?
           ORDER BY m.nome ASC`,
          [kit.id]
        );
        kit.materiais = materiais;
        kit.total_itens = materiais.length;
      }

      return res.json(kits);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao listar kits' });
    }
  }

  /**
   * Montar e salvar um novo kit com materiais disponíveis
   */
  static async criarKit(req: AuthenticatedRequest, res: Response) {
    try {
      const { nome, descricao, materiaisCodigos } = req.body;
      const operadorId = req.user?.id || 1;

      if (!nome || typeof nome !== 'string' || !nome.trim()) {
        return res.status(400).json({ error: 'Identificador / nome do kit é obrigatório' });
      }

      if (!Array.isArray(materiaisCodigos) || materiaisCodigos.length === 0) {
        return res.status(400).json({ error: 'Selecione ou bipe pelo menos 1 material para o kit' });
      }

      const cleanNome = nome.trim().toUpperCase();

      const resultado = await withTransaction(async (execute) => {
        // Verificar se já existe kit disponível com este nome
        const kitExistente = await queryOne(
          'SELECT id FROM kits WHERE nome = ? AND status = "DISPONIVEL"',
          [cleanNome]
        );
        if (kitExistente) {
          throw new Error(`Já existe um kit ativo com a identificação: "${cleanNome}"`);
        }

        // Validar e buscar materiais
        const materiaisIds: number[] = [];
        const materiaisValidados: any[] = [];

        for (const cod of materiaisCodigos) {
          const cleanCod = String(cod).trim();
          const mat = await queryOne(
            'SELECT * FROM materiais WHERE codigo_barras = ? OR codigo_interno = ?',
            [cleanCod, cleanCod]
          );

          if (!mat) {
            throw new Error(`Material não encontrado: ${cleanCod}`);
          }

          if (mat.tipo_controle === 'QUANTIDADE') {
            throw new Error(`Material "${mat.nome}" é controlado por quantidade e não pode ser adicionado ao kit.`);
          }

          if (mat.status === 'EM_USO') {
            throw new Error(`Material "${mat.codigo_interno} - ${mat.nome}" já está em uso.`);
          }

          if (mat.status === 'RESERVADO_KIT') {
            throw new Error(`Material "${mat.codigo_interno} - ${mat.nome}" já está reservado em outro kit.`);
          }

          if (mat.status !== 'DISPONIVEL') {
            throw new Error(`Material "${mat.codigo_interno} - ${mat.nome}" não está disponível (${mat.status}).`);
          }

          if (materiaisIds.includes(mat.id)) {
            throw new Error(`Material repetido no mesmo kit: ${mat.codigo_interno}`);
          }

          materiaisIds.push(mat.id);
          materiaisValidados.push(mat);
        }

        // Criar registro do kit
        const now = new Date().toISOString();
        const insertKit = await execute(
          'INSERT INTO kits (nome, descricao, status, criado_por_id, created_at, updated_at) VALUES (?, ?, "DISPONIVEL", ?, ?, ?)',
          [cleanNome, descricao ? String(descricao).trim() : '', operadorId, now, now]
        );
        const kitId = insertKit[0]?.id;

        // Vincular materiais e atualizar status para RESERVADO_KIT
        for (const mat of materiaisValidados) {
          await execute(
            'INSERT INTO kit_materiais (kit_id, material_id, created_at) VALUES (?, ?, ?)',
            [kitId, mat.id, now]
          );
          await execute(
            'UPDATE materiais SET status = "RESERVADO_KIT", updated_at = ? WHERE id = ?',
            [now, mat.id]
          );
        }

        await audit(
          operadorId,
          'CRIACAO_KIT',
          'kit',
          kitId,
          { nome: cleanNome, itens: materiaisValidados.map(m => m.codigo_interno) },
          execute
        );

        return {
          sucesso: true,
          id: kitId,
          nome: cleanNome,
          total_itens: materiaisValidados.length
        };
      });

      return res.status(201).json(resultado);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Erro ao criar kit' });
    }
  }

  /**
   * Desmontar e excluir kit (devolve todos os materiais ao estoque DISPONIVEL)
   */
  static async excluirKit(req: AuthenticatedRequest, res: Response) {
    try {
      const kitId = parseInt(req.params.id);
      const operadorId = req.user?.id || 1;

      if (!kitId || isNaN(kitId)) {
        return res.status(400).json({ error: 'ID do kit inválido' });
      }

      await withTransaction(async (execute) => {
        const kit = await queryOne('SELECT * FROM kits WHERE id = ?', [kitId]);
        if (!kit) throw new Error('Kit não encontrado');

        // Buscar materiais do kit
        const itens = await execute(
          'SELECT material_id FROM kit_materiais WHERE kit_id = ?',
          [kitId]
        );

        const now = new Date().toISOString();
        for (const item of itens) {
          await execute(
            'UPDATE materiais SET status = "DISPONIVEL", updated_at = ? WHERE id = ?',
            [now, item.material_id]
          );
        }

        await execute('DELETE FROM kit_materiais WHERE kit_id = ?', [kitId]);
        await execute('DELETE FROM kits WHERE id = ?', [kitId]);

        await audit(
          operadorId,
          'DESMONTAGEM_KIT',
          'kit',
          kitId,
          { nome: kit.nome, itens_desmontados: itens.length },
          execute
        );
      });

      return res.json({ sucesso: true, mensagem: 'Kit desmontado e materiais devolvidos ao estoque' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Erro ao desmontar kit' });
    }
  }

  /**
   * Realizar a saída / atribuição atômica de todos os materiais do kit para um colaborador
   */
  static async atribuirKit(req: AuthenticatedRequest, res: Response) {
    try {
      const kitId = parseInt(req.params.id);
      const { colaboradorId, nfcId } = req.body;
      const operadorId = req.user?.id || 1;
      const operadorNome = req.user?.nome || 'OPERADOR';

      if (!kitId || isNaN(kitId)) {
        return res.status(400).json({ error: 'ID do kit inválido' });
      }

      // Buscar kit
      const kit = await queryOne('SELECT * FROM kits WHERE id = ? AND status = "DISPONIVEL"', [kitId]);
      if (!kit) {
        return res.status(404).json({ error: 'Kit não encontrado ou já atribuído' });
      }

      // Identificar colaborador
      let colab: any = null;
      if (colaboradorId) {
        colab = await queryOne('SELECT * FROM colaboradores WHERE id = ?', [colaboradorId]);
      } else if (nfcId) {
        colab = await queryOne('SELECT * FROM colaboradores WHERE nfc_id = ?', [String(nfcId).trim()]);
      }

      if (!colab) {
        return res.status(404).json({ error: 'Colaborador não encontrado' });
      }

      if (colab.status !== 'ATIVO') {
        return res.status(400).json({ error: `Colaborador inativo (${colab.nome}). Retirada bloqueada.` });
      }

      // Buscar materiais do kit
      const materiais = await query(
        `SELECT m.id, m.codigo_interno, m.codigo_barras, m.nome
         FROM kit_materiais km
         JOIN materiais m ON km.material_id = m.id
         WHERE km.kit_id = ?`,
        [kitId]
      );

      if (!materiais.length) {
        return res.status(400).json({ error: 'Este kit está vazio' });
      }

      const codigos = materiais.map(m => m.codigo_interno);

      // Liberar materiais temporariamente para DISPONIVEL antes de chamar o EmprestimoService
      await withTransaction(async (execute) => {
        const now = new Date().toISOString();
        for (const m of materiais) {
          await execute(
            'UPDATE materiais SET status = "DISPONIVEL", updated_at = ? WHERE id = ?',
            [now, m.id]
          );
        }
      });

      // Delegar a saída para o EmprestimoService (garante validação, empréstimos, movimentações e idempotência)
      const requestId = req.header('Idempotency-Key') || `kit-${kitId}-${crypto.randomUUID()}`;
      const resultadoSaida = await EmprestimoService.realizarSaida({
        colaboradorId: colab.id,
        materiaisCodigos: codigos,
        operadorId,
        operadorNome,
        requestId
      });

      // Concluir e remover kit
      await withTransaction(async (execute) => {
        await execute('DELETE FROM kit_materiais WHERE kit_id = ?', [kitId]);
        await execute('DELETE FROM kits WHERE id = ?', [kitId]);

        await audit(
          operadorId,
          'ATRIBUICAO_KIT',
          'colaborador',
          colab.id,
          { kit_id: kitId, kit_nome: kit.nome, materiais: codigos },
          execute
        );
      });

      return res.json({
        sucesso: true,
        mensagem: `KIT "${kit.nome}" ENTREGUE COM SUCESSO`,
        kitNome: kit.nome,
        colaborador: resultadoSaida.colaborador,
        materiaisCount: resultadoSaida.materiaisCount,
        materiais: resultadoSaida.materiais,
        dataHora: resultadoSaida.dataHora
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Erro ao atribuir kit' });
    }
  }
}
