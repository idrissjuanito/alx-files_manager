import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';
import authMiddleware from '../middlewares/authMiddleware';

const router = express.Router();
router.use('/files', authMiddleware);
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);
router.post('/users', UsersController.postNew);
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);
router.get('/users/me', UsersController.getMe);
router.post('/files', FilesController.postUpload);
router.get('/files', FilesController.getIndex);
router.get('/files/:id', FilesController.getShow);
router.put('/files/:id/publish', FilesController.putPublish);
router.put('/files/:id/unpublish', FilesController.putUnpublish);

export default router;
