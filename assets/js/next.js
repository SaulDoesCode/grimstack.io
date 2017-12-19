{
  /* global rilti localStorage fetch */
  const {
    domfn: {append, hasClass, Class, css},
    dom,
    each,
    model,
    once,
    isRenderable,
    isBool,
    run
  } = rilti
  const {article, aside, div, span, html, header, h2, time} = dom

  var hub = model()

  const fancyHeader = (txt, options = {}) => (
    header({class: 'fancyHeader', ...options}, txt)
  )

  const sidebar = aside({
    render: 'body',
    class: 'sidebar',
    props: {
      get rect () { return sidebar.getBoundingClientRect() },
      get toggled () { return hasClass(sidebar, 'toggled') },
      set toggled (state) {
        css(sidebar, {left: state ? `-${sidebar.rect.width - 5}px` : ''})
        Class(sidebar, 'toggled', state)
        hub.emit.sbToggle(state)
      },
      items: new Map(),
      get activeItem () { return sidebar.activeitem },
      set activeItem (ai) {
        if (sidebar.activeitem !== ai && sidebar.items.has(ai)) {
          sidebar.items.forEach((item, name) => {
            const isActive = name === ai
            Class(item, 'active', isActive)
            if (isActive) {
              sidebar.activeitem = name
              hub.emit.sbItem(name, item)
              if (item.action) item.action(item)
            }
          })
        }
      }
    },
    methods: {
      scaleContentElement (el) {
        if (window.innerWidth < 760) {
          return css(el, {
            marginLeft: '',
            width: ''
          })
        }
        const {rect: {width}, toggled} = sidebar
        css(el, {
          marginLeft: toggled ? '4px' : `${width}px`,
          width: toggled ? 'calc(100% - 6px)' : `calc(100% - ${width + 2}px)`
        })
      },
      item (inner, action) {
        sidebar.items.set(
          inner,
          div({
            render: sidebar,
            class: 'flexCentered sbItem',
            methods: {action},
            on: { click () { sidebar.activeItem = inner } }
          },
            inner
          )
        )

        run(() => {
          if (!sidebar.activeItem) sidebar.activeItem = inner
        })
      }
    }
  },
    div({
      class: 'sbToggle',
      on: { click () { sidebar.toggled = !sidebar.toggled } }
    }),
    fancyHeader('grimstack')
  )

  hub.views = new Map()
  const main = dom.main({
    render: 'body',
    class: 'contentGrid',
    methods: {
      scale () { sidebar.scaleContentElement(main) },
      view (name, show, view) {
        if (!isBool(show)) [view, show] = [show, false]
        const viewExists = hub.views.has(name)
        if (!isRenderable(view)) {
          if (!viewExists) return
          hub.lastView = hub.activeView
          hub.activeView = name
          view = hub.views.get(name)
        }
        if (!viewExists) hub.views.set(name, view)
        if (show) {
          main.innerHTML = ''
          return main.append(view)
        }
      }
    },
    cycle: {
      mount () {
        main.scale()
        const resizer = once.resize(window, () => {
          setTimeout(resizer.once, 400)
          main.scale()
        })
      }
    }
  })
  hub.on.sbToggle(main.scale)

  const page = (name, {view, action}) => {
    name = name.trim()
    main.view(name, view)
    sidebar.item(name, () => {
      if (action) action(name, view, main)
      main.view(name, true)
    })
    run(() => {
      if (!hub.activeView) main.view(name, true)
    })
  }
  page.show = name => { sidebar.activeItem = name }

  const fetchWrits = async (req, props = {}, writtype = 'posts') => (
    (await fetch('/writ', {
      method: 'POST',
      body: JSON.stringify(Object.assign({req, writtype}, props))
    })).json()
  )

  fetchWrits('desc', {page: 0}).then(writs => {
    const view = div({class: 'flexCentered'})
    each(writs, ({key, title, author, date, description, slug}) => {
      const loadWrit = async () => {
        const writ = await fetchWrits('slug', {slug})
        console.log(writ)
      }

      article({
        render: view,
        class: 'writ flexCentered',
        on: {click: loadWrit}
      },
        header(
          h2(title),
          time(new Date(date).toLocaleString()),
          span(author)
        ),
        div(description)
      )
    })
    setTimeout(() => page(`Poems and Writs`, {view}), 80)
  })

  page(`Projects`, {
    view: `You will find some of my GitHub Projects and other projects here`
  })
  page(`Doodles`, {
    view: `Little doodles and ideas will be floating around here`
  })

  const stats = JSON.parse(localStorage.getItem('stats') || '{"views":0}')
  console.log('testing:', stats)
  stats.views++
  localStorage.setItem('stats', JSON.stringify(stats))
}
