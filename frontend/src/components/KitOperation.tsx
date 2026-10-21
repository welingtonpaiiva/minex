import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Trash2,
  ScanLine,
  CheckCircle2,
  Lock,
  Unlock,
  Search,
  Layers,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import { NfcReaderModal } from './NfcReaderModal';
import { soundFX } from '../services/soundFX';
import { api } from '../services/api';
import { Kit, KitItem } from '../types';
import { Notice, Empty, Modal, errorMessage } from './ui';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Card de kit selado (aguardando NFC) ───────────────────────────────────── */
function KitSealedCard({
  kit,
  onDeliver,
  onDismantle,
}: {
  kit: Kit;
  onDeliver: (kit: Kit) => void;
  onDismantle: (kit: Kit) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="kit-sealed-card"
    >
      {/* Cabeçalho do card */}
      <div
        className="kit-card-header"
        onClick={() => setExpanded(p => !p)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(p => !p)}
        aria-expanded={expanded}
      >
        <div className="kit-card-icon">
          <Lock size={18} />
        </div>
        <div className="kit-card-info">
          <span className="kit-card-name">{kit.nome}</span>
          <span className="kit-card-count">{kit.total_itens ?? kit.materiais?.length ?? 0} itens</span>
        </div>
        <div className="kit-card-chevron">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </div>

      {/* Itens do kit (expansível) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="kit-card-items">
              {kit.materiais && kit.materiais.length > 0 ? (
                kit.materiais.map((item: KitItem) => (
                  <div key={item.id} className="kit-card-item-row">
                    <Package size={14} />
                    <span className="kit-item-name">{item.nome}</span>
                    <span className="kit-item-code">{item.codigo_interno}</span>
                  </div>
                ))
              ) : (
                <p style={{ color: '#94a3b8', fontSize: 13, padding: '4px 0' }}>Sem itens carregados</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ações */}
      <div className="kit-card-actions">
        <button
          className="kit-deliver-btn"
          onClick={() => onDeliver(kit)}
          title="Vincular a crachá NFC e despachar"
        >
          <ScanLine size={16} />
          Dispensar via NFC
        </button>
        <button
          className="kit-dismantle-btn"
          onClick={() => onDismantle(kit)}
          title="Desmontar kit e devolver itens ao estoque"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Painel de montagem de novo kit ────────────────────────────────────────── */
function BuildKitModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nomeKit, setNomeKit] = useState('');
  const [descricaoKit, setDescricaoKit] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [carrinhoKit, setCarrinhoKit] = useState<any[]>([]);
  const [searchingMaterial, setSearchingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState('');
  const [busy, setBusy] = useState(false);

  // Browse estoque
  const [browseOpen, setBrowseOpen] = useState(false);
  const [availableStock, setAvailableStock] = useState<any[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [loadingStock, setLoadingStock] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => barcodeInputRef.current?.focus(), 150);
  }, []);

  const fetchStock = async (q = '') => {
    setLoadingStock(true);
    try {
      const res = await api.get('/estoque', { params: { status: 'DISPONIVEL', busca: q, limit: 30 } });
      setAvailableStock(res.data.items || []);
    } catch { /* silent */ } finally { setLoadingStock(false); }
  };

  useEffect(() => {
    if (browseOpen) fetchStock(stockSearch);
  }, [browseOpen, stockSearch]);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code || searchingMaterial) return;
    setMaterialError('');
    setSearchingMaterial(true);
    try {
      const res = await api.get(`/materiais/codigo/${encodeURIComponent(code)}`);
      const material = res.data;
      if (!material) throw new Error(`Material não encontrado: "${code}"`);
      if (material.status !== 'DISPONIVEL') throw new Error(`"${material.nome}" não está disponível (${material.status})`);
      if (material.tipo_controle === 'QUANTIDADE') throw new Error('Materiais por quantidade não entram em kits unitários.');
      if (carrinhoKit.some(m => m.id === material.id)) throw new Error(`"${material.codigo_interno}" já está na lista.`);
      soundFX.playScan();
      setCarrinhoKit(prev => [...prev, material]);
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
    } catch (err: any) {
      soundFX.playError();
      setMaterialError(err.response?.data?.error || err.message || 'Erro ao buscar material');
    } finally { setSearchingMaterial(false); }
  }

  async function handleSave() {
    if (!nomeKit.trim()) { setMaterialError('Informe um nome para o kit (ex: CESTO 01).'); return; }
    if (carrinhoKit.length === 0) { setMaterialError('Adicione pelo menos um material ao kit.'); return; }
    setBusy(true); setMaterialError('');
    try {
      await api.post('/kits', {
        nome: nomeKit.trim().toUpperCase(),
        descricao: descricaoKit.trim(),
        materiaisCodigos: carrinhoKit.map(m => m.codigo_interno),
      });
      soundFX.playSuccess();
      onSaved();
    } catch (err: any) {
      soundFX.playError();
      setMaterialError(errorMessage(err));
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Montar novo Kit / Cesto" onClose={onClose}>
      <div className="form-grid">
        <label className="wide">
          Identificação do Kit (ex: CESTO 01, TURNO A NOITE)
          <input
            required
            maxLength={100}
            value={nomeKit}
            onChange={e => setNomeKit(e.target.value)}
            placeholder="CESTO 01"
            style={{ textTransform: 'uppercase', fontWeight: 700 }}
          />
        </label>
        <label className="wide">
          Descrição / observação (opcional)
          <input maxLength={255} value={descricaoKit} onChange={e => setDescricaoKit(e.target.value)} placeholder="Ex: Kit padrão turno manhã — área norte" />
        </label>
      </div>

      <div style={{ margin: '16px 0 6px', fontWeight: 700, fontSize: 13, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Materiais do kit ({carrinhoKit.length})
      </div>

      {/* Scanner de código */}
      <form onSubmit={handleScan} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          ref={barcodeInputRef}
          value={barcodeInput}
          onChange={e => setBarcodeInput(e.target.value)}
          placeholder="Bipear código de barras ou interno…"
          style={{ flex: 1 }}
        />
        <button type="submit" className="button secondary" disabled={searchingMaterial}>
          <ScanLine size={16} />
          {searchingMaterial ? 'Buscando…' : 'Bipar'}
        </button>
        <button type="button" className="button secondary" onClick={() => setBrowseOpen(true)}>
          <Search size={16} />
          Estoque
        </button>
      </form>

      {materialError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 10 }}>
          <AlertCircle size={16} />
          {materialError}
        </div>
      )}

      {/* Lista do carrinho */}
      {carrinhoKit.length > 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          {carrinhoKit.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < carrinhoKit.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
              <Package size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{m.nome}</span>
              <span style={{ color: '#64748b', fontSize: 12 }}>{m.codigo_interno}</span>
              <button
                type="button"
                onClick={() => setCarrinhoKit(prev => prev.filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="form-actions">
        <button className="button primary" onClick={handleSave} disabled={busy}>
          <Lock size={16} />
          {busy ? 'Salvando…' : 'Selar Kit e Aguardar NFC'}
        </button>
      </div>

      {/* Browse estoque */}
      {browseOpen && (
        <Modal title="Selecionar do Estoque Disponível" onClose={() => setBrowseOpen(false)}>
          <input
            autoFocus
            value={stockSearch}
            onChange={e => setStockSearch(e.target.value)}
            placeholder="Buscar material…"
            style={{ marginBottom: 12 }}
          />
          {loadingStock ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Carregando…</p>
          ) : (
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {availableStock.length === 0 && <Empty>Nenhum material disponível.</Empty>}
              {availableStock.map((m: any) => (
                <div
                  key={m.id}
                  onClick={() => {
                    if (carrinhoKit.some(x => x.id === m.id)) { setMaterialError('Já incluído no kit.'); setBrowseOpen(false); return; }
                    soundFX.playScan();
                    setCarrinhoKit(prev => [...prev, m]);
                    setBrowseOpen(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', borderRadius: 8 }}
                  className="hover-row"
                >
                  <Package size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{m.nome}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{m.codigo_interno}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </Modal>
  );
}

/* ─── Tela de sucesso após despachar kit ────────────────────────────────────── */
function KitSuccessScreen({
  data,
  onDismiss,
}: {
  data: any;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.93 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center gap-8 py-16"
    >
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 40px -10px rgba(34,197,94,0.4)' }}>
        <CheckCircle2 size={44} color="white" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#15803d', marginBottom: 8 }}>Kit despachado!</h2>
        <p style={{ color: '#475569', fontSize: 16 }}>
          <strong>{data.kit?.nome || 'Kit'}</strong> vinculado a <strong>{data.colaborador?.nome || 'colaborador'}</strong>
        </p>
        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>{data.kit?.total_itens ?? 0} itens saíram do estoque.</p>
      </div>
      <button className="button secondary" onClick={onDismiss}>Voltar aos kits</button>
    </motion.div>
  );
}

/* ─── Componente principal ───────────────────────────────────────────────────── */
export function KitOperation() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [successData, setSuccessData] = useState<any>(null);

  const [deliveringKit, setDeliveringKit] = useState<Kit | null>(null);
  const [nfcModalOpen, setNfcModalOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const [buildOpen, setBuildOpen] = useState(false);

  const fetchKits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/kits');
      setKits(res.data || []);
    } catch (err: any) {
      setMessage(errorMessage(err));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchKits(); }, []);

  async function handleConfirmarAtribuicao(colaborador: any) {
    if (!deliveringKit || !colaborador) return;
    setBusyAction(true); setMessage('');
    try {
      const res = await api.post(`/kits/${deliveringKit.id}/atribuir`, { colaboradorId: colaborador.id });
      soundFX.playSuccess();
      setNfcModalOpen(false);
      setDeliveringKit(null);
      setSuccessData(res.data);
      await fetchKits();
    } catch (err: any) {
      soundFX.playError();
      setMessage(errorMessage(err));
    } finally { setBusyAction(false); }
  }

  async function handleDesmontar(kit: Kit) {
    if (!window.confirm(`Desmontar o kit "${kit.nome}"? Os ${kit.materiais?.length || 0} itens voltarão ao estoque.`)) return;
    setBusyAction(true);
    try {
      await api.delete(`/kits/${kit.id}`);
      soundFX.playSuccess();
      await fetchKits();
    } catch (err: any) {
      soundFX.playError();
      setMessage(errorMessage(err));
    } finally { setBusyAction(false); }
  }

  // ---- Tela de sucesso -------------------------------------------------------
  if (successData) {
    return <KitSuccessScreen data={successData} onDismiss={() => setSuccessData(null)} />;
  }

  // ---- Tela principal --------------------------------------------------------
  const emptyKits = !loading && kits.length === 0;

  return (
    <div className="kit-panel">
      {/* ── Área principal: kits selados ──────────────────────────────────── */}
      <div className="kit-panel-main">
        {/* Cabeçalho */}
        <div className="kit-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="kit-header-icon">
              <Layers size={22} />
            </div>
            <div>
              <h2 className="kit-header-title">Kits Pré-Montados</h2>
              <p className="kit-header-sub">
                {kits.length === 0
                  ? 'Nenhum kit aguardando despacho'
                  : `${kits.length} kit${kits.length > 1 ? 's' : ''} selado${kits.length > 1 ? 's' : ''} — aguardando crachá NFC`}
              </p>
            </div>
          </div>
          <button
            className="button primary"
            onClick={() => setBuildOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
          >
            <Plus size={18} />
            Montar Kit
          </button>
        </div>

        <Notice message={message} />

        {/* Estado vazio */}
        {emptyKits && (
          <div className="kit-empty-state">
            <div className="kit-empty-icon">
              <Lock size={32} />
            </div>
            <h3>Área de kits vazia</h3>
            <p>Monte um kit para que fique selado aqui, aguardando o colaborador escanear o crachá NFC no balcão.</p>
            <button className="button primary" onClick={() => setBuildOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Plus size={18} />
              Montar primeiro kit
            </button>
          </div>
        )}

        {/* Lista de kits selados */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#64748b', fontSize: 14, padding: '20px 0' }}>
            <Cpu size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
            Carregando kits…
          </div>
        )}

        <div className="kit-grid">
          <AnimatePresence>
            {kits.map(kit => (
              <KitSealedCard
                key={kit.id}
                kit={kit}
                onDeliver={k => { setDeliveringKit(k); setNfcModalOpen(true); }}
                onDismantle={handleDesmontar}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Instrução de operação */}
        {kits.length > 0 && (
          <div className="kit-instructions">
            <ScanLine size={16} />
            <span>
              Clique em <strong>Dispensar via NFC</strong> no kit desejado e aproxime o crachá do colaborador para vinculá-lo automaticamente.
            </span>
          </div>
        )}
      </div>

      {/* ── Modal de montagem ─────────────────────────────────────────────── */}
      {buildOpen && (
        <BuildKitModal
          onClose={() => setBuildOpen(false)}
          onSaved={async () => { setBuildOpen(false); await fetchKits(); }}
        />
      )}

      {/* ── Modal NFC de entrega ──────────────────────────────────────────── */}
      {deliveringKit && (
        <NfcReaderModal
          isOpen={nfcModalOpen}
          title={`Vincular kit "${deliveringKit.nome}" a colaborador`}
          subtitle="Aproxime o crachá NFC ou informe a matrícula"
          requireActive={true}
          onNfcRead={async (_nfcId, person) => {
            if (person) {
              await handleConfirmarAtribuicao(person);
            }
          }}
          onClose={() => { setNfcModalOpen(false); setDeliveringKit(null); }}
        />
      )}
    </div>
  );
}
