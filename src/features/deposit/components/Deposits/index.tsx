import { Box, Flex, Link, Text } from "@radix-ui/themes"
import { AssetComboIcon } from "src/components/Asset/AssetComboIcon"
import type { SupportedChainName } from "src/types"
import { assert } from "src/utils/assert"
import { chainTxExplorer } from "src/utils/chainTxExplorer"
import { formatTokenValue } from "src/utils/format"
import type { Context } from "../../../machines/depositUIMachine"

export const Deposits = ({
  chainName,
  depositResult,
}: {
  chainName: SupportedChainName | null
  depositResult: Context["depositNearResult"] | Context["depositTurboResult"]
}) => {
  if (depositResult?.tag !== "ok") {
    return null
  }
  const explorerUrl = chainName != null && chainTxExplorer(chainName)
  const txHash = depositResult.value.txHash

  assert(txHash != null, "txHash should not be null")
  assert(explorerUrl != null, "explorerUrl should not be null")

  const txUrl = explorerUrl + txHash

  return (
    <Flex p={"2"} gap={"3"}>
      <Box pt={"2"}>
        <AssetComboIcon
          icon={depositResult.value.depositDescription.asset.icon}
          name={depositResult.value.depositDescription.asset.name}
        />
      </Box>

      <Flex direction={"column"} flexGrow={"1"}>
        <Flex>
          <Box flexGrow={"1"}>
            <Text size={"2"} weight={"medium"}>
              Deposit
            </Text>
          </Box>

          <Flex gap={"1"} align={"center"}>
            <Text size={"1"} weight={"medium"}>
              Completed
            </Text>
          </Flex>
        </Flex>

        <Flex align={"center"}>
          <Box flexGrow={"1"}>
            <Text size={"1"} weight={"medium"} color={"gray"}>
              From{" "}
              {shortenText(
                depositResult.value.depositDescription.userAddressId
              )}
            </Text>
          </Box>

          <Box>
            <Text size={"1"} weight={"medium"} color={"green"}>
              +
              {formatTokenValue(
                depositResult.value.depositDescription.amount,
                depositResult.value.depositDescription.asset.decimals,
                {
                  min: 0.0001,
                  fractionDigits: 4,
                }
              )}{" "}
              {depositResult.value.depositDescription.asset.symbol}
            </Text>
          </Box>
        </Flex>

        {depositResult.value.txHash != null && txUrl != null && (
          <Box>
            <Text size={"1"} color={"gray"}>
              Transaction:
            </Text>{" "}
            <Text size={"1"}>
              <Link href={txUrl} target={"_blank"}>
                {shortenText(depositResult.value.txHash)}
              </Link>
            </Text>
          </Box>
        )}
      </Flex>
    </Flex>
  )
}

function shortenText(text: string) {
  return `${text.slice(0, 5)}...${text.slice(-5)}`
}
