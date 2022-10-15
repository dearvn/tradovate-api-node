import zip from 'lodash.zipobject'
import JSONbig from 'json-bigint'

import httpMethods from 'http-client'
import _openWebSocket from 'open-websocket'

const STORAGE_KEY       = 'tradovate-api-access-token'
const EXPIRATION_KEY    = 'tradovate-api-access-expiration'
const DEVICE_ID_KEY     = 'tradovate-device-id'
const AVAIL_ACCTS_KEY   = 'tradovate-api-available-accounts'
const USER_DATA_KEY     = 'tradovate-user-data'

const endpoints = {
  base_url: 'https://demo.tradovateapi.com/v1',
  md: 'wss://md.tradovateapi.com/v1/websocket',
  demo: 'wss://demo.tradovateapi.com/v1/websocket',
  live: 'wss://live.tradovateapi.com/v1/websocket',
}

const noop = () => {}

const wsOptions = {}

function openWebSocket(url) {
  return _openWebSocket(url, wsOptions)
}

const setDeviceId = (id) => {
    sessionStorage.setItem(DEVICE_ID_KEY, id)
}

const getDeviceId = () => {
    return sessionStorage.getItem(DEVICE_ID_KEY)
}

const setAvailableAccounts = accounts => {
    sessionStorage.setItem(AVAIL_ACCTS_KEY, JSON.stringify(accounts))
}

/**
 * Returns and array of available accounts or undefined.
 * @returns Account[]
 */
const getAvailableAccounts = () => {
    return JSON.parse(sessionStorage.getItem(AVAIL_ACCTS_KEY))
}

/**
 * Use a predicate function to find an account. May be undefined.
 */
const queryAvailableAccounts = predicate => {
    return JSON.parse(getAvailableAccounts()).find(predicate)
}

const setAccessToken = (token, expiration) => {
    //if(!token || !expiration) throw new Error('attempted to set undefined token')
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

const tvGet = async (endpoint, query = null, env = 'demo') => {
    const { token } = getAccessToken()
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
            ? baseURL + endpoint + q
            : baseURL + endpoint

        console.log(url)

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        })

        const js = await res.json()

        return js

    } catch(err) {
        console.error(err)
    }
}

