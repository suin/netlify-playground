import { DatocmsPosts } from './datocms/datcmsPosts'
import { createClient } from '@suin/esa-api'
import {
  createRouter,
  PostArchive,
  PostCreate,
  PostDelete,
  PostUpdate,
} from '@suin/esa-webhook-router'
import {
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  Callback,
} from 'aws-lambda'
import { index as sync } from './esaPostSync'

require('source-map-support/register')

const unpublishCategory = /^(Private|Templates|Archived)(\/.+)?$/
const itemTypePost = '248697'

export const handler: APIGatewayProxyHandler = (event, _, callback) => {
  const errors: string[] = []
  if (!isValidEnv(process.env, errors)) {
    throw new Error(errors.join(' '))
  }
  const {
    DATOCMS_FULL_ACCESS_API_TOKEN: datoToken,
    ESA_API_TOKEN: esaToken,
    ESA_WEBHOOK_SECRET: esaSecret,
  } = process.env
  const sendError = createErrorSender(callback)
  const payloadHandler = async ({
    kind,
    team: { name: team },
    post: { number },
  }: PostCreate | PostUpdate | PostArchive | PostDelete) => {
    try {
      console.log('start %o', kind)
      await sync({
        esa: createClient({ team, token: esaToken }),
        targetCms: new DatocmsPosts({ token: datoToken, itemTypePost }),
        unpublishCategory,
        team,
        number,
        logger: console.log,
      })
      console.log('finish %o', kind)
      return callback(null, { statusCode: 200, body: 'OK' })
    } catch (error) {
      return sendError(500, `Failed to create a post: ${error.message}`, error)
    }
  }
  try {
    createRouter({ secret: esaSecret })
      .on('post_create', payloadHandler)
      .on('post_update', payloadHandler)
      .on('post_archive', payloadHandler)
      .on('post_delete', payloadHandler)
      .route(event)
  } catch (error) {
    sendError(400, error.message)
  }
}

const createErrorSender = (callback: Callback<APIGatewayProxyResult>) => (
  code: number,
  message: string,
  error?: Error
): void => {
  console.log(`< ${code}: ${message}`)
  if (error) console.error(error)
  callback(null, { statusCode: code, body: message })
}

type Env = {
  readonly ESA_WEBHOOK_SECRET: string
  readonly DATOCMS_FULL_ACCESS_API_TOKEN: string
  readonly ESA_API_TOKEN: string
}

const isValidEnv = (
  env: NodeJS.ProcessEnv & Partial<Record<keyof Env, unknown>>,
  errors: string[] = []
): env is Env => {
  if (typeof env.ESA_WEBHOOK_SECRET !== 'string') {
    errors.push(`env variable ESA_WEBHOOK_SECRET is not set`)
  }
  if (typeof env.DATOCMS_FULL_ACCESS_API_TOKEN !== 'string') {
    errors.push(`env variable DATOCMS_FULL_ACCESS_API_TOKEN is not set`)
  }
  if (typeof env.ESA_API_TOKEN !== 'string') {
    errors.push(`env variable ESA_API_TOKEN is not set`)
  }
  return errors.length === 0
}
