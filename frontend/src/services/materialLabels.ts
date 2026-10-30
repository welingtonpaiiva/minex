import { api } from './api';
import { errorMessage } from '../components/ui';

export async function downloadMaterialLabels(filters: object = {}, printTest = false) {
  try {
    const response = printTest ? await api.get('/materiais/etiquetas/teste', { responseType: 'blob' })
      : await api.post('/materiais/etiquetas', filters, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data), link = document.createElement('a');
    link.href = url; link.download = printTest ? 'teste-leitura-code128.pdf' : 'etiquetas-mina-ug.pdf'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error: any) {
    if (error.response?.data instanceof Blob) {
      let body; try { body = JSON.parse(await error.response.data.text()); } catch { /* Mensagem padrão abaixo. */ }
      if (body?.error) throw new Error(body.error);
    }
    throw new Error(errorMessage(error));
  }
}
