import { useForm } from "react-hook-form"

import { Button, Spinner, Text } from "@radix-ui/themes"
import { Form } from "../../../../../components/Form"
import { Select } from "../../../../../components/Select/Select"
import type {
  BlockchainEnum,
  DepositFormNetworkProps,
  DepositFormNetworkValues,
} from "../../../../../types/deposit"
import styles from "./styles.module.css"

export const DepositFormNetwork = ({
  blockchains,
  onSubmit,
}: DepositFormNetworkProps) => {
  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepositFormNetworkValues>({ reValidateMode: "onSubmit" })

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <Form<DepositFormNetworkValues>
          handleSubmit={handleSubmit((values: DepositFormNetworkValues) =>
            onSubmit(values)
          )}
          register={register}
        >
          <div className={styles.selectWrapper}>
            <Select<BlockchainEnum>
              options={blockchains}
              value={watch("blockchain")}
              placeholder={{ label: "Select network", icon: null }}
              onChange={(value: string) =>
                setValue("blockchain", value as BlockchainEnum)
              }
              fullWidth
            />
          </div>
          <div className={styles.buttonGroup}>
            <Button
              variant="classic"
              size="3"
              radius="large"
              className={`${styles.button} ${styles.orangeButton}`}
            >
              <div className={styles.buttonContent}>
                <Spinner loading={false} />
                <Text size="6">Generate deposit address</Text>
              </div>
            </Button>
            <Button
              variant="classic"
              size="3"
              radius="large"
              className={styles.button}
            >
              <div className={styles.buttonContent}>
                <Spinner loading={false} />
                <Text size="6">Deposit via Near</Text>
              </div>
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}
