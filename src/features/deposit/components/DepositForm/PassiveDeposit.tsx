import { CheckIcon, CopyIcon } from "@radix-ui/react-icons"
import { Button, Spinner } from "@radix-ui/themes"
import { QRCodeSVG } from "qrcode.react"
import { Copy } from "../../../../components/IntentCard/CopyButton"
import type { BaseTokenInfo } from "../../../../types/base"
import type { BlockchainEnum } from "../../../../types/interfaces"
import { renderDepositHint } from "./renderDepositHint"

export type PassiveDepositProps = {
  network: BlockchainEnum
  depositAddress: string | null
  minDepositAmount: bigint | null
  token: BaseTokenInfo
}

export function PassiveDeposit({
  network,
  depositAddress,
  minDepositAmount,
  token,
}: PassiveDepositProps) {
  const truncatedAddress = truncateAddress(depositAddress ?? "")

  return (
    <div className="flex flex-col items-stretch">
      <div className="font-bold text-label text-sm">
        Use this deposit address
      </div>

      <div className="mt-1 text-gray-11 text-sm dark:text-gray-11">
        Always double-check your deposit address — it may change without notice.
      </div>

      <div className="my-6 flex items-center justify-center">
        <div className="flex size-36 items-center justify-center rounded-lg border border-border p-2">
          {depositAddress != null ? (
            <QRCodeSVG value={depositAddress} />
          ) : (
            <Spinner loading={true} />
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center rounded-lg bg-gray-3 px-4 py-2">
        <div className="flex flex-1 justify-center">
          <span className="relative">
            {/* Visible truncated address */}
            <span className="pointer-events-none font-medium font-mono text-label text-sm">
              {truncatedAddress}
            </span>

            {/* Hidden full address for copy functionality */}
            <input
              type="text"
              value={depositAddress ?? ""}
              readOnly
              style={{
                // It's easier to make the input transparent using CSS instead of Tailwind
                all: "unset",
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                color: "transparent",
              }}
            />
          </span>
        </div>

        <div className="shrink-0">
          <Copy text={depositAddress ?? ""}>
            {(copied) => (
              <Button
                type="button"
                size="4"
                variant="solid"
                className="box-border size-8 p-0"
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            )}
          </Copy>
        </div>
      </div>

      {renderDepositHint(network, minDepositAmount, token)}
    </div>
  )
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
