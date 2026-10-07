import { afterEach, describe, expect, it, vi } from 'vitest';
import { FloppyData, FloppyDataError } from '../src/index.js';

const requests: Request[] = [];

function mockFetch(response: () => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return response();
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const apiError = {
  error: {
    code: 'insufficient_balance',
    message: 'Insufficient Web Data balance.',
    details: { requestId: 'abc-CDG' },
  },
};

afterEach(() => {
  requests.length = 0;
  vi.unstubAllEnvs();
});

describe('FloppyData', () => {
  it('sends the API key to the production API by default', async () => {
    const fd = new FloppyData({
      apiKey: 'test-key',
      fetch: mockFetch(() => json({ requests: { total: 10, used: 1, remaining: 9 } })),
    });

    const { data } = await fd.getWebDataBalance();

    expect(data.requests.remaining).toBe(9);
    expect(requests[0].url).toBe('https://api.floppydata.net/v2/web-data/balance');
    expect(requests[0].headers.get('X-Api-Key')).toBe('test-key');
  });

  it('reads FLOPPYDATA_API_KEY and honours baseUrl', async () => {
    vi.stubEnv('FLOPPYDATA_API_KEY', 'env-key');
    const fd = new FloppyData({
      baseUrl: 'https://api.example.test',
      fetch: mockFetch(() => json({ items: [], pendingCount: 0 })),
    });

    await fd.listStaticProxies();

    expect(requests[0].url).toBe('https://api.example.test/v2/proxy/static');
    expect(requests[0].headers.get('X-Api-Key')).toBe('env-key');
  });

  it('refuses to start without an API key', () => {
    vi.stubEnv('FLOPPYDATA_API_KEY', '');
    expect(() => new FloppyData()).toThrow(/FLOPPYDATA_API_KEY/);
  });

  it('sends flat parameters as JSON body, query, and path', async () => {
    const fd = new FloppyData({
      apiKey: 'test-key',
      fetch: mockFetch(() => new Response(null, { status: 204 })),
    });

    await fd.fetchWebData({ url: 'https://example.com', difficulty: 'auto' });
    await fd.getRotatingProxyUsage({ subuserId: 7, proxyType: 'mobile' });
    await fd.deleteRotatingProxySubuser({ subuserId: 7 });

    expect(requests[0].method).toBe('POST');
    expect(requests[0].headers.get('Content-Type')).toBe('application/json');
    expect(await requests[0].json()).toEqual({ url: 'https://example.com', difficulty: 'auto' });
    expect(requests[1].url).toBe(
      'https://api.floppydata.net/v2/proxy/rotating/usage?subuserId=7&proxyType=mobile',
    );
    expect(requests[2].method).toBe('DELETE');
    expect(requests[2].url).toBe('https://api.floppydata.net/v2/proxy/rotating/subusers/7');
  });

  it('omits Content-Type when an all-optional body is omitted', async () => {
    // The API reads a request with no body and no Content-Type as `{}`, but
    // rejects `Content-Type: application/json` with an empty body.
    const fd = new FloppyData({
      apiKey: 'test-key',
      fetch: mockFetch(() => json({}, 201)),
    });

    await fd.createBrowserSession();

    expect(requests[0].headers.get('Content-Type')).toBeNull();
    expect(await requests[0].text()).toBe('');
  });

  it('throws FloppyDataError with the API error code and details', async () => {
    const fd = new FloppyData({ apiKey: 'test-key', fetch: mockFetch(() => json(apiError, 402)) });

    const error = await fd.fetchWebData({ url: 'https://example.com' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FloppyDataError);
    expect(error).toMatchObject({
      name: 'FloppyDataError',
      status: 402,
      code: 'insufficient_balance',
      message: 'insufficient_balance: Insufficient Web Data balance.',
      details: { requestId: 'abc-CDG' },
      body: apiError,
    });
  });

  it('reports non-JSON error responses as unknown_error', async () => {
    const fd = new FloppyData({
      apiKey: 'test-key',
      fetch: mockFetch(() => new Response('<html>Bad gateway</html>', { status: 502 })),
    });

    const error = await fd.getAccountBalances().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FloppyDataError);
    expect(error).toMatchObject({ status: 502, code: 'unknown_error', body: '<html>Bad gateway</html>' });
  });

  it('returns the parsed error body when throwOnError is false', async () => {
    const fd = new FloppyData({ apiKey: 'test-key', fetch: mockFetch(() => json(apiError, 402)) });

    const result = await fd.fetchWebData({ url: 'https://example.com' }, { throwOnError: false });

    expect(result.data).toBeUndefined();
    expect(result.error).toEqual(apiError);
    expect(result.response?.status).toBe(402);
  });

  it('passes network failures through unchanged', async () => {
    const failure = new TypeError('fetch failed');
    const fd = new FloppyData({
      apiKey: 'test-key',
      fetch: mockFetch(() => Promise.reject(failure)),
    });

    await expect(fd.getAccountBalances()).rejects.toBe(failure);
  });
});
