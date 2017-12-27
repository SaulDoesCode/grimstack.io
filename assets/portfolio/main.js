{
/* global rilti location */
  const {dom, domfn: {attrToggle, Class, hasClass}, notifier, extend, run, route, isStr, on, once} = rilti
  const {a, p, header, footer, article, main, nav, section, span, div, hr, h1, h4, img, table, tr, td} = dom

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
          if (!navRack.active) navRack.links[navRack.links.length - 1].activate()
        })
      })

      rilti.on.wheel(head, e => {
        e.preventDefault()
        const {links, active} = navRack
        const i = links.indexOf(active)
        let next = e.deltaY > 1 ? i + 1 : i - 1
        if (!links[next]) {
          if (next >= links.length) next = 0
          else if (next < 0) next = links.length - 1
        }
        links[next].activate()
      }, true)
    }
  })

  const projectBox = (title, description, url) => article({
    class: 'project-box'
  },
    link(url, header(title), true),
    p(description)
  )

  const skillItem = (alt, src) => article({
    class: 'skill-item'
  },
    img({ attr: { alt, src } }),
    div(alt)
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
      hr()
    ),
    about: section({
      class: 'content-view',
      id: 'about-view'
    },
      article({
        class: 'self-summary'
      },
        dom.h2('Overview'),
        p(`
          Hi, I'm Saul and developing for the Web is my fulltime obsession second only to my love of philosophy.
          Ever since my first taste of programming at 14
          I've been tinkering away ever since building everything from simple doodles, golang servers to my own batteries included
          javascript framework; even this personal site is built with rilti.js and homespun CSS.
        `),
        img({
          attr: {
            alt: 'Profile Picture of Saul',
            src: '/media/Saul.jpg'
          }
        }),
        dom.h2('Details'),
        table(
          tr(
            td('Age '),
            td(new Date().getYear() - new Date('11 April 1997').getYear())
          ),
          tr(
            td('Name '),
            td('Saul van der Walt')
          ),
          tr(
            td('Nationality '),
            td('South African')
          ),
          tr(
            td('Skillset'),
            td('Junior-Mid Web Developer')
          ),
          tr(
            td('Status'),
            td('Available for Hire')
          )
        ),
        hr(),
        footer(
          section(
            h4('Reach Me At'),
            div(`saul@grimstack.io`)
          ),
          section(
            h4('Find Me On'),
            div(
              link('https://medium.com/@saulvdw', 'medium', true),
              link('https://github.com/SaulDoesCode', 'github', true)
            )
          )
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
