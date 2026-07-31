import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import adminActsRoutes from './adminActsRoutes';
import adminResourcesRoutes from './adminResourcesRoutes';
import adminTicketsRoutes from './adminTicketsRoutes';
import adminHelplinesRoutes from './adminHelplinesRoutes';
import adminTemplatesRoutes from './adminTemplatesRoutes';
import adminStatsRoutes from './adminStatsRoutes';

const adminRouter = Router();

// Apply authorization middleware to secure all admin endpoints
adminRouter.use(requireAuth);

// Mount separated admin sub-routes
adminRouter.use('/', adminActsRoutes);
adminRouter.use('/', adminResourcesRoutes);
adminRouter.use('/', adminTicketsRoutes);
adminRouter.use('/', adminHelplinesRoutes);
adminRouter.use('/', adminTemplatesRoutes);
adminRouter.use('/', adminStatsRoutes);

export default adminRouter;