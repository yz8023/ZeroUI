// Dumps or checks the public API of :kit from the compiled release classes.
// Kotlin internal members (names containing "$kit") are left out of the dump.
// Usage: node tools/api/api.cjs dump   writes kit/api/kit.api
//        node tools/api/api.cjs check  fails when the dump differs from kit/api/kit.api
// Requires: ./gradlew :kit:bundleLibCompileToJarRelease and javap on PATH or under JAVA_HOME.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..', '..')
const jar = path.join(root, 'kit/build/intermediates/compile_library_classes_jar/release/bundleLibCompileToJarRelease/classes.jar')
const reference = path.join(root, 'kit/api/kit.api')
const javap = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'javap') : 'javap'
const skipped = /(^|\/)(R|BuildConfig)(\$[^/]*)?\.class$|ComposableSingletons\$|\$\$inlined|\$\$ExternalSyntheticLambda|\$[a-z]\w*\$\d/

const classes = execFileSync('unzip', ['-Z1', jar]).toString().split('\n')
  .filter((n) => n.endsWith('.class') && !skipped.test(n))
  .map((n) => n.slice(0, -'.class'.length).replace(/\//g, '.'))
  .sort()

const dump = []
for (let i = 0; i < classes.length; i += 200) {
  const out = execFileSync(javap, ['-public', '-cp', jar, ...classes.slice(i, i + 200)], { maxBuffer: 1 << 28 }).toString()
  dump.push(
    out.replace(/\r/g, '').replace(/^Compiled from .*\n/gm, '')
      .split('\n').filter((line) => !line.includes('$kit(') && !line.includes('access$')).join('\n'),
  )
}
const internalNames = require('./internal.cjs').collect(path.join(root, 'kit/src/main/java'))

function accessorTarget(method) {
  const m = /^(?:get|set|is)([A-Z]\w*)$/.exec(method)
  return m ? m[1][0].toLowerCase() + m[1].slice(1) : null
}

function isInternalMember(line) {
  const ctor = /\s([\w$.]+)\(/.exec(line)
  if (ctor && internalNames.constructors.has(ctor[1].split('.').pop())) return true
  const m = /\s([\w$]+?)(?:-\w+)?(?:\$default)?\(/.exec(line)
  if (!m) return false
  const method = m[1]
  return internalNames.members.has(method) || internalNames.members.has(accessorTarget(method))
}

function isInternalClass(header) {
  const name = /([\w$]+?)(?:\s+(?:extends|implements)\s.*)?\s*\{$/.exec(header)?.[1] || ''
  return name.split(/[.$]/).some((part) => internalNames.classes.has(part))
}

function keepPublicClasses(source) {
  const kept = []
  let skipping = false
  for (const line of source.split('\n')) {
    const isHeader = line.length > 0 && !/^\s/.test(line) && line !== '}'
    if (isHeader) skipping = !line.startsWith('public ') || isInternalClass(line)
    if (!skipping && !(line.startsWith(' ') && isInternalMember(line))) kept.push(line)
    if (line === '}') skipping = false
  }
  return kept.join('\n')
}

const text = keepPublicClasses(dump.join(''))
const leakPattern = /top\.yukonga|com\.kyant/
const leaks = text.split('\n').filter((line) => leakPattern.test(line)).length
const leakLimitPath = path.join(__dirname, 'leak-limit.json')

const mode = process.argv[2]
if (mode === 'dump') {
  fs.mkdirSync(path.dirname(reference), { recursive: true })
  fs.writeFileSync(reference, text)
  fs.writeFileSync(leakLimitPath, JSON.stringify({ lines: leaks }, null, 2) + '\n')
  console.log(`wrote ${path.relative(root, reference)} (${text.split('\n').filter((l) => l.startsWith('public ')).length} public classes, ${leaks} lines with third-party types)`)
} else if (mode === 'check') {
  const expected = fs.existsSync(reference) ? fs.readFileSync(reference, 'utf8') : ''
  const limit = fs.existsSync(leakLimitPath) ? JSON.parse(fs.readFileSync(leakLimitPath, 'utf8')).lines : 0
  if (leaks > limit) {
    console.error(`public signatures expose more third-party (top.yukonga, com.kyant) types than the limit: ${leaks} lines, limit ${limit}`)
    process.exit(1)
  }
  if (leaks < limit) console.log(`third-party type lines dropped to ${leaks} (limit ${limit}); run dump to lower the limit`)
  if (expected === text) {
    console.log('public API matches kit/api/kit.api')
  } else {
    const a = new Set(expected.split('\n'))
    const b = new Set(text.split('\n'))
    const removed = [...a].filter((l) => !b.has(l))
    const added = [...b].filter((l) => !a.has(l))
    console.error('public API changed:')
    removed.slice(0, 40).forEach((l) => console.error('- ' + l))
    added.slice(0, 40).forEach((l) => console.error('+ ' + l))
    console.error('Run `node tools/api/api.cjs dump` to accept the change.')
    process.exit(1)
  }
} else {
  console.error('usage: api.cjs dump|check')
  process.exit(2)
}
