import { Button, Spinner, Text } from "@radix-ui/themes"

import { useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import { Form } from "../../../../../components/Form"
import { FieldComboInput } from "../../../../../components/Form/FieldComboInput"
import type { ModalDepositSelectAssetsPayload } from "../../../../../components/Modal/ModalDepositSelectAssets"
import { useModalStore } from "../../../../../providers/ModalStoreProvider"
import { ModalType } from "../../../../../stores/modalStore"
import type { BaseTokenInfo } from "../../../../../types/base"
import styles from "./styles.module.css"

export type DepositFormNearValues = {
  asset: string
  amount: string
}

export interface DepositFormNearProps {
  onSubmit: (values: DepositFormNearValues) => void
}

export const DepositFormNear = ({ onSubmit }: DepositFormNearProps) => {
  const [selectToken, setSelectToken] = useState<BaseTokenInfo>()
  const [errorSelectToken, setErrorSelectToken] = useState("")
  const {
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<DepositFormNearValues>()
  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )

  const handleSelect = (
    fieldName: string,
    selectToken: BaseTokenInfo | undefined
  ) => {
    setModalType(ModalType.MODAL_DEPOSIT_SELECT_ASSETS, {
      fieldName,
      selectToken,
    })
  }

  useEffect(() => {
    if (
      (payload as ModalDepositSelectAssetsPayload)?.modalType !==
      ModalType.MODAL_DEPOSIT_SELECT_ASSETS
    ) {
      return
    }
    const { modalType, token } = payload as ModalDepositSelectAssetsPayload
    if (modalType === ModalType.MODAL_DEPOSIT_SELECT_ASSETS && token) {
      setSelectToken(token)
      setValue("asset", token.address)
      onCloseModal(undefined)
    }
  }, [payload, onCloseModal, setValue])

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <Form<DepositFormNearValues>
          handleSubmit={handleSubmit((values: DepositFormNearValues) =>
            onSubmit(values)
          )}
          register={register}
        >
          <FieldComboInput<DepositFormNearValues>
            fieldName="amount"
            selected={selectToken}
            handleSelect={() => handleSelect("amount", undefined)}
            className="border rounded-t-xl"
            required="This field is required"
            errors={errors}
            errorSelect={errorSelectToken}
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
