import { Router } from 'express';
import { adminAuth, tenantAuth } from '../middleware/auth';
import { webhookAuth } from '../middleware/webhookAuth';
import { errorHandler } from '../middleware/errorHandler';
import * as healthController from '../controllers/health.controller';
import * as tenantController from '../controllers/tenant.controller';
import * as tenantProviderController from '../controllers/tenantProvider.controller';
import * as ticketController from '../controllers/ticket.controller';
import * as customerController from '../controllers/customer.controller';
import * as knowledgeBaseController from '../controllers/knowledgeBase.controller';
import * as draftController from '../controllers/draft.controller';
import * as webhookController from '../controllers/webhook.controller';

export function createRouter(): Router {
  const router = Router();

  // Health
  router.get('/health', healthController.getHealth);

  // Admin routes
  router.post('/api/v1/tenants', adminAuth, tenantController.create);
  router.get('/api/v1/tenants/:tenantId', adminAuth, tenantController.show);
  router.put('/api/v1/tenants/:tenantId', adminAuth, tenantController.update);

  // Tenant provider routes
  router.get('/api/v1/tenants/:tenantId/providers', tenantAuth, tenantProviderController.list);
  router.post('/api/v1/tenants/:tenantId/providers', tenantAuth, tenantProviderController.create);
  router.put(
    '/api/v1/tenants/:tenantId/providers/:provider',
    tenantAuth,
    tenantProviderController.update,
  );
  router.delete(
    '/api/v1/tenants/:tenantId/providers/:provider',
    tenantAuth,
    tenantProviderController.remove,
  );

  // Ticket routes
  router.get('/api/v1/tenants/:tenantId/tickets', tenantAuth, ticketController.list);
  router.get('/api/v1/tenants/:tenantId/tickets/:id', tenantAuth, ticketController.show);
  router.post('/api/v1/tenants/:tenantId/tickets/sync', tenantAuth, ticketController.sync);

  // Customer routes
  router.get('/api/v1/tenants/:tenantId/customers', tenantAuth, customerController.list);
  router.get('/api/v1/tenants/:tenantId/customers/:id', tenantAuth, customerController.show);
  router.post('/api/v1/tenants/:tenantId/customers', tenantAuth, customerController.create);
  router.put(
    '/api/v1/tenants/:tenantId/customers/:id/metadata',
    tenantAuth,
    customerController.updateMetadata,
  );

  // Knowledge article routes
  router.get(
    '/api/v1/tenants/:tenantId/knowledge-articles',
    tenantAuth,
    knowledgeBaseController.list,
  );
  router.get(
    '/api/v1/tenants/:tenantId/knowledge-articles/:id',
    tenantAuth,
    knowledgeBaseController.show,
  );
  router.post(
    '/api/v1/tenants/:tenantId/knowledge-articles',
    tenantAuth,
    knowledgeBaseController.create,
  );
  router.put(
    '/api/v1/tenants/:tenantId/knowledge-articles/:id',
    tenantAuth,
    knowledgeBaseController.update,
  );
  router.delete(
    '/api/v1/tenants/:tenantId/knowledge-articles/:id',
    tenantAuth,
    knowledgeBaseController.remove,
  );

  // Draft routes
  router.post('/api/v1/tenants/:tenantId/tickets/:id/draft', tenantAuth, draftController.generate);
  router.get(
    '/api/v1/tenants/:tenantId/tickets/:id/drafts',
    tenantAuth,
    draftController.listByTicket,
  );
  router.patch('/api/v1/tenants/:tenantId/drafts/:id', tenantAuth, draftController.updateStatus);
  router.post('/api/v1/tenants/:tenantId/drafts/:id/send', tenantAuth, draftController.send);

  // Webhook routes
  router.post('/webhooks/:tenantSlug/:provider', webhookAuth, webhookController.receive);

  // Error handler
  router.use(errorHandler);

  return router;
}
