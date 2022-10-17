// tslint:disable:interface-name
declare module 'tradovate-api-node' {
    export default function(options?: {
        env?:        string,
        name?:       string,
        password?:   string,
        appId?:      string,
        appVersion?: string,
        cid?:        string,
        sec?:        string

        httpDemo?: string
        httpLive?: string
        wsMd?: string
        wsDemo?: string
        wsLive?: string
        proxy?: string
    }): Tradovate
  
    export interface Account {
        id: number,
        name: string,
        userId: number,
        accountType: string,
        active: boolean,
        clearingHouseId: number,
        riskCategoryId: number,
        autoLiqProfileId: number,
        marginAccountType: string,
        legalStatus: string,
        timestamp: string,
        readonly: boolean
    }
    
    export type booleanString = 'true' | 'false'
    export interface GetInfo {

    }

    export interface Tradovate {
      getInfo(): GetInfo
      accountList(): Promise<Account>
      orderList(options: {}): Promise<QueryOrderResult[]>
      placeOrder(options: NewOrder): Promise<Order>
    }
  
    export interface HttpError extends Error {
      code: number
      url: string
    }
  
    export interface WebSocket {
      subscribe: (
        _id: string | string[],
        interval: number,
        total: number,
        callback: (ticker: string, interval: number) => void,
      ) => ReconnectingWebSocketHandler
      
    }
  
    export type WebSocketCloseOptions = {
      delay: number
      fastClose: boolean
      keepClosed: boolean
    }
  
    export type ReconnectingWebSocketHandler = (options?: WebSocketCloseOptions) => void
  
    export interface NewOrderParent {
      symbol: string
      side: OrderSide_LT
      type: OrderType_LT
      newClientOrderId?: string
      newOrderRespType?: NewOrderRespType_LT
      recvWindow?: number
      timeInForce?: TimeInForce_LT
      useServerTime?: boolean
    }
  
    export interface NewOrderMarketBase extends NewOrderParent {
      type: OrderType.MARKET
      quantity: string
    }
  
    export interface NewOrderMarketQuote extends NewOrderParent {
      type: OrderType.MARKET
      quoteOrderQty: string
    }
  
    export interface NewOrderLimit extends NewOrderParent {
      type: OrderType.LIMIT
      quantity: string
      price: string
      icebergQty?: string
    }
  
    export interface NewOrderSL extends NewOrderParent {
      type: OrderType.STOP_LOSS_LIMIT | OrderType.TAKE_PROFIT_LIMIT
      quantity: string
      price: string
      stopPrice: string
      icebertQty?: string
    }
  
    export type NewOrder = NewOrderMarketBase | NewOrderMarketQuote | NewOrderLimit | NewOrderSL
  
  
    export interface OrderFill {
      tradeId: number
      price: string
      qty: string
      commission: string
      commissionAsset: string
    }
  
    export interface Order {
      clientOrderId: string
      cummulativeQuoteQty: string
      executedQty: string
      fills?: OrderFill[]
      icebergQty?: string
      isIsolated?: boolean
      isWorking: boolean
      orderId: number
      orderListId: number
      origQty: string
      price: string
      side: OrderSide_LT
      status: OrderStatus_LT
      stopPrice?: string
      symbol: string
      time: number
      timeInForce: TimeInForce_LT
      transactTime?: number
      type: OrderType_LT
      updateTime: number
    }
  
  
    export type ListOrderStatus_LT = 'EXECUTING' | 'ALL_DONE' | 'REJECT'
  
    export const enum ListOrderStatus {
      EXECUTING = 'EXECUTING',
      ALL_DONE = 'ALL_DONE',
      REJECT = 'REJECT',
    }
  
    export type ListStatusType_LT = 'RESPONSE' | 'EXEC_STARTED' | 'ALL_DONE'
  
    export const enum ListStatusType {
      RESPONSE = 'RESPONSE',
      EXEC_STARTED = 'EXEC_STARTED',
      ALL_DONE = 'ALL_DONE',
    }
  
    export type OcoOrderType_LT = 'OCO'
  
