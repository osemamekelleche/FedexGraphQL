import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = join(projectRoot, 'public', 'assets')
const workerOutputDirectory = join(outputDirectory, 'workers')

console.log('Bundling the GraphiQL frontend...')
await rm(outputDirectory, { recursive: true, force: true })
await mkdir(workerOutputDirectory, { recursive: true })

const productionDefines = {
  'process.env.NODE_ENV': '"production"',
}

await build({
  absWorkingDir: projectRoot,
  entryPoints: [join(projectRoot, 'src', 'frontend', 'main.tsx')],
  outfile: join(outputDirectory, 'graphiql.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2020'],
  jsx: 'automatic',
  define: productionDefines,
  loader: {
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
    '.ttf': 'dataurl',
    '.eot': 'dataurl',
    '.svg': 'dataurl',
    '.png': 'dataurl',
  },
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'info',
})

console.log('Bundling the Monaco workers...')
await build({
  absWorkingDir: projectRoot,
  entryPoints: {
    'editor.worker': join(projectRoot, 'src', 'frontend', 'workers', 'editor.worker.ts'),
    'json.worker': join(projectRoot, 'src', 'frontend', 'workers', 'json.worker.ts'),
    'graphql.worker': join(projectRoot, 'src', 'frontend', 'workers', 'graphql.worker.ts'),
  },
  outdir: workerOutputDirectory,
  entryNames: '[name]',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
  define: productionDefines,
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'info',
})

for (const file of [
  join(outputDirectory, 'graphiql.js'),
  join(outputDirectory, 'graphiql.css'),
  join(workerOutputDirectory, 'editor.worker.js'),
  join(workerOutputDirectory, 'json.worker.js'),
  join(workerOutputDirectory, 'graphql.worker.js'),
]) {
  const info = await stat(file)
  console.log(`${file} ${(info.size / 1024).toFixed(1)} KB`)
}

console.log('Frontend assets written to public/assets.')
