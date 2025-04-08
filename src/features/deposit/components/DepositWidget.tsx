import { TokenListUpdater } from "../../../components/TokenListUpdater"
import { WidgetRoot } from "../../../components/WidgetRoot"
import { DepositWidgetProvider } from "../../../providers/DepositWidgetProvider"
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
  renderHostAppLink,
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
              <DepositForm
                chainType={chainType}
                renderHostAppLink={renderHostAppLink}
              />
            </DepositUIMachineFormSyncProvider>
          </DepositUIMachineProvider>
        </DepositFormProvider>
      </DepositWidgetProvider>
    </WidgetRoot>
  )
}
