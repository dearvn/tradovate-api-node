import './common'

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


export default async (opts) => {
  
  const endpoints = {
    httpDemo: (opts && opts.httpDemo) || DEMO_URL,
    httpLive: (opts && opts.httpLive) || LIVE_URL,
  }

  const token = await connect({ ...opts, endpoints })

  const params = {...opts, token: token}

  const privGet = await tvGet({ ...params, endpoints })
  const privPost = await tvPost({ ...params, endpoints })
  
  return {
    accountList: async () => await accountList(privGet, '/account/list'),
    orderList: async () => await privGet('/order/list'),
    placeOrder: async (payload) => await placeOrder(privPost, payload, '/order/placeorder'),
  }
}