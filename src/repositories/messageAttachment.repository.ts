import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';

export async function upsertAttachments(
  messageId: string,
  tenantId: string,
  attachments: Array<{
    externalId?: string;
    fileName: string;
    fileType?: string;
    fileSize?: number;
    url: string;
    localPath?: string;
    contentText?: string;
  }>,
) {
  for (const attachment of attachments) {
    const existing = attachment.externalId
      ? await getPrisma().messageAttachment.findFirst({
          where: { messageId, externalId: attachment.externalId },
        })
      : null;

    if (existing) {
      await getPrisma().messageAttachment.update({
        where: { id: existing.id },
        data: {
          fileName: attachment.fileName,
          fileType: attachment.fileType ?? existing.fileType,
          fileSize: attachment.fileSize ?? existing.fileSize,
          url: attachment.url,
          localPath: attachment.localPath ?? existing.localPath,
          contentText: attachment.contentText ?? existing.contentText,
        },
      });
    } else {
      await getPrisma().messageAttachment.create({
        data: {
          id: generateId(),
          messageId,
          tenantId,
          externalId: attachment.externalId ?? null,
          fileName: attachment.fileName,
          fileType: attachment.fileType ?? null,
          fileSize: attachment.fileSize ?? null,
          url: attachment.url,
          localPath: attachment.localPath ?? null,
          contentText: attachment.contentText ?? null,
        },
      });
    }
  }
}

export async function findAttachmentById(id: string, tenantId: string) {
  return getPrisma().messageAttachment.findFirst({
    where: { id, tenantId },
  });
}

export async function findAttachmentsByMessageId(messageId: string) {
  return getPrisma().messageAttachment.findMany({
    where: { messageId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function findTextAttachmentsByTicketId(ticketId: string, tenantId: string) {
  return getPrisma().messageAttachment.findMany({
    where: {
      tenantId,
      contentText: { not: null },
      message: { ticketId },
    },
    select: {
      fileName: true,
      fileType: true,
      contentText: true,
    },
  });
}
