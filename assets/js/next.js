{
  /* global rilti localStorage */
  const {
    domfn: {append, hasClass, Class, css},
    dom,
    each,
    model,
    once,
    isEmpty,
    isBool,
    run
  } = rilti
  const {aside, div, header} = dom

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
        if (isEmpty(view)) {
          if (!viewExists) return
          hub.lastView = hub.activeView
          hub.activeView = name
          view = hub.views.get(name)
        }
        if (!viewExists) hub.views.set(name, view)
        if (show) {
          main.innerHTML = ''
          return append(main, view)
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

  page(`Poems and Writs`, {
    view: `This is where all the poems and writs will go`
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
