import { Router } from 'express';
import { tenantOrUserAuth, userAuth, requireRole } from '../middleware/auth';
import { webhookAuth } from '../middleware/webhookAuth';
import { errorHandler } from '../middleware/errorHandler';
import * as healthController from '../controllers/health.controller';
import * as tenantController from '../controllers/tenant.controller';
import * as appController from '../controllers/app.controller';
import * as ticketController from '../controllers/ticket.controller';
import * as customerController from '../controllers/customer.controller';
import * as knowledgeBaseController from '../controllers/knowledgeBase.controller';
import * as draftController from '../controllers/draft.controller';
import * as webhookController from '../controllers/webhook.controller';
import * as authController from '../controllers/auth.controller';
import * as userController from '../controllers/user.controller';
import * as chatController from '../controllers/chat.controller';
import * as attachmentController from '../controllers/attachment.controller';
import * as voiceRecordingController from '../controllers/voiceRecording.controller';

export function createRouter(): Router {
  const router = Router();

  // Health
  router.get('/health', healthController.getHealth);

  // Auth routes (public)
  router.post('/auth/register', authController.register);
  router.post('/auth/login', authController.login);
  router.post('/auth/refresh', authController.refresh);

  // Auth routes (user auth required)
  router.get('/auth/me', userAuth, authController.me);
  router.post('/auth/change-password', userAuth, authController.changePassword);

  // User creates their own tenant (becomes owner)
  router.post('/my/tenants', userAuth, tenantController.createForUser);

  // Owner updates their tenant (partial settings merge)
  router.patch(
    '/tenants/:tenantId',
    userAuth, requireRole('owner'),
    tenantController.updateForOwner,
  );

  // Tenant detail (owner/admin only)
  router.get(
    '/tenants/:tenantId',
    userAuth, requireRole('owner', 'admin'),
    tenantController.show,
  );

  // User management routes (user auth + role)
  router.get(
    '/tenants/:tenantId/users',
    userAuth, requireRole('owner', 'admin'),
    userController.list,
  );
  router.get(
    '/tenants/:tenantId/users/:userId',
    userAuth, requireRole('owner', 'admin'),
    userController.show,
  );
  router.post(
    '/tenants/:tenantId/users',
    userAuth, requireRole('owner', 'admin'),
    userController.invite,
  );
  router.put(
    '/tenants/:tenantId/users/:userId',
    userAuth, requireRole('owner', 'admin'),
    userController.update,
  );
  router.delete(
    '/tenants/:tenantId/users/:userId',
    userAuth, requireRole('owner'),
    userController.remove,
  );

  // App routes
  router.get(
    '/tenants/:tenantId/apps',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    appController.list,
  );
  router.get(
    '/tenants/:tenantId/apps/:appId',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    appController.show,
  );
  router.post(
    '/tenants/:tenantId/apps',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    appController.create,
  );
  router.put(
    '/tenants/:tenantId/apps/:appId',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    appController.update,
  );
  router.delete(
    '/tenants/:tenantId/apps/:appId',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    appController.remove,
  );
  router.post(
    '/tenants/:tenantId/apps/:appId/sync',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    appController.sync,
  );
  router.post(
    '/tenants/:tenantId/apps/:appId/test',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    appController.test,
  );

  // Ticket routes
  router.get(
    '/tenants/:tenantId/tickets',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    ticketController.list,
  );
  router.get(
    '/tenants/:tenantId/tickets/:id',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    ticketController.show,
  );
  router.post(
    '/tenants/:tenantId/tickets/sync',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    ticketController.sync,
  );
  router.patch(
    '/tenants/:tenantId/tickets/:id/output-app',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    ticketController.updateOutputApp,
  );

  // Customer routes
  router.get(
    '/tenants/:tenantId/customers',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    customerController.list,
  );
  router.get(
    '/tenants/:tenantId/customers/:id',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    customerController.show,
  );
  router.post(
    '/tenants/:tenantId/customers',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    customerController.create,
  );
  router.put(
    '/tenants/:tenantId/customers/:id/metadata',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    customerController.updateMetadata,
  );

  // Knowledge article routes
  router.get(
    '/tenants/:tenantId/knowledge-articles',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    knowledgeBaseController.list,
  );
  router.get(
    '/tenants/:tenantId/knowledge-articles/:id',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    knowledgeBaseController.show,
  );
  router.post(
    '/tenants/:tenantId/knowledge-articles',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    knowledgeBaseController.create,
  );
  router.put(
    '/tenants/:tenantId/knowledge-articles/:id',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    knowledgeBaseController.update,
  );
  router.delete(
    '/tenants/:tenantId/knowledge-articles/:id',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    knowledgeBaseController.remove,
  );
  router.post(
    '/tenants/:tenantId/knowledge-articles/embed',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    knowledgeBaseController.embedAll,
  );
  router.post(
    '/tenants/:tenantId/knowledge-articles/:id/embed',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    knowledgeBaseController.embed,
  );
  router.post(
    '/tenants/:tenantId/knowledge-articles/generate-from-tickets',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    knowledgeBaseController.generateFromTickets,
  );

  // Voice recording routes
  router.get(
    '/tenants/:tenantId/voice-recordings',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    voiceRecordingController.list,
  );
  router.get(
    '/tenants/:tenantId/voice-recordings/:id',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    voiceRecordingController.show,
  );
  router.post(
    '/tenants/:tenantId/voice-recordings/:id/retry',
    tenantOrUserAuth, requireRole('owner', 'admin'),
    voiceRecordingController.retry,
  );

  // Draft routes
  router.get(
    '/tenants/:tenantId/drafts',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    draftController.listByTenant,
  );
  router.post(
    '/tenants/:tenantId/tickets/:id/draft',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    draftController.generate,
  );
  router.get(
    '/tenants/:tenantId/tickets/:id/drafts',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    draftController.listByTicket,
  );
  router.patch(
    '/tenants/:tenantId/drafts/:id',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    draftController.updateStatus,
  );
  router.post(
    '/tenants/:tenantId/drafts/:id/send',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    draftController.send,
  );

  // Chat routes (KB test)
  router.post(
    '/tenants/:tenantId/chat',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    chatController.chat,
  );

  // Attachment routes
  router.get(
    '/tenants/:tenantId/attachments/:attachmentId',
    tenantOrUserAuth, requireRole('owner', 'admin', 'member'),
    attachmentController.serve,
  );

  // Webhook routes
  router.post('/webhooks/:tenantId/apps/:appId', webhookAuth, webhookController.receive);

  // Error handler
  router.use(errorHandler);

  return router;
}
