import { Router } from 'express';
import { KitController } from '../controllers/KitController';

const router = Router();

router.get('/', KitController.listarKits);
router.post('/', KitController.criarKit);
router.delete('/:id', KitController.excluirKit);
router.post('/atribuir', KitController.atribuirKit);

export default router;
