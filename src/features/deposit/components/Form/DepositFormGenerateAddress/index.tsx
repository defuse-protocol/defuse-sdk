import { useActor } from "@xstate/react"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useState } from "react"
import { assert } from "vitest"
import { type NonReducibleUnknown, fromPromise } from "xstate"
import { DepositService } from "../../../../../features/deposit/services/depositService"
import { depositGenerateAddressMachine } from "../../../../../features/machines/depositGenerateAddressMachine"
import type {
  BaseAssetInfo,
  BlockchainEnum,
} from "../../../../../types/deposit"
import styles from "./styles.module.css"

type DepositFormGenerateAddressProps = {
  blockchain: BlockchainEnum
  asset: BaseAssetInfo
}

const depositNearService = new DepositService()

export const DepositFormGenerateAddress = ({
  blockchain,
  asset,
}: DepositFormGenerateAddressProps) => {
  const [generateAddress, setGenerateAddress] = useState<string | null>(null)
  const [state, send] = useActor(
    depositGenerateAddressMachine.provide({
      actors: {
        generateDepositAddress: fromPromise(
          async ({ input }: { input: NonReducibleUnknown }) => {
            const { blockchain, assetAddress } = input as {
              blockchain: BlockchainEnum
              assetAddress: string
            }
            const address = await depositNearService.generateDepositAddress(
              blockchain,
              assetAddress
            )
            return address
          }
        ),
      },
    })
  )

  useEffect(() => {
    send({
      type: "INPUT",
      blockchain: blockchain,
      assetAddress: asset.address,
    })
  }, [send, blockchain, asset.address])

  useEffect(() => {
    if (state.value === "Genereted") {
      setGenerateAddress(state.context.depositAddress)
    }
  }, [state])

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Deposit {blockchain}</h2>
      <p className={styles.instruction}>Send your funds to this address:</p>
      <div className={styles.qrCodeWrapper}>
        {generateAddress && <QRCodeSVG value={generateAddress} />}
      </div>
      <p className={styles.address}>{generateAddress}</p>
    </div>
  )
}
