import { useState } from 'react';
import { MaterialOperation } from './MaterialOperation';
import { QuantityOperation } from './QuantityOperation';
import { KitOperation } from './KitOperation';
import { QuickReturn } from './QuickReturn';
import { Boxes, UsersRound } from 'lucide-react';

export function OperationSwitch({ type }: { type: 'saida' | 'entrada' }) {
  const [mode, setMode] = useState<'INDIVIDUAL' | 'QUANTIDADE' | 'KITS' | 'PESSOAS'>(type === 'entrada' ? 'PESSOAS' : 'INDIVIDUAL');

  return (
    <>
      <div className="tabs operation-tabs">
        {type === 'entrada' && <button className={'tab ' + (mode === 'PESSOAS' ? 'active' : '')} onClick={() => setMode('PESSOAS')}>
          <UsersRound size={17} />Pessoas e materiais<span className="return-tab-badge">BAIXA RÁPIDA</span>
        </button>}
        <button
          className={'tab ' + (mode === 'INDIVIDUAL' ? 'active' : '')}
          onClick={() => setMode('INDIVIDUAL')}
        >
          Equipamentos individuais
        </button>
        <button
          className={'tab ' + (mode === 'QUANTIDADE' ? 'active' : '')}
          onClick={() => setMode('QUANTIDADE')}
        >
          Materiais por quantidade
        </button>
        {type === 'saida' && (
          <button
            className={'tab ' + (mode === 'KITS' ? 'active' : '')}
            onClick={() => setMode('KITS')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Boxes size={16} />
            <span>Kits Pré-Montados</span>
            <span style={{ fontSize: '10px', background: '#331274', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
              ÁGIL
            </span>
          </button>
        )}
      </div>

      {mode === 'INDIVIDUAL' ? (
        <MaterialOperation type={type} />
      ) : mode === 'QUANTIDADE' ? (
        <QuantityOperation type={type} />
      ) : mode === 'PESSOAS' ? (
        <QuickReturn />
      ) : (
        <KitOperation />
      )}
    </>
  );
}
