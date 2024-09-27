# Defuse Protocol SDK

This SDK is designed to assist developers when interacting with the main functions of the protocol. Main functions that can be defined as:

- Quotation
- SwapForm

## Getting Started

Install the package:

```text
yarn add @defuse-protocol/defuse-sdk
```

or:

```text
npm install @defuse-protocol/defuse-sdk
```

## Wrap App in Context Provider

```javascript
import { DefuseProvider } from "@defuse-protocol/defuse-sdk"

function App() {
  return <DefuseProvider>{/** ... */}</DefuseProvider>
}
```

## Use Defuse SDK

Now that everything is set up, every component and function can use Defuse SDK React Hooks.

```javascript
import {
  useTokensStore,
  useWalletSelector,
  useSwap,
} from "@defuse-protocol/defuse-sdk"

export function SwapForm() {
  const [formData, setFormData] = useState({
    tokenIn,
    tokenOut,
    selectTokenIn,
    selectTokenOut,
  })
  const { data } = useTokensStore((state) => state)
  const { selector, accountId } = useWalletSelector()
  const {
    callRequestCreateIntent,
    nextEstimateQueueTransactions,
    getEstimateQueueTransactions,
    isProcessing,
    isError,
  } = useSwap({
    selector,
    accountId,
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Handle form submission logic here
    console.log("SwapForm Data:", formData)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="select1">Select 1:</label>
        <select
          name="select1"
          id="select1"
          value={formData.tokenIn}
          onChange={handleChange}
        >
          <option value="">--Please choose a token--</option>
          {data.map((token) => (
            <option key={token.address} value={token.address}>
              {token.name} ({token.symbol})
            </option>
          ))}
        </select>
      </div>
      ...
      <button type="submit">Submit</button>
    </form>
  )
}
```
