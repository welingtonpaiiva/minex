import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { api } from '../services/api';
import './MaterialPhoto.css';

export function MaterialPhoto({ src, name, size = 'thumbnail' }: { src?: string; name: string; size?: 'thumbnail' | 'preview' }) {
  const [url, setUrl] = useState(''), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true, object = '';
    setFailed(false); setUrl('');
    if (!src) return;
    if (!src.startsWith('/api/materiais/fotos/')) { setUrl(src); return; }
    api.get(src.replace('/api', ''), { responseType: 'blob' }).then(response => {
      if (!active) return;
      object = URL.createObjectURL(response.data); setUrl(object);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (object) URL.revokeObjectURL(object); };
  }, [src]);
  return <span className={'material-photo ' + size}>
    {url && !failed ? <img src={url} alt={'Foto de ' + name} loading="lazy" decoding="async" onError={() => setFailed(true)}/>
      : <Package aria-label={'Sem foto de ' + name} size={size === 'preview' ? 48 : 25}/>}
  </span>;
}
