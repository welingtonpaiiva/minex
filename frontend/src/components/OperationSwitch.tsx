import { useState } from 'react';
import { MaterialOperation } from './MaterialOperation';
import { QuantityOperation } from './QuantityOperation';
import { KitOperation } from './KitOperation';
import { Boxes } from 'lucide-react';

export function OperationSwitch({ type }: { type: 'saida' | 'entrada' }) {
  const [mode, setMode] = useState<'INDIVIDUAL' | 'QUANTIDADE' | 'KITS'>('INDIVIDUAL');

  return (
    <>
      <div className="tabs" style={{ padding: '22px 34px 0', display: 'flex', gap: '8px' }}>
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
      ) : (
        <KitOperation />
      )}
    </>
  );
}
