/**
 * Generates GraphQL types for every object, enum, and alias in the FedEx
 * OpenAPI documents checked into this repository.
 *
 *   ship.json   -> Fedex<Name>       (Ship API)
 *   track.json  -> FedexTrack<Name>  (Track API)
 *
 * The generated types are prefixed so they can never collide with the
 * hand-written convenience types in `src/graphql/typeDefs.ts` or with each
 * other across API documents.
 *
 * Input and output shapes are generated separately because GraphQL input
 * object types cannot be used as output types (and vice versa):
 *
 *   FedexMoney        -> response object
 *   FedexMoneyInput   -> request object
 *
 * OpenAPI enums become GraphQL enums on input types (for autocomplete).
 * Output fields use `String` for enum values so a new FedEx value can never
 * break response serialization. Enums with invalid GraphQL values (for
 * example `true`/`false` or values containing spaces) fall back to the
 * underlying scalar type.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REF_PREFIX = '#/components/schemas/'

const DOCUMENTS = [
  { file: 'ship.json', prefix: 'Fedex' },
  { file: 'track.json', prefix: 'FedexTrack' },
]

const RESERVED_NAMES = new Set(['FedexHealth', 'FedexMessage'])
const usedNames = new Set(RESERVED_NAMES)
const typeDefs = new Map()

const INVALID_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/
const RESERVED_ENUM_VALUES = new Set(['true', 'false', 'null'])

function sanitize(name) {
  return String(name).replace(/[^_0-9A-Za-z]/g, '_')
}

function uniqueName(base) {
  let name = base
  let suffix = 2
  while (usedNames.has(name)) {
    name = `${base}_${suffix}`
    suffix += 1
  }
  usedNames.add(name)
  return name
}

function refName(def) {
  if (!def || typeof def !== 'object' || typeof def.$ref !== 'string') return null
  if (!def.$ref.startsWith(REF_PREFIX)) return null
  return def.$ref.slice(REF_PREFIX.length)
}

function hasStructuralSiblings(def) {
  return Boolean(
    def.type || def.enum || def.properties || def.allOf || def.anyOf || def.oneOf,
  )
}

function mergeShapes(left, right) {
  if (left.kind === 'object' && right.kind === 'object') {
    return {
      kind: 'object',
      properties: { ...left.properties, ...right.properties },
    }
  }
  return right.kind === 'unknown' ? left : right
}

function isValidEnumValue(value) {
  return (
    typeof value === 'string' &&
    INVALID_NAME.test(value) &&
    !value.startsWith('__') &&
    !RESERVED_ENUM_VALUES.has(value)
  )
}

function isValidEnum(values) {
  return (
    Array.isArray(values) &&
    values.length > 0 &&
    values.every(isValidEnumValue)
  )
}

/**
 * Resolve `$ref`, `allOf`, `anyOf`, `oneOf`, and inline properties into one
 * flat property map. Cycles are cut with `seen`; GraphQL types themselves may
 * be recursive, only schema composition is flattened here.
 */
function shapeOf(def, context, seen = new Set()) {
  if (!def || typeof def !== 'object') return { kind: 'unknown' }

  const ref = refName(def)
  if (ref) {
    if (!context.schemas[ref] || seen.has(ref)) return { kind: 'unknown' }
    const base = shapeOf(context.schemas[ref], context, new Set([...seen, ref]))
    if (!hasStructuralSiblings(def)) return base
    const siblings = { ...def }
    delete siblings.$ref
    return mergeShapes(base, shapeOf(siblings, context, seen))
  }

  if (
    def.allOf ||
    def.anyOf ||
    def.oneOf ||
    def.properties ||
    def.type === 'object'
  ) {
    const properties = {}
    for (const key of ['allOf', 'anyOf', 'oneOf']) {
      for (const part of def[key] ?? []) {
        const shape = shapeOf(part, context, seen)
        Object.assign(properties, shape.properties ?? {})
      }
    }
    if (def.properties) Object.assign(properties, def.properties)
    return { kind: 'object', properties }
  }

  if (def.enum && isValidEnum(def.enum)) return { kind: 'enum', values: def.enum }
  if (def.type === 'array') return { kind: 'array', items: def.items }
  if (def.type) return { kind: 'scalar', type: def.type }
  return { kind: 'unknown' }
}

function describe(value, maxLength) {
  if (typeof value !== 'string') return ''
  const plain = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return ''
  return plain.length > maxLength ? `${plain.slice(0, maxLength - 1).trimEnd()}…` : plain
}

function registerEnum(name, values, description) {
  const uniqueValues = [...new Set(values)]
  if (!isValidEnum(uniqueValues)) return false
  if (!typeDefs.has(name)) {
    typeDefs.set(name, {
      kind: 'enum',
      name,
      values: [...uniqueValues].sort(),
      description: describe(description, 320),
    })
  }
  return true
}

function scalarName(type) {
  switch (type) {
    case 'integer':
      return 'Int'
    case 'number':
      return 'Float'
    case 'boolean':
      return 'Boolean'
    case 'string':
      return 'String'
    default:
      return 'String'
  }
}

function registerObject(name, shape, mode, description, context) {
  if (!shape || shape.kind !== 'object') return false
  if (Object.keys(shape.properties).length === 0) return false
  if (typeDefs.has(name)) return true

  const definition = {
    kind: mode === 'input' ? 'input' : 'type',
    name,
    fields: [],
    description: describe(description, 320),
  }
  // Store the placeholder first so recursive references resolve to this name.
  typeDefs.set(name, definition)

  for (const [property, propertyDef] of Object.entries(shape.properties)) {
    const type = mapType(propertyDef, name, property, mode, context)
    if (!type) continue
    definition.fields.push({
      name: property,
      type,
      description: describe(propertyDef?.description, 220),
    })
  }

  return true
}

