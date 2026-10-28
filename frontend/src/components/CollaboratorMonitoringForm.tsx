export function CollaboratorMonitoringForm({ value, onChange }: { value: any; onChange: (value: any) => void }) {
  return <>
    <label>Empresa<input maxLength={255} value={value.empresa || ''} onChange={e => onChange({ ...value, empresa: e.target.value })} /></label>
    <label>Turma<input maxLength={32} value={value.turma || ''} placeholder="Ex.: A, B, C, D ou ADM" onChange={e => onChange({ ...value, turma: e.target.value })} /></label>
    <label className="check-label wide"><input type="checkbox" checked={Boolean(value.brigadista)} onChange={e => onChange({ ...value, brigadista: e.target.checked })} />Integrante da brigada de emergência</label>
    {Boolean(value.brigadista) && <>
      <label>Especialidade na brigada<input maxLength={255} value={value.brigada_especialidade || ''} placeholder="Ex.: Resgate e emergência" onChange={e => onChange({ ...value, brigada_especialidade: e.target.value })} /></label>
      <label>Validade da habilitação<input type="date" value={value.brigada_validade || ''} onChange={e => onChange({ ...value, brigada_validade: e.target.value || null })} /></label>
      <p className="summary-note wide">A presença na mina vem do registro de acesso. A identificação como brigadista e a validade da habilitação são informações distintas.</p>
    </>}
  </>;
}
