const dns = require('dns').promises;

async function lookupDns() {
  const domain = 'handsbreadth.com';

  const txt = await dns.resolveTxt(domain);
  console.log('TXT:', txt.map(r => r.join(' ')));

  const mx = await dns.resolveMx(domain);
  console.log('MX:', mx);

  const a = await dns.resolve4(domain);
  console.log('A:', a);
}

lookupDns();