    export const enum OcoOrderType {
      CONTINGENCY_TYPE = 'OCO',
    }
  
    export interface OcoOrder {
      orderListId: number
      contingencyType: OcoOrderType.CONTINGENCY_TYPE
      listStatusType: ListStatusType_LT
      listOrderStatus: ListOrderStatus_LT
      listClientOrderId: string
      transactionTime: number
      symbol: string
      orders: Order[]
      orderReports: Order[]
    }
  
    export type OrderSide_LT = 'BUY' | 'SELL'
  
    export const enum OrderSide {
      BUY = 'BUY',
      SELL = 'SELL',
    }
  
    export type OrderStatus_LT =
      | 'CANCELED'
      | 'EXPIRED'
      | 'FILLED'
      | 'NEW'
      | 'PARTIALLY_FILLED'
      | 'PENDING_CANCEL'
      | 'REJECTED'
  
    export const enum OrderStatus {
      CANCELED = 'CANCELED',
      EXPIRED = 'EXPIRED',
      FILLED = 'FILLED',
      NEW = 'NEW',
      PARTIALLY_FILLED = 'PARTIALLY_FILLED',
      PENDING_CANCEL = 'PENDING_CANCEL',
      REJECTED = 'REJECTED',
    }
  
    export type OrderType_LT =
      | 'LIMIT'
      | 'LIMIT_MAKER'
      | 'MARKET'
      | 'STOP'
      | 'STOP_MARKET'
      | 'STOP_LOSS_LIMIT'
      | 'TAKE_PROFIT_LIMIT'
      | 'TAKE_PROFIT_MARKET'
      | 'TRAILING_STOP_MARKET'
  
    export type FuturesOrderType_LT =
      | 'LIMIT'
      | 'MARKET'
      | 'STOP'
      | 'TAKE_PROFIT'
      | 'STOP_MARKET'
      | 'TAKE_PROFIT_MARKET'
      | 'TRAILING_STOP_MARKET'
  
    export const enum OrderType {
      LIMIT = 'LIMIT',
      LIMIT_MAKER = 'LIMIT_MAKER',
      MARKET = 'MARKET',
      STOP = 'STOP',
      STOP_MARKET = 'STOP_MARKET',
      STOP_LOSS_LIMIT = 'STOP_LOSS_LIMIT',
      TAKE_PROFIT_LIMIT = 'TAKE_PROFIT_LIMIT',
      TAKE_PROFIT_MARKET = 'TAKE_PROFIT_MARKET',
      TRAILING_STOP_MARKET = 'TRAILING_STOP_MARKET',
    }
  
    export type NewOrderRespType_LT = 'ACK' | 'RESULT' | 'FULL'
  
    export const enum NewOrderRespType {
      ACK = 'ACK',
      RESULT = 'RESULT',
      FULL = 'FULL',
    }
  
    export type TimeInForce_LT = 'GTC' | 'IOC' | 'FOK'
  
    export const enum TimeInForce {
      GTC = 'GTC',
      IOC = 'IOC',
      FOK = 'FOK',
    }
  
    export type OrderRejectReason_LT =
      | 'ACCOUNT_CANNOT_SETTLE'
      | 'ACCOUNT_INACTIVE'
      | 'DUPLICATE_ORDER'
      | 'INSUFFICIENT_BALANCE'
      | 'MARKET_CLOSED'
      | 'NONE'
      | 'ORDER_WOULD_TRIGGER_IMMEDIATELY'
      | 'PRICE_QTY_EXCEED_HARD_LIMITS'
      | 'UNKNOWN_ACCOUNT'
      | 'UNKNOWN_INSTRUMENT'
      | 'UNKNOWN_ORDER'
  
