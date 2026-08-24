// nudes — server-rendered blog index at /the-nude.html
// (vercel.json rewrites it here; there is no static the-nude.html any more).
//
// Same reasoning as api/post.js: the card grid used to be built in the browser
// from /api/posts, so a crawler that doesn't run JS saw an empty <div> and never
// found a single article. This returns the real list as HTML, plus ItemList
// structured data so every post is discoverable from the source.

const { fetchAllPosts, renderIndex, STATIC_POSTS } = require('./_blog');

module.exports = async function handler(req, res) {
  let posts = [];
  try { posts = await fetchAllPosts(); } catch (e) { posts = []; }
  // If the sheet is unreachable, still ship the hand-built post rather than an
  // empty page — an empty index is worse for SEO than a stale one.
  if (!posts.length) posts = STATIC_POSTS;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.end(renderIndex(posts));
};
