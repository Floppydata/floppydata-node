// Rotating proxy, end to end:
// balance -> create a subuser -> pick a location -> build a connection
// -> verify it with the proxy checker -> usage and request history
// -> delete the subuser.
//
//   FLOPPYDATA_API_KEY=... npx tsx examples/02-rotating-proxy.ts

import { FloppyData } from '@floppydata/sdk';

const fd = new FloppyData({ baseUrl: process.env.FLOPPYDATA_BASE_URL });

const PROXY_TYPE = 'residential';
const COUNTRY = 'US';

// 1. Traffic balance: expiring + non-expiring = total.
const { data: balance } = await fd.getRotatingProxyBalance();
console.log(
  `Rotating traffic: ${balance.total.traffic.availableGb} GB ` +
    `(${balance.expiring.traffic.availableGb} GB expiring at ${balance.expiring.expiresAt})`,
);

// 2. Existing subusers (a default one is created if the account has none).
const { data: subusers } = await fd.listRotatingProxySubusers();
console.log(`Existing subusers: ${subusers.items.map((s) => s.id).join(', ')}`);

// 3. A dedicated subuser keeps this workload's traffic separate in usage reports.
const { data: created } = await fd.createRotatingProxySubuser({ name: `sdk-example-${Date.now()}` });
const subuser = created.subuser;
console.log(`Created subuser ${subuser.id} (${subuser.username})`);

try {
  // 4. Pick a location. Cities and states are country-level lists.
  const { data: locations } = await fd.listRotatingProxyLocations({ type: PROXY_TYPE });
  const country = locations.items.find((l) => l.countryCode === COUNTRY);
  if (!country) throw new Error(`${COUNTRY} is not available for ${PROXY_TYPE} proxies`);
  const city = country.cities[0];
  console.log(`${country.name}: ${country.cities.length} cities; using ${city}`);

  // 5. Build a sticky (15 min) SOCKS5 connection for the new subuser.
  const { data: built } = await fd.buildRotatingProxyConnection({
    subuserId: subuser.id,
    type: PROXY_TYPE,
    country: COUNTRY,
    city,
    rotation: 15,
    session: 'sdk_example_1',
    protocol: 'socks5',
  });
  const { connection } = built;
  console.log(`Connection: ${connection.protocol}://${connection.host}:${connection.port}`);

  // 6. Verify the exit IP. The checker takes a connection string or separate fields.
  const { data: check } = await fd.checkProxy({
    body: { connectionString: connection.connectionString },
  });
  console.log(`Exit IP ${check.ip} in ${check.location.city}, ${check.location.country}`);

  const { data: again } = await fd.checkProxy({
    body: {
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      protocol: connection.protocol,
    },
  });
  console.log(`Same sticky session, same IP: ${again.ip === check.ip}`);

  // 7. Usage for this subuser only. txBytes/rxBytes are null when filtered
  //    by subuser; totalBytes is accurate.
  const { data: usage } = await fd.getRotatingProxyUsage({ subuserId: subuser.id });
  console.log(`Subuser traffic last 7 days: ${usage.traffic.last7Days.totalGb} GB`);

  // 8. Per-request history for the last 24h, paginated. Keep from/to fixed across pages.
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const limit = 500;
  const bytesByHost = new Map<string, number>();
  for (let offset = 0; ; offset += limit) {
    const { data: page } = await fd.listRotatingProxyRequests({
      from: from.toISOString(),
      to: to.toISOString(),
      limit,
      offset,
    });
    for (const event of page.events) {
      bytesByHost.set(event.host, (bytesByHost.get(event.host) ?? 0) + event.trafficIn + event.trafficOut);
    }
    if (page.events.length < limit) break;
  }
  console.log('Top hosts by traffic in the last 24h:');
  for (const [host, bytes] of [...bytesByHost].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`  ${host}: ${bytes} B`);
  }
} finally {
  // 9. Clean up. The last remaining subuser cannot be deleted.
  await fd.deleteRotatingProxySubuser({ subuserId: subuser.id });
  console.log(`Deleted subuser ${subuser.id}`);
}
