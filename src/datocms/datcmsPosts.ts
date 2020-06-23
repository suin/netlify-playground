import { ApolloClient } from 'apollo-client'
import { createHttpLink } from 'apollo-link-http'
import { setContext } from 'apollo-link-context'
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory'
import gql from 'graphql-tag'
import fetch from 'node-fetch'
import { SiteClient } from 'datocms-client'
import { TargetCms, CreatePost, UpdatePost } from '../esaPostSync'

export class DatocmsPosts implements TargetCms {
  private readonly contentsDeliveryApi: ApolloClient<NormalizedCacheObject>
  private readonly contentsManagementApi: SiteClient
  private readonly itemTypePost: string

  constructor({
    token,
    itemTypePost,
  }: {
    readonly token: string
    readonly itemTypePost: string
  }) {
    this.contentsDeliveryApi = createClient(token)
    this.contentsManagementApi = new SiteClient(token)
    this.itemTypePost = itemTypePost
  }

  async createPost({
    slug,
    title,
    author,
    date,
    tags,
    category,
    body,
    bodySource,
    sourceUrl,
    seo,
    pathAliases,
  }: CreatePost): Promise<string> {
    const post = await this.contentsManagementApi.items.create<Post>({
      itemType: this.itemTypePost,
      slug,
      title,
      author,
      date,
      tags: JSON.stringify(tags),
      category,
      body,
      bodySource,
      sourceUrl,
      seo,
      pathAliases: JSON.stringify(pathAliases),
    })
    return post.id
  }

  async deletePost(id: string): Promise<void> {
    await this.contentsManagementApi.items.destroy(id)
  }

  async getAuthorIdByEsaUsername(
    esaUsername: string
  ): Promise<
    | { authorType: 'known'; authorId: string }
    | { authorType: 'unknown'; authorId: string }
  > {
    const result = await this.contentsDeliveryApi.query({
      query: gql`
        {
          author: author(filter: { esaUsername: { eq: "${esaUsername}" } }) {
            id
          }
          fallbackAuthor: author(filter: { name: { eq: "__fallbackAuthor" } }) {
            id
          }
        }
      `,
    })
    const { author, fallbackAuthor } = result?.data ?? {}
    return author
      ? { authorType: 'known', authorId: author.id }
      : { authorType: 'unknown', authorId: fallbackAuthor.id }
  }

  async getPostIdByEsaPostUrl(esaPostUrl: string): Promise<string | undefined> {
    const result = await this.contentsDeliveryApi.query({
      query: gql`
        {
          post(
            filter: { sourceUrl: { eq: "${esaPostUrl}" } }
          ) {
            id
          }
        }
      `,
    })
    return result?.data?.post?.id
  }

  async isPostPublished(id: string): Promise<boolean> {
    const result = await this.contentsDeliveryApi.query({
      query: gql`
        {
          post(
            filter: { id: { eq: "${id}" } }
          ) {
            _status
          }
        }
      `,
    })
    if (result?.data?.post) {
      return result?.data?.post?._status === 'published'
    } else {
      throw new Error(`Post not found: ${id}`)
    }
  }

  async publishPost(id: string): Promise<void> {
    await this.contentsManagementApi.items.publish(id)
  }

  async unpublishPost(id: string): Promise<void> {
    await this.contentsManagementApi.items.unpublish(id)
  }

  async updatePost(
    id: string,
    { title, author, tags, category, body, bodySource }: UpdatePost
  ): Promise<void> {
    await this.contentsManagementApi.items.update<Post>(id, {
      title,
      author,
      tags: JSON.stringify(tags),
      category,
      body,
      bodySource,
    })
  }

  async build(buildTriggerId: string): Promise<void> {
    return this.contentsManagementApi.buildTriggers.trigger(buildTriggerId)
  }
}

interface Post {
  id: string
  slug: string
  title: string
  author: string
  date: string
  tags: string
  category: string
  body: string
  bodySource: string
  sourceUrl: string
  seo: {
    title?: string
    description?: string
  }
  pathAliases: string
}

const createClient = (token: string) => {
  const httpLink = createHttpLink({
    uri: 'https://graphql.datocms.com/preview',
    fetch,
  })
  const authLink = setContext((_, { headers }) => {
    return {
      headers: Object.assign(headers || {}, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      }),
    }
  })
  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
  })
}
