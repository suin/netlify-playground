declare module 'datocms-client' {
  declare class SiteClient {
    constructor(token: string)

    readonly items: Items
  }

  interface Items {
    create<T extends Record>(
      item: Readonly<{ itemType: string } & Omit<T, 'id'>>
    ): Promise<Item<T>>

    update<T extends Record>(
      itemId: string,
      record: Readonly<Partial<Omit<T, 'id'>>>
    ): Promise<Item<T>>

    publish<T extends Record>(itemId: string): Promise<T>

    unpublish<T extends Record>(itemId: string): Promise<T>

    destroy<T extends Record>(itemId): Promise<T>
  }

  type Item<T extends Record> = T & {
    id: string
    type: string
    attributes: {
      [k: string]: unknown
    }
    relationships: {
      item_type: {
        data: {
          type: string
          id: string
        }
      }
      creator: {
        data: {
          type: string
          id: string
        }
      }
    }
    meta: {
      created_at: string
      updated_at: string
      published_at: null | string
      first_published_at: null | string
      publication_scheduled_at: null | string
      status: null | 'draft' | 'updated' | 'published'
      is_valid: boolean
      current_version: string
    }
  }

  type Record = {
    [k: string]: any
  }

  type Meta = {
    status?: 'published' | 'draft'
  }
}
