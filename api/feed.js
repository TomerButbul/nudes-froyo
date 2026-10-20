// nudes — Instagram feed proxy (Vercel Serverless Function)
// Behold's free plan caps how many times a month its feed URL can be fetched, and
// every homepage visit used to fetch it straight from the browser. Now the browser
// asks us, and Vercel's edge serves one cached copy to everyone, so Behold only
// hears from us a few times a day per region.
// On a Behold error we hand back the last good copy this instance has seen and tell
// the edge not to cache the failure, so a bad fetch never sticks for six hours.
// Returns Behold's JSON as-is ({ posts: [...] }).

const FEED_ID = 'pQ5AuOeYfqpM0us18ZhW';
let lastGood = null;

module.exports = async function handler(req, res) {
  try {
    const r = await fetch('https://feeds.behold.so/' + FEED_ID);
    if (!r.ok) throw new Error('behold ' + r.status);
    const data = await r.json();
    if (!data || !Array.isArray(data.posts)) throw new Error('behold: no posts');
    lastGood = data;
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
    return res.status(200).json(data);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    if (lastGood) return res.status(200).json(lastGood);
    return res.status(502).json({ posts: [] });
  }
};
