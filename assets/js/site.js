rilti.app('grimstack')((hub, cache, local) => {
  const {dom, domfn, each, model, route, run, render, once, on, isMounted,isStr, isInt, isFunc} = rilti
  const {div, span, header, h1, h2, h3, section, aside, article, footer, input, time, html} = dom
  const {attr, hasAttr, hasClass, Class, css, append, prepend, remove, removeNodes} = domfn
  window.hub = hub

  let token = local('token')

  const fancyNum = num => (
    num >= 1e9 ? (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'g' :
    num >= 1e6 ? (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'm' :
    num >= 1e3 ? (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' :
    ''+num
  )

  const details = (summary, content, options = {}) => dom.details(
    options,
    dom.summary(summary),
    html(content)
  )

  const notifications = div({
    id: 'notifications',
    class: 'flex-centered',
    render: 'body',
  })

  const notify = (mode, closeAfter = 12000, onclose) => (...msg) => {

    const notification = section({
      class: 'notify flex-centered '+mode,
      render: notifications,
    },
      span({
        class: 'close grm-cancel roundcorners flex-centered',
        on: {
          click() {
            remove(notification)
            if (isFunc(onclose)) onclose()
          }
        }
      }),
      span(msg)
    )

    if (isInt(closeAfter)) remove(notification, closeAfter)
  }
  hub.warn = notify('warn')
  hub.info = notify('info')
  hub.err  = notify('err')

  if (!local('cookieInfo')) {
    notify('cookie', false, () => local('cookieInfo', true))
    (
      html(
        `<b>grimstack uses cookies</b> to cache some resources
        <small>(css, icons, auth tokens)</small>, hope that\'s ok.
        Privacy is important and we don't intend to compromise yours,
        the only metrics collected by this site are views and likes`
      )
    )
  }

  const toggle = (left, right, fn, color = '#E3DAC9') => {
    const tglr = span({class: 'middle'})
    left = span({class: 'left'}, left)
    right = span({class: 'right'}, right)
    const el = div({
      class: 'toggle',
      props: {
        get state() {
          return hasClass(el, 'active')
        },
        set state(val) {
          val = !!val
          Class(el, 'active', val)
          css(left, {
            color: !val ? color : '',
            fontSize: !val ? '1.1em' : ''
          })
          css(right, {
            color: val ? color : '',
            fontSize: val ? '1.1em' : ''
          })
        }
      }
    },
      left,
      span({
        class: 'back',
        on: {
          click() {
            el.state = !el.state
            if (fn) fn(el.state)
          }
        }
      },
        tglr
      ),
      right,
    )
    el.state = false
    return el
  }

  const centerElement = el => {
    run(() => {
      if (isMounted(el)) {
        const {width} = el.getBoundingClientRect()
        css(el, {left: `calc(50% - ${width/2}px)`})
      }
    })
  }

  const Contexts = {
    home: {
      hash: '#/home',
      color: '#E3DAC9',
      text: 'home'
    },
    account: {
      hash: '#/account',
      color: 'hsl(39,80%,75%)',
      text: 'account'
    },
    post: {
      hash: '#/post/',
      color: 'hsl(0,80%,75%)',
      text: 'post'
    }
  }

  hub.ctx = v => {
    if (v in Contexts) {
      const ctx = (hub.activeContext = Contexts[hub.ctxName = v])
      if (location.hash.slice(0, ctx.hash.length) !== ctx.hash) location.hash = ctx.hash
      hub.emit.ctx(v, ctx)
    } else if(isFunc(v)) {
      return hub.on.ctx(v)
    }
    return hub.activeContext
  }

  const testCondition = condition => (isFunc(condition) ? condition() : condition) === true

  const ctxbound = (el, ctx, target = 'body', condition = true) => {
    const checkCtx = name => {
      if (name === ctx && testCondition(condition)) {
        hub.emit[`ctxMount:${name}`](el, name)
        render(el, target)
      } else {
        hub.emit[`ctxUnmount:${name}`](el, name)
        remove(el)
      }
    }
    hub.ctx(checkCtx)
    checkCtx(hub.ctxName)
  }

  const ctxRoute = () => {
    const hash = location.hash
    each(Contexts, (ctx, name) => {
      if (hash.slice(0, ctx.hash.length) === ctx.hash) hub.ctx(name)
    })
  }
  on.hashchange(window, ctxRoute)

  const closeCtx = div({
    class: 'closeCtx grm-cancel',
    attr: {
      title: 'close',
    }
  })

  dom('#ctx').then(ctx_el => {
    on.click(ctx_el, () => {
      hub.ctx('home')
    })
    on.click(closeCtx, () => {
      hub.ctx('home')
    })
    hub.ctx((name, {text, color}) => {

      if (name !== 'home') {
        render(closeCtx, ctx_el, 'before')
      } else {
        remove(closeCtx)
      }

      ctx_el.textContent = text
      css(ctx_el, {background: color})
    })
    ctxRoute()
    if (!hub.ctxName) hub.ctx('home')
  })

  dom('#account').then(acct => {
    hub.ctx(name => {
      acct.style.display = name === 'account' ? 'none' : ''
    })
    acct.style.display = hub.ctxName === 'account' ? 'none' : ''
    on.click(acct, () => {
      hub.ctx('account')
    })
  })

  const fetchWrits = async (req, props = {}, writtype = 'posts') => (await
    (await fetch('/writ', {
      method:'POST',
      body: JSON.stringify(Object.assign({
        req,
        writtype,
        token: hub.token,
      }, props))
    }))
    .json()
  )

  const postlist = dom.main({
    id: 'postList',
  },
    header({
      css: {
        color: Contexts.post.color
      }
    },
      'posts'
    ),
    section({
      class: 'pager'
    },
      div({
        on: {
          click() {
            if (hub.postListPage > 0) hub.postListPage--
          }
        }
      },
        "Previous"
      ),
      div({
        on: {
          click() {
            hub.postListPage++
          }
        }
      },
        "Next"
      )
    )
  )
  ctxbound(postlist, 'home')

  const LoadingHTML = `<div class="grm-spin4 flex-centered"></div><br>Loading...`

  const link = (href, inner, className = '') => dom.a({className, attr: {href}}, inner)

  const timeDate = date => time(timeago().format(new Date(date)))

  const postDesc = data => {
    const {title, description, date, tags, slug, viewCount, likeCount, author, _key} = data
    const href = '#/post/' + slug
    route(href, async () => {
      try {
        if (!data.content) {
          let alreadySeen = !!local(_key)
          pvContent.innerHTML = LoadingHTML

          const pdata = await fetchWrits('slug', {slug, alreadySeen})

          if (!pdata) throw new Error('server/database error')
          data.content = pdata.content
          vcount.textContent = fancyNum(data.viewCount = alreadySeen ? pdata.viewCount : (pdata.viewCount + 1))
          lcount.textContent = fancyNum(data.likeCount = pdata.likeCount)
          alreadySeen = local(_key, true)
        }
        run(() => hub.emit.showPost(data))
      } catch(e) {
        console.error('Could not fetch post content: ', e)
      }
    })

    const lcount = div({
      class: 'grm-thumbs-up likecount',
      on: {
        click() {
          hub.emit('like:'+slug)
        }
      }
    },
      fancyNum(likeCount)
    )

    const vcount = div({
      class: 'grm-eye viewcount'
    },
      fancyNum(viewCount)
    )

    hub.on('like:'+slug, () => {
      fetch('/like', {
        method: 'POST',
        body: JSON.stringify({
          token,
          key: _key,
          coll: 'posts'
        })
      }).then(res => {
        res.json().then(result => {
          if (result.err) return console.warn(`trouble liking item`, result)
          if (result.msg === "Success") {
            lcount.textContent = fancyNum(data.likeCount = result.likecount)
            Class(lcount, "liked", result.state)
          }
        })
      })
    })


    const desc = article({
      class: 'postDesc',
      render: postlist
    },
      link(href, header(title)),
      aside(lcount, vcount),
      section(
        div(html(description)),
      ),
      footer(
        div({class: 'grm-tag tags'}, tags.map(tag => span({class: 'tag'}, tag))),
        div({class: 'grm-feather details'}, timeDate(date), span(author))
      )
    )
}

  let oldPostListPage;
  hub.$set('postListPage', async page => {
    if (page !== oldPostListPage) {
      if (page < 1) return hub.postListPage = 1
      try {
        const posts = await fetchWrits('desc', {page})

        if (posts.err) return hub.warn("Could not fetch posts, there's probably not enough posts written yet")
        dom.queryEach('.postDesc', el => remove(el))
        each(posts, postDesc)
      } catch (e) {
        console.error(e)
      }
      oldPostListPage = page
    }
  })
  hub.postListPage = 1

  const pvTitle = header({
    class: 'pvTitle'
  },
    'Post title'
  )
  const pvContent = article(html(LoadingHTML))
  const pvAuthor = span('Author')
  const pvDate = time('11/11/17')
  const pvTags = div({
    class: 'grm-tag tags'
  })

  const postViewer = dom.main({
    id: 'postViewer',
    lifecycle: {
      destroy() {
        location.hash = ''
      }
    }
  },
    section({
      class: 'pvHead'
    },
      pvTitle,
      dom.br(),
      div({class: 'details'}, pvDate, pvAuthor)
    ),
    dom.br(),
    pvContent,
    dom.br(),
    footer(pvTags)
  )

  ctxbound(postViewer, 'post')

  hub.on.showPost(({title, content, date, tags, viewcount, likecount, author}) => {
    if (pvTitle.textContent != title) {
      pvTitle.textContent = title
      pvDate.textContent = timeago().format(new Date(date))
      const timeUpdater = rilti.timeout(() => {
        pvDate.textContent = timeago().format(new Date(date))
        if (hub.ctxName != 'post') timeUpdater.stop()
      }, 10000)
      pvAuthor.textContent = author
      pvContent.innerHTML = content
      pvTags.innerHTML = ''
      append(pvTags, tags.map(tag => span({class: 'tag'}, tag)))
    }
  })

  const testToken = () => {
    if (!token) return hub.Authenticated = false

    fetch('/auth/token/', {
      method: 'POST',
      body: JSON.stringify({token})
    })
    .then(res => res.json())
    .then(data => {
      if (data.err || data.errors) {
        console.warn(data.err)
        hub.isAuthorized = false
        const usrname = local("username")
        if (usrname) {
          hub.err(`
            Sorry${' '+usrname}, we were unable to authenticate your session,
            your auth token must have expired or perhaps you've logged in somewhere else.
            If you want to, just login again
          `)
        }
        localStorage.clear()
        return
      }
      hub.user = data
      hub.isAuthorized = true
      console.log('Authenticated: all is well!')
    })
  }

  const tokenate = tkn => {
    const username = hub.username = localStorage.getItem('username')
    const gravatar = hub.gravatar = localStorage.getItem('gravatar')
    hub.token = token = tkn
    hub.$set('isAuthorized', state => {
      if (state === true) hub.emit.Authenticated({username, gravatar, token})
    })
    testToken()
  }

  token ? tokenate(token) : hub.async.token.then(tokenate)

  once.storage(window, ({key}) => {
    if (key === 'token') {
      hub.token = localStorage.getItem('token')
    }
  })

  const AuthMessage = div({
    class: 'authMsg',
    props: {
      set msg (txt) {
        AuthMessage.textContent = txt
        authform.appendChild(AuthMessage)
      },
      to: null,
      set timeout (to) {
        if (AuthMessage.to) AuthMessage.to.stop()
        AuthMessage.to = to
      }
    },
    lifecycle: {
      mount (el) {
        el.timeout = remove(el, 5000)
      }
    }
  })

  const authinfo = [
    dom.p({
      class: 'fancyfont',
      css: {
        fontSize: '1.2em'
      }
    },
      'Welcome to password-less authentication'
    ),
    details(
      'More info...',
      `<p>
        <b>you have email? a cool username?</b> Awesome, we'll send you a verification link.
        If you follow the link your account is verified and you're logged in and that's that.
      </p>
      <p>
        We authenticate your session with a JWT token that lasts about a week, the token
        gets stored in your browser's localStorage, so next time you visit we know you're cool.
        If you want to logout we simply delete the token.
        Also, we're not crooks so there will be <b>no funny business<b> with your email address, that stuff's private
        and we respect that.
      </p>`
      )
  ]

  const emailInput = input({
    class : 'pop-in',
    attr: {
      type: 'email',
      name: 'email',
      placeholder: 'Email'
    }
  })

  const usernameInput = input({
    class : 'pop-in',
    attr: {
      type: 'text',
      name: 'username',
      placeholder: 'Username',
      maxlength: '35',
      minlength: '2',
      pattern: '^[a-zA-Z0-9._]{3,55}$'
    }
  })

  const emailRegEx = (/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)
  const validEmail = emailStr => emailRegEx.test(emailStr)
  const validUsername = (username = '') => /^[a-zA-Z0-9\._]{3,55}$/.test(username)

  const formData = (
    email = emailInput.value.trim(),
    username = usernameInput.value.trim()
  ) => ({email, username})

  const validForm = ({email, username} = formData(), shout = true) => {
    if (!validEmail(email)) {
      if (shout) AuthMessage.msg = 'Invalid email address'
      return false
    }
    if (hub.authmode !== 'login' && !validUsername(username)) {
      if (shout) AuthMessage.msg = 'Invalid username, please keep it under 60 characters with no spaces, underscores and numbers are allowed'
      return false
    }
    return true
  }

  hub.authmode = 'signup'
  const authModeToggle = toggle('signup', 'login', state => {
    hub.authmode = state ? 'login' : 'signup'
  })

  const submit = dom.button({
    class : 'pop-in',
    on: {
      click() {
        const details = formData()
        if (validForm(details)) {
          authform.innerHTML = '<div class="grm-spin4"></div><br>Sending...'
          if (hub.authmode === 'login') delete details.username
          hub.emit.submitAuth(details)
        }
      }
    }
  }, 'Go!')

  hub.$set('authmode', mode => {
    mode === 'login' ? remove(usernameInput) : render(usernameInput, emailInput, 'before')
  })

  const authform = dom.main({
    id: 'authform',
  },
    authinfo,
    authModeToggle,
    section(usernameInput, emailInput, submit)
  )
  ctxbound(authform, 'account', 'body', () => !hub.isAuthorized)
  hub.$set('isAuthorized', val => {
    if (val) remove(authform)
  })

  hub.once.submitAuth(async details => {
    const res = await fetch('/auth', {
      method: 'POST',
      body: JSON.stringify(details)
    })
    const result = await res.json()
    authform.innerHTML = ''
    if (result.err) AuthMessage.msg = result.err
    if (result.msg) {
      section({
        render: authform,
        class: 'fancyfont',
        css: {
          fontSize: '1.2em'
        }
      },
        result.msg
      )
    }
  })

  const B64flag = 'data:image/jpeg;base64,'
  const gravatarIcon = async (code, username) => {
    if (!code) return false
    if (!username) return false
    const data = await cache.resource(`https://www.gravatar.com/avatar/${code}.jpg`, 'arrayBuffer')

    hub.profileImg = B64flag + rilti.arrayBufferToB64(data)
    const img = dom.img({src: hub.profileImg})

    const el = await dom('#account')
    Class(el, 'grm-user', false)
    Class(el, 'authenticated', true)
    render(img, el)
  }

  hub.on.logout(() => {
    fetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({token})
    })
    .then(res => {
      res.json().then(({msg, err}) => {
        if (err) console.error(err)
        if (msg) console.log(msg)
      })
    })
    localStorage.clear()
    cache.clear()
  })

  hub.once.Authenticated(usr => {
    const {gravatar, username} = usr
    gravatarIcon(gravatar, username)

    const logout = div({
      class: 'logout roundcorners flex-centered grm-logout',
      attr: {
        title: 'logout',
      },
      on: {
        click: hub.emit.logout
      }
    })

    const profile = dom.main({
      class: 'profile',
    })

    const profileDetails = aside({
      class: 'profileDetails roundcorners flex-centered',
      render: profile,
    },
      dom.img({
        class: 'roundcorners',
        lifecycle: {
          create(el) {
            hub.async.profileImg.then(src => el.src = src)
          }
        }
      })
    )

    fetch('/u/'+username)
    .then(res => {
      res.json().then(user => {
        console.log(user)
        div({
            class: 'bio',
            render: profileDetails,
          },
          span({
            css: {
              color: Contexts.account.color,
            }
          }, 'Bio'),
          user.bio
        )
      })
    })

    ctxbound(logout, 'account', '#ui', () => hub.isAuthorized)
    ctxbound(profile, 'account', 'body', () => hub.isAuthorized)
  })

})