const tvPost = async (endpoint, data, _usetoken = true, env = 'demo') => {
    const { token } = getAccessToken()
    const bearer = _usetoken ? { Authorization: `Bearer ${token}` } : {} 

    let baseURL = env === 'demo' ? endpoints.demo : env === 'live' ? endpoints.live : ''
    if(!baseURL) throw new Error(`[Services:tvPost] => 'env' variable should be either 'live' or 'demo'.`)

    try {
        const res = await fetch(baseURL + endpoint, {
            method: 'POST',
            headers: {
                ...bearer,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })

        const js = await res.json()

        return js

    } catch(err) {
        console.error(err)
    }
}

const connect = async (data) => {
    const { token, expiration } = getAccessToken()
    if(token && tokenIsValid(expiration)) {
        console.log('Already have an access token. Using existing token.')
        return
    }
    const authResponse = await tvPost('/auth/accesstokenrequest', data, false)

    const { accessToken, expirationTime } = authResponse

    console.log(authResponse)
    
    setAccessToken(accessToken, expirationTime)
}

/**
 * A generic implementation for the Tradovate real-time APIs WebSocket client. 
 *
 * ```js
 * const mySocket = new TradovateSocket()
 * //if you want labels for logs, do this
 * const myLabeledSocket = new TradovateSocket({debugLabel: 'my-websocket'})
 * ```
 */
function TradovateSocket({debugLabel = 'tvSocket'} = {}) {
    let counter = 0
    let curTime = new Date()

    this.listeningURL = ''
    this.debugLabel = debugLabel

    this.increment = function() { return counter++ }
    this.getCurTime = function() { return curTime }
    this.setCurTime = function(t) { curTime = t === curTime ? curTime : t }

    this.ws = null
    this.connected = false
    this.listeners = []    

    this.addListener = function(listener) {
        this.listeners.push(listener)
        return () => this.listeners.splice(this.listeners.indexOf(listener), 1)
    }
}

/**
 * Connect this client socket to one of the Tradovate real-time API URLs.
 * 
 * ```js
 * //market data connection example
 * const mySocket = new TradovateSocket()
 * mySocket.connect('wss://md.tradovateapi.com/v1/websocket', MY_ACCESS_TOKEN)
 * ```
 * @param {string} url The Tradovate WebSocket URL to use for this client.
 * @param {string} token Your access token, acquired using the REST API.
 * @returns {Promise<void>} 
 */
TradovateSocket.prototype.connect = async function(url, token) {
    console.log('connecting...')
    const self = this

    return new Promise((res, rej) => {
        this.listeningURL = url
        this.ws = new WebSocket(url)

        //long running
        this.ws.addEventListener('message', function onEvents(msg) {
            self.setCurTime(checkHeartbeats(self.ws, self.getCurTime()))
            const [T, data] = prepareMessage(msg.data)
            
            console.log(self.debugLabel + '\n', T, data)

            if(T === 'a' && data && data.length > 0) {
                self.listeners.forEach(listener => data.forEach(d => listener(d)))
            }
        })

        //auth only
        this.ws.addEventListener('message', function onConnect(msg) {
            const [T, _] = prepareMessage(msg.data)
            if(T === 'o') {
                self.send({
                    url: 'authorize',
                    body: token,
                    onResponse: _ => {
                        self.ws.removeEventListener('message', onConnect)
                        res()
                    },
                    onReject: rej
                })
            }
        })
    })
}

/**
 * Send a message via an authorized WebSocket. Parameters will depend on the request.
 * ```js
 * //accounts list example
 * const mySocket = new TradovateSocket()
 * await mySocket.connect('wss://demo.tradovateapi.com/v1/websocket')
 * 
 * const [response] = await mySocket.send({url: 'account/list'})
 * console.log(response)
 * ```
 * @param {{url: string, query?: string, body?: { [k:string]: any }, onResponse?: (item: any) => void, onReject?: () => void} param0 
 * @returns {Promise<{e?: string, d?: any, i: number, s: number}>}
 */
TradovateSocket.prototype.send = async function({url, query, body, onResponse, onReject}) {
    const self = this

    return new Promise((res, rej) => {
        const id = this.increment()
        self.ws.addEventListener('message', function onEvent(msg) {
            const [_, data] = prepareMessage(msg.data)        
            data.forEach(item => {
                if(item.s === 200 && item.i === id) {  
                    if(onResponse) {
                        onResponse(item)
                    }
                    self.ws.removeEventListener('message', onEvent)
                    res(item)
                } else if(item.s && item.s !== 200 && item.i && item.i === id) {
                    console.log(item)
                    self.ws.removeEventListener('message', onEvent)
                    if(onReject) onReject()
                    rej(`\nFAILED:\n\toperation '${url}'\n\tquery ${query ? JSON.stringify(query, null, 2) : ''}\n\tbody ${body ? JSON.stringify(body, null, 2) : ''}\n\treason '${JSON.stringify(item?.d, null, 2) || 'unknown'}'`)
                } 
            })
        })
        this.ws.send(`${url}\n${id}\n${query || ''}\n${JSON.stringify(body)}`)
    })
}

/**
 * Creates a subscription to one of the real-time data endpoints. Returns a Promise of a function that when called cancels the subscription.
 * **Note: you can't cancel a user/syncrequest.**
 * ```js
 * const mySocket = new TradovateSocket()
 * await mySocket.connect('wss://demo.tradovateapi.com/v1/websocket')
 * 
 * await mySocket.subscribe({
 *     url: 'user/syncrequest',
 *     body: { users: [123456] }, //user id
 *     subscription: console.log //log the data
 * })
 * ```
 * @param {{url: 'md/getchart' | 'md/subscribedom' | 'md/subscribequote' | 'md/subscribehistogram' | 'user/syncrequest' , body: {[k:string]: any}, subscription: (item: {[k: string]: any}) => void}} param0 
 * @returns {Promise<() => void>}
 */
TradovateSocket.prototype.subscribe = async function({url, body, subscription}) {
    const self = this

    let removeListener = noop
    let cancelUrl = ''
    let cancelBody = {}
    let contractId
    
    let response = await this.send({url, body})

    if(response.d['p-ticket']) {
        await waitForMs(response.d['p-time']*1000)
        let nextResponse = await self.send({url, body: {...body, 'p-ticket': response.d['p-ticket']}})
        response = nextResponse
    }

    const realtimeId = response?.d?.realtimeId || response?.d?.subscriptionId
    if(body?.symbol && !body.symbol.startsWith('@')) {
        const contractRes = await tvGet('/contract/find', { name: body.symbol })
        contractId = contractRes?.id || null
        if(!contractId) {
            contractId = await tvGet('/contract/suggest', {name: body.symbol })[0].id
        }
    }

    if(!realtimeId && response.d && response.d.users) { //for user sync request's initial response
        subscription(response.d)
    }

    return new Promise((res, rej) => {
        
        switch(url.toLowerCase()) {
            case 'md/getchart': {
                cancelUrl = 'md/cancelChart'
                cancelBody = { subscriptionId: realtimeId }
                if(this.listeningURL !== endpoints.md) rej('Cannot subscribe to Chart Data without using the Market Data URL.')
                removeListener = self.addListener(data => {
                    if(data.d.charts) {
                        data.d.charts.forEach(chart => chart.id === realtimeId ? subscription(chart) : noop())
                    }
                })
                break
            }
            case 'md/subscribedom': {
                cancelUrl = 'md/unsubscribedom'
                cancelBody = { symbol: body.symbol }
                if(this.listeningURL !== endpoints.md) rej('Cannot subscribe to DOM Data without using the Market Data URL.')
                removeListener = self.addListener(data => {
                    if(data.d.doms) {
                        data.d.doms.forEach(dom => dom.contractId === contractId ? subscription(dom) : noop())
                    }
                })
                break
            }
            case 'md/subscribequote': {
                cancelUrl = 'md/unsubscribequote'
                cancelBody = { symbol: body.symbol }
                if(this.listeningURL !== endpoints.md) rej('Cannot subscribe to Quote Data without using the Market Data URL.')
                removeListener = self.addListener(data => {
                    if(data.d.quotes) {
                        data.d.quotes.forEach(quote => quote.contractId === contractId ? subscription(quote) : noop())
                    } 
                })
                break
            }
            case 'md/subscribehistogram': {
                cancelUrl = 'md/unsubscribehistogram'
                cancelBody = { symbol: body.symbol }
                if(this.listeningURL !== endpoints.md) rej('Cannot subscribe to Histogram Data without using the Market Data URL.')
                removeListener = self.addListener(data => {
                    if(data.d.histograms) {
                        data.d.histograms.forEach(histogram => histogram.contractId === contractId ? subscription(histogram) : noop())
                    } 
                })
                break
            }
            case 'user/syncrequest': {
                if(this.listeningURL !== endpoints.demo && url !== endpoints.live) rej('Cannot subscribe to User Data without using one of the Demo or Live URLs.')
                removeListener = self.addListener(data => {
                    if(data?.d?.users || data?.e === 'props') {
                        subscription(data.d)
                    }                         
                })
                break
            }
            default:
                rej('Incorrect URL parameters provided to subscribe.')
                break            
        }

        res(async () => {
            removeListener()
            if(cancelUrl && cancelUrl !== '') {
                await self.send({ url: cancelUrl, body: cancelBody })
            }
        })
    })
}

function checkHeartbeats(socket, curTime) {
    const now = new Date()  //time at call of onmessage
    if(now.getTime() - curTime.getTime() >= 2500) {
        socket.send('[]')   //send heartbeat
        return new Date()   //set the new base time
    }
    
    return curTime
}

function prepareMessage(raw) {
    const T = raw.slice(0, 1)
    const data = raw.length > 1 ? JSON.parse(raw.slice(1)) : []

    return [T, data]
}


const { accessToken } = await connect(credentials)



////////////////////////////////////

export default async (opts) => {
  if (opts && opts.wsBase) {
    endpoints.base = opts.wsBase
  }

  if (opts && opts.wsFutures) {
    endpoints.futures = opts.wsFutures
  }

  if (opts && opts.proxy) {
    wsOptions.proxy = opts.proxy
  }

  const syncSocket = new TradovateSocket({debugLabel: 'sync data'})

  const { accessToken, userId } = await getAccessToken(URL, credentials)

  await syncSocket.connect(WS_DEMO_URL, accessToken)

  const subscribe = await syncSocket.subscribe({
      url: 'user/syncrequest',
      body: { users: [userId] },
      subscription: item => {
          if(item.users) {
              //this is the initial response. You will get any of these fields in the response
              const { 
                  accountRiskStatuses,
                  accounts,
                  cashBalances,
                  commandReports,
                  commands,
                  contractGroups,
                  contractMaturities,
                  contracts,
                  currencies,
                  exchanges,
                  executionReports,
                  fillPairs,
                  fills,
                  marginSnapshots,
                  orderStrategies, 
                  orderStrategyLinks,
                  orderStrategyTypes,
                  orderVersions,
                  orders,
                  positions,
                  products,
                  properties,
                  spreadDefinitions,
                  userAccountAutoLiqs,
                  userPlugins,
                  userProperties,
                  userReadStatuses,
                  users        
              } = item
              console.log(`initial response:\n${JSON.stringify(item, null, 2)}`)
          } else {
              //otherwise this is a user data event, they look like this
              const { entityType, entity, eventType } = item
              console.log(`update event:\n${JSON.stringify(item, null, 2)}`)
          }
      }
  })

  return {
    subscribe
  }
}