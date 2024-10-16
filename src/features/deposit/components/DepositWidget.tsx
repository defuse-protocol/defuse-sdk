import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { type NonReducibleUnknown, createActor, fromPromise } from "xstate"
import { depositGenerateAddressMachine } from "../../../features/machines/depositGenerateAddressMachine"
import { depositNearMachine } from "../../../features/machines/depositNearMachine"
import { DepositWidgetProvider } from "../../../providers"
import type {
  BaseAssetInfo,
  BlockchainEnum,
  Transaction,
} from "../../../types/deposit"
import { DepositService } from "../services/depositService"
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

const depositNearService = new DepositService()

export const DepositWidget = ({
  accountId,
  signAndSendTransactionsNear,
}: DepositWidgetProps) => {
  const [formType, setFormType] = useState<DepositFormType | null>(null)
  const [blockchain, setBlockchain] = useState<BlockchainEnum | null>(null)
  const [asset, setAsset] = useState<BaseAssetInfo | null>(null)
  const [generateAddress, setGenerateAddress] = useState<string | null>(null)
  const depositFormNearMethods = useForm<DepositFormNearValues>()

  const depositNearActor = createActor(
    depositNearMachine.provide({
      actors: {
        signAndSendTransactions: fromPromise(
          async ({ input }: { input: NonReducibleUnknown }) => {
            const { asset, amount } = input as {
              asset: string
              amount: string
            }
            const transactions =
              depositNearService.createDepositNearTransaction(
                "defuse.near", // TODO: Contract hasn't been deployed yet
                asset,
                amount
              )
            const txHash = (await signAndSendTransactionsNear(transactions)) as
              | string
              | undefined
            return txHash || "" // TODO: Ensure a TX hash is returned
          }
        ),
      },
    })
  )
  const generateAddressActor = createActor(
    depositGenerateAddressMachine.provide({
      actors: {
        generateDepositAddress: fromPromise(
          async ({ input }: { input: NonReducibleUnknown }) =>
            depositNearService.generateDepositAddress(
              blockchain as BlockchainEnum,
              asset?.address as string
            )
        ),
      },
    })
  )

  generateAddressActor.subscribe((state) => {
    if (state.value === "Genereted") {
      setGenerateAddress(state.context.depositAddress)
    }
  })

  const handleSubmitNear = async (values: DepositFormNearValues) => {
    depositNearActor.start()
    depositNearActor.send({
      type: "INPUT",
      asset: values.asset,
      amount: values.amount,
      accountId,
    })
  }

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
          if (values.formType === DepositFormType.DEPOSIT_PASSIVE) {
            generateAddressActor.start()
            generateAddressActor.send({
              type: "INPUT",
              blockchain: values.blockchain,
              assetAddress: values.address,
            })
          }
        }}
      >
        {formType === DepositFormType.DEPOSIT_PASSIVE &&
          blockchain &&
          asset?.address &&
          generateAddress && (
            <DepositFormGenerateAddress
              blockchain={blockchain}
              address={generateAddress}
              onBack={() => setFormType(null)}
            />
          )}
        {formType === DepositFormType.DEPOSIT_NEAR && asset && (
          <FormProvider {...depositFormNearMethods}>
            <DepositFormNear
              asset={asset}
              onSubmit={handleSubmitNear}
              onBack={() => setFormType(null)}
            />
          </FormProvider>
        )}
      </DepositFormController>
    </DepositWidgetProvider>
  )
}
