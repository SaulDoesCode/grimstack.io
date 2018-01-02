/* global importScripts toolbox Request */
importScripts('/js/sw-toolbox.js')

toolbox.precache([
  '/news/index.html',
  '/news/images/icons/icon-128x128.png',
  '/js/rilti.min.js',
  '/news/site.js',
  '/news/site.css',
  '/news/default.css'
])

toolbox.router.get('/*', toolbox.cacheFirst)
toolbox.router.get('https://newsapi.org/v2/*', toolbox.networkFirst, {
  cache: 'newsapi'
})

toolbox.router.get('/news/*', async (req, vals, opts) => {
  try {
    const res = await toolbox.networkFirst(req, vals, opts)
    return res
  } catch (err) {
    if (req.method === 'GET' && req.headers.get('accept').includes('text/html')) {
      return toolbox.cacheOnly(new Request('/news/index.html'), vals, opts)
    }
    console.error(err)
  }
})
