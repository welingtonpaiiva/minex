import { query, queryOne } from '../config/db';

export class ColaboradorService {
  static async listar(busca?: string, status?: string) {
    let sql = 'SELECT * FROM colaboradores WHERE 1=1';
    const params: any[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (busca) {
      sql += ' AND (nome LIKE ? OR matricula LIKE ? OR nfc_id LIKE ? OR setor LIKE ?)';
      const term = `%${busca.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY nome ASC';
    return await query(sql, params);
  }

  static async buscarPorId(id: number) {
    return await queryOne('SELECT * FROM colaboradores WHERE id = ?', [id]);
  }

  static async buscarPorNfc(nfcId: string) {
    if (!nfcId) return null;
    const cleanNfc = nfcId.trim();
    const unpaddedNfc = cleanNfc.replace(/^0+/, '');

    // 1. Tentar busca exata por nfc_id
    let colab = await queryOne('SELECT * FROM colaboradores WHERE nfc_id = ?', [cleanNfc]);

    // 2. Tentar busca ignorando zeros à esquerda (ex: leitores que enviam zeros adicionais)
    if (!colab && unpaddedNfc) {
      colab = await queryOne(
        "SELECT * FROM colaboradores WHERE LTRIM(nfc_id, '0') = ? OR nfc_id = ?",
        [unpaddedNfc, unpaddedNfc]
      );
    }

    // 3. Fallback: buscar por matrícula
    if (!colab) {
      colab = await queryOne('SELECT * FROM colaboradores WHERE matricula = ?', [cleanNfc]);
    }

    return colab;
  }

  static async buscarPorMatricula(matricula: string) {
    if (!matricula) return null;
    const clean = matricula.trim();
    const unpadded = clean.replace(/^0+/, '');
    return await queryOne(
      "SELECT * FROM colaboradores WHERE matricula = ? OR nfc_id = ? OR LTRIM(matricula, '0') = ?",
      [clean, clean, unpadded]
    );
  }

  static async criar(dados: {
    nome: string;
    matricula: string;
    setor?: string;
    cargo?: string;
    foto_url?: string;
    nfc_id?: string;
  }) {
    if (!dados.nome || !dados.matricula) {
      throw new Error('Nome e matrícula são obrigatórios');
    }

    const matExist = await queryOne('SELECT id FROM colaboradores WHERE matricula = ?', [dados.matricula.trim()]);
    if (matExist) {
      throw new Error('Já existe um colaborador cadastrado com esta matrícula');
    }

    if (dados.nfc_id && dados.nfc_id.trim() !== '') {
      const cleanNfc = dados.nfc_id.trim();
      const unpaddedNfc = cleanNfc.replace(/^0+/, '');
      const nfcExist = unpaddedNfc
        ? await queryOne("SELECT id FROM colaboradores WHERE nfc_id = ? OR LTRIM(nfc_id, '0') = ?", [cleanNfc, unpaddedNfc])
        : await queryOne('SELECT id FROM colaboradores WHERE nfc_id = ?', [cleanNfc]);
      if (nfcExist) {
        throw new Error('Este cartão NFC já está vinculado a outro colaborador');
      }
    }

    await query(
      `INSERT INTO colaboradores (nome, matricula, setor, cargo, foto_url, nfc_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.nome.trim(),
        dados.matricula.trim(),
        dados.setor || '',
        dados.cargo || '',
        dados.foto_url || '',
        dados.nfc_id ? dados.nfc_id.trim() : null,
        'ATIVO'
      ]
    );

    return await queryOne('SELECT * FROM colaboradores WHERE matricula = ?', [dados.matricula.trim()]);
  }

  static async editar(id: number, dados: {
    nome?: string;
    setor?: string;
    cargo?: string;
    foto_url?: string;
    nfc_id?: string;
    status?: string;
  }) {
    const colab = await this.buscarPorId(id);
    if (!colab) {
      throw new Error('Colaborador não encontrado');
    }

    if (dados.nfc_id && dados.nfc_id.trim() !== colab.nfc_id) {
      const cleanNfc = dados.nfc_id.trim();
      const unpaddedNfc = cleanNfc.replace(/^0+/, '');
      const nfcExist = unpaddedNfc
        ? await queryOne("SELECT id FROM colaboradores WHERE (nfc_id = ? OR LTRIM(nfc_id, '0') = ?) AND id != ?", [cleanNfc, unpaddedNfc, id])
        : await queryOne('SELECT id FROM colaboradores WHERE nfc_id = ? AND id != ?', [cleanNfc, id]);
      if (nfcExist) {
        throw new Error('Este cartão NFC já está associado a outro colaborador');
      }
    }

    await query(
      `UPDATE colaboradores
       SET nome = ?, setor = ?, cargo = ?, foto_url = ?, nfc_id = ?, status = ?, updated_at = (datetime('now', 'localtime'))
       WHERE id = ?`,
      [
        dados.nome !== undefined ? dados.nome.trim() : colab.nome,
        dados.setor !== undefined ? dados.setor : colab.setor,
        dados.cargo !== undefined ? dados.cargo : colab.cargo,
        dados.foto_url !== undefined ? dados.foto_url : colab.foto_url,
        dados.nfc_id !== undefined ? (dados.nfc_id ? dados.nfc_id.trim() : null) : colab.nfc_id,
        dados.status !== undefined ? dados.status : colab.status,
        id
      ]
    );

    return await this.buscarPorId(id);
  }

  static async associarNfc(colaboradorId: number, nfcId: string) {
    if (!nfcId) throw new Error('Código NFC não informado');

    const cleanNfc = nfcId.trim();
    const unpaddedNfc = cleanNfc.replace(/^0+/, '');
    const exist = unpaddedNfc
      ? await queryOne("SELECT id FROM colaboradores WHERE (nfc_id = ? OR LTRIM(nfc_id, '0') = ?) AND id != ?", [cleanNfc, unpaddedNfc, colaboradorId])
      : await queryOne('SELECT id FROM colaboradores WHERE nfc_id = ? AND id != ?', [cleanNfc, colaboradorId]);
    if (exist) {
      throw new Error('Este cartão NFC já pertence a outro colaborador');
    }

    await query('UPDATE colaboradores SET nfc_id = ?, updated_at = (datetime(\'now\', \'localtime\')) WHERE id = ?', [cleanNfc, colaboradorId]);
    return await this.buscarPorId(colaboradorId);
  }
}
