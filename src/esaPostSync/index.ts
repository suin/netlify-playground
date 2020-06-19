export const index = async ({
  esa,
  targetCms,
  unpublishCategory,
  team,
  number,
  logger: log = () => {},
}: {
  readonly esa: Esa
  readonly targetCms: TargetCms
  readonly unpublishCategory: RegExp
  readonly team: string
  readonly number: number
  readonly logger?: (message?: any, ...args: any[]) => any
}): Promise<void> => {
  const esaPostUrl = `https://${team}.esa.io/posts/${number}`

  log('finding the target post of %o ...', esaPostUrl)
  let targetPostId = await targetCms.getPostIdByEsaPostUrl(esaPostUrl)
  if (typeof targetPostId === 'string') {
    log('target post found: %o', targetPostId)
  } else {
    log('target post not created yet')
  }

  log('fetching esa post data of %o ...', { team, number })
  const { post: esaPost } = await esa.getPost(number)
  if (!esaPost) {
    log('esa post not found: %o', number)
    if (typeof targetPostId === 'string') {
      log('deleting target post %o ...', targetPostId)
      await targetCms.deletePost(targetPostId)
      log('target post deleted: %o', targetPostId)
    }
    return
  }

  log('finding the author for %o ...', esaPost.created_by.screen_name)
  const author = await targetCms.getAuthorIdByEsaUsername(
    esaPost.created_by.screen_name
  )
  log('assigned author: %o', author)

  if (typeof targetPostId === 'string') {
    log('updating the target post %o ...', targetPostId)
    await targetCms.updatePost(targetPostId, {
      title: esaPost.name,
      subtitle: '', // todo
      tags: esaPost.tags,
      body: esaPost.body_html,
      bodySource: esaPost.body_md,
      seo: {}, // todo
    })
    log('target post updated: %o', targetPostId)
  } else {
    log('creating new target post...')
    targetPostId = await targetCms.createPost({
      slug: esaPost.number.toString(),
      title: esaPost.name,
      subtitle: '', // todo
      author: author.authorId,
      date: esaPost.created_at,
      tags: esaPost.tags,
      body: esaPost.body_html,
      bodySource: esaPost.body_md,
      sourceUrl: esaPostUrl,
      seo: {}, // todo
    })
    log('target post created: %o', targetPostId)
  }

  // publishment decision
  log('deciding publishment...')
  let publishes = true
  if (esaPost.wip) {
    publishes = false
    log('esaPost.wip is true: %o', targetPostId)
  }
  if (typeof esaPost.category !== 'string') {
    publishes = false
    log('esaPost.category belongs to root: %o', { publishes })
  } else if (unpublishCategory.test(esaPost.category)) {
    publishes = false
    log('esaPost.category belongs to unpublishCategory: %o', {
      publishes,
      unpublishCategory,
    })
  }
  if (esaPost.name.startsWith('WIP:')) {
    publishes = false
    log('esaPost.name starts with `WIP:`: %o', {
      publishes,
      name: esaPost.name,
    })
  }
  if (author.authorType === 'unknown') {
    publishes = false
    log('author is unknown: %o', { publishes })
  }
  if (publishes) {
    log('publishing the target post %o ...', targetPostId)
    await targetCms.publishPost(targetPostId)
    log('target post published: %o', targetPostId)
  } else {
    log('unpublishing the target post %o ...', targetPostId)
    await targetCms.unpublishPost(targetPostId)
    log('target post unpublished: %o', targetPostId)
  }
}

export interface Esa {
  getPost(
    number: number
  ): Promise<{
    readonly team: string
    readonly post?: {
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
  }>
}

export interface TargetCms {
  getPostIdByEsaPostUrl(esaPostUrl: string): Promise<string | undefined>

  getAuthorIdByEsaUsername(
    esaUsername: string
  ): Promise<
    | { authorType: 'known'; authorId: string }
    | { authorType: 'unknown'; authorId: string }
  >

  createPost(post: TargetPost): Promise<string>

  updatePost(id: string, post: Partial<TargetPost>): Promise<void>

  publishPost(id: string): Promise<void>

  unpublishPost(id: string): Promise<void>

  deletePost(id: string): Promise<void>
}

export type TargetPost = {
  readonly slug: string
  readonly title: string
  readonly subtitle: string
  readonly author: string
  readonly date: string
  readonly tags: ReadonlyArray<string>
  readonly body: string
  readonly bodySource: string
  readonly sourceUrl: string
  readonly seo: {
    readonly title?: string
    readonly description?: string
  }
}
