export function returnConditionMessage(condition: string) {
  if (condition === 'CONFERENCIA') return 'Recebidos, mas ainda indisponíveis. Um operador, supervisor ou administrador deve conferir e liberar no estoque.';
  if (condition === 'DANIFICADO') return 'Encaminhados para manutenção. Os itens permanecem indisponíveis para retirada.';
  return 'Conferidos e aptos. Os itens voltam ao estoque disponível para retirada.';
}

export function ReturnCondition({ value, onChange, disabled = false, label = 'Condição dos itens selecionados' }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; label?: string;
}) {
  return <>
    <label>{label}<select aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
      <option value="APTO">Conferidos e aptos — liberar no estoque</option>
      <option value="CONFERENCIA">Conferência pendente — manter indisponíveis</option>
      <option value="DANIFICADO">Danificados — encaminhar para manutenção</option>
    </select></label>
    <p className="summary-note">{returnConditionMessage(value)}</p>
  </>;
}
