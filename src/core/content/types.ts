export type ContentEntryStatus = 'draft' | 'published' | 'unpublished'

export type BuiltInContentCollectionField = 'body' | 'featuredMedia' | 'seo'

export interface ContentCollectionBuiltInFields {
  body: boolean
  featuredMedia: boolean
  seo: boolean
}

export interface ContentCustomFieldDefinition {
  id: string
  label: string
  type: string
}

export interface ContentCollectionFieldSchema {
  builtIn: ContentCollectionBuiltInFields
  custom: ContentCustomFieldDefinition[]
}

export interface ContentCollection {
  id: string
  name: string
  slug: string
  routeBase: string
  singularLabel: string
  pluralLabel: string
  fields?: ContentCollectionFieldSchema
  createdAt: string
  updatedAt: string
}

export interface CreateContentCollectionInput {
  name: string
  slug?: string
  routeBase?: string
  singularLabel?: string
  pluralLabel?: string
  fields?: ContentCollectionFieldSchema
}

export interface UpdateContentCollectionInput {
  name?: string
  slug?: string
  routeBase?: string
  singularLabel?: string
  pluralLabel?: string
  fields?: ContentCollectionFieldSchema
}

export interface ContentEntry {
  id: string
  collectionId: string
  title: string
  slug: string
  status: ContentEntryStatus
  bodyMarkdown: string
  featuredMediaId: string | null
  seoTitle: string
  seoDescription: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  deletedAt: string | null
}

export interface ContentEntryDraftInput {
  title: string
  slug: string
  bodyMarkdown: string
  featuredMediaId: string | null
  seoTitle: string
  seoDescription: string
}

export interface CreateContentEntryInput {
  title: string
  slug?: string
  bodyMarkdown?: string
  featuredMediaId?: string | null
  seoTitle?: string
  seoDescription?: string
}

export interface UpdateContentEntryCollectionInput {
  collectionId: string
}

export type ContentMediaType = 'image' | 'video'

export type ContentBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'heading'; level: 2 | 3 | 4; text: string }
  | { id: string; type: 'media'; mediaType: ContentMediaType | null; src: string; alt: string }