function componentRef(ref, mode, parentName, fieldName, context) {
  const shape = context.shapes.get(ref)
  if (!shape) return 'String'

  if (shape.kind === 'enum') {
    if (mode === 'output') return 'String'
    const name = context.enumComponentNames.get(ref)
    if (!name) return 'String'
    return registerEnum(name, shape.values, context.schemas[ref]?.description)
      ? name
      : 'String'
  }

  if (shape.kind === 'object') {
    const name =
      mode === 'input' ? context.inputComponentNames.get(ref) : context.outputComponentNames.get(ref)
    if (!name) return 'String'
    return registerObject(
      name,
      shape,
      mode,
      context.schemas[ref]?.description,
      context,
    )
      ? name
      : 'String'
  }

  if (shape.kind === 'array') {
    return `[${mapType(shape.items ?? {}, parentName, `${fieldName}Item`, mode, context)}]`
  }

  if (shape.kind === 'scalar') return scalarName(shape.type)
  return 'String'
}

function mapType(def, parentName, fieldName, mode, context) {
  if (!def || typeof def !== 'object') return 'String'

  const ref = refName(def)
  if (ref && !hasStructuralSiblings(def)) {
    return componentRef(ref, mode, parentName, fieldName, context)
  }

  if (def.enum && isValidEnum(def.enum)) {
    if (mode === 'output') return 'String'
    const name = uniqueName(`${parentName}_${fieldName}`)
    return registerEnum(name, def.enum, def.description) ? name : 'String'
  }

  if (def.type === 'array') {
    return `[${mapType(def.items ?? {}, parentName, fieldName, mode, context)}]`
  }

  if (def.type === 'object' || def.properties || def.allOf || def.anyOf || def.oneOf) {
    const shape = shapeOf(def, context)
    if (shape.kind !== 'object' || Object.keys(shape.properties).length === 0) return 'String'
    const name = uniqueName(`${parentName}_${fieldName}`)
    return registerObject(name, shape, mode, def.description, context) ? name : 'String'
  }

  if (def.type) return scalarName(def.type)
  return 'String'
}

function emitType(definition) {
  const lines = []
  if (definition.description) {
    lines.push(JSON.stringify(definition.description))
  }
  lines.push(`${definition.kind} ${definition.name} {`)
  for (const field of definition.fields) {
    if (field.description) lines.push(`  ${JSON.stringify(field.description)}`)
    lines.push(`  ${field.name}: ${field.type}`)
  }
  lines.push('}')
  return lines.join('\n')
}

function emitEnum(definition) {
  const lines = []
  if (definition.description) {
    lines.push(JSON.stringify(definition.description))
  }
  lines.push(`enum ${definition.name} {`)
  for (const value of definition.values) lines.push(`  ${value}`)
  lines.push('}')
  return lines.join('\n')
}

const contexts = []

for (const document of DOCUMENTS) {
  const openApi = JSON.parse(readFileSync(join(projectRoot, document.file), 'utf8'))
  const schemas = openApi.components.schemas
  const context = {
    file: document.file,
    prefix: document.prefix,
    schemas,
    shapes: new Map(),
    enumComponentNames: new Map(),
    outputComponentNames: new Map(),
    inputComponentNames: new Map(),
  }

  for (const name of Object.keys(schemas)) {
    context.shapes.set(name, shapeOf(schemas[name], context))
  }

  // Reserve every top-level name up front so generated helper types cannot
  // take a name belonging to a schema that is registered later.
  for (const [name, shape] of context.shapes) {
    const base = `${document.prefix}${sanitize(name)}`
    if (shape.kind === 'enum') {
      context.enumComponentNames.set(name, uniqueName(base))
    } else {
      const outputName = uniqueName(base)
      context.outputComponentNames.set(name, outputName)
      context.inputComponentNames.set(name, uniqueName(`${outputName}Input`))
    }
  }

  // Register every schema, not just the ones used by the convenience types.
  // This keeps the GraphQL schema equivalent to the OpenAPI document.
  for (const [name, shape] of context.shapes) {
    if (shape.kind === 'enum') {
      const enumName = context.enumComponentNames.get(name)
      if (enumName) registerEnum(enumName, shape.values, schemas[name]?.description)
    } else if (shape.kind === 'object') {
      registerObject(
        context.outputComponentNames.get(name),
        shape,
        'output',
        schemas[name]?.description,
        context,
      )
      registerObject(
        context.inputComponentNames.get(name),
        shape,
        'input',
        schemas[name]?.description,
        context,
      )
    }
  }

  contexts.push(context)
}

const blocks = [...typeDefs.values()]
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((definition) => (definition.kind === 'enum' ? emitEnum(definition) : emitType(definition)))

const sdl = blocks.join('\n\n')
const target = join(projectRoot, 'src', 'graphql', 'generated.ts')
const documents = DOCUMENTS.map((document) => document.file).join(', ')
const source = `// AUTO-GENERATED by scripts/generate-fedex-types.mjs from ${documents}.
// Run \`npm run generate\` instead of editing this file.
export const generatedTypeDefs: string = ${JSON.stringify(sdl)}
`
writeFileSync(target, source, 'utf8')

const objectCount = [...typeDefs.values()].filter((definition) => definition.kind !== 'enum').length
const enumCount = [...typeDefs.values()].filter((definition) => definition.kind === 'enum').length
console.log(
  `Wrote ${target} (${blocks.length} types: ${objectCount} object/input, ${enumCount} enum, ${sdl.length} chars)`,
)
