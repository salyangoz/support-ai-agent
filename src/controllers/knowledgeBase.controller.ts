import { Request, Response, NextFunction } from 'express';
import * as knowledgeBaseService from '../services/knowledgeBase.service';
import { toSnakeCase } from '../utils/serializer';
import { parsePaginationQuery } from '../utils/pagination';
import { getQueue, QUEUE_NAMES } from '../queues/queues';
import * as chunkRepo from '../repositories/knowledgeChunk.repository';
import * as ticketRepo from '../repositories/ticket.repository';

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const { category, search, is_active, page } = req.query;
    const pagination = parsePaginationQuery(req.query as Record<string, unknown>);

    const result = await knowledgeBaseService.getArticles(tenantId, {
      category: category as string | undefined,
      search: search as string | undefined,
      isActive: is_active !== undefined ? is_active === 'true' : undefined,
      cursor: pagination.cursor,
      limit: pagination.limit,
      page: !pagination.cursor && page ? Number(page) : undefined,
    });

    res.status(200).json(toSnakeCase(result));
  } catch (err) {
    next(err);
  }
}

export async function show(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const id = req.params.id as string;
    const article = await knowledgeBaseService.getArticleById(tenantId, id);

    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    res.status(200).json(toSnakeCase(article));
  } catch (err) {
    next(err);
  }
}

export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const { title, content, category, language } = req.body;

    if (!title || !content) {
      res.status(400).json({
        error: 'title and content are required',
      });
      return;
    }

    const article = await knowledgeBaseService.createArticle({
      tenantId,
      title,
      content,
      category,
      language,
    });

    res.status(201).json(toSnakeCase(article));
  } catch (err) {
    next(err);
  }
}

export async function update(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const id = req.params.id as string;
    const { title, content, category, language } = req.body;

    const article = await knowledgeBaseService.updateArticle(tenantId, id, {
      title,
      content,
      category,
      language,
    });

    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    res.status(200).json(toSnakeCase(article));
  } catch (err) {
    next(err);
  }
}

export async function embed(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const articleId = req.params.id as string;
    const settings = req.tenant?.settings;

    const result = await knowledgeBaseService.embedArticle(tenantId, articleId, {
      credentials: settings?.embedding_credentials || settings?.ai_credentials,
      service: settings?.embedding_service,
      model: settings?.embedding_model,
    });

    if (!result) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    res.status(200).json(toSnakeCase(result));
  } catch (err) {
    next(err);
  }
}

export async function embedAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const settings = req.tenant?.settings;
    const credentials = settings?.embedding_credentials || settings?.ai_credentials;

    const chunks = await chunkRepo.findChunksWithoutEmbedding(tenantId);
    const queue = getQueue(QUEUE_NAMES.EMBED_CHUNK);
    let enqueued = 0;

    for (const chunk of chunks) {
      await queue.add('embed-chunk', {
        chunkId: chunk.id,
        text: chunk.content,
        credentials,
        embeddingService: settings?.embedding_service,
        embeddingModel: settings?.embedding_model,
      }, {
        jobId: `embed-chunk-${chunk.id}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      enqueued++;
    }

    res.status(202).json(toSnakeCase({ enqueued, message: `${enqueued} embedding jobs queued` }));
  } catch (err) {
    next(err);
  }
}

export async function remove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const id = req.params.id as string;

    const article = await knowledgeBaseService.softDeleteArticle(
      tenantId,
      id,
    );

    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function generateFromTickets(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const ticketIds = await ticketRepo.findClosedTicketsWithoutKbArticle(tenantId);
    const queue = getQueue(QUEUE_NAMES.GENERATE_KB_FROM_TICKET);
    let enqueued = 0;

    for (const { id } of ticketIds) {
      await queue.add('generate-kb-from-ticket', {
        tenantId,
        ticketId: id,
      }, {
        jobId: `gen-kb-${id}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      enqueued++;
    }

    res.status(202).json(toSnakeCase({ enqueued, message: `${enqueued} KB generation jobs queued` }));
  } catch (err) {
    next(err);
  }
}
