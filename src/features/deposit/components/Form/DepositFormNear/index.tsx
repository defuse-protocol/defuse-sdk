import { Button, Spinner, Text } from "@radix-ui/themes"

import { useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import { Form } from "../../../../../components/Form"
import { FieldComboInput } from "../../../../../components/Form/FieldComboInput"
import type { ModalDepositSelectAssetsPayload } from "../../../../../components/Modal/ModalDepositSelectAssets"
import { useModalStore } from "../../../../../providers/ModalStoreProvider"
import { ModalType } from "../../../../../stores/modalStore"
import type { NetworkTokenWithSwapRoute } from "../../../../../types"
import type { BaseTokenInfo } from "../../../../../types/base"
import type { BaseAssetInfo } from "../../../../../types/deposit"
import { balanceToBignumberString } from "../../../../../utils/balanceTo"
import type { DepositFormRouterValues } from "../DepositFormRouter"
import styles from "./styles.module.css"

export type DepositFormNearValues = {
  asset: string
  amount: string
}

export interface DepositFormNearProps {
  asset: BaseAssetInfo
  onSubmit: (values: DepositFormNearValues) => void
  onBack: () => void
}

export const DepositFormNear = ({
  asset,
  onSubmit,
  onBack,
}: DepositFormNearProps) => {
  const [selectToken, setSelectToken] = useState<NetworkTokenWithSwapRoute>()
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useFormContext<DepositFormNearValues>()

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
  console.log("selectToken ??", selectToken)
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
            handleSelect={() => {}}
            className="border rounded-t-xl"
            required="This field is required"
            handleClick={onBack}
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
