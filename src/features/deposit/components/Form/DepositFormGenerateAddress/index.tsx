import { InfoCircledIcon } from "@radix-ui/react-icons"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip"
import { Flex, IconButton } from "@radix-ui/themes"
import { useActor } from "@xstate/react"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useState } from "react"
import { assert } from "vitest"
import { fromPromise } from "xstate"
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
        generateDepositAddress: fromPromise(async ({ input }) => {
          const { blockchain, assetAddress } = input
          assert(blockchain != null, "Blockchain is not selected")
          assert(assetAddress != null, "Asset is not selected")
          const address = await depositNearService.generateDepositAddress(
            blockchain,
            assetAddress
          )
          return address
        }),
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
      <h2 className={styles.title}>Deposit to the address below</h2>
      <p className={styles.instruction}>
        Withdraw assets from an exchange to the Ethereum address above. Upon
        confirmation, you will receive your assets on Defuse within minutes.
      </p>
      <div className={styles.qrCodeWrapper}>
        {generateAddress && <QRCodeSVG value={generateAddress} />}
      </div>
      <Flex
        direction="row"
        gap="2"
        align="center"
        justify="center"
        className={styles.hintWrapper}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <InfoCircledIcon />
            </TooltipTrigger>
            <TooltipContent>
              <span className={styles.tooltipContent}>
                Make sure to select Ethereum as the withdrawal network
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <p className={styles.hint}>
          Make sure to select {blockchain} as the withdrawal network
        </p>
      </Flex>
    </div>
  )
}
