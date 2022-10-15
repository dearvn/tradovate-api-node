import zip from 'lodash.zipobject'
import HttpsProxyAgent from 'https-proxy-agent'
import JSONbig from 'json-bigint'

import 'isomorphic-fetch'

const DEMO_URL = 'https://demo.tradovateapi.com/v1'
const LIVE_URL = 'https://live.tradovateapi.com/v1'
    
const STORAGE_KEY       = 'tradovate-api-access-token'
const EXPIRATION_KEY    = 'tradovate-api-access-expiration'
const DEVICE_ID_KEY     = 'tradovate-device-id'
const AVAIL_ACCTS_KEY   = 'tradovate-api-available-accounts'
const USER_DATA_KEY     = 'tradovate-user-data'

const defaultGetTime = () => Date.now()

const setDeviceId = (id) => {
    sessionStorage.setItem(DEVICE_ID_KEY, id)
}

const getDeviceId = () => {
    return sessionStorage.getItem(DEVICE_ID_KEY)
}

const setAvailableAccounts = accounts => {
    sessionStorage.setItem(AVAIL_ACCTS_KEY, JSON.stringify(accounts))
}

const getAvailableAccounts = () => {
    return JSON.parse(sessionStorage.getItem(AVAIL_ACCTS_KEY))

}

const queryAvailableAccounts = predicate => {
    return JSON.parse(getAvailableAccounts()).find(predicate)
}

const setAccessToken = (token, expiration) => {
    sessionStorage.setItem(STORAGE_KEY, token)
    sessionStorage.setItem(EXPIRATION_KEY, expiration)
}

const getAccessToken = () => {
    const token = sessionStorage.getItem(STORAGE_KEY)
    const expiration = sessionStorage.getItem(EXPIRATION_KEY)
    if(!token) {
        console.warn('No access token retrieved. Please request an access token.')
    }
    return { token, expiration }
}

const tokenIsValid = expiration => new Date(expiration) - new Date() > 0 

const setUserData = (data) => sessionStorage.setItem(USER_DATA_KEY, JSON.stringify(data))
const getUserData = () => JSON.parse(sessionStorage.getItem(USER_DATA_KEY))

const waitForMs = t => {
  return new Promise((res) => {
      setTimeout(() => {
          res()
      }, t)
  })
}

const handleRetry = async (data, json) => {
  const ticket    = json['p-ticket'],
        time      = json['p-time'],
        captcha   = json['p-captcha']

  if(captcha) {
      console.error('Captcha present, cannot retry auth request via third party application. Please try again in an hour.')
      return
  }

  console.log(`Time Penalty present. Retrying operation in ${time}s`)

  await waitForMs(time * 1000) 
  return await connect({ ...data, 'p-ticket': ticket })   
}

const connect = async ({
  name,
  password,
  appId,
  appVersion,
  cid,
  sec,
  endpoints,
  env = 'demo',
  proxy = ''
}) => {
  let { token, expiration } = getAccessToken()

  if(token && tokenIsValid(expiration)) {
      console.log('Already connected. Using valid token.') 
      //const accounts = await tvGet('/account/list')
      //setAvailableAccounts(accounts)      
      return token
  }

  const credentials = {
    name:       name,
    password:   password,
    appId:      appId,
    appVersion: appVersion,
    cid:        cid,
    sec:        sec
  }

  const privPost = tvPost({ proxy, endpoints, env })

  const authResponse = await privPost('/auth/accesstokenrequest', credentials, false)

  if(authResponse['p-ticket']) {
      return await handleRetry({...credentials, proxy: proxy, endpoints:  endpoints, env: env}, authResponse) 
  } else {
      const { errorText, accessToken, userId, userStatus, name, expirationTime } = authResponse

      if(errorText) {
          console.error(errorText)
          return
      }
      
      setAccessToken(accessToken, expirationTime)

      //const privGet = tvGet({ proxy, endpoints, env })

      //const accounts = await privGet('/account/list')

      //console.log(accounts)

      //setAvailableAccounts(accounts)

      console.log(`Successfully stored access token ${accessToken} for user {name: ${name}, ID: ${userId}, status: ${userStatus}}.`)

      return accessToken
  }
}

const ORDER_TYPE = {
  Limit:              'Limit',
  MIT:                'MIT',
  Market:             'Market',
  QTS:                'QTS',
  Stop:               'Stop',
  StopLimit:          'StopLimit',
  TrailingStop:       'TralingStop',
  TrailingStopLimit:  'TrailingStopLimit'
}

const tvGet = async ({
  endpoints,
  token = '',
  env = 'demo',
  proxy = ''
}) => (path, query = {}) => {

  if (!token) {
    throw new Error('You need to pass an token to make authenticated calls.')
  }

  try {
    let q = ''
    if(query) {
        q = Object.keys(query).reduce((acc, next, i, arr) => {
            acc += next + '=' + query[next]
            if(i !== arr.length - 1) acc += '&'
            return acc
        }, '?')
    }

    console.log('With query:', q.toString() || '<no query>')

    let baseURL = env === 'demo' ? endpoints.demo : env === 'live' ? endpoints.live : ''        
    if(!baseURL) throw new Error(`[Services:tvGet] => 'env' variable should be either 'live' or 'demo'.`)

    let url = query !== null
        ? baseURL + path + q
        : baseURL + path

    console.log(url)

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
    })

    const js = await res.json()

    return js

  } catch(err) {
      console.error(err)
  }
}

const tvPost = async ({
  endpoints,
  token = '',
  env = 'demo',
  proxy = ''
}) => (path, data = {}, _usetoken = true) => {

  if (!token && _usetoken == true) {
    throw new Error('You need to pass an token to make authenticated calls.')
  }

  try {
    
    const bearer = _usetoken ? { Authorization: `Bearer ${token}` } : {} 

    let baseURL = env === 'demo' ? endpoints.demo : env === 'live' ? endpoints.live : ''        
    if(!baseURL) throw new Error(`[Services:tvGet] => 'env' variable should be either 'live' or 'demo'.`)

    let url = baseURL + path

    console.log(url)

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            ...bearer,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}),
    })

    const js = await res.json()

    return js

  } catch(err) {
      console.error(err)
  }
}

const accountList = async (privGet, url) => {
  const accounts = await privGet(url)

  console.log(accounts)

  setAvailableAccounts(accounts)

  return accounts
}

const placeOrder = async (privPost, payload, url) => {

  const { id, name } = getAvailableAccounts()[0]

  const res = await privPost('/order/placeOrder', {...payload, accountId: id, accountSpec: name})

  return res
}


export default opts => {
  
  const endpoints = {
    demo: (opts && opts.httpDemo) || DEMO_URL,
    live: (opts && opts.httpLive) || LIVE_URL,
  }

  const token = await connect({ ...opts, endpoints })

  const params = {...opts, token: token}

  const privGet = await tvGet({ ...params, endpoints })
  const privPost = await tvPost({ ...params, endpoints })
  
  return {
    accountList: () => await accountList(privGet, '/account/list'),
    orderList: () => await privGet('/order/list'),
    placeOrder: payload => await placeOrder(privPost, payload, '/order/placeorder'),
  }
}