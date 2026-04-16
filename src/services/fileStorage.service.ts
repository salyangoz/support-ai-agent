import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { config } from '../config';
import { generateId } from '../utils/uuid';
import { logger } from '../utils/logger';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getExtension(fileName: string, fileType?: string): string {
  const ext = path.extname(fileName);
  if (ext) return ext;

  if (fileType) {
    const map: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
    };
    return map[fileType] || '';
  }

  return '';
}

export async function downloadAndStore(
  tenantId: string,
  url: string,
  fileName: string,
  fileType?: string,
): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxRedirects: 5,
    });

    const ext = getExtension(fileName, fileType);
    const storedName = `${generateId()}${ext}`;
    const dir = path.join(config.uploadsDir, 'attachments', tenantId);
    ensureDir(dir);

    const filePath = path.join(dir, storedName);
    fs.writeFileSync(filePath, response.data);

    // Return relative path for DB storage
    return path.join('attachments', tenantId, storedName);
  } catch (err) {
    logger.error('Failed to download attachment', {
      url,
      fileName,
      error: (err as Error).message,
    });
    return null;
  }
}
