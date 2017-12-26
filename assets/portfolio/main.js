{
/* global rilti location */
  const {dom, domfn: {attrToggle, Class, hasClass}, notifier, extend, run, route, isStr, on, once} = rilti
  const {a, p, header, footer, article, aside, main, nav, section, span, div, h1, img} = dom

  const randInt = (min, max) => ~~(Math.random() * (max - min + 1) + min)

  const log = console.log.bind(console)
  const err = console.error.bind(console)
  const warn = console.warn.bind(console)

  const model = rilti.model()

  const link = (href, contents, newtab = false, cls) => {
    if (isStr(newtab)) [cls, newtab] = [newtab, !!cls]
    return a({
      href,
      class: cls,
      cycle: {
        create: el => attrToggle(el, 'target', newtab, '_blank')
      }
    },
    contents
  )
  }

  const content = main({
    render: 'body',
    id: 'main-content'
  })

  const theme = {
    colorize: (color = theme.colors[randInt(0, theme.colors.length - 1)]) => run(() => {
      document.body.style.setProperty('--bg-color', theme.activeColor = color)
    }),
    colors: [
      'hsl(44,32%,67%)',
      'hsl(0,32%,66%)',
      'hsl(43,92%,55%)',
      'hsl(167,62%,66%)',
      'hsl(125,56%,57%)'
    ]
  }
  setInterval(() => theme.colorize(), 8000)

  const fancyHeader = ({title, render = content, inner = '', options = {}}) => header(
  extend({class: 'fancy-header', render}, options),
  h1(title),
  inner
)

  const head = fancyHeader({title: `SaulDoesCode`})

  const navRack = notifier({
    links: [
      link('#/projects', 'projects'),
      link('#/skills', 'skills'),
      link('#/about', 'about')
    ],
    each: fn => navRack.links.forEach(fn),
    get active () {
      let active
      navRack.each(link => {
        if (hasClass(link, 'active')) active = link
      })
      return active
    },
    rack: nav({
      render: head,
      id: 'nav-rack',
      cycle: {
        mount: () => navRack.init()
      }
    }),
    init () {
      const {each, rack, emit, on} = navRack
      each(link => {
        rack.appendChild(link)

        on.change((_, l) => {
          if (l !== link) Class(link, 'active', false)
        })
        const href = link.getAttribute('href')

        link.activate = () => {
          if (!hasClass(link, 'active')) {
            if (!location.hash.includes(href)) location.hash = href
            Class(link, 'active', true)
            emit.change(href, link)
          }
        }

        link.onclick = link.activate
        route(link.getAttribute('href'), link.activate)
        run(() => {
          if (!navRack.active) link.activate()
        })
      })

      rilti.on.wheel(head, ({deltaY}) => {
        const {links, active} = navRack
        const i = links.indexOf(active)
        const next = deltaY > 1 ? i + 1 : i - 1
        if (links[next]) links[next].activate()
        else if (next >= links.length) links[0].activate()
        else if (next < 0) links[links.length - 1].activate()
      }, true)
    }
  })

  const projectBox = (title, description, url) => article({
    class: 'project-box'
  },
    link(url, header(title), true),
    p(description)
  )

  const skillItem = (name, imageURL) => article({
    class: 'skill-item'
  },
    img({
      attr: {
        src: imageURL,
        alt: name
      }
    }),
    div(name)
  )

  const views = {
    projects: section({
      class: 'content-view',
      id: 'projects-view'
    },
    div({
      class: 'item-grid'
    },
      projectBox(
        'rilti.js',
        `a future forward frontend framework`,
        'https://github.com/SaulDoesCode/rilti.js'
      ),
      projectBox(
        'Rilti News PWA',
        `a Progressive Web App written with rilti.js, using newsapi.org for content.`,
        '/news'
      ),
      projectBox(
        'SuperModel.js',
        `a proxy driven data reactivity library`,
        'https://github.com/SaulDoesCode/SuperModel.js'
      )
    )
  ),
    skills: section({
      class: 'content-view',
      id: 'skills-view'
    },
      skillItem('HTML', '/media/skills/html.png'),
      skillItem('JavaScript', '/media/skills/javascript.png'),
      skillItem('CSS', '/media/skills/css.png'),
      skillItem('NodeJS', '/media/skills/nodejs.png'),
      skillItem('Golang', '/media/skills/golang.png'),
      dom.hr()
    ),
    about: section({
      class: 'content-view',
      id: 'about-view'
    },
      h1('About me'),
      article({
        class: 'self-summary'
      },
        div(
          span('Name\t'),
          `Saul van der Walt`
        ),
        div(
          span('Age\t'),
          new Date().getYear() - new Date('11 April 1997').getYear()
        ),
        div(
          span('Skillset\t'),
          `Junior-Mid Web Developer`
        )
      )
    )
  }

  navRack.on.change(href => {
    if (href.includes('projects')) {
      model.activeView = 'projects'
    } else if (href.includes('skills')) {
      model.activeView = 'skills'
    } else if (href.includes('about')) {
      model.activeView = 'about'
    }

    if (model.activeView in views) {
      if (model.activeSection) model.activeSection.remove()
      model.activeSection = views[model.activeView]
      content.append(model.activeSection)
    }
  })
}
