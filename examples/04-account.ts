// Account rollups: balances and usage across products in one call each.
//
//   FLOPPYDATA_API_KEY=... npx tsx examples/04-account.ts

import { FloppyData } from '@floppydata/sdk';

const fd = new FloppyData({ baseUrl: process.env.FLOPPYDATA_BASE_URL });

// All products. A proxy product the account does not have comes back as null.
const { data: balances } = await fd.getAccountBalances();
const rotating = balances.proxy?.rotating;
const staticIps = balances.proxy?.static;
console.log('Balances:');
console.log(`  Web Data:       ${balances.webData?.requests.remaining ?? 0} requests left`);
console.log(`  Rotating proxy: ${rotating ? `${rotating.total.traffic.availableGb} GB` : 'not configured'}`);
console.log(`  Static proxy:   ${staticIps ? `${staticIps.activeIpCount} active IPs` : 'not configured'}`);

// One product only.
const { data: webDataOnly } = await fd.getAccountBalances({ product: 'web-data' });
console.log(`Web Data only: ${JSON.stringify(webDataOnly)}`);

// Usage across Web Data and rotating proxies for a date range.
const { data: usage } = await fd.getAccountUsage({ from: '2026-09-01', to: '2026-09-30' });
console.log(`Usage ${usage.filters.from}..${usage.filters.to}:`);
console.log(`  Web Data requests: ${usage.webData?.requests.requestedRange?.total ?? 0}`);
console.log(`  Rotating proxy:    ${usage.proxy?.rotating?.traffic.requestedRange?.totalGb ?? 0} GB`);

// Rotating proxy usage filtered by proxy type.
const { data: mobile } = await fd.getAccountUsage({ product: 'proxy-rotating', proxyType: 'mobile' });
console.log(`  Mobile, last 30 days: ${mobile.proxy?.rotating?.traffic.last30Days.totalGb ?? 0} GB`);
