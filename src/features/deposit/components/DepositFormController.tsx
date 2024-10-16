import type { PropsWithChildren } from "react"
import { BlockchainEnum } from "../../../types/deposit"
import {
  DepositFormRouter,
  type DepositFormRouterValues,
} from "./Form/DepositFormRouter"

export enum DepositFormType {
  DEPOSIT_PASSIVE = "DepositPassiveFormType",
  DEPOSIT_NEAR = "DepositNearFormType",
}

interface DepositFormControllerProps extends PropsWithChildren {
  onSelect: (values: DepositFormType) => void
  formType: DepositFormType | null
}

export const DepositFormController = ({
  children,
  onSelect,
  formType,
}: DepositFormControllerProps) => {
  return (
    <>
      {!formType && (
        <DepositFormRouter
          onSubmit={(values: DepositFormRouterValues) => {
            switch (values.blockchain) {
              case BlockchainEnum.NEAR:
                onSelect(DepositFormType.DEPOSIT_NEAR)
                break
              case BlockchainEnum.ETHEREUM:
              case BlockchainEnum.BASE:
                onSelect(DepositFormType.DEPOSIT_PASSIVE)
                break
              default:
                throw new Error("Invalid blockchain")
            }
          }}
        />
      )}
      {children}
    </>
  )
}
