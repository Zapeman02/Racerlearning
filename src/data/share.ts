import type { ModelRecord } from './models.ts';
import { parseModel, serializeModel } from './transfer.ts';

/** URL hash key that carries a shared model, e.g. `#m=<code>`. */
export const SHARE_PARAM = 'm';

/**
 * Turns a model into a short, URL-safe share code.
 * The code is the exact export file (compact JSON), deflated and base64url-encoded,
 * so decoding it gives the same model as importing an exported file.
 */
export async function encodeShareCode(model: ModelRecord): Promise<string> {
  const json = JSON.stringify(JSON.parse(serializeModel(model)));
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate'));
  return toBase64Url(packed);
}

/** Accepts a bare share code or a full share link and returns the model it carries. */
export async function decodeShareCode(input: string): Promise<ModelRecord> {
  const code = extractCode(input);
  if (!code) throw new Error('No share code found');
  let json: string;
  try {
    json = new TextDecoder().decode(await pipe(fromBase64Url(code), new DecompressionStream('deflate')));
  } catch {
    throw new Error('Share code is broken or incomplete');
  }
  return parseModel(json);
}

export function shareLink(code: string, base: string): string {
  return `${base.split('#')[0]}#${SHARE_PARAM}=${code}`;
}

/** Pulls the code out of a link (`...#m=code`) or returns the trimmed input when it already is a code. */
export function extractCode(input: string): string | null {
  const text = input.trim();
  const match = text.match(new RegExp(`[#&?]${SHARE_PARAM}=([A-Za-z0-9_-]+)`));
  if (match) return match[1];
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : null;
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): Uint8Array<ArrayBuffer> {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
