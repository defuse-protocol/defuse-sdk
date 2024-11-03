import { Box, Flex, Link, Text } from "@radix-ui/themes"
import { AssetComboIcon } from "src/components/Asset/AssetComboIcon"
import type { SwappableToken } from "src/types"
import type { Context } from "../../../machines/depositUIMachine"

const NEAR_EXPLORER = "https://nearblocks.io"

export const Deposits = ({
  amount,
  asset,
  userAddressId,
  depositNearResult,
}: {
  amount: string
  asset: SwappableToken | null
  userAddressId: string
  depositNearResult: Context["depositNearResult"]
}) => {
  if (
    depositNearResult?.status !== "DEPOSIT_COMPLETED" ||
    depositNearResult?.txHash == null ||
    asset == null
  ) {
    return null
  }

  const txUrl =
    depositNearResult.txHash != null
      ? `${NEAR_EXPLORER}/txns/${depositNearResult.txHash}`
      : null

  return (
    <Flex p={"2"} gap={"3"}>
      <Box pt={"2"}>
        <AssetComboIcon icon={asset.icon} name={asset.name} />
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
              From {shortenText(userAddressId)}
            </Text>
          </Box>

          <Box>
            <Text size={"1"} weight={"medium"} color={"green"}>
              +{amount.toString()} {asset?.symbol}
            </Text>
          </Box>
        </Flex>

        {depositNearResult.txHash != null && txUrl != null && (
          <Box>
            <Text size={"1"} color={"gray"}>
              Transaction:
            </Text>{" "}
            <Text size={"1"}>
              <Link href={txUrl} target={"_blank"}>
                {shortenText(depositNearResult.txHash)}
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
