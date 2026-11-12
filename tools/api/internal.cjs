// Collects the names of Kotlin `internal` declarations in the kit sources.
// Bytecode shows internal top-level functions and constructors as public, so the dump drops them by name.
const fs = require('fs')
const path = require('path')

const modifiers = '(?:(?:inline|suspend|operator|infix|tailrec|const|lateinit|data|enum|sealed|abstract|open|override|value|fun)\\s+)*'
const declaration = new RegExp(
  '^\\s*(?:@[\\w.]+(?:\\([^)]*\\))?\\s+)*internal\\s+' + modifiers + '(class|object|interface|fun|val|var)\\s+(?:<[^>]+>\\s*)?(?:[\\w.<>?, ]+\\.)?(\\w+)',
  'gm',
)

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.kt')) out.push(full)
  }
  return out
}

const internalConstructor = /class\s+(\w+)\s*(?:<[^>]*>)?\s*(?:@\w+\s*)*internal\s+constructor/g

function collect(sourceRoot) {
  const classes = new Set()
  const members = new Set()
  const constructors = new Set()
  for (const file of walk(sourceRoot, [])) {
    const text = fs.readFileSync(file, 'utf8')
    for (const match of text.matchAll(internalConstructor)) constructors.add(match[1])
    for (const match of text.matchAll(declaration)) {
      const [, kind, name] = match
      if (kind === 'class' || kind === 'object' || kind === 'interface') classes.add(name)
      else members.add(name)
    }
  }
  return { classes, members, constructors }
}

module.exports = { collect }
