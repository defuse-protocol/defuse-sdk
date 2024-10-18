import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { DepositWidgetProvider } from "../../../providers"
import type {
  BaseAssetInfo,
  BlockchainEnum,
  Transaction,
} from "../../../types/deposit"
import {
  DepositFormController,
  type DepositFormOnSelectValues,
  DepositFormType,
} from "./DepositFormController"
import { DepositFormGenerateAddress } from "./Form/DepositFormGenerateAddress"
import {
  DepositFormNear,
  type DepositFormNearValues,
} from "./Form/DepositFormNear"

type DepositWidgetProps = {
  accountId: string
  signAndSendTransactionsNear: (transactions: Transaction[]) => void
}

export const DepositWidget = ({
  accountId,
  signAndSendTransactionsNear,
}: DepositWidgetProps) => {
  const [formType, setFormType] = useState<DepositFormType | null>(null)
  const [blockchain, setBlockchain] = useState<BlockchainEnum | null>(null)
  const [asset, setAsset] = useState<BaseAssetInfo | null>(null)
  const depositFormNearMethods = useForm<DepositFormNearValues>()

  return (
    <DepositWidgetProvider>
      <DepositFormController
        formType={formType}
        onSelect={(values: DepositFormOnSelectValues) => {
          setFormType(values.formType)
          setAsset({
            address: values.address,
            decimals: values.decimals,
            icon: values.icon,
            symbol: values.symbol,
          })
          setBlockchain(values.blockchain)
        }}
      >
        {formType === DepositFormType.DEPOSIT_PASSIVE &&
          blockchain &&
          asset &&
          asset.address && (
            <DepositFormGenerateAddress blockchain={blockchain} asset={asset} />
          )}
        {formType === DepositFormType.DEPOSIT_NEAR &&
          asset &&
          asset.address && (
            <FormProvider {...depositFormNearMethods}>
              <DepositFormNear
                asset={asset}
                accountId={accountId}
                signAndSendTransactionsNear={signAndSendTransactionsNear}
              />
            </FormProvider>
          )}
      </DepositFormController>
    </DepositWidgetProvider>
  )
}
