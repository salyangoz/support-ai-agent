import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import * as attachmentRepo from '../repositories/messageAttachment.repository';

export async function serve(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const attachmentId = req.params.attachmentId as string;

    const attachment = await attachmentRepo.findAttachmentById(attachmentId, tenantId);

    if (!attachment || !attachment.localPath) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const filePath = path.resolve(config.uploadsDir, attachment.localPath);

    if (attachment.fileType) {
      res.setHeader('Content-Type', attachment.fileType);
    }
    res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);

    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ error: 'File not found on disk' });
      }
    });
  } catch (err) {
    next(err);
  }
}
