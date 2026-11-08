/**
 * Generates GraphQL types for every object, enum, and alias in
 * `ship.json` (the FedEx Ship API OpenAPI document).
 *
 * The generated types are prefixed with `Fedex` so they can never collide with
 * the hand-written convenience types in `src/graphql/typeDefs.ts`.
 *
 * Input and output shapes are generated separately because GraphQL input
 * object types cannot be used as output types (and vice versa):
 *
 *   FedexMoney        -> response object
 *   FedexMoneyInput   -> request object
 *
 * OpenAPI enums become GraphQL enums on input types (for autocomplete).
 * Output fields use `String` for enum values so a new FedEx value can never
 * break response serialization.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const openApi = JSON.parse(readFileSync(join(projectRoot, 'ship.json'), 'utf8'))
const schemas = openApi.components.schemas
const REF_PREFIX = '#/components/schemas/'

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

/**
 * Resolve `$ref`, `allOf`, `anyOf`, and inline properties into one flat
 * property map. Cycles are cut with `seen`; GraphQL types themselves may be
 * recursive, only schema composition is flattened here.
 */
function shapeOf(def, seen = new Set()) {
  if (!def || typeof def !== 'object') return { kind: 'unknown' }

  const ref = refName(def)
  if (ref) {
    if (!schemas[ref] || seen.has(ref)) return { kind: 'unknown' }
    const base = shapeOf(schemas[ref], new Set([...seen, ref]))
    if (!hasStructuralSiblings(def)) return base
    const siblings = { ...def }
    delete siblings.$ref
    return mergeShapes(base, shapeOf(siblings, seen))
  }

  if (def.allOf || def.anyOf || def.properties || def.type === 'object') {
    const properties = {}
    for (const key of ['allOf', 'anyOf']) {
      for (const part of def[key] ?? []) {
        const shape = shapeOf(part, seen)
        Object.assign(properties, shape.properties ?? {})
      }
    }
    if (def.properties) Object.assign(properties, def.properties)
    return { kind: 'object', properties }
  }

  if (def.enum) return { kind: 'enum', values: def.enum }
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

function isValidEnumValue(value) {
  return (
    typeof value === 'string' &&
    INVALID_NAME.test(value) &&
    !value.startsWith('__') &&
    !RESERVED_ENUM_VALUES.has(value)
  )
}

function registerEnum(name, values, description) {
  const uniqueValues = [...new Set(values)]
  if (uniqueValues.length === 0 || !uniqueValues.every(isValidEnumValue)) return false
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

const shapes = new Map()
for (const name of Object.keys(schemas)) {
  shapes.set(name, shapeOf(schemas[name]))
}

const enumComponentNames = new Map()
const outputComponentNames = new Map()
const inputComponentNames = new Map()

// Reserve every top-level name up front so generated helper types cannot take
// a name belonging to a schema that is registered later.
for (const [name, shape] of shapes) {
  if (shape.kind === 'enum') {
    enumComponentNames.set(name, uniqueName(`Fedex${sanitize(name)}`))
  } else {
    const outputName = uniqueName(`Fedex${sanitize(name)}`)
    outputComponentNames.set(name, outputName)
    inputComponentNames.set(name, uniqueName(`${outputName}Input`))
  }
}

function registerObject(name, shape, mode, description) {
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
    const type = mapType(propertyDef, name, property, mode)
    if (!type) continue
    definition.fields.push({
      name: property,
      type,
      description: describe(propertyDef?.description, 220),
    })
  }

  return true
}

function componentRef(ref, mode) {
  const shape = shapes.get(ref)
  if (!shape) return 'String'

  if (shape.kind === 'enum') {
    if (mode === 'output') return 'String'
    const name = enumComponentNames.get(ref)
    if (!name) return 'String'
    return registerEnum(name, shape.values, schemas[ref]?.description) ? name : 'String'
  }

  if (shape.kind === 'object') {
    const name = mode === 'input' ? inputComponentNames.get(ref) : outputComponentNames.get(ref)
    if (!name) return 'String'
    return registerObject(name, shape, mode, schemas[ref]?.description) ? name : 'String'
  }

  if (shape.kind === 'scalar') return scalarName(shape.type)
  return 'String'
}

function mapType(def, parentName, fieldName, mode) {
  if (!def || typeof def !== 'object') return 'String'

  const ref = refName(def)
  if (ref && !hasStructuralSiblings(def)) {
    return componentRef(ref, mode)
  }

  if (def.enum) {
    if (mode === 'output') return 'String'
    const name = uniqueName(`${parentName}_${fieldName}`)
    return registerEnum(name, def.enum, def.description) ? name : 'String'
  }

  if (def.type === 'array') {
    return `[${mapType(def.items ?? {}, parentName, fieldName, mode)}]`
  }

  if (def.type === 'object' || def.properties || def.allOf || def.anyOf) {
    const shape = shapeOf(def)
    if (shape.kind !== 'object' || Object.keys(shape.properties).length === 0) return 'String'
    const name = uniqueName(`${parentName}_${fieldName}`)
    return registerObject(name, shape, mode, def.description) ? name : 'String'
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

// Register every schema, not just the ones used by the convenience types.
// This keeps the GraphQL schema equivalent to the OpenAPI document.
for (const [name, shape] of shapes) {
  if (shape.kind === 'enum') {
    const enumName = enumComponentNames.get(name)
    if (enumName) registerEnum(enumName, shape.values, schemas[name]?.description)
  } else if (shape.kind === 'object') {
    registerObject(outputComponentNames.get(name), shape, 'output', schemas[name]?.description)
    registerObject(inputComponentNames.get(name), shape, 'input', schemas[name]?.description)
  }
}

const blocks = [...typeDefs.values()]
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((definition) => (definition.kind === 'enum' ? emitEnum(definition) : emitType(definition)))

const sdl = blocks.join('\n\n')
const target = join(projectRoot, 'src', 'graphql', 'generated.ts')
const source = `// AUTO-GENERATED by scripts/generate-fedex-types.mjs from ship.json.
// Run \`npm run generate\` instead of editing this file.
export const generatedTypeDefs: string = ${JSON.stringify(sdl)}
`
writeFileSync(target, source, 'utf8')

const objectCount = [...typeDefs.values()].filter((definition) => definition.kind !== 'enum').length
const enumCount = [...typeDefs.values()].filter((definition) => definition.kind === 'enum').length
console.log(
  `Wrote ${target} (${blocks.length} types: ${objectCount} object/input, ${enumCount} enum, ${sdl.length} chars)`,
)