    export const enum OrderRejectReason {
      ACCOUNT_CANNOT_SETTLE = 'ACCOUNT_CANNOT_SETTLE',
      ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
      DUPLICATE_ORDER = 'DUPLICATE_ORDER',
      INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
      MARKET_CLOSED = 'MARKET_CLOSED',
      NONE = 'NONE',
      ORDER_WOULD_TRIGGER_IMMEDIATELY = 'ORDER_WOULD_TRIGGER_IMMEDIATELY',
      PRICE_QTY_EXCEED_HARD_LIMITS = 'PRICE_QTY_EXCEED_HARD_LIMITS',
      UNKNOWN_ACCOUNT = 'UNKNOWN_ACCOUNT',
      UNKNOWN_INSTRUMENT = 'UNKNOWN_INSTRUMENT',
      UNKNOWN_ORDER = 'UNKNOWN_ORDER',
    }
  
    export type ExecutionType_LT = 'NEW' | 'CANCELED' | 'REPLACED' | 'REJECTED' | 'TRADE' | 'EXPIRED'
  
    export const enum ExecutionType {
      NEW = 'NEW',
      CANCELED = 'CANCELED',
      REPLACED = 'REPLACED',
      REJECTED = 'REJECTED',
      TRADE = 'TRADE',
      EXPIRED = 'EXPIRED',
    }
  
  
    export interface Ticker {
      eventType: string
      eventTime: number
      symbol: string
      priceChange: string
      priceChangePercent: string
      weightedAvg: string
      prevDayClose: string
      curDayClose: string
      closeTradeQuantity: string
      bestBid: string
      bestBidQnt: string
      bestAsk: string
      bestAskQnt: string
      open: string
      high: string
      low: string
      volume: string
      volumeQuote: string
      openTime: number
      closeTime: number
      firstTradeId: number
      lastTradeId: number
      totalTrades: number
    }
  
  
    export interface Candle {
      eventType: string
      eventTime: number
      symbol: string
      startTime: number
      closeTime: number
      firstTradeId: number
      lastTradeId: number
      open: string
      high: string
      low: string
      close: string
      volume: string
      trades: number
      interval: string
      isFinal: boolean
      quoteVolume: string
      buyVolume: string
      quoteBuyVolume: string
    }
  
    export interface Trade {
      eventType: string
      eventTime: number
      symbol: string
      price: string
      quantity: string
      maker: boolean
      isBuyerMaker: boolean
      tradeId: number
    }
  
    export interface WSTrade extends Trade {
      tradeTime: number
      buyerOrderId: number
      sellerOrderId: number
    }
  
  
    export type EventType_LT =
      | 'account'
  
  
    export interface BalanceUpdate {
      asset: string
      balanceDelta: string
      clearTime: number
      eventTime: number
      eventType: 'balanceUpdate'
    }
  
  
    export interface Balance {
      asset: string
      walletBalance: string
      crossWalletBalance: string
      balanceChange: string
    }
  
    export interface Position {
      symbol: string
      positionAmount: string
      entryPrice: string
      accumulatedRealized: string
      unrealizedPnL: string
      marginType: 'isolated' | 'cross'
      isolatedWallet: string
      positionSide: PositionSide_LT
    }
  
    export type EventReasonType =
      | 'ORDER'
    
    export interface QueryOrderResult {
      clientOrderId: string
      cummulativeQuoteQty: string
      executedQty: string
      icebergQty: string
      isWorking: boolean
      orderId: number
      orderListId: number
      origQty: string
      origQuoteOrderQty: string
      price: string
      side: OrderSide_LT
      status: OrderStatus_LT
      stopPrice: string
      symbol: string
      time: number
      timeInForce: TimeInForce_LT
      type: OrderType_LT
      updateTime: number
    }
  
    
  
    export interface CancelOrderResult {
      symbol: string
      origClientOrderId: string
      orderId: number
      orderListId: number
      clientOrderId: string
      price: string
      origQty: string
      executedQty: string
      cummulativeQuoteQty: string
      status: string
      timeInForce: string
      type: OrderType_LT
      side: OrderSide_LT
    }
  
    export interface CandleChartResult {
      openTime: number
      open: string
      high: string
      low: string
      close: string
      volume: string
      closeTime: number
      quoteVolume: string
      trades: number
      baseAssetVolume: string
      quoteAssetVolume: string
    }
  
  }