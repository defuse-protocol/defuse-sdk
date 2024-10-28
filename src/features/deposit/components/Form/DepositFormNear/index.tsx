import { Button, Spinner, Text } from "@radix-ui/themes"

import { useActor, useSelector } from "@xstate/react"

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
import type {
  BaseAssetInfo,
  DepositWidgetProps,
  Transaction,
} from "../../../../../types/deposit"
import { balanceToBignumberString } from "../../../../../utils/balanceTo"
import { formatTokenValue } from "../../../../../utils/format"
import styles from "./styles.module.css"

export type DepositFormNearValues = {
  asset: string
  amount: string
}

export interface DepositFormNearProps
  extends Pick<DepositWidgetProps, "onEmit"> {
  asset: BaseAssetInfo
  sendTransaction: (transactions: Transaction[]) => Promise<string>
  accountId: string | undefined
}

const depositNearService = new DepositService()

export const DepositFormNear = ({
  asset,
  sendTransaction,
  accountId,
  onEmit,
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
    assert(accountId != null, "Account ID is not defined")

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
    setValue("amount", formatTokenValue(balance, asset.decimals))
  }

  const [state, send] = useActor(
    depositNearMachine.provide({
      actors: {
        signAndSendTransactions: fromPromise(async ({ input }) => {
          const { asset, amount } = input
          assert(asset != null, "Asset is not selected")
          assert(amount != null, "Amount is not selected")

          let transactions: Transaction[] = []
          let transactionNative: Transaction[] = []

          // We have to check if the amount is greater than the balance then
          // we have to create a batch transaction for the NEAR deposit first
          // and then the FT deposit
          if (Number(amount) > Number(balanceData || 0n)) {
            transactionNative =
              depositNearService.createNativeDepositNearTransaction(
                (BigInt(amount) - BigInt(balanceData || 0n)).toString()
              )
          }
          const transactionFungible =
            depositNearService.createDepositNearTransaction(
              settings.defuseContractId,
              asset,
              amount
            )

          transactions = [...transactionNative, ...transactionFungible]
          const txHash = await sendTransaction(transactions)
          return txHash
        }),
        validateTransaction: fromPromise(async ({ input }) => {
          const { txHash, accountId, amount } = input
          assert(txHash != null, "Tx hash is not defined")
          assert(accountId != null, "Account ID is not defined")
          assert(amount != null, "Amount is not defined")
          const isValid = await depositNearService.checkNearTransactionValidity(
            txHash,
            accountId,
            amount
          )
          return isValid
        }),
      },
      guards: {
        isDepositValid: ({ context }) => {
          if (!context.txHash) return false
          return true
        },
      },
    })
  )

  useEffect(() => {
    if (!accountId) return

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to reset the amount when the asset changes
  useEffect(() => {
    setValue("amount", "")
  }, [asset, setValue])

  // TODO: Remove this once we have the deposit fully working
  console.log(state.value, state)

  // TODO: Subscribe to the SUCCESSFUL_DEPOSIT event
  useEffect(() => {
    if (state.matches("Completed")) {
      onEmit?.({
        type: "SUCCESSFUL_DEPOSIT",
        data: state.context.txHash,
      })
    }
    if (state.matches("Aborted")) {
      onEmit?.({
        type: "FAILED_DEPOSIT",
        data: null,
        error: state.context.error,
      })
    }
  }, [state, onEmit])

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
          disabled={!watch("amount") || !accountId}
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
