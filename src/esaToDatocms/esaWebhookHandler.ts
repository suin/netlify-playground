import {
  createEsaWebhookHandler,
  OnPostCreate,
  OnPostUpdate,
} from '../esaWebhook/createEsaWebhookHandler'
import { Dato } from '../datocms/dato'
import { createClient } from '@suin/esa-api'

require('source-map-support/register')

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

const errors: string[] = []
if (!isValidEnv(process.env, errors)) {
  throw new Error(errors.join(' '))
}

const env: Env = process.env

const dato = new Dato({
  token: process.env.DATOCMS_FULL_ACCESS_API_TOKEN,
  itemTypePost: '248697',
})

const onPostCreate: OnPostCreate = async ({ payload, callback, sendError }) => {
  const esa = createClient({
    team: payload.team.name,
    token: env.ESA_API_TOKEN,
  })
  try {
    console.log('Creating a new post record...')
    const { post } = await esa.getPost(payload.post.number)
    console.log('esa post fetched: %o', post)
    const author = await dato.getAuthorByEsaUsername(
      post.created_by.screen_name
    )
    console.log('author detected: %o', author)
    const createdPost = await dato.createPost({
      slug: post.number.toString(),
      title: post.name,
      subtitle: '', // todo
      author,
      date: post.created_at, // todo
      tags: JSON.stringify(post.tags),
      body: post.body_html,
      bodySource: post.body_md,
      dataSource: post.url,
      seo: {}, // todo
    })
    console.log('Created DatoCMS Post content: %o', createdPost.id)
    return callback(null, { statusCode: 200, body: 'OK' })
  } catch (e) {
    return sendError(500, `Failed to create a post: ${e.message}`, e)
  }
}

const onPostUpdate: OnPostUpdate = async ({ callback, sendError }) => {
  try {
    // const esa = createClient({
    //   team: payload.team.name,
    //   token: env.ESA_API_TOKEN,
    // })
    // const { post } = await esa.getPost(payload.post.number)
    // const previousPost = await dato.getPostByDataSource(post.url)
    // const updatedPost = await dato.updatePost(previousPost.id, {
    //   title: post.name,
    //   subtitle: '', // todo
    //   tags: JSON.stringify(post.tags),
    //   body: post.body_html,
    //   bodySource: post.body_md,
    //   seo: {}, // todo
    // })
    // console.log('Post updated: %o', updatedPost)
    return callback(null, { statusCode: 200, body: 'OK' })
  } catch (e) {
    return sendError(500, `Failed to create a post: ${e.message}`, e)
  }
}

export const esaWebhookHandler = createEsaWebhookHandler({
  secret: process.env.ESA_WEBHOOK_SECRET,
  onPostCreate,
  onPostUpdate,
  onPostArchive: ({ callback }) => {
    return callback(null, { statusCode: 200, body: 'OK' })
  },
  onPostDelete: ({ callback }) => {
    return callback(null, { statusCode: 200, body: 'OK' })
  },
})
