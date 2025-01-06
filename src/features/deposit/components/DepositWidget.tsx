import { useEffect } from "react"
import { WidgetRoot } from "../../../components/WidgetRoot"
import { DepositWidgetProvider } from "../../../providers/DepositWidgetProvider"
import { useTokensStore } from "../../../providers/TokensStoreProvider"
import type { DepositWidgetProps } from "../../../types/deposit"
import { DepositForm } from "./DepositForm"
import { DepositFormProvider } from "./DepositFormProvider"
import { DepositUIMachineFormSyncProvider } from "./DepositUIMachineFormSyncProvider"
import { DepositUIMachineProvider } from "./DepositUIMachineProvider"

export const DepositWidget = ({
  tokenList,
  userAddress,
  chainType,
  sendTransactionNear,
  sendTransactionEVM,
  sendTransactionSolana,
}: DepositWidgetProps) => {
  return (
    <WidgetRoot>
      <DepositWidgetProvider>
        <TokenListUpdater tokenList={tokenList} />
        <DepositFormProvider>
          <DepositUIMachineProvider
            tokenList={tokenList}
            sendTransactionNear={sendTransactionNear}
            sendTransactionEVM={sendTransactionEVM}
            sendTransactionSolana={sendTransactionSolana}
          >
            <DepositUIMachineFormSyncProvider
              userAddress={userAddress}
              userChainType={chainType}
            >
              <DepositForm chainType={chainType} />
            </DepositUIMachineFormSyncProvider>
          </DepositUIMachineProvider>
        </DepositFormProvider>
      </DepositWidgetProvider>
    </WidgetRoot>
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
