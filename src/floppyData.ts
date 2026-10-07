import { FloppyDataError } from './errors.js';
import { createClient } from './gen/client/index.js';
import { FloppyDataApi } from './gen/sdk.gen.js';

export const DEFAULT_BASE_URL = 'https://api.floppydata.net';

export interface FloppyDataOptions {
  /** Client API key. Defaults to the `FLOPPYDATA_API_KEY` environment variable. */
  apiKey?: string;
  /** Defaults to the production API, {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** Custom `fetch`, e.g. to add a proxy agent or for tests. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

/**
 * Floppydata Client API v2.
 *
 * ```ts
 * const fd = new FloppyData({ apiKey: process.env.FLOPPYDATA_API_KEY });
 * const { data } = await fd.getAccountBalances();
 * ```
 *
 * Every method throws {@link FloppyDataError} on a non-2xx response. Pass
 * `{ throwOnError: false }` as the second argument to get `{ data, error }`
 * instead.
 */
export class FloppyData extends FloppyDataApi {
  constructor(options: FloppyDataOptions = {}) {
    const apiKey = options.apiKey ?? readEnv('FLOPPYDATA_API_KEY');
    if (!apiKey) {
      throw new Error(
        'Missing Floppydata API key. Pass { apiKey } or set FLOPPYDATA_API_KEY. Create a key at https://app.floppydata.com/api-keys',
      );
    }

    const client = createClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      auth: apiKey,
      throwOnError: true,
      fetch: options.fetch,
    });
    client.interceptors.error.use((error, response, _request, requestOptions) =>
      // Only HTTP errors are wrapped. With throwOnError: false the caller gets
      // the parsed body, which is what the generated `error` types describe.
      response && requestOptions.throwOnError !== false
        ? new FloppyDataError(response.status, error)
        : error,
    );

    super({ client });
  }
}

function readEnv(name: string): string | undefined {
  // `process` does not exist in browsers and some edge runtimes.
  return typeof process === 'undefined' ? undefined : process.env[name];
}
