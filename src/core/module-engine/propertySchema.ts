import { Type, type Static } from '@core/utils/typeboxHelpers'

export const PropertyConditionSchema = Type.Recursive((Self) => Type.Union([
  Type.Object(
    { field: Type.String({ minLength: 1 }), eq: Type.Unknown() },
    { additionalProperties: false },
  ),
  Type.Object(
    { field: Type.String({ minLength: 1 }), notEq: Type.Unknown() },
    { additionalProperties: false },
  ),
  Type.Object(
    { field: Type.String({ minLength: 1 }), in: Type.Array(Type.Unknown()) },
    { additionalProperties: false },
  ),
  Type.Object(
    { field: Type.String({ minLength: 1 }), notIn: Type.Array(Type.Unknown()) },
    { additionalProperties: false },
  ),
  Type.Object(
    { and: Type.Array(Self) },
    { additionalProperties: false },
  ),
  Type.Object(
    { or: Type.Array(Self) },
    { additionalProperties: false },
  ),
]))

export const PropertyControlLayoutSchema = Type.Union([
  Type.Literal('inline'),
  Type.Literal('stacked'),
])

const PropertyControlBaseSchema = {
  label: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  condition: Type.Optional(PropertyConditionSchema),
  layout: Type.Optional(PropertyControlLayoutSchema),
  breakpointOverridable: Type.Optional(Type.Boolean()),
}

export const PropertyControlOptionSchema = Type.Object(
  {
    label: Type.String({ minLength: 1 }),
    value: Type.Unknown(),
  },
  { additionalProperties: false },
)

export const PropertyControlSchema = Type.Recursive((Self) => Type.Union([
  Type.Object(
    {
      ...PropertyControlBaseSchema,
      type: Type.Literal('text'),
      placeholder: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PropertyControlBaseSchema,
      type: Type.Literal('textarea'),
      rows: Type.Optional(Type.Number()),
      placeholder: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PropertyControlBaseSchema,
      type: Type.Literal('number'),
      min: Type.Optional(Type.Number()),
      max: Type.Optional(Type.Number()),
      step: Type.Optional(Type.Number()),
      unit: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PropertyControlBaseSchema,
      type: Type.Literal('color'),
      format: Type.Optional(Type.Union([Type.Literal('hex'), Type.Literal('rgba')])),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PropertyControlBaseSchema,
      type: Type.Literal('select'),
      options: Type.Array(PropertyControlOptionSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...PropertyControlBaseSchema, type: Type.Literal('toggle') },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...PropertyControlBaseSchema, type: Type.Literal('image') },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PropertyControlBaseSchema,
      type: Type.Literal('media'),
      mediaKind: Type.Union([Type.Literal('image'), Type.Literal('video')]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...PropertyControlBaseSchema, type: Type.Literal('url') },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...PropertyControlBaseSchema, type: Type.Literal('richtext') },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...PropertyControlBaseSchema, type: Type.Literal('spacing') },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PropertyControlBaseSchema,
      type: Type.Literal('group'),
      collapsed: Type.Optional(Type.Boolean()),
      children: Type.Record(Type.String(), Self),
    },
    { additionalProperties: false },
  ),
]))

export type PropertyControl = Static<typeof PropertyControlSchema>

/**
 * Maps each flat prop key to a PropertyControl descriptor. Use
 * `type: 'group'` for visual grouping only; it does not nest the data shape.
 */
export const PropertySchemaSchema = Type.Unsafe<Record<string, PropertyControl>>(
  Type.Record(Type.String(), PropertyControlSchema),
)

export type PropertyCondition = Static<typeof PropertyConditionSchema>
export type PropertyControlLayout = Static<typeof PropertyControlLayoutSchema>
export type PropertySchema = Static<typeof PropertySchemaSchema>
