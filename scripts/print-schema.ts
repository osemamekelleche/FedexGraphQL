import { writeFileSync } from 'node:fs'
import { printSchema } from 'graphql'
import { schema } from '../src/graphql/schema.js'

const target = new URL('../schema.graphql', import.meta.url)
writeFileSync(target, `${printSchema(schema)}\n`, 'utf8')
console.log(`Wrote ${target.pathname}`)
