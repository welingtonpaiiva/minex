import { Request, Response } from 'express';
import { query, queryOne, runTransaction } from '../config/db';

export class KitController {
  // Criar um novo kit
  static async criarKit(req: Request, res: Response) {
    try {
      const { nome, materiais } = req.body;
      if (!nome) {
        return res.status(400).json({ error: 'Nome do kit é obrigatório' });
      }

      await runTransaction(async () => {
        // Criar o kit
        const result = await query(
          'INSERT INTO kits (nome, status) VALUES (?, ?)',
          [nome, 'DISPONIVEL']
        );
        const kitId = result.lastID;

        // Adicionar materiais ao kit se fornecidos
        if (materiais && materiais.length > 0) {
          for (const matCodigo of materiais) {
            const material = await queryOne('SELECT id, status FROM materiais WHERE codigo_interno = ?', [matCodigo]);
            if (!material) {
              throw new Error(`Material não encontrado: ${matCodigo}`);
            }
            if (material.status !== 'DISPONIVEL') {
              throw new Error(`Material ${matCodigo} não está disponível para kit`);
            }
            await query('INSERT INTO kit_materiais (kit_id, material_id) VALUES (?, ?)', [kitId, material.id]);
          }
        }
      });

      res.status(201).json({ message: 'Kit criado com sucesso' });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Já existe um kit com este nome' });
      }
      res.status(500).json({ error: err.message || 'Erro ao criar kit' });
    }
  }

  // Listar kits disponíveis com seus materiais
  static async listarKits(req: Request, res: Response) {
    try {
      const kits = await query('SELECT * FROM kits WHERE status = "DISPONIVEL" ORDER BY created_at DESC');
      
      for (const kit of kits) {
        const materiais = await query(`
          SELECT m.id, m.nome, m.codigo_interno, m.codigo_barras, c.nome as categoria_nome 
          FROM kit_materiais km
          JOIN materiais m ON km.material_id = m.id
          LEFT JOIN categorias c ON m.categoria_id = c.id
          WHERE km.kit_id = ?
        `, [kit.id]);
        kit.materiais = materiais;
      }
      
      res.json(kits);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao buscar kits' });
    }
  }

  // Excluir um kit
  static async excluirKit(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      await runTransaction(async () => {
        await query('DELETE FROM kit_materiais WHERE kit_id = ?', [id]);
        await query('DELETE FROM kits WHERE id = ?', [id]);
      });
      
      res.json({ message: 'Kit excluído com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao excluir kit' });
    }
  }

  // Fazer a saída de todos os materiais do kit para um colaborador
  static async atribuirKit(req: Request, res: Response) {
    try {
      const { kitId, colaboradorId, operadorId } = req.body;
      
      if (!kitId || !colaboradorId) {
        return res.status(400).json({ error: 'kitId e colaboradorId são obrigatórios' });
      }

      let resumo = { materiaisCount: 0, materiais: [] as any[], colaborador: null as any };

      await runTransaction(async () => {
        // Verificar se colaborador existe e está ativo
        const colab = await queryOne('SELECT * FROM colaboradores WHERE id = ?', [colaboradorId]);
        if (!colab || colab.status === 'INATIVO') {
          throw new Error('Colaborador não encontrado ou inativo');
        }
        resumo.colaborador = colab;

        // Buscar operador (dummy ou real dependendo do auth)
        // Para simplificar, assumimos que o ID 1 é o admin padrão caso não seja enviado, assim como no EmprestimoController
        const opId = operadorId || 1; 
        const op = await queryOne('SELECT id, nome FROM usuarios WHERE id = ?', [opId]);

        // Buscar materiais do kit
        const materiais = await query(`
          SELECT m.id, m.codigo_interno, m.nome, m.status 
          FROM kit_materiais km
          JOIN materiais m ON km.material_id = m.id
          WHERE km.kit_id = ?
        `, [kitId]);

        if (materiais.length === 0) {
          throw new Error('Este kit está vazio');
        }

        // Registrar saída para cada material
        for (const m of materiais) {
          if (m.status !== 'DISPONIVEL') {
            throw new Error(`Material ${m.codigo_interno} do kit não está disponível (Status: ${m.status})`);
          }

          // Criar empréstimo
          await query(
            'INSERT INTO emprestimos (colaborador_id, material_id, operador_saida_id) VALUES (?, ?, ?)',
            [colab.id, m.id, op.id]
          );

          // Atualizar status do material
          await query('UPDATE materiais SET status = "EM_USO" WHERE id = ?', [m.id]);

          // Registrar histórico
          await query(`
            INSERT INTO movimentacoes (
              material_id, material_codigo, material_nome,
              colaborador_id, colaborador_nome, colaborador_matricula,
              operador_id, operador_nome, tipo, observacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SAIDA', 'Atribuição via Kit')
          `, [
            m.id, m.codigo_interno, m.nome,
            colab.id, colab.nome, colab.matricula,
            op.id, op.nome
          ]);

          resumo.materiais.push(m);
          resumo.materiaisCount++;
        }

        // Após atribuir, o kit é destruído pois ele cumpriu seu propósito
        await query('DELETE FROM kit_materiais WHERE kit_id = ?', [kitId]);
        await query('DELETE FROM kits WHERE id = ?', [kitId]);

        // Atualizar acesso à mina
        const acessoAtivo = await queryOne('SELECT id FROM acessos_mina WHERE colaborador_id = ? AND status = "ATIVO"', [colab.id]);
        if (!acessoAtivo) {
          await query('INSERT INTO acessos_mina (colaborador_id, status) VALUES (?, "ATIVO")', [colab.id]);
        }
      });

      res.json(resumo);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Erro ao atribuir kit' });
    }
  }
}
