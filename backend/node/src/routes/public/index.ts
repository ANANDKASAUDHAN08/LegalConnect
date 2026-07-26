import { Router } from 'express';
import publicHelpRoutes from './publicHelpRoutes';
import publicActRoutes from './publicActRoutes';
import publicSearchRoutes from './publicSearchRoutes';
import publicAiRoutes from './publicAiRoutes';
import publicTemplateRoutes from './publicTemplateRoutes';
import publicInfoRoutes from './publicInfoRoutes';
import lawyerCasePackRoutes from '../lawyer/lawyerCasePackRoutes';

const router = Router();

// Mount separated public domain-focused sub-routers
router.use('/legal', publicHelpRoutes);
router.use('/legal', publicActRoutes);
router.use('/legal', publicSearchRoutes);
router.use('/legal', publicAiRoutes);
router.use('/legal', publicTemplateRoutes);
router.use('/legal', lawyerCasePackRoutes); // Maintains original /api/legal/case-packs contract
router.use('/info', publicInfoRoutes);

export default router;