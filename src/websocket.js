import _openWebSocket from 'open-websocket'
import { setDeviceId,
    getDeviceId,
    setAvailableAccounts,
    getAvailableAccounts,
    queryAvailableAccounts,
    setAccessToken,
    getAccessToken,
    tokenIsValid,
    setUserData,
    getUserData,
    waitForMs,
    connect,
    tvGet,
    tvPost } from "./common"


const DEMO_URL = 'https://demo.tradovateapi.com/v1'
const LIVE_URL = 'https://live.tradovateapi.com/v1'
const WS_MD_URL = 'wss://md.tradovateapi.com/v1/websocket'
const WS_DEMO_URL = 'wss://demo.tradovateapi.com/v1/websocket'
const WS_LIVE_URL = 'wss://live.tradovateapi.com/v1/websocket'

const endpoints = {
    httpDemo: DEMO_URL,
    httpLive: LIVE_URL,
    wsMd: WS_MD_URL,
    wsDemo: WS_DEMO_URL,
    wsLive: WS_LIVE_URL,
}

const noop = () => {}

const wsOptions = {}

function openWebSocket(url) {
  return _openWebSocket(url, wsOptions)
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
        this.ws = _openWebSocket(url)

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
                if(this.listeningURL !== endpoints.wsMd) rej('Cannot subscribe to Chart Data without using the Market Data URL.')
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
                if(this.listeningURL !== endpoints.wsMd) rej('Cannot subscribe to DOM Data without using the Market Data URL.')
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
                if(this.listeningURL !== endpoints.wsMd) rej('Cannot subscribe to Quote Data without using the Market Data URL.')
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
                if(this.listeningURL !== endpoints.wsMd) rej('Cannot subscribe to Histogram Data without using the Market Data URL.')
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
                console.log(">>>>>>>>>>>>>>>>>>>>>websocket:", cancelUrl)
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

////////////////////////////////////

export default async (opts) => {
  
  if (opts && opts.proxy) {
    wsOptions.proxy = opts.proxy
  }

  const syncSocket = new TradovateSocket({debugLabel: 'sync data'})

  const endpoints = {
    httpDemo: (opts && opts.httpDemo) || DEMO_URL,
    httpLive: (opts && opts.httpLive) || LIVE_URL,
    wsMd: (opts && opts.wsMd) || WS_MD_URL,
    wsDemo: (opts && opts.wsDemo) || WS_DEMO_URL,
    wsLive: (opts && opts.wsLive) || WS_LIVE_URL
  }

  if (!opts.env) {
    opts.env = 'demo'
  }
  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>websocket")
  const token = await connect({ ...opts, endpoints })
  
  const userId = getUserData()['ID']

  let wsURL = opts.env === 'demo' ? endpoints.wsDemo : opts.env === 'live' ? endpoints.wsLive : ''        
    
  const params = {...opts, token: token}

  const privGet = await tvGet({ ...params, endpoints })
  const privPost = await tvPost({ ...params, endpoints })
  
  //await syncSocket.connect(endpoints.wsMd, token)

  /*const subscribe = await syncSocket.subscribe({
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
  })*/

  return {
    //subscribe
  }
}