import { useActor } from "@xstate/react"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import {
  Context,
  depositNearMachine,
} from "src/features/machines/depositNearMachine"
import { type NonReducibleUnknown, createActor, fromPromise } from "xstate"
import { DepositWidgetProvider } from "../../../providers"
import { DepositService } from "../services/depositService"
import { DepositFormController, DepositFormType } from "./DepositFormController"
import {
  DepositFormNear,
  type DepositFormNearValues,
} from "./Form/DepositFormNear"

type DepositWidgetProps = {
  accountId: string
  signAndSendTransactionsNear: (calldata: unknown) => void
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
            const { asset, amount, accountId } = input as {
              asset: string
              amount: string
              accountId: string
            }
            const calldata = depositNearService.createDepositNearTransaction(
              accountId,
              asset,
              amount
            )
            // TODO: create calldata payload
            const txHash = (await signAndSendTransactionsNear(input)) as
              | string
              | undefined
            return txHash || "" // TODO: Ensure a TX hash is returned
          }
        ),
      },
    })
  )

  depositNearActor.subscribe((state) => {
    console.log("Current state:", state.value)
    console.log("Context:", state.context)
  })

  const handleSubmitNear = async (values: DepositFormNearValues) => {
    console.log("handleSubmitNear", values)
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
