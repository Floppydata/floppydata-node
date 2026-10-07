// Static proxies: list owned IPs -> health-check each one in parallel.
//
//   FLOPPYDATA_API_KEY=... npx tsx examples/03-static-proxy.ts

import { FloppyData, FloppyDataError } from '@floppydata/sdk';

const fd = new FloppyData({ baseUrl: process.env.FLOPPYDATA_BASE_URL });

const { data: inventory } = await fd.listStaticProxies();
console.log(`${inventory.items.length} active static IPs, ${inventory.pendingCount} pending`);

const results = await Promise.allSettled(
  inventory.items.map((proxy) =>
    fd.checkProxy({ body: { connectionString: proxy.connection.connectionString } }),
  ),
);

results.forEach((result, i) => {
  const proxy = inventory.items[i];
  const label = `${proxy.ip} [${proxy.proxyType}, ${proxy.countryCode}]`;
  if (result.status === 'rejected') {
    const reason = result.reason instanceof FloppyDataError ? result.reason.code : String(result.reason);
    console.log(`FAIL ${label}: ${reason}`);
  } else if (result.value.data.ip !== proxy.ip) {
    console.log(`WARN ${label}: exits via ${result.value.data.ip}`);
  } else {
    console.log(`OK   ${label}: ${result.value.data.location.city}`);
  }
});
