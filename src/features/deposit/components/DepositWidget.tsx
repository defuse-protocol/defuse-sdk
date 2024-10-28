import { useEffect } from "react"
import { DepositWidgetProvider } from "../../../providers"
import type { DepositWidgetProps } from "../../../types/deposit"

import { useTokensStore } from "src/providers/TokensStoreProvider"
import { DepositForm } from "./DepositForm"
import { DepositFormProvider } from "./DepositFormProvider"
import { DepositUIMachineFormSyncProvider } from "./DepositUIMachineFormSyncProvider"
import { DepositUIMachineProvider } from "./DepositUIMachineProvider"

export const DepositWidget = ({
  tokenList,
  userAddress,
  sendTransactionNear,
  onEmit,
}: DepositWidgetProps) => {
  return (
    <DepositWidgetProvider>
      <TokenListUpdater tokenList={tokenList} />
      <DepositFormProvider>
        <DepositUIMachineProvider
          tokenList={tokenList}
          sendTransactionNear={sendTransactionNear}
        >
          <DepositUIMachineFormSyncProvider userAddress={userAddress}>
            <DepositForm />
          </DepositUIMachineFormSyncProvider>
        </DepositUIMachineProvider>
      </DepositFormProvider>
    </DepositWidgetProvider>
  )
}

function TokenListUpdater({
  tokenList,
}: { tokenList: DepositWidgetProps["tokenList"] }) {
  const { updateTokens } = useTokensStore((state) => state)

  useEffect(() => {
    updateTokens(tokenList)
  }, [tokenList, updateTokens])

  return null
}
