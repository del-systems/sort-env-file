const launchApp = () => require('../index')

beforeEach(() => {
  process.exit = jest.fn(code => {
    throw new Error(`Process exited with code ${code}`)
  })
})

it('exists due to insufficient arguments', () => {
  expect(launchApp).toThrow()
})

it('exists due to help flag is provided', () => {
  [['-h'], ['--help'], ['-w', '/tmp/file.env', '--help'], ['/tmp/file.env', '-h']].forEach(value => {
    process.argv = ['/usr/bin/node', 'index.js'].concat(value)
    expect(launchApp).toThrow()
  })
})

it('exists due to multiple files are provided without overwrite flag', () => {
  process.argv = ['/usr/bin/node', 'index.js', '/tmp/file1', '/tmp/file2']
  expect(launchApp).toThrow()
})
