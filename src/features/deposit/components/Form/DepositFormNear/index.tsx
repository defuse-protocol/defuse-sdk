import { Button, Spinner, Text } from "@radix-ui/themes"

import { useActor } from "@xstate/react"
import { useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import { type NonReducibleUnknown, fromPromise } from "xstate"
import { Form } from "../../../../../components/Form"
import { FieldComboInput } from "../../../../../components/Form/FieldComboInput"
import { DepositService } from "../../../../../features/deposit/services/depositService"
import { depositNearMachine } from "../../../../../features/machines/depositNearMachine"
import type { NetworkTokenWithSwapRoute } from "../../../../../types"
import type { BaseTokenInfo } from "../../../../../types/base"
import type { BaseAssetInfo, Transaction } from "../../../../../types/deposit"
import { balanceToBignumberString } from "../../../../../utils/balanceTo"
import styles from "./styles.module.css"

export type DepositFormNearValues = {
  asset: string
  amount: string
}

export interface DepositFormNearProps {
  asset: BaseAssetInfo
  signAndSendTransactionsNear: (transactions: Transaction[]) => void
  accountId: string
}

const depositNearService = new DepositService()

export const DepositFormNear = ({
  asset,
  signAndSendTransactionsNear,
  accountId,
}: DepositFormNearProps) => {
  const [selectToken, setSelectToken] = useState<NetworkTokenWithSwapRoute>()
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useFormContext<DepositFormNearValues>()

  const [state, send] = useActor(
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

  const onSubmit = async (values: DepositFormNearValues) => {
    send({
      type: "INPUT",
      asset: values.asset,
      amount: values.amount,
      accountId,
    })
  }

  useEffect(() => {
    if (asset) {
      const tokenAdapter: BaseTokenInfo = {
        defuseAssetId: asset.address,
        address: asset.address,
        symbol: asset.address,
        name: asset.address,
        decimals: asset.decimals,
        icon: asset.icon,
        chainId: "",
        chainIcon: "",
        chainName: "",
        routes: [],
      }
      setSelectToken(tokenAdapter)
    }
  }, [asset])

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <Form<DepositFormNearValues>
          handleSubmit={handleSubmit((values: DepositFormNearValues) =>
            onSubmit({
              ...values,
              amount: balanceToBignumberString(values.amount, asset.decimals),
            })
          )}
          register={register}
        >
          <FieldComboInput<DepositFormNearValues>
            fieldName="amount"
            selected={selectToken}
            className="border rounded-t-xl"
            required="This field is required"
          />
          <div className={styles.buttonGroup}>
            <Button className={`${styles.button} ${styles.orangeButton}`}>
              <span className={styles.buttonContent}>
                <Spinner loading={false} />
                <Text size="6">Deposit</Text>
              </span>
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}
