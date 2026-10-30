import { useRef, useState } from 'react';
import { api } from '../services/api';
import { notifyChange } from '../hooks/useResource';
import { Modal, Notice, errorMessage } from './ui';
import './MaterialBatchModal.css';

export function MaterialBatchModal({ categories, onClose }: { categories: any[]; onClose: () => void }) {
  const [config, setConfig] = useState({ nome: 'Lanterna', prefixo: 'LM-', inicio: 1, fim: 300, digitos: 3,
    patrimonio: 'MINA-UG', categoria_id: categories.find(c => /lanterna/i.test(c.nome))?.id || '' });
  const [preview, setPreview] = useState<any>(null), [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [confirmed, setConfirmed] = useState(false);
  const pending = useRef(false);
  function change(value: Partial<typeof config>) { setConfig(old => ({ ...old, ...value })); setPreview(null); setReport(null); setConfirmed(false); setMessage(''); }
  async function run(create: boolean) {
    if (pending.current || (create && (!preview || !confirmed))) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      if (create) {
        const response = await api.post('/materiais/lote', { ...preview.config, confirmar: true });
        setReport(response.data); setPreview(null); setConfirmed(false); notifyChange();
      } else { setReport(null); setConfirmed(false); setPreview((await api.post('/materiais/lote/previa', config)).data); }
    } catch (error) { setMessage(errorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Modal title="Cadastro em Lote" onClose={() => { if (!pending.current) onClose(); }}>
    <Notice message={message}/>
    <form onSubmit={event => { event.preventDefault(); void run(false); }}>
      <fieldset className="batch-fields" disabled={busy}><div className="form-grid">
        <label>Tipo de equipamento<select value={config.nome} onChange={e => change({ nome: e.target.value })}>{['Lanterna', 'Rádio', 'Medidor de gás', 'Bateria de rádio', 'Equipamento'].map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Categoria<select value={config.categoria_id} onChange={e => change({ categoria_id: e.target.value })}><option value="">Sem categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label>Prefixo da TAG<input required maxLength={20} value={config.prefixo} onChange={e => change({ prefixo: e.target.value.toUpperCase() })}/></label>
        <label>Patrimônio<input required maxLength={255} value={config.patrimonio} onChange={e => change({ patrimonio: e.target.value })}/></label>
        <label>Número inicial<input required type="number" min={1} value={config.inicio} onChange={e => change({ inicio: Number(e.target.value) })}/></label>
        <label>Número final<input required type="number" min={1} value={config.fim} onChange={e => change({ fim: Number(e.target.value) })}/></label>
        <label>Quantidade de dígitos<input required type="number" min={1} max={8} value={config.digitos} onChange={e => change({ digitos: Number(e.target.value) })}/></label>
      </div></fieldset>
      <p className="summary-note">Cada equipamento terá TAG e código de barras exclusivos, no padrão Code 128. Limite de 1.000 equipamentos por lote.</p>
      {preview && <><div className="notice success" role="status">{preview.total} equipamentos · {preview.criar} novos · {preview.ignorados} conflitos serão ignorados</div>
        <div className="batch-preview table-wrap"><table className="data-table"><thead><tr><th>TAG</th><th>Patrimônio</th><th>Prévia</th></tr></thead><tbody>{preview.items.map((item: any) => <tr key={item.codigo}><td>{item.codigo}</td><td>{item.patrimonio}</td><td>{item.conflito ? 'Já cadastrado — ignorar' : 'Novo — disponível'}</td></tr>)}</tbody></table></div>
        <label className="batch-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/>Revisei a prévia e confirmo o cadastro dos novos equipamentos.</label></>}
      {report && <><Notice type={report.erros ? 'error' : 'success'} message={`${report.criados} criados · ${report.ignorados} ignorados · ${report.erros} erros`}/>
        <div className="batch-preview table-wrap"><table className="data-table"><thead><tr><th>TAG</th><th>Resultado</th></tr></thead><tbody>{report.items.map((item: any) => <tr key={item.codigo}><td>{item.codigo}</td><td>{item.resultado}{item.erro && ': ' + item.erro}</td></tr>)}</tbody></table></div></>}
      <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Fechar</button><button type="submit" className="button secondary" disabled={busy}>{busy ? 'Processando…' : 'Verificar conflitos e gerar prévia'}</button>{preview && <button type="button" className="button primary" disabled={busy || !confirmed || !preview.criar} onClick={() => void run(true)}>Confirmar cadastro de {preview.criar} equipamentos</button>}</div>
    </form>
  </Modal>;
}

export function MaterialPatrimonyModal({ onClose }: { onClose: () => void }) {
  const [preview, setPreview] = useState<any>(null), [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function run(apply: boolean) {
    if (pending.current || (apply && (!preview || !confirmed))) return;
    pending.current = true; setBusy(true); setMessage(''); setSuccess('');
    try {
      if (apply) {
        const result = await api.post('/materiais/patrimonio-mina-ug', { confirmar: true, versao: preview.versao });
        setSuccess(result.data.atualizados + ' itens atualizados com patrimônio MINA-UG.');
        setPreview(null); setConfirmed(false); notifyChange();
      } else { setPreview((await api.get('/materiais/patrimonio-mina-ug/previa')).data); setConfirmed(false); }
    } catch (error) { setMessage(errorMessage(error)); if (apply) { setPreview(null); setConfirmed(false); } }
    finally { pending.current = false; setBusy(false); }
  }
  return <Modal title="Patrimônio MINA-UG" onClose={() => { if (!pending.current) onClose(); }}>
    <Notice message={message}/><Notice message={success} type="success"/>
    <p className="summary-note">Atribua o patrimônio MINA-UG a todos os itens cadastrados, incluindo materiais por quantidade. Confira abaixo os valores que serão substituídos.</p>
    {preview && <><p>{preview.total} itens para atualizar.</p><div className="batch-preview table-wrap"><table className="data-table"><thead><tr><th>TAG</th><th>Patrimônio atual</th></tr></thead><tbody>{preview.items.map((item: any) => <tr key={item.id}><td>{item.codigo_interno}</td><td>{item.patrimonio || 'Sem patrimônio'}</td></tr>)}</tbody></table></div>
      {preview.total > 0 && <label className="batch-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/>Confirmo a alteração do patrimônio dos {preview.total} itens para MINA-UG.</label>}</>}
    <div className="form-actions"><button className="button secondary" disabled={busy} onClick={onClose}>Fechar</button><button className="button secondary" disabled={busy} onClick={() => void run(false)}>{busy ? 'Processando…' : 'Conferir itens cadastrados'}</button>{preview?.total > 0 && <button className="button primary" disabled={busy || !confirmed} onClick={() => void run(true)}>Aplicar patrimônio MINA-UG</button>}</div>
  </Modal>;
}
