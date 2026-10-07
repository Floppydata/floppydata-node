// Cloud Browser lifecycle:
// create a persistent session with a custom fingerprint, proxy and cookies
// -> drive it with Playwright -> live view -> stop
// -> start a second session reusing the saved state -> stop
// -> page through session history -> delete history and saved settings.
//
//   npm install playwright-core
//   FLOPPYDATA_API_KEY=... npx tsx examples/05-cloud-browser.ts

import { FloppyData } from '@floppydata/sdk';
import { chromium } from 'playwright-core';

const fd = new FloppyData({ baseUrl: process.env.FLOPPYDATA_BASE_URL });
const TASK_ID = 'sdk-example';

async function visit(connectUrl: string, url: string): Promise<string> {
  const browser = await chromium.connectOverCDP(connectUrl);
  try {
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url);
    return await page.title();
  } finally {
    // With keepAlive: true this only releases the relay; the session keeps running.
    await browser.close();
  }
}

// 1. First session: custom settings, kept for 1 hour after it ends.
const { data: first } = await fd.createBrowserSession({
  browser: {
    viewport: { width: 1440, height: 900 },
    fingerprint: {
      strategy: 'custom',
      os: 'windows',
      locale: 'en-US',
      timezone: 'auto', // follows the proxy location
      geolocation: { mode: 'auto' },
      hardware: { cpuCores: 8, memoryGb: 8 },
      masking: { canvas: 'noise', webgl: { mode: 'auto' }, webrtc: 'proxy' },
    },
  },
  proxy: {
    type: 'residential',
    location: { countryCode: 'US', city: 'New York' },
    rotation: { mode: 'sticky' },
  },
  storage: {
    cookies: {
      items: [{ name: 'consent', value: 'yes', domain: '.example.com', path: '/', secure: true }],
    },
  },
  runtime: { timeoutSeconds: 1800, keepAlive: true },
  persist: { ttlSeconds: 3600 },
  startUrl: 'https://example.com',
  metadata: { taskId: TASK_ID },
});
const settingsId = first.settings.id;
console.log(`Session ${first.id} ${first.status}, settings ${settingsId} (${first.settings.persistence})`);

try {
  // 2. Drive it with Playwright over CDP.
  if (!first.connectUrl) throw new Error('Session has no connectUrl');
  console.log(`Page title: ${await visit(first.connectUrl, 'https://example.com')}`);

  // 3. keepAlive: true, so we can reconnect with a freshly signed connectUrl.
  const { data: current } = await fd.getBrowserSession({ sessionId: first.id });
  if (current.connectUrl) {
    console.log(`Reconnected, title: ${await visit(current.connectUrl, 'https://example.org')}`);
  }

  // 4. Live view URL to watch the browser (close any CDP relay first).
  const { data: liveView } = await fd.createBrowserSessionLiveView({ sessionId: first.id });
  console.log(`Live view: ${liveView.liveViewUrl}`);
} finally {
  // 5. Stop (idempotent). Saved state is kept until endedAt + ttlSeconds.
  const { data: stopped } = await fd.stopBrowserSession({ sessionId: first.id });
  console.log(`Stopped; state kept until ${stopped.settings.retentionExpiresAt}`);
}

// 6. Second session reusing the saved fingerprint, proxy IP, cookies and storage.
//    browser/proxy/persist cannot be sent together with settings.id.
const { data: second } = await fd.createBrowserSession({
  settings: { id: settingsId },
  runtime: { timeoutSeconds: 600, keepAlive: false },
  metadata: { taskId: TASK_ID },
});
try {
  if (second.connectUrl) {
    console.log(`Title with restored state: ${await visit(second.connectUrl, 'https://example.com')}`);
  }
} finally {
  await fd.stopBrowserSession({ sessionId: second.id });
}

// 7. Page through stopped sessions with the opaque cursor; delete this example's history.
let cursor: string | undefined;
do {
  const { data: page } = await fd.listBrowserSessions({ status: 'stopped', limit: 20, cursor });
  for (const session of page.items) {
    if (session.metadata?.taskId === TASK_ID) {
      await fd.deleteBrowserSession({ sessionId: session.id });
      console.log(`Deleted history for ${session.id}`);
    }
  }
  cursor = page.nextCursor ?? undefined;
} while (cursor);

// 8. Permanently delete the saved browser state (fails with settings_in_use
//    while a session is running on it).
await fd.deleteBrowserSettings({ settingsId });
console.log(`Deleted settings ${settingsId}`);
