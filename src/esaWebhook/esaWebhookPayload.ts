import { isObject } from '@suin/is-object'

export type Payload = PostCreate | PostUpdate | PostArchive | PostDelete

export const isPayload = (
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

  if (!kindList.includes(payload.kind as Payload['kind'])) {
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
