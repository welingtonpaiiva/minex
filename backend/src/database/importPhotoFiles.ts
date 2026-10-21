import { importPhotoFiles } from '../services/PhotoStorage';
import { closeDatabase } from '../config/db';

if (require.main === module) {
  importPhotoFiles().then(count => console.log(count + ' foto(s) importada(s) e conferida(s).'))
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(closeDatabase);
}
