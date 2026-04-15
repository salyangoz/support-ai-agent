import { Request, Response, NextFunction } from 'express';
import * as chatService from '../services/chat.service';
import { toSnakeCase } from '../utils/serializer';

export async function chat(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenant = req.tenant!;
    const { question, history } = req.body;

    if (!question) {
      res.status(400).json({ error: 'question is required' });
      return;
    }

    const result = await chatService.chat(tenant, question, history);

    res.status(200).json(toSnakeCase(result));
  } catch (err) {
    next(err);
  }
}
