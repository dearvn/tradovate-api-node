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


const account_list = async (privGet, url) => {
  console.log(">>>>>>>>>>>>>>>accountList:", url)
  const accounts = await privGet(url, {'test':'ok'})

  console.log("+++++++++++++++++++accounts:", accounts)

  setAvailableAccounts(accounts)

  return accounts
}

const place_order = async (privPost, payload, url) => {

  const { id, name } = getAvailableAccounts()[0]

  const res = await privPost('/order/placeOrder', {...payload, accountId: id, accountSpec: name})

  return res
}

const info = {
  tickers: ['NQZ2']
}

export default async (opts) => {
  
  const endpoints = {
    httpDemo: (opts && opts.httpDemo) || DEMO_URL,
    httpLive: (opts && opts.httpLive) || LIVE_URL,
  }

  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>http-client")
  const token = await connect({ ...opts, endpoints })

  const params = {...opts, token: token}

  const privGet = await tvGet({ ...params, endpoints })
  const privPost = await tvPost({ ...params, endpoints })
  
  //const account = await accountList(privGet, '/account/list')

  //console.log("===============", account)

  return {
    getInfo: () => info,
    accountList: async () => await account_list(privGet, '/account/list'),
    orderList: async () => await privGet('/order/list'),
    placeOrder: async (payload) => await place_order(privPost, payload, '/order/placeorder'),
  }
}