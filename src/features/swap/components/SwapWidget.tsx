import { useEffect } from "react"
import { SwapWidgetProvider } from "../../../providers"
import { useTokensStore } from "../../../providers/TokensStoreProvider"
import type { SwapWidgetProps } from "../../../types"
import { SwapForm } from "./SwapForm"
import { SwapFormProvider } from "./SwapFormProvider"
import { SwapSubmitterProvider } from "./SwapSubmitter"
import { SwapUIMachineFormSyncProvider } from "./SwapUIMachineFormSyncProvider"
import { SwapUIMachineProvider } from "./SwapUIMachineProvider"

export const SwapWidget = ({
  tokenList,
  userAddress,
  sendNearTransaction,
  signMessage,
  onSuccessSwap,
  onNavigateDeposit,
}: SwapWidgetProps) => {
  const [initialTokenIn, initialTokenOut] = tokenList
  assert(
    initialTokenIn && initialTokenOut,
    "Token list must have at least 2 tokens"
  )

  return (
    <SwapWidgetProvider>
      <TokenListUpdater tokenList={tokenList} />
      <SwapFormProvider>
        <SwapUIMachineProvider
          initialTokenIn={initialTokenIn}
          initialTokenOut={initialTokenOut}
          tokenList={tokenList}
          signMessage={signMessage}
        >
          <SwapUIMachineFormSyncProvider
            userAddress={userAddress}
            onSuccessSwap={onSuccessSwap}
          >
            <SwapSubmitterProvider
              userAddress={userAddress}
              sendNearTransaction={sendNearTransaction}
            >
              <SwapForm onNavigateDeposit={onNavigateDeposit} />
            </SwapSubmitterProvider>
          </SwapUIMachineFormSyncProvider>
        </SwapUIMachineProvider>
      </SwapFormProvider>
    </SwapWidgetProvider>
  )
}

function TokenListUpdater({
  tokenList,
}: { tokenList: SwapWidgetProps["tokenList"] }) {
  const { updateTokens } = useTokensStore((state) => state)

  useEffect(() => {
    updateTokens(tokenList)
  }, [tokenList, updateTokens])

  return null
}

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
