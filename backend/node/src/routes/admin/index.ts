import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middlewares/auth';
import adminActsRoutes from './adminActsRoutes';
import adminResourcesRoutes from './adminResourcesRoutes';
import adminTicketsRoutes from './adminTicketsRoutes';
import adminHelplinesRoutes from './adminHelplinesRoutes';
import adminTemplatesRoutes from './adminTemplatesRoutes';
import adminStatsRoutes from './adminStatsRoutes';
import adminRightsRoutes from './adminRightsRoutes';
import adminContributionsRoutes from './adminContributionsRoutes';

const adminRouter = Router();

// Apply authorization middleware to secure all admin endpoints
// requireAuth validates JWT token; requireAdmin enforces Admin/Lawyer role
adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

// Mount separated admin sub-routes
adminRouter.use('/', adminActsRoutes);
adminRouter.use('/', adminResourcesRoutes);
adminRouter.use('/', adminTicketsRoutes);
adminRouter.use('/', adminHelplinesRoutes);
adminRouter.use('/', adminTemplatesRoutes);
adminRouter.use('/', adminStatsRoutes);
adminRouter.use('/', adminRightsRoutes);
adminRouter.use('/', adminContributionsRoutes);

export default adminRouter;