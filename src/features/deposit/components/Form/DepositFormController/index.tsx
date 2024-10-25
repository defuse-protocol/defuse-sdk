import { type PropsWithChildren, useEffect } from "react"
import type { SwappableToken } from "src/types"
import { BlockchainEnum } from "../../../../../types/deposit"
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
  blockchain: BlockchainEnum
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
