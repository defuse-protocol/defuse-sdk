import { useActor } from "@xstate/react"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import {
  Context,
  depositNearMachine,
} from "src/features/machines/depositNearMachine"
import { type NonReducibleUnknown, createActor, fromPromise } from "xstate"
import { DepositWidgetProvider } from "../../../providers"
import type { Transaction } from "../../../types/deposit"
import { DepositService } from "../services/depositService"
import { DepositFormController, DepositFormType } from "./DepositFormController"
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

  // TODO: Remove
  depositNearActor.subscribe((state) => {
    console.log("Current state:", state.value)
    console.log("Context:", state.context)
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
        onSelect={(values: DepositFormType) => setFormType(values)}
      >
        {formType === DepositFormType.DEPOSIT_PASSIVE && <div>form 1</div>}
        {formType === DepositFormType.DEPOSIT_NEAR && (
          <FormProvider {...depositFormNearMethods}>
            <DepositFormNear onSubmit={handleSubmitNear} />
          </FormProvider>
        )}
      </DepositFormController>
    </DepositWidgetProvider>
  )
}
