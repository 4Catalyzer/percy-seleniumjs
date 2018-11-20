# percy-seleniumjs

Unofficial SeleniumJS SDK for [Percy](https://percy.io/). Works with Protractor too.

This SDK lets you use any test runner to actually run the tests, the only requirement is that a selenium driver is provided.

## Installation

```
yarn add -D percy-js
```

## Usage

```js
import PercySeleniumClient from 'PercySelenium'

const driver = createYourSeleniumOrProtractorDriver();

// 1) Initialize the client
const client = new PercySeleniumClient({
  assetLoaderOpts: {
    buildDir: 'build',
    mountPath: '/',
  },
  driver,
});
await this.client.createBuild();

// 2) Take a screenshot
await this.client.createSnapshot({
  name: `My Screenshot`,
});

// 3) Close the session
await this.client.finalizeBuild();
```

If you want to force percy to use the width that was used in the selenium browser, you can do:

```js
const width = await browser.executeScript(`return window.outerWidth`);
await this.client.createSnapshot({
  name: `My Screenshot`,
  widths: [width],
});
```
