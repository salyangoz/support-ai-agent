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
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'audio/wave': '.wav',
      'audio/x-wav': '.wav',
      'audio/mp4': '.m4a',
      'audio/x-m4a': '.m4a',
      'audio/ogg': '.ogg',
      'audio/webm': '.webm',
    };
    return map[fileType] || '';
  }

  return '';
}

export function getAbsolutePath(relativePath: string): string {
  return path.isAbsolute(relativePath)
    ? relativePath
    : path.join(config.uploadsDir, relativePath);
}

export interface DownloadOptions {
  headers?: Record<string, string>;
  subdir?: string;
}

export async function downloadAndStore(
  tenantId: string,
  url: string,
  fileName: string,
  fileType?: string,
  options?: DownloadOptions,
): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60_000,
      maxRedirects: 5,
      headers: options?.headers,
    });

    const ext = getExtension(fileName, fileType);
    const storedName = `${generateId()}${ext}`;
    const subdir = options?.subdir || 'attachments';
    const dir = path.join(config.uploadsDir, subdir, tenantId);
    ensureDir(dir);

    const filePath = path.join(dir, storedName);
    fs.writeFileSync(filePath, response.data);

    return path.join(subdir, tenantId, storedName);
  } catch (err) {
    logger.error('Failed to download file', {
      url,
      fileName,
      error: (err as Error).message,
    });
    return null;
  }
}

export async function deleteLocalFile(relativePath: string): Promise<void> {
  try {
    const abs = getAbsolutePath(relativePath);
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  } catch (err) {
    logger.warn('Failed to delete local file', {
      path: relativePath,
      error: (err as Error).message,
    });
  }
}
