import { createClient, Post, PostsPayload } from '@suin/esa-api'
import { DatocmsPosts } from './datocms/datcmsPosts'
import { syncEsaPost } from './esaPostSync'
import { isValidEnv } from './env'
import { GetPostsParameters } from '@suin/esa-api/index'
import { APIGatewayProxyHandler } from 'aws-lambda'

/// <reference types="../types/datocms-client" />

const errors: string[] = []
if (!isValidEnv(process.env, errors)) {
  throw new Error(errors.join(' '))
}

const {
  DATOCMS_FULL_ACCESS_API_TOKEN: datoToken,
  DATOCMS_POST_ITEM_ID: itemTypePost,
  ESA_API_TOKEN: esaToken,
  ESA_TEAM: team,
  ESA_PRIVATE_CATEGORY_REGEX: privateCategoryRegex,
} = process.env
const privateCategory = new RegExp(privateCategoryRegex)

const esa = createClient({ team, token: esaToken })
const dato = new DatocmsPosts({ token: datoToken, itemTypePost })

async function* getAllPosts(params: GetPostsParameters): AsyncGenerator<Post> {
  let page: number | null = 1
  while (typeof page === 'number') {
    const { posts, next_page }: PostsPayload = await esa.getPosts({
      ...params,
      page,
      per_page: 100,
    })
    for (const post of posts) {
      yield post
    }
    page = next_page
  }
}

const syncAll = async (): Promise<void> => {
  for await (const post of getAllPosts({ sort: 'number', order: 'asc' })) {
    console.group('%o %o', post.number, post.name)
    try {
      await syncEsaPost({
        esa,
        targetCms: dato,
        privateCategory,
        team,
        number: post.number,
        logger: console.log,
        esaPost: post,
      })
    } finally {
      console.groupEnd()
    }
  }
}

export const handler: APIGatewayProxyHandler = async () => {
  try {
    await syncAll()
  } catch (e) {
    console.error(e)
    return { statusCode: 500, body: e.message }
  }
  return { statusCode: 200, body: 'done' }
}
