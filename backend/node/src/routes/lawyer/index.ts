import { Router } from 'express';
import lawyerPortalRoutes from './lawyerPortalRoutes';

const router = Router();

// Mount lawyer portal profile management and synchronization routes
router.use('/', lawyerPortalRoutes);

export default router;