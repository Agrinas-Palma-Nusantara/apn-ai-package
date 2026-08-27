import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const temporary = mkdtempSync(join(tmpdir(), 'agrinas-chat-widget-'))
let tarball = ''

try {
  const packed = JSON.parse(execFileSync(
    'npm',
    ['pack', '--ignore-scripts', '--json'],
    { cwd: root, encoding: 'utf8' },
  ))
  tarball = resolve(root, packed[0].filename)

  writeFileSync(join(temporary, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
  }))
  writeFileSync(join(temporary, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022', 'DOM'],
      strict: true,
      noEmit: true,
    },
    include: ['consumer.ts'],
  }))
  writeFileSync(join(temporary, 'consumer.ts'), `
import { createChatClient, mountChatWidget } from '@danyawn/chat-widget'
import { ChatAgriaUI } from '@danyawn/chat-widget/react'

const getAccessToken = async () => 'token'
const client = createChatClient({ apiBaseUrl: 'https://chat.example', getAccessToken })
void client.fetchDocument('document-id')
mountChatWidget({ apiBaseUrl: 'https://chat.example', getAccessToken })
void ChatAgriaUI
`)

  execFileSync('npm', [
    'install', '--ignore-scripts', '--no-package-lock', '--silent',
    tarball, 'react@19', '@types/react@19', 'typescript@5',
  ], { cwd: temporary, stdio: 'inherit' })
  execFileSync(join(temporary, 'node_modules', '.bin', 'tsc'), [], {
    cwd: temporary,
    stdio: 'inherit',
  })

  const manifest = JSON.parse(readFileSync(join(
    temporary,
    'node_modules',
    '@danyawn',
    'chat-widget',
    'package.json',
  ), 'utf8'))
  if (manifest.name !== '@danyawn/chat-widget') {
    throw new Error('Installed package name does not match the release scope.')
  }
  process.stdout.write('Package consumer smoke test passed.\n')
} finally {
  rmSync(temporary, { recursive: true, force: true })
  if (tarball) rmSync(tarball, { force: true })
}
