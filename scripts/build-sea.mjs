import { spawnSync } from 'node:child_process'
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { inject } from 'postject'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(projectRoot, 'public')
const buildDir = join(projectRoot, 'build')
const bundlePath = join(buildDir, 'fedex-graphql.cjs')
const blobPath = join(buildDir, 'sea-prep.blob')
const configPath = join(buildDir, 'sea-config.json')
const executableName = process.platform === 'win32' ? 'fedex-graphql.exe' : 'fedex-graphql'
const executablePath = join(buildDir, executableName)

const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'

/**
 * `@whatwg-node/fetch` probes for the optional native `node-libcurl` package
 * with a dynamic require. Node's SEA loader warns about that probe even though
 * the failure is caught, so remove it from the bundled source. The package is
 * not used anywhere else.
 */
const skipOptionalLibcurl = {
  name: 'skip-optional-libcurl',
  setup(buildContext) {
    buildContext.onLoad(
      { filter: /[\\/]@whatwg-node[\\/]fetch[\\/]dist[\\/]node-ponyfill\.js$/ },
      async (args) => {
        const source = await readFile(args.path, 'utf8')
        const contents = source.replace(
          /globalThis\.libcurl\s*=\s*globalThis\.libcurl\s*\|\|\s*require\(nodelibcurlName\);?/,
          '// node-libcurl is optional and cannot be loaded from a single executable.',
        )
        return { contents, loader: 'js' }
      },
    )
  },
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    ...options,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`)
  }
}

async function collectFiles(directory, relativeDirectory = '') {
  const entries = await readdir(join(directory, relativeDirectory), {
    withFileTypes: true,
  })
  const files = []

  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(directory, relativePath)))
    } else if (entry.isFile()) {
      files.push(relativePath)
    }
  }

  return files
}

run(process.execPath, [join(projectRoot, 'scripts', 'build-frontend.mjs')])

console.log('Bundling the server into a single CommonJS file...')
await rm(buildDir, { recursive: true, force: true })
await mkdir(buildDir, { recursive: true })

await build({
  absWorkingDir: projectRoot,
  entryPoints: [join(projectRoot, 'src/server.ts')],
  outfile: bundlePath,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: `node${process.versions.node.split('.')[0]}`,
  legalComments: 'none',
  sourcemap: false,
  plugins: [skipOptionalLibcurl],
  logLevel: 'info',
})

const frontendFiles = await collectFiles(publicDir)
const assets = Object.fromEntries(
  frontendFiles.map((relativePath) => [
    `public/${relativePath}`,
    join(publicDir, relativePath),
  ]),
)

console.log(`Embedding ${frontendFiles.length} frontend asset files...`)
console.log('Generating the Node SEA blob...')
await writeFile(
  configPath,
  `${JSON.stringify(
    {
      main: 'build/fedex-graphql.cjs',
      output: 'build/sea-prep.blob',
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false,
      assets,
    },
    null,
    2,
  )}\n`,
)

run(process.execPath, ['--experimental-sea-config', configPath])

const nodeExecutable = await realpath(process.execPath)
console.log(`Copying ${nodeExecutable} -> ${executablePath}`)
await copyFile(nodeExecutable, executablePath)

console.log('Injecting the blob into the executable...')
await inject(executablePath, 'NODE_SEA_BLOB', await readFile(blobPath), {
  sentinelFuse: SEA_FUSE,
  overwrite: true,
})

if (process.platform === 'darwin') {
  console.log('Removing and re-applying the macOS code signature...')
  run('codesign', ['--remove-signature', executablePath])
  run('codesign', ['--sign', '-', executablePath])
} else if (process.platform !== 'win32') {
  await chmod(executablePath, 0o755)
}

await copyFile(join(projectRoot, '.env.example'), join(buildDir, '.env.example')).catch(
  () => undefined,
)

console.log('')
console.log(`Standalone executable: ${executablePath}`)
console.log('Place a .env file next to it (or set the variables in the environment) and run it.')
