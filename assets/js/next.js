{
  const {dom, domfn: {hasClass, Class, css}, render, each, model, once} = rilti
  const {aside, div, header, h1} = dom

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
        Class(sidebar, 'toggled', state)
        hub.emit.sbToggle(state)
      }
    },
    methods: {
      scaleContentElement (el) {
        if (window.innerWidth < 760) return css(el, {marginLeft: '', width: ''})
        const {rect: {width}, toggled} = sidebar
        css(el, {
          marginLeft: toggled ? '4px' : `${width}px`,
          width: toggled ? 'calc(100% - 6px)' : `calc(100% - ${width + 2}px)`
        })
      },
      item (inner, click = () => {}) {
        div({
          render: sidebar,
          class: 'flexCentered sbItem',
          on: {click}
        }, inner)
      }
    }
  },
    div({
      class: 'sbToggle',
      on: { click () { sidebar.toggled = !sidebar.toggled } }
    }),
    fancyHeader('grimstack')
  )

  sidebar.item(
    `Say something I'm giving up on you`,
    () => console.log(`Sê iets of ek strip my moer`)
  )

  const main = dom.main({
    render: 'body',
    class: 'contentGrid',
    methods: { scale () { sidebar.scaleContentElement(main) } },
    lifecycle: {
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
}
