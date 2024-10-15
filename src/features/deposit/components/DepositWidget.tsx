import { useActor } from "@xstate/react"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { depositNearMachine } from "src/features/machines/depositNearMachine"
import { createActor, fromPromise } from "xstate"
import { DepositWidgetProvider } from "../../../providers"
import { DepositFormController, DepositFormType } from "./DepositFormController"
import {
  DepositFormNear,
  type DepositFormNearValues,
} from "./Form/DepositFormNear"

type DepositWidgetProps = {
  signAndSendTransactionsNear: (calldata: unknown) => void
}

export const DepositWidget = ({
  signAndSendTransactionsNear,
}: DepositWidgetProps) => {
  const [formType, setFormType] = useState<DepositFormType | null>(null)
  const depositFormNearMethods = useForm<DepositFormNearValues>()

  const depositNearActor = createActor(
    depositNearMachine.provide({
      actors: {
        signAndSendTransactions: fromPromise(async ({ input }) => {
          console.log("signAndSendTransactions", input)
          // TODO: create calldata payload
          const txHash = (await signAndSendTransactionsNear(input)) as
            | string
            | undefined
          return txHash || "" // TODO: Ensure a TX hash is returned
        }),
      },
    }),
    { input: {} }
  )

  const handleSubmitNear = async (values: DepositFormNearValues) => {
    console.log("handleSubmitNear", values)
    depositNearActor.send({
      type: "INPUT",
      asset: values.asset,
      amount: values.amount,
    })
  }

  depositNearActor.subscribe((snapshot) => {
    console.log(snapshot.status)
  })

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
