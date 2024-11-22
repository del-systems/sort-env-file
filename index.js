#!/usr/bin/env node

const fsPromises = require('node:fs/promises')
const args = process.argv.slice(2)

function printHelp () {
  const help = `sort-env-file
  Sorts .env files while keeping comments attached to the entries`

  process.stderr.write(help)
}

if (args.includes('-h') || args.includes('--help')) {
  printHelp()
  process.exit(0)
}

if (args.length === 0) {
  printHelp()
  process.exit(1)
}

let overwriteEnabled = false
const filePaths = []
args.forEach((value, index, array) => {
  if (value === '-w' || value === '--overwrite') {
    overwriteEnabled = true
    return
  }

  filePaths.push(value)
})

if (!overwriteEnabled && filePaths.length !== 1) {
  process.stderr.write('Multiple files can be processed only with -w (--overwrite) flag enabled')
  process.exit(2)
}

async function main () {
  const openedFiles = await Promise.all(
    filePaths.map(path => fsPromises.open(path, overwriteEnabled ? 'r+' : 'r'))
  )

  try {
    const readFiles = await Promise.all(
      openedFiles.map(handle => handle.readFile({ encoding: 'utf-8' }))
    )

    const sortedEnvFiles = await Promise.all(
      readFiles.map(sortEnvContent)
    )

    if (overwriteEnabled) {
      await Promise.all(
        sortedEnvFiles.map(async (content, index) => {
          await openedFiles.at(index).truncate(0)
          await openedFiles.at(index).write(content, 0, 'utf-8')
        })
      )

      process.stderr.write('Files were overriten sucessfully')
    } else {
      sortedEnvFiles.forEach(printSorted)
    }
  } finally {
    await Promise.all(
      openedFiles.map(handle => handle.close())
    )
  }
}

function printSorted (content) {
  process.stdout.write(content)
}

const NEWLINE = '\n'

async function sortEnvContent (content) {
  const groupedEnvFiles = content.split(NEWLINE).reduce(
    (groups, line) => {
      const trimmedLine = line.trim()

      if (trimmedLine.length === 0) {
        groups.push('')
      } else {
        const previousLine = groups.pop()
        if (previousLine.trim() === '') {
          groups.push(line)
        } else if (previousLine.trim().startsWith('#')) {
          groups.push(previousLine + NEWLINE + line)
        } else {
          groups.push(previousLine, line)
        }
      }
      return groups
    },
    ['']
  ).filter(value => value !== '')

  groupedEnvFiles.sort((a, b) => {
    const [varA, varB] = [a, b].map(value => value.split(NEWLINE).filter(line => !line.trim().startsWith('#')).at(-1))
    if (varA < varB) {
      return -1
    } else if (varA > varB) {
      return 1
    } else {
      return 0
    }
  })

  return groupedEnvFiles.reduce((output, elem) => {
    if (output === null) return elem

    const lines = elem.split(NEWLINE)
    const shouldAddNewline = lines.length > 1 || lines[0].trim().startsWith('#')

    return output + NEWLINE + (shouldAddNewline ? NEWLINE : '') + elem
  }, null) + NEWLINE
}

module.exports = main()
