import type { IPasswordHasher } from '@application/ports/IPasswordHasher';

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class WebCryptoHasher implements IPasswordHasher {
  async hash(password: string): Promise<string> {
    return sha256hex(password);
  }

  async verify(password: string, hashed: string): Promise<boolean> {
    return (await sha256hex(password)) === hashed;
  }
}
