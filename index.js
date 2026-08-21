import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const skillsRoot = join(dirname(fileURLToPath(import.meta.url)), 'skills')
const skillNames = [
  'brainstorming', 'writing-plans', 'executing-plans', 'systematic-debugging',
  'test-driven-development', 'requesting-code-review', 'receiving-code-review',
  'verification-before-completion',
]

export const name = 'dsh-superpowers-zh'
export const inject = ['skills']

function loadSkill(name) {
  const directory = join(skillsRoot, name)
  const raw = readFileSync(join(directory, 'SKILL.md'), 'utf8')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw)
  if (!match) throw new Error(`dsh-superpowers-zh: ${name}/SKILL.md has no frontmatter`)
  const metadata = Object.fromEntries(match[1].split(/\r?\n/).flatMap((line) => {
    const item = /^([A-Za-z-]+):\s*["']?(.*?)["']?\s*$/.exec(line)
    return item ? [[item[1], item[2]]] : []
  }))
  if (!metadata.name || !metadata.description) throw new Error(`dsh-superpowers-zh: ${name}/SKILL.md requires name and description`)
  return { name: metadata.name, description: metadata.description, content: match[2], resourceBase: { kind: 'directory', path: directory } }
}

export function apply(ctx) {
  for (const skill of skillNames) ctx.skills.register(loadSkill(skill))
}
