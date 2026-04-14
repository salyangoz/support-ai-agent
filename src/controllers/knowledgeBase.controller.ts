import { Request, Response, NextFunction } from 'express';
import * as knowledgeBaseService from '../services/knowledgeBase.service';
import { toSnakeCase } from '../utils/serializer';

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const { category, search, is_active, page, limit } = req.query;

    const articles = await knowledgeBaseService.getArticles(tenantId, {
      category: category as string | undefined,
      search: search as string | undefined,
      isActive: is_active !== undefined ? is_active === 'true' : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json({ data: toSnakeCase(articles) });
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
