const launchApp = () => require('../index')

beforeEach(() => {
  jest.resetModules()

  jest.spyOn(process, 'exit').mockImplementation(code => {
    throw new Error(`Process exited with code ${code}`)
  })
  jest.spyOn(process, 'stderr', 'get').mockReturnValue({ write: jest.fn() })
  jest.spyOn(process, 'stdout', 'get').mockReturnValue({ write: jest.fn() })
})

it('exists due to insufficient arguments', () => {
  expect(launchApp).toThrow()
  expect(process.stdout.write).not.toBeCalled()
  expect(process.stderr.write).toBeCalled()
})

it('exists due to help flag is provided', () => {
  [['-h'], ['--help'], ['-w', '/tmp/file.env', '--help'], ['/tmp/file.env', '-h']].forEach(value => {
    process.argv = ['/usr/bin/node', 'index.js'].concat(value)
    expect(launchApp).toThrow()
    expect(process.stdout.write).not.toBeCalled()
    expect(process.stderr.write).toBeCalled()
  })
})

it('exists due to multiple files are provided without overwrite flag', () => {
  process.argv = ['/usr/bin/node', 'index.js', '/tmp/file1', '/tmp/file2']
  expect(launchApp).toThrow()
  expect(process.stdout.write).not.toBeCalled()
  expect(process.stderr.write).toBeCalled()
})

const writeMultiline = adder => {
  let content = null
  adder(line => {
    if (content === null) {
      content = line
    } else {
      content += '\n' + line
    }
  })
  return content
}

const writeFile = async content => {
  const fs = require('node:fs/promises')
  const path = require('node:path')
  const os = require('node:os')
  const dirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'sort-env-file'))
  const filePath = path.join(dirPath, Math.floor(Math.random() * 100000).toString(16))
  await fs.writeFile(filePath, content, 'utf-8')

  return filePath
}

const exampleA = {
  unsorted: writeMultiline(add => {
    add('')
    add('HOME=/tmp')
    add('')
    add('# Server environment')
    add('# Available values are "production", "staging"')
    add('#')
    add('# Setting value to "staging" disables some of the modules')
    add('RACK_ENV=production')
    add('')
    add('PATH="HOME/lib/bin:$PATH"')
    add('')
    add('# AWS ACCESS TOKEN')
    add('ACCESS_TOKEN=ID123')
    add('')
    add('')
    add('')
    add('')
    add('# Dangling comment')
    add('')
    add('# Other dangling comment')
    add('')
  }),
  sorted: writeMultiline(add => {
    add('# AWS ACCESS TOKEN')
    add('ACCESS_TOKEN=ID123')
    add('HOME=/tmp')
    add('PATH="HOME/lib/bin:$PATH"')
    add('')
    add('# Server environment')
    add('# Available values are "production", "staging"')
    add('#')
    add('# Setting value to "staging" disables some of the modules')
    add('RACK_ENV=production')
    add('')
    add('# Dangling comment')
    add('')
    add('# Other dangling comment')
    add('')
  })
}

const exampleB = {
  unsorted: writeMultiline(add => {
    add('# Staging number which is used when forming domain name: app1.dev.example.com')
    add('STAGING_NUMBER=45')
    add('')
    add('ACME_VERSION=1234')
    add('ACME_COMMIT=4566')
  }),
  sorted: writeMultiline(add => {
    add('ACME_COMMIT=4566')
    add('ACME_VERSION=1234')
    add('')
    add('# Staging number which is used when forming domain name: app1.dev.example.com')
    add('STAGING_NUMBER=45')
    add('')
  })
}

const exampleC = {
  unsorted: writeMultiline(add => {
    add('C=123')
    add('B=456')
    add('A=789')
  }),
  sorted: writeMultiline(add => {
    add('A=789')
    add('B=456')
    add('C=123')
    add('')
  })
}

it('outputs properly', async () => {
  process.argv = ['/usr/bin/node', 'index.js', await writeFile(exampleA.unsorted)]
  await launchApp()
  expect(process.stderr.write).not.toBeCalled()
  expect(process.stdout.write).toBeCalledWith(exampleA.sorted)
})

it('overwrites file properly', async () => {
  const fileA = await writeFile(exampleA.unsorted)
  const fileB = await writeFile(exampleB.unsorted)
  const fileC = await writeFile(exampleC.unsorted)
  process.argv = ['/usr/bin/node', 'index.js', '-w', fileA, fileB, fileC]

  await launchApp()
  expect(process.stderr.write).toBeCalled()
  expect(process.stdout.write).not.toBeCalled()

  const fs = require('node:fs/promises')
  expect(await fs.readFile(fileA, 'utf-8')).toEqual(exampleA.sorted)
  expect(await fs.readFile(fileB, 'utf-8')).toEqual(exampleB.sorted)
  expect(await fs.readFile(fileC, 'utf-8')).toEqual(exampleC.sorted)
})
