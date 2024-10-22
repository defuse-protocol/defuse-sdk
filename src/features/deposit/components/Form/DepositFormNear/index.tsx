import { Button, Spinner, Text } from "@radix-ui/themes"

import { useActor } from "@xstate/react"

import { useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import { settings } from "src/config/settings"
import { assert } from "vitest"
import { fromPromise, log } from "xstate"
import { Form } from "../../../../../components/Form"
import { FieldComboInput } from "../../../../../components/Form/FieldComboInput"
import { Input } from "../../../../../components/Input"
import { DepositService } from "../../../../../features/deposit/services/depositService"
import { depositNearMachine } from "../../../../../features/machines/depositNearMachine"
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
  const [selectToken, setSelectToken] = useState<BaseTokenInfo>()
  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<DepositFormNearValues>()

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
          const txHash = (await signAndSendTransactionsNear(transactions)) as
            | string
            | undefined
          return txHash || "" // TODO: Ensure a TX hash is returned
        }),
      },
    })
  )
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
    setValue("amount", "10")
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
          >
            Max
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
