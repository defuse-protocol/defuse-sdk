import { Button, Spinner, Text } from "@radix-ui/themes"

import { useActor } from "@xstate/react"

import { useEffect } from "react"
import { useFormContext } from "react-hook-form"
import { settings } from "src/config/settings"
import {
  useGetNearNativeBalance,
  useGetNearNep141BalanceAccount,
} from "src/hooks/useNearGetTokenBalance"
import { assert } from "vitest"
import { fromPromise } from "xstate"
import { Form } from "../../../../../components/Form"
import { Input } from "../../../../../components/Input"
import { DepositService } from "../../../../../features/deposit/services/depositService"
import { depositNearMachine } from "../../../../../features/machines/depositNearMachine"
import type { BaseAssetInfo, Transaction } from "../../../../../types/deposit"
import {
  balanceToBignumberString,
  balanceToDecimal,
} from "../../../../../utils/balanceTo"
import styles from "./styles.module.css"

export type DepositFormNearValues = {
  asset: string
  amount: string
}

export interface DepositFormNearProps {
  asset: BaseAssetInfo
  sendTransaction: (transactions: Transaction[]) => void
  accountId: string
}

const depositNearService = new DepositService()

export const DepositFormNear = ({
  asset,
  sendTransaction,
  accountId,
}: DepositFormNearProps) => {
  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<DepositFormNearValues>()

  const {
    data: balanceData,
    mutate: mutateNearNep141BalanceAccount,
    isPending: isPendingNearNep141BalanceAccount,
  } = useGetNearNep141BalanceAccount({ retry: true })
  const {
    data: balanceNativeData,
    mutate: mutateNearNativeBalance,
    isPending: isPendingNearNativeBalance,
  } = useGetNearNativeBalance({ retry: true })

  const onSubmit = async (values: DepositFormNearValues) => {
    send({
      type: "INPUT",
      asset: asset.address,
      amount: values.amount,
      accountId,
    })
  }

  const handleSetMaxValue = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    let balance = 0n
    if (asset.address === "wrap.near") {
      balance = (balanceData || 0n) + (balanceNativeData || 0n)
    } else {
      balance = balanceData || 0n
    }
    setValue(
      "amount",
      balanceToDecimal(balance.toString(), asset.decimals).toString()
    )
  }

  const [state, send] = useActor(
    depositNearMachine.provide({
      actors: {
        signAndSendTransactions: fromPromise(async ({ input }) => {
          const { asset, amount } = input
          assert(asset != null, "Asset is not selected")
          assert(amount != null, "Amount is not selected")
          const transactions = depositNearService.createDepositNearTransaction(
            settings.defuseContractId,
            asset,
            amount
          )
          const txHash = (await sendTransaction(transactions)) as
            | string
            | undefined
          return txHash || "" // TODO: Ensure a TX hash is returned
        }),
      },
    })
  )

  useEffect(() => {
    mutateNearNep141BalanceAccount({
      tokenAddress: asset.address,
      userAddress: accountId,
    })
    asset.address === "wrap.near" &&
      mutateNearNativeBalance({
        userAddress: accountId,
      })
  }, [
    asset.address,
    accountId,
    mutateNearNep141BalanceAccount,
    mutateNearNativeBalance,
  ])

  return (
    <Form<DepositFormNearValues>
      handleSubmit={handleSubmit((values: DepositFormNearValues) =>
        onSubmit({
          ...values,
          amount: balanceToBignumberString(values.amount, asset.decimals),
        })
      )}
      register={register}
    >
      <Input
        name="amount"
        value={watch("amount")}
        onChange={(value) => setValue("amount", value)}
        type="number"
        slotRight={
          <Button
            className={styles.maxButton}
            size="2"
            onClick={handleSetMaxValue}
            disabled={
              isPendingNearNep141BalanceAccount || isPendingNearNativeBalance
            }
          >
            <Text color="orange">Max</Text>
          </Button>
        }
      />
      <div className={styles.buttonGroup}>
        <Button
          variant="classic"
          size="3"
          radius="large"
          className={`${styles.button}`}
          color="orange"
          disabled={!watch("amount")}
        >
          <span className={styles.buttonContent}>
            <Spinner loading={false} />
            <Text size="6">Deposit</Text>
          </span>
        </Button>
      </div>
    </Form>
  )
}
