import {
  APIGatewayProxyCallback,
  APIGatewayProxyEvent,
  Callback,
} from 'aws-lambda'
import { APIGatewayProxyResult } from 'aws-lambda/trigger/api-gateway-proxy'
import crypto from 'crypto'

require('source-map-support/register')

// noinspection JSUnusedGlobalSymbols
export const handler = (
  event: APIGatewayProxyEvent,
  _: any,
  callback: APIGatewayProxyCallback
) => {
  const sendError = createErrorSender(callback)
  if (!isValidEnv(process.env)) {
    return sendError(
      500,
      'Service was not set up properly',
      new Error(`ESA_WEBHOOK_SECRET was not set`)
    )
  }

  if (event.httpMethod !== 'POST') {
    return sendError(405, 'This endpoint only supports POST method.')
  }

  if (typeof event.body !== 'string') {
    return sendError(400, 'Body must be provided.')
  }

  const authResult = isAuthenticRequest(process.env.ESA_WEBHOOK_SECRET, event)

  if (authResult.type === 'invalid') {
    return sendError(400, `X-Esa-Signature didn't match.`, authResult.error)
  }

  const result = parseJson(event.body)
  if (result.type === 'error') {
    return sendError(400, 'Invalid JSON body.', result.error)
  }

  const webhookBody = result.data
  console.log({ webhookBody })

  callback(null, {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
}

type Env = {
  ESA_WEBHOOK_SECRET: string
}

const isValidEnv = (env: NodeJS.ProcessEnv): env is Env => {
  return typeof env.ESA_WEBHOOK_SECRET === 'string'
}

const parseJson = (
  text: string
):
  | { readonly type: 'error'; readonly error: Error }
  | { readonly type: 'ok'; readonly data: unknown } => {
  try {
    return { type: 'ok', data: JSON.parse(text) }
  } catch (error) {
    return { type: 'error', error }
  }
}

const createErrorSender = (callback: Callback<APIGatewayProxyResult>) => (
  code: number,
  message: string,
  error?: Error
) => {
  console.log(`< ${code}: ${message}`)
  if (error) console.error(error)
  callback(null, { statusCode: code, body: message })
}

const isAuthenticRequest = (
  webhookSecret: string,
  req: APIGatewayProxyEvent
):
  | { readonly type: 'valid' }
  | {
      readonly type: 'invalid'
      readonly error: Error
    } => {
  const givenSignature = req.headers['x-esa-signature'] as unknown
  if (typeof givenSignature !== 'string') {
    return {
      type: 'invalid',
      error: new Error('x-esa-signature header is required'),
    }
  }
  const calculatedSignature =
    'sha256=' +
    crypto.createHmac('sha256', webhookSecret).update(req.body!).digest('hex')
  return givenSignature === calculatedSignature
    ? {
        type: 'valid',
      }
    : {
        type: 'invalid',
        error: new Error(
          `Signatures didn't match! given: ${givenSignature}, calculated: ${calculatedSignature}`
        ),
      }
}
