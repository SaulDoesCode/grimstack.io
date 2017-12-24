{
  /* global rilti fetch localStorage */
  const {dom, each, run} = rilti
  const {a, header, h1, h3, p, span, div, footer, time, option, main, img} = dom

  const apiKey = '918a79d4d5f24a89ac236d656c9a44f6'
  const defaultSource = localStorage.getItem('news-source') || 'ars-technica'
  let mainColor = localStorage.getItem('main-color') || '#e24650'

  const setColor = (color = mainColor) => run(() => {
    document.body.style.setProperty('--main-color', color)
    if (color !== mainColor) {
      localStorage.setItem('main-color', mainColor = color)
    }
  })

  const sitehead = header({
    render: 'body',
    id: 'site-header'
  },
    h1('Rilti News - Progressive Web App')
  )

  const settings = span({render: sitehead})

  dom.input({
    render: settings,
    id: 'color-selector',
    attr: {
      type: 'color',
      value: mainColor
    },
    cycle: { mount () { setColor() } },
    on: {
      change (e, el) {
        setColor(el.value)
      }
    }
  })

  const sitecontent = main({
    render: 'body',
    id: 'site-content'
  })

  footer({
    renderAfter: sitecontent,
    id: 'site-footer'
  },
    span(
      'We have ',
      a({href: 'https://newsapi.org'}, 'newsapi.org'),
      ' to thank for all these marvelous news articles'
    ),
    div({
      class: 'small-links'
    },
      span(
       'This site is built with ',
        a({ href: `https://github.com/SaulDoesCode/rilti.js` }, ` rilti.js `)
      )
    )
  )

  const checkOK = status => {
    if (status !== 'ok') throw new Error(`request status is not ok, something wrong`)
  }

  const getSources = async () => {
    try {
      const res = await fetch(`https://newsapi.org/v2/sources?language=en&apiKey=${apiKey}`)
      const {sources, status} = await res.json()
      checkOK(status)
      const dropDown = dom.select({
        id: 'source-selector',
        on: {
          change ({target: {value}}) {
            getNews(value)
            localStorage.setItem('news-source', value)
          }
        }
      })

      each(sources, ({id, name, description}) => {
        const opt = option({
          render: dropDown,
          attr: {
            value: id,
            title: description
          }
        },
          name
        )
        if (id === defaultSource) opt.setAttribute('selected', true)
      })

      settings.append(dropDown)
    } catch (err) {
      console.error('Couldn\'t fetch news sources: ', err)
    }
  }

  const renderArticle = ({title, author, description, url, urlToImage, publishedAt}) => dom.article({
    class: 'news-article',
    render: sitecontent,
    on: {
      click () { window.open(url) }
    }
  },
    header(
      h3(title),
      author ? span(`By `, author) : '',
      time(` on `, new Date(publishedAt).toLocaleDateString())
    ),
    !urlToImage ? '' : img({
      props: { src: urlToImage },
      css: { width: '100%', height: 'auto' }
    }),
    p(description)
  )

  const getNews = async (source = defaultSource) => {
    try {
      const res = await fetch(`https://newsapi.org/v2/top-headlines?sources=${source}&apiKey=${apiKey}`)
      const {status, articles} = await res.json()
      checkOK(status)
      sitecontent.innerHTML = ''
      each(articles, renderArticle)
    } catch (err) {
      console.error(`Ran into trouble fetching news from ${source}: `, err)
    }
  }

  getNews()
  getSources()
}
