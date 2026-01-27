import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function fail(message) {
  console.error(`Version sync check failed: ${message}`)
  process.exit(1)
}

const packageJson = JSON.parse(readFile('package.json'))
const packageVersion = packageJson.version

if (!packageVersion) {
  fail('package.json version is missing')
}

const packageLock = JSON.parse(readFile('package-lock.json'))
if (packageLock.version !== packageVersion) {
  fail(`package-lock.json version ${packageLock.version} does not match package.json ${packageVersion}`)
}

const changelog = readFile('CHANGELOG.md')
const changelogMatch = changelog.match(/^##\s*\[([^\]]+)\]/m)
if (!changelogMatch) {
  fail('CHANGELOG.md is missing a version header')
}

const changelogVersion = changelogMatch[1]
if (changelogVersion !== packageVersion) {
  fail(`CHANGELOG.md top version ${changelogVersion} does not match package.json ${packageVersion}`)
}

const inAppChangelog = readFile('src/pages/Changelog.jsx')
const changelogArrayMatch = inAppChangelog.match(/const\s+changelog\s*=\s*\[\s*\{([\s\S]*?)\}\s*,/m)
if (!changelogArrayMatch) {
  fail('src/pages/Changelog.jsx changelog array is missing or malformed')
}

const firstEntry = changelogArrayMatch[1]
const versionMatch = firstEntry.match(/version:\s*([^,\n}]+)/)
if (!versionMatch) {
  fail('src/pages/Changelog.jsx first entry is missing a version field')
}

const rawVersion = versionMatch[1].trim()
if (rawVersion !== 'APP_VERSION' && rawVersion !== `'${packageVersion}'` && rawVersion !== `"${packageVersion}"`) {
  fail(`src/pages/Changelog.jsx first entry version (${rawVersion}) does not reference APP_VERSION or ${packageVersion}`)
}

const appVersionConfig = readFile('src/config/appVersion.js')
if (!appVersionConfig.includes('package.json')) {
  fail('src/config/appVersion.js should derive version from package.json')
}

console.log(`Version sync check passed: ${packageVersion}`)
