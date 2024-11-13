import { Box, Flex, Link, Text } from "@radix-ui/themes"
import { AssetComboIcon } from "src/components/Asset/AssetComboIcon"
import { formatTokenValue } from "src/utils/format"
import type { Context } from "../../../machines/depositUIMachine"

const NEAR_EXPLORER = "https://nearblocks.io"

export const Deposits = ({
  depositNearResult,
}: {
  depositNearResult: Context["depositNearResult"]
}) => {
  if (depositNearResult?.tag !== "ok") {
    return null
  }
  const txUrl =
    depositNearResult.value.txHash != null
      ? `${NEAR_EXPLORER}/txns/${depositNearResult.value.txHash}`
      : null

  return (
    <Flex p={"2"} gap={"3"}>
      <Box pt={"2"}>
        <AssetComboIcon
          icon={depositNearResult.value.depositDescription.asset.icon}
          name={depositNearResult.value.depositDescription.asset.name}
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
                depositNearResult.value.depositDescription.userAddressId
              )}
            </Text>
          </Box>

          <Box>
            <Text size={"1"} weight={"medium"} color={"green"}>
              +
              {formatTokenValue(
                depositNearResult.value.depositDescription.amount,
                depositNearResult.value.depositDescription.asset.decimals,
                {
                  min: 0.0001,
                  fractionDigits: 4,
                }
              )}{" "}
              {depositNearResult.value.depositDescription.asset.symbol}
            </Text>
          </Box>
        </Flex>

        {depositNearResult.value.txHash != null && txUrl != null && (
          <Box>
            <Text size={"1"} color={"gray"}>
              Transaction:
            </Text>{" "}
            <Text size={"1"}>
              <Link href={txUrl} target={"_blank"}>
                {shortenText(depositNearResult.value.txHash)}
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
