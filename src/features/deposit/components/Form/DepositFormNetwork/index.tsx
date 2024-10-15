import { useForm } from "react-hook-form"

import { Button, Spinner, Text } from "@radix-ui/themes"
import { Form } from "../../../../../components/Form"
import { Select } from "../../../../../components/Select/Select"
import { BlockchainEnum } from "../../../../../types/deposit"
import styles from "./styles.module.css"

export type DepositFormNetworkValues = {
  blockchain: BlockchainEnum
}

export interface DepositFormNetworkProps {
  options: {
    [key in BlockchainEnum]: {
      label: BlockchainEnum
      icon: React.ReactNode | null
    }
  }
  onSubmit: (values: DepositFormNetworkValues) => void
}

export const DepositFormNetwork = ({
  options,
  onSubmit,
}: DepositFormNetworkProps) => {
  const {
    handleSubmit,
    register,
    watch,
    formState: { errors },
  } = useForm<DepositFormNetworkValues>({ reValidateMode: "onSubmit" })

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <Form<DepositFormNetworkValues>
          handleSubmit={handleSubmit(onSubmit)}
          register={register}
        >
          <div className={styles.selectWrapper}>
            <Select<BlockchainEnum, DepositFormNetworkValues>
              name="blockchain"
              register={register}
              options={options}
              placeholder={{ label: "Select network", icon: null }}
              fullWidth
            />
          </div>
          <div className={styles.buttonGroup}>
            {watch("blockchain") !== BlockchainEnum.NEAR && (
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
            )}
            {watch("blockchain") === BlockchainEnum.NEAR && (
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
            )}
          </div>
        </Form>
      </div>
    </div>
  )
}
