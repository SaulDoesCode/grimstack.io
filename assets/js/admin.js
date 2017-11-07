rilti.app('grimstack')((hub, cache, local) => {
  const randStr = (len, charSelection = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.0123456789') => {
    let text = ''
    while (len != 0) {
      text += charSelection.charAt(~~(Math.random() * charSelection.length))
      len--
    }
    return text
  }
  window.hub = hub

  const {dom, domfn, each, extend, on, once, run, render, isArr, isDef, isBool, isNil, isStr, isObj, isFunc, isInt, isNode, isMounted} = rilti
  const {aside, article, button, div, span, header, section, input, query, h1, h2, h3, h4} = dom
  const {Class, hasClass, append, remove, attr, css} = domfn

  const notifications = div({
    id: 'notifications',
    class: 'flex-centered',
    render: 'body'
  })

  const notify = (mode, closeAfter = 7000) => (...msg) => {
    const notification = section({
      class: 'notify flex-centered ' + mode,
      render: notifications
    },
      span({
        class: 'close grm-cancel roundcorners flex-centered',
        on: { click () { remove(notification) } }
      }),
      span(msg)
    )

    if (isInt(closeAfter)) remove(notification, closeAfter)
  }
  hub.warn = notify('warn')
  hub.info = notify('info')
  hub.err = notify('err')

  const testToken = () => {
    if (!token) return hub.Authenticated = false

    fetch('/auth/token/', {
      method: 'POST',
      body: JSON.stringify({token})
    })
    .then(res => res.json())
    .then(data => {
      if (data.err || data.errors) {
        console.warn(data)
        hub.isAuthorized = false
        local.clear()
        location.replace('/')
        return
      }
      hub.user = data
      hub.isAuthorized = true
      console.log('Authenticated: all is well!')
    })
  }

  let token = local('token')

  const tokenate = tkn => {
    const username = hub.username = local('username')
    const gravatar = hub.gravatar = local('gravatar')
    token = tkn
    hub.$set('isAuthorized', state => {
      if (state === true) hub.emit.Authenticated({username, gravatar, token})
      else location.replace('/')
    })
    testToken()
  }

  token ? tokenate(token) : location.replace('/')

  once.storage(window, ({key}) => {
    if (key === 'token') {
      hub.token = local('token')
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

  hub.once.Authenticated(usr => {
    const {gravatar, username} = usr
    gravatarIcon(gravatar, username)
  })

  showdown.setFlavor('github')
  const md = new showdown.Converter()
  // md.makeHtml

  const slugify = (() => {
    const reduce = () => {
      const a = ('àáäâèéëêìíïîòóöôùúüûñçßÿœæŕśńṕẃǵǹḿǘẍźḧ·/_,:;' + 'ąàáäâãåæćęęèéëêìíïîłńòóöôõøśùúüûñçżź').split('')
      const b = ('aaaaeeeeiiiioooouuuuncsyoarsnpwgnmuxzh------' + 'aaaaaaaaceeeeeeiiiilnoooooosuuuunczz').split('')

      return a.reduce((acc, current, index) => {
        const exist = acc.a.find((char) => char === current)

        if (exist) {
          return acc
        }

        acc.a.push(current)
        acc.b.push(b[index])

        return acc
      }, {
        a: [],
        b: []
      })
    }

    const reduced = reduce()
    const a = reduced.a.join('') // "àáäâèéëêìíïîòóöôùúüûñçßÿœæŕśńṕẃǵǹḿǘẍźḧ·/_,:;ąãåćęłõøż"
    const b = reduced.b.join('') // "aaaaeeeeiiiioooouuuuncsyoarsnpwgnmuxzh------aaacelooz"
    const p = new RegExp(a.split('').join('|'), 'g')

    return txt => txt.toString().toLowerCase()
  .replace(/\s+/g, '-')      // Replace spaces with -
  .replace(p, c => b.charAt(a.indexOf(c)))  // Replace special chars
  .replace(/&/g, '-and-')    // Replace & with 'and'
  .replace(/[^\w-]+/g, '')   // Remove all non-word chars
  .replace(/--+/g, '-')      // Replace multiple - with single -
  .replace(/^-+/, '')        // Trim - from start of text
  .replace(/-+$/, '')        // Trim - from end of text
  })()

  const runQuery = hub.Q = (query, bindvars = {}) => new Promise((resolve, reject) => {
    fetch('/admin/query', {
      method: 'POST',
      body: JSON.stringify({token, query, bindvars})
    })
    .then(res => {
      res.json().then(data => {
        if (data.err) return reject(data.err)
        resolve(data)
      })
    })
  })

  const Contexts = {
    edit: {
      hash: '#/edit',
      color: '#E3DAC9',
      text: 'writing mode'
    },
    postlist: {
      hash: '#/postlist',
      color: 'hsl(0,79%,75%)',
      text: 'postlist'
    },
    users: {
      hash: '#/users/',
      color: 'hsl(0,80%,75%)',
      text: 'users screen'
    }
  }

  hub.ctx = v => {
    if (v in Contexts) {
      const ctx = (hub.activeContext = Contexts[hub.ctxName = v])
      if (location.hash.slice(0, ctx.hash.length) !== ctx.hash) location.hash = ctx.hash
      hub.emit.ctx(v, ctx)
    } else if (isFunc(v)) {
      return hub.on.ctx(v)
    }
    return hub.activeContext
  }

  const testCondition = condition => (isFunc(condition) ? condition() : condition) === true

  const ctxbound = (el, ctx, target = 'body', condition = true) => {
    const checkCtx = name => name === ctx && testCondition(condition) ? render(el, target) : remove(el)
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
      title: 'close'
    }
  })

  dom('#ctx').then(ctx_el => {
    on.click(ctx_el, () => {
      hub.ctx('edit')
    })
    on.click(closeCtx, () => {
      hub.ctx('edit')
    })
    hub.ctx((name, {text, color}) => {
      if (name !== 'edit') {
        render(closeCtx, ctx_el, 'before')
      } else {
        remove(closeCtx)
      }

      ctx_el.textContent = text
      css(ctx_el, {background: color})
    })
    ctxRoute()
    if (!hub.ctxName) hub.ctx('edit')
  })

  const newWritBtn = div({
    id: 'newWritBtn',
    class: 'grm-magic',
    attr: {
      ui: 'postlist',
      title: 'new writ'
    },
    on: {
      click: hub.emit.newWrit
    }
  })

  ctxbound(newWritBtn, 'postlist', '#ui')

  const postlistBtn = div({
    id: 'publishBtn',
    class: 'grm-newspaper',
    attr: {
      ui: 'newWrit',
      title: 'view postlist'
    },
    on: {
      click: hub.emit.postlist
    }
  })
  ctxbound(postlistBtn, 'edit', '#ui')

  hub.on.postlist(() => {
    hub.ctx('postlist')
  })

  const postlistMain = dom.main({
    class: 'flex-centered'
  })
  ctxbound(postlistMain, 'postlist', 'body')

  const postlist = div({
    id: 'postlist',
    class: 'flex-centered',
    render: postlistMain
  })

  const Posts = new Map()

  const populateList = async (list, listmap, writType) => {
    const writs = await runQuery(`
      FOR writ IN ${writType}
      SORT writ.date DESC
      RETURN writ
    `)
    if (writs.err) return hub.err(writs.err)

    listmap.clear()
    list.innerHTML = ''

    each(writs, writ => {
      listmap.set(writ._key, writs)

      div({
        class: 'writ roundcorners',
        render: list,
      },
        header(writType),
        dom.h2({
          on: {
            click () {
              hub.emit.edit(writ, writType)
            }
          }
        },
          writ.title
        ),
        (() => {
          let proplist = section({
            class: 'roundcorners flex-centered'
          })

          each(writ, (val, key) => {
            if (['markdown', 'description', 'content', '_id', '_rev', 'likes', 'title'].includes(key)) return
            if (key === 'date') val = new Date(val).toLocaleDateString()
            if (key === 'edits' && val.length > 3) val = val.slice(val.length - 3, val.length)

            div({
              class: 'writ-prop roundcorners',
              render: proplist
            },
              dom.b(`${key}:  `),
              isArr(val) ?
              val.map((v, i) => [
                span(key === 'edits' ? new Date(v).toLocaleDateString() : v),
                (i !== val.length - 1) ? ', ' : ''
              ]) : val
            )
          })
          return proplist
        })()
      )
    })
  }

  hub.on.updatePostlist(() => {
    populateList(postlist, Posts, 'posts')
  })

  const Editor = dom.main({
    id: 'editor',
    class: 'flex-centered'
  })
  ctxbound(Editor, 'edit', 'body')

  const WritersBlock = div({
    class: 'flex-centered',
    id: 'writersblock',
    render: Editor
  })

  const titleBlock = header({
    id: 'titleblock',
    render: WritersBlock,
    attr: {contenteditable: true}
  }, 'Writ Title')

  const mdHolder = dom.pre({
    attr: {contenteditable: true}
  })
  hub.mded = mdHolder
  hub.md = md
  hub.xmd = () => md.makeHtml(mdHolder.innerText)

  const descriptionEditor = div({
    attr: {contenteditable: true}
  })

  const writingBlock = article({
    id: 'writingblock',
    on: {
      keydown (e) {
        if (e.ctrlKey && e.keyCode === 83) {
          e.preventDefault()
          hub.emit.saveWrit()
        }
      }
    },
    render: WritersBlock
  },
    mdHolder,
    dom.hr(),
    descriptionEditor
  )

  const writingButtons = aside({
    render: WritersBlock,
    class: 'wr-buttons flex-centered'
  })

  const tagMaker = div({
    class: 'tagMaker pop-in roundcorners'
  })

  const tagInput = input({
    on: {
      keydown ({keyCode}) {
        if (keyCode === 13) {
          hub.emit.changeTags(false)
          tagsBtn.$state(false)
        }
      }
    },
    render: tagMaker
  })

  const tagSubmit = button({
    render: tagMaker,
    on: {
      click () {
        hub.emit.changeTags(false)
        tagsBtn.$state(false)
      }
    }
  }, 'enter')

  const wrBtn = ({icon, title, event, toggle = false, color = '#fca136', dblclick = false, altIcon, state = false}) => button({
    class: `roundcorners flex-centered ${icon} ${state ? 'active' : ''}`,
    render: writingButtons,
    attr: {title},
    props: {
      clickCount: 0,
      $state (val) {
        if (isBool(val)) {
          state = val
          Class(this, 'active', toggle && state)
          this.style.color = toggle && state ? color : ''
          if (altIcon) {
            Class(this, {
              [icon]: state === true,
              [altIcon]: state === false
            })
          }
        }
        return state
      }
    },
    css: {
      color: toggle && state ? color : ''
    },
    lifecycle: {
      create (el) {
        on[dblclick ? 'dblclick' : 'click'](el, e => {
          el.$state(!state)
          hub.emit(event, state, el, e)
          if (dblclick) {
            Class(el, 'dblclick-active', true)
            setTimeout(() => Class(el, 'dblclick-active'), 2000)
          }
        })
      }
    }
  })

  wrBtn({
    icon: 'grm-trash',
    title: 'delete writ',
    event: 'deleteWrit',
    dblclick: true
  })
  wrBtn({
    icon: 'grm-floppy',
    title: 'save',
    event: 'saveWrit'
  })
  const publishBtn = wrBtn({
    icon: 'grm-eye',
    title: 'set pubslished state',
    event: 'setPublished',
    toggle: true
  })
  const tagsBtn = wrBtn({
    icon: 'grm-tag',
    title: 'change tags',
    event: 'changeTags',
    toggle: true,
    color: '#9e8a62'
  })
  wrBtn({
    icon: 'grm-cancel',
    title: 'clear editor',
    event: 'clearEditor'
  })

  hub.on.changeTags(state => {
    if (state) return render(tagMaker, 'body')
    remove(tagMaker)
    const {_key: key, tags, title} = extractWrit(hub.activeWrit)
    runQuery(`
      FOR writ IN ${hub.activeWritType}
      FILTER writ._key == @key
      UPDATE writ WITH {tags: @tags} IN ${hub.activeWritType}`,
      {key, tags}
    )
    .then(hub.info.bind(null, 'writ publish state updated: ' + title), hub.err)
    hub.emit.updatePostlist()
  })

  const extractWrit = (writ = hub.activeWrit || {}) => {
    writ.title = titleBlock.textContent.trim()
    writ.slug = slugify(writ.title)
    writ.markdown = mdHolder.innerText
    writ.content = md.makeHtml(writ.markdown).trim()
    writ.description = descriptionEditor.textContent.trim()
    if (isNil(writ.author)) writ.author = local('username')
    if (isNil(writ.published)) writ.published = publishBtn.$state()
    writ.tags = tagInput.value.split(',').map(tag => tag.trim())
    if (writ._key === hub.activeWrit._key) cache.activeWrit = hub.activeWrit = writ
    return writ
  }

  const editWrit = (writ, writType = 'posts') => {
    if (isStr(writ)) writ = JSON.parse(writ)
    titleBlock.textContent = writ.title
    mdHolder.textContent = writ.markdown
    descriptionEditor.textContent = writ.description
    tagInput.value = writ.tags.map((tag, i) => tag + ((i !== writ.tags.length - 1) ? ',' : '')).join('')
    publishBtn.$state(writ.published)
    cache.activeWrit.then(w => {
      if (w._key !== writ._key) cache.lastActiveWrit = hub.lastActiveWrit = w
    }, () => {})
    hub.activeWrit = cache.activeWrit = writ
    hub.activeWritType = 'posts'
    hub.ctx('edit')
  }

  const clearEditor = () => {
    if (hub.activeWrit) hub.lastActiveWrit = cache.lastActiveWrit = extractWrit(hub.activeWrit)
    hub.activeWrit = {}

    titleBlock.textContent = 'add a title'
    mdHolder.textContent = 'add some content using markdown'
    descriptionEditor.textContent = 'add a description'
    publishBtn.$state(false)
    tagInput.value = ''
    hub.ctx('postlist')
  }

  hub.on.clearEditor(clearEditor)
  hub.on.edit(editWrit)

  cache.activeWrit.then(writ => {
    const ctx = hub.ctxName
    editWrit(writ)
    if (ctx !== 'edit') hub.ctx(ctx)
  }, () => {})

  setInterval(() => {
    if (!rilti.isEmpty(hub.activeWrit)) {
      extractWrit(hub.activeWrit)
    }
  }, 5000)

  hub.on.newWrit(() => {
    clearEditor()
    hub.ctx('edit')
  })

  hub.on.saveWrit(() => {
    saveWrit(hub.activeWritType, cache.activeWrit = extractWrit(hub.activeWrit))
    console.log('writ saved!')
    hub.emit.updatePostlist()
  })

  hub.on.deleteWrit(() => {
    cache.lastDeletedWrit = hub.activeWrit
    runQuery(`
      FOR writ IN ${hub.activeWritType}
      FILTER writ._key == @key
      REMOVE writ IN ${hub.activeWritType}`, {
        key: hub.activeWrit._key
      })
    .then(hub.info.bind(null, 'writ publish state updated: ' + hub.activeWrit.title), hub.err)
    hub.emit.updatePostlist()
    hub.ctx('postlist')
  })

  hub.restoreLastDeletedWrit = () => {
    cache.lastDeletedWrit.then(hub.emit.edit, hub.err)
  }

  hub.on.setPublished(state => {
    hub.activeWrit.published = state
    runQuery(`
      FOR writ IN ${hub.activeWritType}
      FILTER writ._key == @key
      UPDATE writ WITH {published: @state} IN ${hub.activeWritType}
    `, {key: hub.activeWrit._key, state}).then(hub.info.bind(null, 'writ publish state updated: ' + hub.activeWrit.title), hub.err)
    hub.emit.updatePostlist()
  })

  hub.emit.updatePostlist()

  const saveWrit = async (writType, data) => {
    if (isNil(data.slug)) data.slug = slugify(data.title)
    if (isNil(data.content)) data.content = md.makeHtml(data.markdown)
    if (isNil(data.author)) data.author = local('username')
    if (isNil(data.published)) data.published = false
    if (isNil(data.tags)) data.tags = ['meta']

    if (isNil(data._key)) {
      const existingPosts = await runQuery(`
        FOR writ IN ${writType}
        FILTER writ.title == @title || writ.markdown == @markdown
        RETURN writ
      `, {
        title: data.title,
        markdown: data.markdown
      })

      if (existingPosts.length) {
        data._key = existingPosts[0]._key
        console.log('writ exists, updating...', existingPosts)
      } else {
        data._key = ''
      }
    }

    const bindVars = {
      title: data.title,
      slug: data.slug,
      key: data._key,
      markdown: data.markdown,
      content: data.content,
      description: data.description,
      tags: data.tags,
      published: data.published,
      author: data.author
    }

    const query = `
    UPSERT {_key: @key}
		INSERT {
      slug: @slug,
			title: @title,
			content: @content,
			markdown: @markdown,
			description: @description,
      author: @author,
			tags: @tags,
      published: @published,
      viewCount: 0,
      likeCount: 0,
      likes: [],
      edits: [],
      date: DATE_NOW()
		} UPDATE {
      title: @title,
      slug: @slug,
      content: @content,
      markdown: @markdown,
      description: @description,
      tags: @tags,
      published: @published,
			edits: APPEND(OLD.edits, [DATE_NOW()], true)
		} IN ${writType}`
    runQuery(query, bindVars).then(hub.info.bind(null, 'saved writ: ' + data.title), hub.err)

    setTimeout(hub.emit.updatePostlist, 100)
  }

  /*
  Journey to the sands of elsewhere
  29/10/2017

  time died as a single rust colored tear fell into the fine dry sand below
  it doesn't look the way I thought it would
  a second fell, it's forever now

  I've dreamt of these sweet soft sands
  soon their tender touch will carress my broken soul
  and embrace me the way life's indifference never could
  the answers have had their show and outstayed their welcome

  a muddy clump is forming now

  I don't feel anymore, that left when my becoming came undone
  my love did not die when I heard them laugh
  it did not die when they listened, nodded and promptly forgot
  nor when they saw my anguish and let me carry their's
  it died when they took my heart and danced with it
  teasing me with false courtesy and rude affection like an ugly whore
  gleefully whispering in my ear in no words at all, that,
  geniality is a luxury the world cannot afford to spare one so contorted as you

  a strange slippery heat kisses my skin, it's comforting
  I was vain to think that any of it ever mattered
  a coldness grows over my neck and back, it hurts so bad
  it won't be long now, my face is pressed against the soft sands
  no I can't take it back, I must not take it back

  so sore now, the sand is cold and sticky
  I didn't want this, I don't mean it
  I can't move, I can't move
  I can't scream
  ...
  bitter metal taste, all numb now
  ...
  empty now, alone now
  ...
  my beautiful wrong sentimental song starts to play...
  ...
  play and play...
  ...

  Drifting to Sublation

  a cosmic ocean glows bright green
  with anguish and euphoria
  upon its pristine surface
  endless bodies float waywardly
  on their way to way through
  the veil that separates
  modality from form
  transparent now
  they are fragile and beautiful
  their faults shine in them
  as clumps of large priceless emeralds
  even a slight stiring will
  break their forms apart
  before they disolve naturally
  into the calm luke warm water
  releasing their jewels to the depths
  from which a bright light shines
  the insane light of eternity
  digesting order with the sap of time

  he has fallen into a rut again and he cannot help himself
  he sighs loathingly once again expressing his repugnance at the world and himself
  it sprays finely like foul piss in the wind, it's everybody's problem now
  he holds his head again like some craven thrall cursing behind its master's back
  he closes his eyes and forgives himself again, breathing in that sweet piss like perfume
  then smokes another ciggarette to finish the sacred ritual
  he is so wretched aleady, but he wears that tough guy suit right over his victimhood
  he's insensitive, right, and wholly oppressed
  you say something but he just pisses more then blames you for the ungodly stench
  he claims his innocence with such ham and candor
  that you could swear he was an altar boy fucked by the priest
  this is his great fuck you stand, and you're in the way
  he sighs again spreading that terrible sickness
  then closes his eyes and forgives himself
  the rot is so deep, he hurts, you know, he hurts, but he's too proud
  that wound festers away, but he bears it and blames the world for his pain
  should you say something he'd bark at you then sigh forgiving himself
  he's screaming inside and there's nothing to be done
  I sigh and forgive myself
  */
})
