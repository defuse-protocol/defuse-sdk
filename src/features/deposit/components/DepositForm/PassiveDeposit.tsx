import { CopyIcon, InfoCircledIcon } from "@radix-ui/react-icons"
import { Button, Callout, Flex, Spinner, Text } from "@radix-ui/themes"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"
import CopyToClipboard from "react-copy-to-clipboard"
import { Input } from "../../../../components/Input"
import type { BaseTokenInfo } from "../../../../types/base"
import { BlockchainEnum } from "../../../../types/interfaces"
import type { SwappableToken } from "../../../../types/swap"
import { formatTokenValue } from "../../../../utils/format"

export type PassiveDepositProps = {
  network: BlockchainEnum
  depositAddress: string | null
  minDepositAmount: bigint | null
  token: BaseTokenInfo | null
}

export function PassiveDeposit({
  network,
  depositAddress,
  minDepositAmount,
  token,
}: PassiveDepositProps) {
  const [isCopied, setIsCopied] = useState(false)

  return (
    <div className="flex flex-col items-stretch">
      <h2 className="text-[#21201C] text-center text-base font-bold leading-6">
        Deposit to the address below
      </h2>
      <p className="text-[#63635E] text-center text-sm font-normal leading-5 mb-4">
        {/* biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here */}
        Withdraw assets from an exchange to the{" "}
        {/* biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here */}
        {network != null ? networkSelectToLabel[network] : "(empty)"} address
        below. Upon confirmation, you will receive your assets on Defuse within
        minutes.
      </p>
      <div className="flex justify-center items-center w-full min-h-[188px] mb-4 rounded-lg bg-[#FDFDFC] border border-[#F1F1F1] p-4">
        {depositAddress ? (
          <QRCodeSVG value={depositAddress} />
        ) : (
          <Spinner loading={true} />
        )}
      </div>
      {depositAddress && (
        <Input
          name="generatedAddress"
          value={depositAddress ? truncateUserAddress(depositAddress) : ""}
          disabled
          className="min-h-14 py-0 mb-4 [&>input]:text-base"
          slotRight={
            <Button
              type="button"
              size="2"
              variant="soft"
              className="px-3"
              disabled={!depositAddress}
            >
              <CopyToClipboard
                text={depositAddress}
                onCopy={() => setIsCopied(true)}
              >
                <Flex gap="2" align="center">
                  <Text>{isCopied ? "Copied" : "Copy"}</Text>
                  <Text asChild>
                    <CopyIcon height="14" width="14" />
                  </Text>
                </Flex>
              </CopyToClipboard>
            </Button>
          }
        />
      )}

      {renderDepositHint(network, minDepositAmount, token)}
    </div>
  )
}

const networkSelectToLabel: Record<BlockchainEnum, string> = {
  [BlockchainEnum.NEAR]: "NEAR",
  [BlockchainEnum.ETHEREUM]: "Ethereum",
  [BlockchainEnum.BASE]: "Base",
  [BlockchainEnum.ARBITRUM]: "Arbitrum",
  [BlockchainEnum.BITCOIN]: "Bitcoin",
  [BlockchainEnum.SOLANA]: "Solana",
  [BlockchainEnum.DOGECOIN]: "Dogecoin",
  [BlockchainEnum.TURBOCHAIN]: "TurboChain",
  [BlockchainEnum.AURORA]: "Aurora",
  [BlockchainEnum.XRPLEDGER]: "XRP Ledger",
}

function truncateUserAddress(hash: string) {
  return `${hash.slice(0, 12)}...${hash.slice(-12)}`
}

function renderDepositHint(
  network: BlockchainEnum | null,
  minDepositAmount: bigint | null,
  token: SwappableToken | null
) {
  return (
    <Callout.Root size="1" color="indigo" variant="soft">
      <Callout.Icon>
        <InfoCircledIcon />
      </Callout.Icon>

      {network != null && (
        <Callout.Text>
          Make sure to select {networkSelectToLabel[network]} as the deposit
          network
        </Callout.Text>
      )}

      {minDepositAmount != null && minDepositAmount > 1n && token != null && (
        <Callout.Text>
          {/* biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here */}
          Minimal amount to deposit is{" "}
          <Text size="1" weight="bold">
            {formatTokenValue(minDepositAmount, token.decimals)} {token.symbol}
          </Text>
        </Callout.Text>
      )}
    </Callout.Root>
  )
}
