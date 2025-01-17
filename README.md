# Defuse Protocol SDK

The Defuse Protocol SDK is a powerful and flexible package designed to facilitate asset swap trading logic in React or Next.js applications. This SDK provides developers with the necessary tools and components to integrate advanced swap functionality into their decentralized applications (dApps).

## Main components that can be defined as:

- WidgetContextProvider
- SwapWidget

## Getting Started

Create a new ```~/.npmrc``` file if one doesn't exist, replacing TOKEN with your Github personal access token. (Reason - without it you can't install a package from github registry, [details](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-with-a-personal-access-token))

```text
//npm.pkg.github.com/:_authToken=TOKEN
```

Install the package:

```text
yarn add @defuse-protocol/defuse-sdk
```

or:

```text
npm install @defuse-protocol/defuse-sdk
```

## Use Defuse SDK

Now that you’ve installed the SDK, you can use it in your application:

```javascript
"use client"
import { SwapWidgetProvider, SwapWidget } from "@defuse-protocol/defuse-sdk"

export default function MyApp() {
  return (
    <div>
      <SwapWidgetProvider>
        <h1>Welcome to my app</h1>
        <SwapWidget
          theme="dark"
          tokenList={tokenList}
          event={eventListener}
          onSign={signMessage}
        />
      </SwapWidgetProvider>
    </div>
  )
}
```

DefuseProvider is a wrapper that provides the SDK with the necessary context for the components to work. It must be defined at the root of the application.

SwapWidget is the main component of the SDK. It handles the swap interface and logic, providing a complete solution for asset swapping in your application.

The SDK handles complex swap logic, including:

- Token selection and validation
- Price estimation and evaluation
- Swap execution
- Multi-chain support
- Error handling and user feedback

By leveraging this SDK, developers can quickly implement robust swap functionality in their dApps without having to build the complex logic from scratch.
