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
import { syncEsaPost } from './esaPostSync'
import { isValidEnv } from './env'

require('source-map-support/register')

export const handler: APIGatewayProxyHandler = (event, _, callback) => {
  const errors: string[] = []
  if (!isValidEnv(process.env, errors)) {
    throw new Error(errors.join(' '))
  }
  const {
    DATOCMS_FULL_ACCESS_API_TOKEN: datoToken,
    DATOCMS_POST_ITEM_ID: itemTypePost,
    DATOCMS_BUILD_TRIGGER_ID: buildTriggerId,
    ESA_API_TOKEN: esaToken,
    ESA_WEBHOOK_SECRET: esaSecret,
    ESA_PRIVATE_CATEGORY_REGEX: privateCategoryRegex,
  } = process.env
  const privateCategory = new RegExp(privateCategoryRegex)
  const sendError = createErrorSender(callback)
  const payloadHandler = async ({
    kind,
    team: { name: team },
    post: { number },
  }: PostCreate | PostUpdate | PostArchive | PostDelete) => {
    const datocms = new DatocmsPosts({
      token: datoToken,
      itemTypePost,
      buildTriggerId,
    })
    try {
      console.log('start %o', kind)
      await syncEsaPost({
        esa: createClient({ team, token: esaToken }),
        targetCms: datocms,
        privateCategory,
        team,
        number,
        logger: console.log,
      })
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
