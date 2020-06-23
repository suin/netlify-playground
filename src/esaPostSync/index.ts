import { formatISO } from 'date-fns'

export const syncEsaPost = async ({
  esa,
  targetCms,
  privateCategory,
  team,
  number,
  logger: log = () => {},
  esaPost,
  createPost = {},
  getDate = () => new Date(),
  preventDeploy = false,
}: {
  readonly esa: Esa
  readonly targetCms: TargetCms
  /**
   * regular expression to match esa post category.
   *
   * A post that matches this pattern will not be uploaded to the target CMS.
   */
  readonly privateCategory: RegExp
  /**
   * esa team name
   */
  readonly team: string
  /**
   * esa post number
   */
  readonly number: number
  readonly logger?: (message?: any, ...args: any[]) => any
  readonly esaPost?: EsaPost
  readonly createPost?: Partial<CreatePost>
  readonly getDate?: () => Date
  readonly preventDeploy?: boolean
}): Promise<void> => {
  const esaPostUrl = `https://${team}.esa.io/posts/${number}`

  log('finding the target post of %o ...', esaPostUrl)
  let targetPostId = await targetCms.getPostIdByEsaPostUrl(esaPostUrl)
  if (typeof targetPostId === 'string') {
    log('target post found: %o', targetPostId)
  } else {
    log('target post not created yet')
  }

  if (esaPost === undefined) {
    log('fetching esa post data of %o ...', { team, number })
    const { post } = await esa.getPost(number)
    esaPost = post
  }

  // delete the target post that was deleted in esa
  if (!esaPost) {
    log('esa post not found: %o', number)
    if (typeof targetPostId === 'string') {
      log('deleting target post %o ...', targetPostId)
      await targetCms.deletePost(targetPostId)
      log('target post deleted: %o', targetPostId)
    }
    return
  }

  // delete the target post that was moved to private category
  if (
    typeof esaPost.category !== 'string' ||
    privateCategory.test(esaPost.category)
  ) {
    log(
      'esaPost.category belongs to root or private category %s',
      privateCategory
    )
    if (typeof targetPostId === 'string') {
      log('deleting target post %o ...', targetPostId)
      await targetCms.deletePost(targetPostId)
      log('target post deleted: %o', targetPostId)
    } else {
      log('target post was not created')
    }
    return
  }

  // create or update the target post
  log('detecting author username from %s ...', [
    ...esaPost.tags,
    esaPost.created_by.screen_name,
  ])
  const {
    tags,
    authorUsername = esaPost.created_by.screen_name,
  } = extractAuthorUsernameFromTags(esaPost.tags)
  log('author username detected: %o', authorUsername)

  log('finding the author for %o ...', authorUsername)
  const author = await targetCms.getAuthorIdByEsaUsername(authorUsername)
  log('assigned author: %o', author)

  if (typeof targetPostId === 'string') {
    log('updating the target post %o ...', targetPostId)
    await targetCms.updatePost(targetPostId, {
      title: esaPost.name,
      tags,
      category: esaPost.category ?? '',
      body: esaPost.body_html,
      bodySource: esaPost.body_md,
      author: author.authorId,
    })
    log('target post updated: %o', targetPostId)
  } else {
    log('creating new target post...')
    targetPostId = await targetCms.createPost({
      slug: `/posts/${esaPost.number}`,
      title: esaPost.name,
      author: author.authorId,
      date: formatISO(getDate()),
      tags,
      category: esaPost.category ?? '',
      body: esaPost.body_html,
      bodySource: esaPost.body_md,
      sourceUrl: esaPostUrl,
      seo: {},
      pathAliases: [],
      ...createPost,
    })
    log('target post created: %o', targetPostId)
  }

  // publishment decision
  log('deciding publishment...')
  let publishes = true
  if (esaPost.wip) {
    publishes = false
    log('unpublish, since esaPost.wip is true')
  }
  if (esaPost.name.startsWith('WIP:')) {
    publishes = false
    log('unpublish, since esaPost.name starts with `WIP:`: %o', esaPost.name)
  }
  if (author.authorType === 'unknown') {
    publishes = false
    log('unpublish, since the author is not registered to the target CMS')
  }
  log('should publish? %o', publishes)

  // publish or unpublish
  log('determine if the target post has been published...')
  const isPublished = await targetCms.isPostPublished(targetPostId)
  log('target post has been published? %o', isPublished)
  if (publishes && !isPublished) {
    log('publishing the target post %o ...', targetPostId)
    await targetCms.publishPost(targetPostId)
    log('target post published: %o', targetPostId)
  } else if (!publishes && isPublished) {
    log('unpublishing the target post %o ...', targetPostId)
    await targetCms.unpublishPost(targetPostId)
    log('target post unpublished: %o', targetPostId)
  }

  // deploy site
  if (preventDeploy) {
    log('deploy was prevented')
    return
  }
  log('deploying site...')
  await targetCms.deploy()
  log('deploy done')
}

export interface Esa {
  getPost(
    number: number
  ): Promise<{
    readonly team: string
    readonly post?: EsaPost
  }>
}

type EsaPost = {
  readonly number: number
  readonly name: string
  readonly tags: ReadonlyArray<string>
  readonly body_html: string
  readonly body_md: string
  readonly created_at: string
  readonly created_by: {
    readonly screen_name: string
  }
  readonly wip: boolean
  readonly category: null | string
}

export interface TargetCms {
  getPostIdByEsaPostUrl(esaPostUrl: string): Promise<string | undefined>

  getAuthorIdByEsaUsername(
    esaUsername: string
  ): Promise<
    | { authorType: 'known'; authorId: string }
    | { authorType: 'unknown'; authorId: string }
  >

  createPost(post: CreatePost): Promise<string>

  updatePost(id: string, post: UpdatePost): Promise<void>

  isPostPublished(id: string): Promise<boolean>

  publishPost(id: string): Promise<void>

  unpublishPost(id: string): Promise<void>

  deletePost(id: string): Promise<void>

  deploy(): Promise<void>
}

export type CreatePost = {
  readonly slug: string
  readonly title: string
  readonly author: string
  readonly date: string
  readonly tags: ReadonlyArray<string>
  readonly category: string
  readonly body: string
  readonly bodySource: string
  readonly sourceUrl: string
  readonly seo: {
    readonly title?: string
    readonly description?: string
  }
  readonly pathAliases: ReadonlyArray<string>
}

export type UpdatePost = Partial<
  Pick<
    CreatePost,
    'title' | 'author' | 'tags' | 'category' | 'body' | 'bodySource'
  >
>

const extractAuthorUsernameFromTags = (
  tags: EsaPost['tags']
): {
  readonly authorUsername?: string
  readonly tags: ReadonlyArray<string>
} =>
  tags.reduce<ReturnType<typeof extractAuthorUsernameFromTags>>(
    ({ authorUsername, tags }, tag) => {
      const match = tag.match(/^@([a-zA-Z0-9_-]+)$/)
      return match && typeof match[1] === 'string'
        ? { authorUsername: match[1], tags }
        : { authorUsername, tags: [...tags, tag] }
    },
    { tags: [] }
  )
