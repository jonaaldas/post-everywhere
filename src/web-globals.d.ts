/**
 * Vercel's Hono builder uses a minimal type environment that lacks
 * standard web API types (Request, Response, Headers, FormData, etc.).
 * These declarations ensure compatibility with both Node.js and Vercel builds.
 *
 * Node.js @types/node already provides these via undici, so when
 * @types/node is present these merge harmlessly.
 */

export {};

declare global {
  interface Request {
    readonly headers: Headers;
    readonly body: ReadableStream<Uint8Array> | null;
    readonly method: string;
    readonly url: string;
    json(): Promise<unknown>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    formData(): Promise<FormData>;
    clone(): Request;
  }

  interface Response {
    readonly ok: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly headers: Headers;
    readonly body: ReadableStream<Uint8Array> | null;
    json(): Promise<unknown>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    formData(): Promise<FormData>;
    clone(): Response;
  }

  interface Headers {
    get(name: string): string | null;
    set(name: string, value: string): void;
    has(name: string): boolean;
    delete(name: string): void;
    forEach(callback: (value: string, key: string) => void): void;
    append(name: string, value: string): void;
    entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
  }

  interface FormData {
    get(name: string): FormDataEntryValue | null;
    getAll(name: string): FormDataEntryValue[];
    has(name: string): boolean;
    set(name: string, value: string | Blob, filename?: string): void;
    append(name: string, value: string | Blob, filename?: string): void;
    delete(name: string): void;
    forEach(callback: (value: FormDataEntryValue, key: string) => void): void;
    entries(): IterableIterator<[string, FormDataEntryValue]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<FormDataEntryValue>;
  }

  type FormDataEntryValue = File | string;

  interface File extends Blob {
    readonly name: string;
    readonly lastModified: number;
    readonly type: string;
  }

  interface Blob {
    readonly size: number;
    readonly type: string;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    slice(start?: number, end?: number, contentType?: string): Blob;
    stream(): ReadableStream<Uint8Array>;
  }

  interface RequestInit {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit | null;
    signal?: AbortSignal | null;
    redirect?: string;
    cache?: string;
    credentials?: string;
    mode?: string;
    referrer?: string;
    referrerPolicy?: string;
    integrity?: string;
    keepalive?: boolean;
  }

  interface ResponseInit {
    status?: number;
    statusText?: string;
    headers?: HeadersInit;
  }

  type HeadersInit = Headers | Record<string, string> | [string, string][];
  type BodyInit = ReadableStream<Uint8Array> | Blob | BufferSource | FormData | URLSearchParams | string;
  type BufferSource = ArrayBufferView | ArrayBuffer;

  interface URLSearchParams {
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    getAll(name: string): string[];
    has(name: string): boolean;
    set(name: string, value: string): void;
    toString(): string;
    forEach(callback: (value: string, key: string) => void): void;
    entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
    readonly size: number;
  }
}
