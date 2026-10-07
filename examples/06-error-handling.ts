// Error handling: FloppyDataError codes, recovery from settings_in_use,
// and the non-throwing { data, error } style.
//
//   FLOPPYDATA_API_KEY=... npx tsx examples/06-error-handling.ts [settingsId]

import { FloppyData, FloppyDataError } from '@floppydata/sdk';

const fd = new FloppyData({ baseUrl: process.env.FLOPPYDATA_BASE_URL });

// Every method throws FloppyDataError on a non-2xx response.
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const { data } = await fd.fetchWebData({ url, difficulty: 'auto' });
    return data.html;
  } catch (error) {
    if (!(error instanceof FloppyDataError)) throw error; // network failure, bug, ...
    switch (error.code) {
      case 'insufficient_balance':
        console.error('Out of Web Data requests; top up and retry.');
        return null;
      case 'invalid_request':
        // details.target points at the offending field.
        console.error(`Invalid ${error.details.target}: ${error.message}`);
        return null;
      case 'upstream_error':
        console.error(`Upstream HTTP ${error.details.upstreamStatus}, request ${error.details.requestId}`);
        return null;
      default:
        throw error;
    }
  }
}

// settings_in_use names the session holding the settings, so stop it and retry.
async function startWithSettings(settingsId: string) {
  try {
    return (await fd.createBrowserSession({ settings: { id: settingsId } })).data;
  } catch (error) {
    const activeSessionId = error instanceof FloppyDataError ? error.details.activeSessionId : undefined;
    if (!(error instanceof FloppyDataError) || error.code !== 'settings_in_use' || !activeSessionId) {
      throw error;
    }
    console.log(`Settings busy in ${activeSessionId}; stopping it and retrying`);
    await fd.stopBrowserSession({ sessionId: activeSessionId });
    return (await fd.createBrowserSession({ settings: { id: settingsId } })).data;
  }
}

const html = await fetchHtml('https://example.com');
console.log(html ? `Fetched ${html.length} bytes` : 'Fetch failed');

// Non-throwing style: pass { throwOnError: false } and branch on `error`,
// which is the parsed API error body.
const result = await fd.getWebDataBalance({ throwOnError: false });
if (result.error) {
  console.error(`HTTP ${result.response?.status}: ${result.error.error.code}`);
} else {
  console.log(`Remaining: ${result.data.requests.remaining}`);
}

const settingsId = process.argv[2];
if (settingsId) {
  const session = await startWithSettings(settingsId);
  console.log(`Started ${session.id}`);
  await fd.stopBrowserSession({ sessionId: session.id });
}
