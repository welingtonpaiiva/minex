import { memo, useEffect, useState } from 'react';
import { HardHat } from 'lucide-react';

export const MonitoringPortrait = memo(function MonitoringPortrait({ name, src }: { name: string; src: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials = name.trim().split(/\s+/).filter(Boolean).map(word => word[0]);
  const demoIndex = /\/images\/demonstracao-equipe\.webp#portrait-([0-7])$/.exec(src || '');
  const index = demoIndex ? Number(demoIndex[1]) : null;
  return <div className={'mine-portrait' + (index !== null ? ' is-demo-portrait' : '')}>
    {src && !failed ? <img src={src} alt={'Foto ' + (index !== null ? 'fictícia de ' : 'de ') + name} onError={() => setFailed(true)} decoding="async"
      style={index !== null ? { width: '400%', height: '200%', left: `${-(index % 4) * 100}%`, top: `${-Math.floor(index / 4) * 100}%` } : undefined} />
      : <div className="mine-portrait-fallback" aria-label={'Foto não cadastrada de ' + name}><HardHat size={36} /><span>{initials[0]}{initials.length > 1 ? initials[initials.length - 1] : ''}</span></div>}
  </div>;
});
