import {
  APIGatewayProxyCallback,
  APIGatewayProxyEvent,
  Callback,
} from 'aws-lambda'
import { APIGatewayProxyResult } from 'aws-lambda/trigger/api-gateway-proxy'
import crypto from 'crypto'
import { isObject } from '@suin/is-object'

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

  const payload = result.data

  const errors: string[] = []
  if (!isPayload(payload, errors)) {
    return sendError(400, errors.join(' '))
  }

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

export type Payload = PostCreate | PostUpdate | PostArchive | PostDelete

const isPayload = (
  payload: unknown,
  errors: string[] = []
): payload is Payload => {
  if (!isObject<Payload>(payload)) {
    errors.push('The payload is not an type object.')
    return false
  }
  if (typeof payload.kind !== 'string') {
    errors.push('The `kind` is not type string.')
    return false
  }

  if (!kindList.includes(payload.kind as Kind)) {
    errors.push(
      `The \`kind\` value ${JSON.stringify(payload.kind)} is not supported.`
    )
    return false
  }
  return true
}

const kindMap = {
  postCreate: 'post_create',
  postUpdate: 'post_update',
  postArchive: 'post_archive',
  postDelete: 'post_delete',
} as const

const kindList = Object.values(kindMap)

type Kind = Payload['kind']

export interface PostCreate {
  readonly kind: typeof kindMap.postCreate
  readonly team: Team
  readonly post: Post
  readonly user: User
}

export interface PostUpdate {
  readonly kind: typeof kindMap.postUpdate
  readonly team: Team
  readonly post: PostWithDiff
  readonly user: User
}

export interface PostArchive {
  readonly kind: typeof kindMap.postArchive
  readonly team: Team
  readonly post: Post
  readonly user: User
}

export interface PostDelete {
  readonly kind: typeof kindMap.postDelete
  readonly team: Team
  readonly post: DeletedPost
  readonly user: User
}

export interface Team {
  readonly name: string
}

export interface Post {
  readonly name: string
  readonly body_md: string
  readonly body_html: string
  readonly message: string
  readonly wip: boolean
  readonly number: number
  readonly url: string
}

export interface User {
  readonly icon: Icon
  readonly name: string
  readonly screen_name: string
}

export interface Icon {
  readonly url: string
  readonly thumb_s: Thumb
  readonly thumb_ms: Thumb
  readonly thumb_m: Thumb
  readonly thumb_l: Thumb
}

export interface Thumb {
  readonly url: string
}

export interface PostWithDiff extends Post {
  readonly diff_url: string
}

export interface DeletedPost {
  readonly name: string
  readonly wip: boolean
  readonly number: number
}
