import {
  APIGatewayProxyCallback,
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  Callback,
} from 'aws-lambda'
import {
  isPayload,
  Payload,
  PostArchive,
  PostCreate,
  PostDelete,
  PostUpdate,
} from './esaWebhookPayload'
import { APIGatewayProxyResult } from 'aws-lambda/trigger/api-gateway-proxy'
import crypto from 'crypto'

type Handler<T extends Payload> = ({}: {
  readonly payload: T
  readonly sendError: SendError
  readonly callback: APIGatewayProxyCallback
}) => void
export type OnPostCreate = Handler<PostCreate>
export type OnPostUpdate = Handler<PostUpdate>
export type OnPostArchive = Handler<PostArchive>
export type OnPostDelete = Handler<PostDelete>

export const createEsaWebhookHandler = ({
  secret,
  onPostCreate,
  onPostUpdate,
  onPostArchive,
  onPostDelete,
}: {
  readonly secret: string
  readonly onPostCreate?: OnPostCreate
  readonly onPostUpdate?: OnPostUpdate
  readonly onPostArchive?: OnPostArchive
  readonly onPostDelete?: OnPostDelete
}): APIGatewayProxyHandler => {
  return (event, _, callback) => {
    const sendError = createErrorSender(callback)

    if (event.httpMethod !== 'POST') {
      return sendError(405, 'This endpoint only supports POST method.')
    }

    if (typeof event.body !== 'string') {
      return sendError(400, 'Body must be provided.')
    }

    const authResult = isAuthenticRequest(secret, event)

    if (authResult.type === 'invalid') {
      return sendError(400, `X-Esa-Signature didn't match.`, authResult.error)
    }

    const result = parseJson(event.body)
    if (result.type === 'error') {
      return sendError(400, 'Invalid JSON body.', result.error)
    }

    const payload = result.data

    const errors: string[] = []
    if (!isPayload(payload, errors)) {
      return sendError(400, errors.join(' '))
    }

    switch (payload.kind) {
      case 'post_create':
        onPostCreate && onPostCreate({ payload, sendError, callback })
        break
      case 'post_update':
        onPostUpdate && onPostUpdate({ payload, sendError, callback })
        break
      case 'post_archive':
        onPostArchive && onPostArchive({ payload, sendError, callback })
        break
      case 'post_delete':
        onPostDelete && onPostDelete({ payload, sendError, callback })
        break
    }
  }
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

export type SendError = (code: number, message: string, error?: Error) => void

const createErrorSender = (
  callback: Callback<APIGatewayProxyResult>
): SendError => (code, message, error) => {
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
