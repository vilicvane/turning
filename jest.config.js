module.exports = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['expect-puppeteer'],
  testEnvironment: 'node',

  testMatch: ['<rootDir>/bld/design/test.js'],

  // collectCoverage: true,
  // coverageThreshold: {
  //   global: {
  //     statements: 100,
  //     branches: 100,
  //     functions: 100,
  //     lines: 100,
  //   },
  // },
};
