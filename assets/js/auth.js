var Auth = (() => {
  const {isObj} = rilti

  const postReq = (url, body, options = {}) => fetch(url, Object.assign({
    method: 'POST',
    body: isObj(body) ? JSON.stringify(body) : body
  }, options))

  const testToken = async (token, verbose) => {
    if (!token) return false
    try {
      const data = await (await postReq('/auth/token', {token})).res.json()
      if (data.err || data.errors) {
        if (verbose) console.warn(data)
        return false
      }
      return data
    } catch (e) {
      return false
    }
  }

  const tokenate = async (token, store, reload) => {
    const authData = await testToken(token)
    if (!authData || !authData.username) {
      if (store) {
        store.clear()
        if (reload) location.replace('/')
      }
      return false
    }
    store({
      gravatar: authData.emailmd5,
      username: authData.username,
      user: authData
    })
    return true
  }


  return {
    testToken,
    tokenate,
  }
})()
