import { ApolloClient } from 'apollo-client'
import { createHttpLink } from 'apollo-link-http'
import { setContext } from 'apollo-link-context'
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory'
import gql from 'graphql-tag'
import fetch from 'node-fetch'
import { SiteClient } from 'datocms-client'

export class Dato {
  private readonly cda: ApolloClient<NormalizedCacheObject>
  private readonly cma: SiteClient
  private readonly itemTypePost: string

  constructor({
    token,
    itemTypePost,
  }: {
    readonly token: string
    readonly itemTypePost: string
  }) {
    this.cda = createClient(token)
    this.cma = new SiteClient(token)
    this.itemTypePost = itemTypePost
  }

  async createPost({
    slug,
    title,
    subtitle,
    date,
    tags,
    body,
    bodySource,
    dataSource,
    author,
    seo,
  }: {
    readonly author: Author
  } & Readonly<Omit<Post, 'id' | 'author'>>): Promise<Post> {
    return this.cma.items.create<Post>({
      itemType: this.itemTypePost,
      slug,
      title,
      subtitle,
      author: author.id,
      date,
      tags,
      body,
      bodySource,
      dataSource,
      seo,
    })
  }

  async publishPost(postId: string): Promise<Post> {
    return this.cma.items.publish(postId)
  }

  async unpublishPost(postId: string): Promise<Post> {
    return this.cma.items.unpublish(postId)
  }

  async getPostByDataSource(dataSource: string): Promise<Post | undefined> {
    const result = await this.cda.query({
      query: gql`
        {
          allPosts(
            filter: { dataSource: { eq: "${dataSource}" } }
          ) {
            id
            title
          }
        }
      `,
    })
    const allPosts = result?.data?.allPosts ?? []
    return allPosts.length > 0 ? allPosts[0] : undefined
  }

  async updatePost(
    id: string,
    record: Partial<Omit<Post, 'id'>>
  ): Promise<Post> {
    return this.cma.items.update<Post>(id, record)
  }

  async deleteItem(id: string): Promise<void> {
    await this.cma.items.destroy(id)
  }

  async getAuthorByEsaUsername(esaUsername: string): Promise<Author> {
    const result = await this.cda.query({
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
      ? { type: 'author', id: author.id }
      : { type: 'fallbackAuthor', id: fallbackAuthor.id }
  }
}

export type Author = {
  readonly type: 'author' | 'fallbackAuthor'
  readonly id: string
}

export interface Post {
  id: string
  slug: string
  title: string
  subtitle: string
  author: string
  date: string
  tags: string | '[]'
  body: string
  bodySource: string
  dataSource: string
  seo: {
    title?: string
    description?: string
  }
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
