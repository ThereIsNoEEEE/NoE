import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getImageFromSource } from '../crawler.mjs';

const STORAGE_ROOT = fileURLToPath(new URL('../../storage/', import.meta.url));
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export function imageCandidates(payload) {
  return (payload?.notice?.images || []).flatMap(value => {
    const image = typeof value === 'string' ? { url: value } : value;
    if (!image || image.availability === 'unavailable') return [];
    if (image.localPath && payload.assetDirectory) return [{ localPath: image.localPath, assetDirectory: payload.assetDirectory }];
    try {
      const url = new URL(image.url.replace(/&amp;/g, '&'));
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || !/(^|\.)kookmin\.ac\.kr$/.test(url.hostname)) return [];
      if (/\/_res\/|\/images\/(?:common|mbl)\/|(?:logo|emblem|g-translate)/i.test(url.pathname)) return [];
      url.protocol = 'https:';
      return [{ src: url.href }];
    } catch { return []; }
  });
}

function contentType(bytes) {
  const hex = bytes.subarray(0, 12).toString('hex');
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (bytes.subarray(0, 3).toString() === 'GIF') return 'image/gif';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  throw new Error('지원하지 않는 이미지 형식');
}

export async function readNoticeImage(payload, { storageRoot = STORAGE_ROOT, remoteLoader = getImageFromSource } = {}) {
  // Try at most three stored references; never accept arbitrary client URLs.
  for (const candidate of imageCandidates(payload).slice(0, 3)) {
    try {
      if (candidate.src) return await remoteLoader(candidate.src);
      const root = await realpath(storageRoot);
      const file = await realpath(resolve(root, candidate.assetDirectory, candidate.localPath));
      const rel = relative(root, file);
      if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) continue;
      const info = await stat(file);
      if (!info.isFile() || info.size > MAX_IMAGE_BYTES) continue;
      const bytes = await readFile(file);
      return { bytes, contentType: contentType(bytes) };
    } catch { /* Missing/broken posters fall through to the next reference. */ }
  }
  return null;
}
