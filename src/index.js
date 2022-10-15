import httpMethods from 'http-client'
import wsMethods from 'websocket'

export default (opts = {}) => ({
  ...httpMethods(opts),
  ws: wsMethods(opts),
})