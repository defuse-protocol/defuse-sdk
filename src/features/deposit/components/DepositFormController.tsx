import type { PropsWithChildren } from "react"
import { BlockchainEnum } from "../../../types/deposit"
import {
  DepositFormNetwork,
  type DepositFormNetworkValues,
} from "./Form/DepositFormNetwork"

export enum DepositFormType {
  DEPOSIT_PASSIVE = "DepositPassiveFormType",
  DEPOSIT_NEAR = "DepositNearFormType",
}

interface DepositFormControllerProps extends PropsWithChildren {
  onSelect: (values: DepositFormType) => void
  formType: DepositFormType | null
}

const blockchains = {
  near: { label: BlockchainEnum.NEAR, icon: null },
  ethereum: { label: BlockchainEnum.ETHEREUM, icon: null },
  base: { label: BlockchainEnum.BASE, icon: null },
}

export const DepositFormController = ({
  children,
  onSelect,
  formType,
}: DepositFormControllerProps) => {
  return (
    <>
      {!formType && (
        <DepositFormNetwork
          options={blockchains}
          onSubmit={(values: DepositFormNetworkValues) => {
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
