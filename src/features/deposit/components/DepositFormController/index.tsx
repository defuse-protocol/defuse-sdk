import type { PropsWithChildren } from "react"
import { BlockchainEnum } from "../../../../types/deposit"
import {
  DepositFormRouter,
  type DepositFormRouterValues,
} from "../Form/DepositFormRouter"
import styles from "./styles.module.css"

export enum DepositFormType {
  DEPOSIT_PASSIVE = "DepositPassiveFormType",
  DEPOSIT_NEAR = "DepositNearFormType",
}

export type DepositFormOnSelectValues = {
  formType: DepositFormType
  blockchain: BlockchainEnum
  address: string
  decimals: number
  icon: string
  symbol: string
}

interface DepositFormControllerProps extends PropsWithChildren {
  onSelect: (
    values: {
      formType: DepositFormType
    } & DepositFormRouterValues
  ) => void
  formType: DepositFormType | null
}

export const DepositFormController = ({
  children,
  onSelect,
  formType,
}: DepositFormControllerProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <DepositFormRouter
          onSubmit={(values: DepositFormRouterValues) => {
            switch (values.blockchain) {
              case BlockchainEnum.NEAR:
                onSelect({
                  formType: DepositFormType.DEPOSIT_NEAR,
                  ...values,
                })
                break
              case BlockchainEnum.ETHEREUM:
              case BlockchainEnum.BASE:
                onSelect({
                  formType: DepositFormType.DEPOSIT_PASSIVE,
                  ...values,
                })
                break
              default:
                throw new Error("Invalid blockchain")
            }
          }}
        />
        {children}
      </div>
    </div>
  )
}
