import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { DepositWidgetProvider } from "../../../providers"
import type {
  BaseAssetInfo,
  DepositBlockchainEnum,
  DepositWidgetProps,
} from "../../../types/deposit"
import { assert } from "../../../utils/assert"
import {
  DepositFormController,
  type DepositFormOnSelectValues,
  DepositFormType,
} from "./Form/DepositFormController"
import { DepositFormGenerateAddress } from "./Form/DepositFormGenerateAddress"
import {
  DepositFormNear,
  type DepositFormNearValues,
} from "./Form/DepositFormNear"

export const DepositWidget = ({
  tokenList,
  accountId,
  sendTransactionNear,
  onEmit,
}: DepositWidgetProps) => {
  const [formType, setFormType] = useState<DepositFormType | null>(null)
  const [blockchain, setBlockchain] = useState<DepositBlockchainEnum | null>(
    null
  )
  const [asset, setAsset] = useState<BaseAssetInfo | null>(null)
  const depositFormNearMethods = useForm<DepositFormNearValues>()

  assert(tokenList.length > 0, "Token list must have at least 1 token")

  return (
    <DepositWidgetProvider>
      <DepositFormController
        tokenList={tokenList}
        accountId={accountId}
        formType={formType}
        onSelect={(values: DepositFormOnSelectValues) => {
          setFormType(values.formType)
          setAsset({
            address: values.asset.address,
            decimals: values.asset.decimals,
            icon: values.asset.icon,
            symbol: values.asset.symbol,
          })
          setBlockchain(values.blockchain)
        }}
      >
        {formType === DepositFormType.DEPOSIT_PASSIVE &&
          blockchain &&
          asset &&
          asset.address && (
            <DepositFormGenerateAddress
              blockchain={blockchain}
              asset={asset}
              accountId={accountId}
            />
          )}
        {formType === DepositFormType.DEPOSIT_NEAR &&
          asset &&
          asset.address && (
            <FormProvider {...depositFormNearMethods}>
              <DepositFormNear
                asset={asset}
                accountId={accountId}
                sendTransaction={sendTransactionNear}
                onEmit={onEmit}
              />
            </FormProvider>
          )}
      </DepositFormController>
    </DepositWidgetProvider>
  )
}
