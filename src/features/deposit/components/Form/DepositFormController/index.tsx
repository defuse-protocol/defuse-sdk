import type { PropsWithChildren } from "react"
import { DepositBlockchainEnum, type SwappableToken } from "src/types"
import {
  DepositFormRouter,
  type DepositFormRouterValues,
} from "../DepositFormRouter"
import styles from "./styles.module.css"

export enum DepositFormType {
  DEPOSIT_PASSIVE = "DepositPassiveFormType",
  DEPOSIT_NEAR = "DepositNearFormType",
}

export type DepositFormOnSelectValues = {
  formType: DepositFormType
  blockchain: DepositBlockchainEnum
  asset: {
    address: string
    decimals: number
    icon: string
    symbol: string
  }
}

interface DepositFormControllerProps extends PropsWithChildren {
  tokenList: SwappableToken[]
  onSelect: (
    values: {
      formType: DepositFormType
    } & DepositFormRouterValues
  ) => void
  formType: DepositFormType | null
}

export const DepositFormController = ({
  tokenList,
  children,
  onSelect,
}: DepositFormControllerProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <DepositFormRouter
          tokenList={tokenList}
          onSubmit={(values: DepositFormRouterValues) => {
            switch (values.blockchain) {
              case DepositBlockchainEnum.NEAR:
                onSelect({
                  formType: DepositFormType.DEPOSIT_NEAR,
                  ...values,
                })
                break
              case DepositBlockchainEnum.ETHEREUM:
              case DepositBlockchainEnum.BASE:
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
