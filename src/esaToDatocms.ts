import { Dato } from './datocms/dato'
import { createClient } from '@suin/esa-api'
import { createRouter } from '@suin/esa-webhook-router'
import {
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  Callback,
} from 'aws-lambda'

require('source-map-support/register')

export const handler: APIGatewayProxyHandler = (event, _, callback) => {
  const env = process.env
  const errors: string[] = []
  if (!isValidEnv(env, errors)) {
    throw new Error(errors.join(' '))
  }

  const dato = new Dato({
    token: env.DATOCMS_FULL_ACCESS_API_TOKEN,
    itemTypePost: '248697',
  })

  const sendError = createErrorSender(callback)

  const router = createRouter({ secret: env.ESA_WEBHOOK_SECRET })

  router.on('post_create', async payload => {
    try {
      const esa = createClient({
        team: payload.team.name,
        token: env.ESA_API_TOKEN,
      })
      console.log('creating a new post record...')
      const { post } = await esa.getPost(payload.post.number)
      console.log('esa post fetched: %o', post.number)
      const author = await dato.getAuthorByEsaUsername(
        post.created_by.screen_name
      )
      console.log('author detected: %o', author)
      console.log('creating DatoCMS post...')
      const createdPost = await dato.createPost({
        slug: post.number.toString(),
        title: post.name,
        subtitle: '', // todo
        author,
        date: post.created_at,
        tags: JSON.stringify(post.tags),
        body: post.body_html,
        bodySource: post.body_md,
        dataSource: post.url,
        seo: {}, // todo
      })
      console.log('DatoCMS post created: %o', createdPost.id)
      if (author.type === 'fallbackAuthor') {
        console.log(
          'DatoCMS post was not published, since the author is unknown'
        )
      } else if (post.wip) {
        console.log('DatoCMS post was not published, since the post is wip')
      } else {
        console.log('publishing DatoCMS post...')
        await dato.publishPost(createdPost.id)
        console.log('DatoCMS post published')
      }
      console.log('done')
      return callback(null, { statusCode: 200, body: 'OK' })
    } catch (e) {
      return sendError(500, `Failed to create a post: ${e.message}`, e)
    }
  })

  router.on('post_update', async payload => {
    try {
      const esa = createClient({
        team: payload.team.name,
        token: env.ESA_API_TOKEN,
      })
      console.log('updating a post record...')
      const { post } = await esa.getPost(payload.post.number)
      const previousPost = await dato.getPostByDataSource(post.url)
      const updatedPost = await dato.updatePost(previousPost.id, {
        title: post.name,
        subtitle: '', // todo
        tags: JSON.stringify(post.tags),
        body: post.body_html,
        bodySource: post.body_md,
        seo: {}, // todo
      })
      console.log('Post updated: %o', updatedPost.id)
      if (post.wip) {
        console.log('DatoCMS post was not published, since the post is wip')
      } else {
        console.log('publishing DatoCMS post...')
        await dato.publishPost(updatedPost.id)
        console.log('DatoCMS post published')
      }
      return callback(null, { statusCode: 200, body: 'OK' })
    } catch (e) {
      return sendError(500, `Failed to create a post: ${e.message}`, e)
    }
  })

  router.on('post_archive', async payload => {
    try {
      const esa = createClient({
        team: payload.team.name,
        token: env.ESA_API_TOKEN,
      })
      console.log('archiving a post record...')
      const { post } = await esa.getPost(payload.post.number)
      const previousPost = await dato.getPostByDataSource(post.url)
      const updatedPost = await dato.updatePost(previousPost.id, {
        title: post.name,
        subtitle: '', // todo
        tags: JSON.stringify(post.tags),
        body: post.body_html,
        bodySource: post.body_md,
        seo: {}, // todo
      })
      console.log('Post updated: %o', updatedPost.id)
      console.log('unpublishing DatoCMS post, since the post was archived...')
      await dato.unpublishPost(updatedPost.id)
      console.log('DatoCMS post unpublished')
      return callback(null, { statusCode: 200, body: 'OK' })
    } catch (e) {
      return sendError(500, `Failed to create a post: ${e.message}`, e)
    }
  })

  router.on('post_delete', async payload => {
    try {
      console.log('deleting a post record...')
      const previousPost = await dato.getPostByDataSource(
        `https://${payload.team.name}.esa.io/posts/${payload.post.number}`
      )
      await dato.deleteItem(previousPost.id)
      console.log('Post deleted: %o', previousPost.id)
      return callback(null, { statusCode: 200, body: 'OK' })
    } catch (e) {
      return sendError(500, `Failed to create a post: ${e.message}`, e)
    }
  })

  try {
    router.route(event)
  } catch (e) {
    callback(null, {
      statusCode: 400,
      headers: { 'content-type': 'text/plain' },
      body: e.message,
    })
  }
}

const createErrorSender = (
  callback: Callback<APIGatewayProxyResult>
): SendError => (code, message, error) => {
  console.log(`< ${code}: ${message}`)
  if (error) console.error(error)
  callback(null, { statusCode: code, body: message })
}

type SendError = (code: number, message: string, error?: Error) => void

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
