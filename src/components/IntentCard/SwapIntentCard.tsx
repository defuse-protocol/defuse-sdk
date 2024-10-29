import { Box, Button, Flex, Link, Spinner, Text } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import type { ActorRefFrom, StateValueFrom } from "xstate"
import type { intentStatusMachine } from "../../features/machines/intentStatusMachine"
import { formatTokenValue } from "../../utils/format"
import { AssetComboIcon } from "../Asset/AssetComboIcon"

type SwapIntentCardProps = {
  intentStatusActorRef: ActorRefFrom<typeof intentStatusMachine>
}

const NEAR_EXPLORER = "https://nearblocks.io"

export function SwapIntentCard({ intentStatusActorRef }: SwapIntentCardProps) {
  const state = useSelector(intentStatusActorRef, (state) => state)
  const { tokenIn, tokenOut } = state.context
  const { totalAmountIn, totalAmountOut } = state.context.quote

  const txUrl =
    state.context.txHash != null
      ? `${NEAR_EXPLORER}/txns/${state.context.txHash}`
      : null

  return (
    <Flex p={"2"} gap={"3"}>
      <Box pt={"2"}>
        <AssetComboIcon {...tokenOut} />
      </Box>

      <Flex direction={"column"} flexGrow={"1"}>
        <Flex>
          <Box flexGrow={"1"}>
            <Text size={"2"} weight={"medium"}>
              Swap
            </Text>
          </Box>

          <Flex gap={"1"} align={"center"}>
            {(state.matches("pending") || state.matches("checking")) && (
              <Spinner size="1" />
            )}

            <Text
              size={"1"}
              weight={"medium"}
              color={
                state.matches("error") || state.matches("not_valid")
                  ? "red"
                  : undefined
              }
            >
              {renderStatusLabel(state.value)}
            </Text>

            {state.can({ type: "RETRY" }) && (
              <Button
                size={"1"}
                variant={"outline"}
                onClick={() => intentStatusActorRef.send({ type: "RETRY" })}
              >
                retry
              </Button>
            )}
          </Flex>
        </Flex>

        <Flex align={"center"}>
          <Box flexGrow={"1"}>
            <Text size={"1"} weight={"medium"} color={"gray"}>
              -
              {formatTokenValue(totalAmountIn, tokenIn.decimals, {
                min: 0.0001,
                fractionDigits: 4,
              })}{" "}
              {tokenIn.symbol}
            </Text>
          </Box>

          <Box>
            <Text size={"1"} weight={"medium"} color={"green"}>
              +
              {formatTokenValue(totalAmountOut, tokenOut.decimals, {
                min: 0.0001,
                fractionDigits: 4,
              })}{" "}
              {tokenOut.symbol}
            </Text>
          </Box>
        </Flex>

        {state.context.intentHash != null && (
          <Box>
            <Text size={"1"} color={"gray"} wrap={"nowrap"}>
              Intent: {state.context.intentHash}
            </Text>
          </Box>
        )}

        {state.context.txHash != null && txUrl != null && (
          <Box>
            <Text size={"1"} color={"gray"}>
              Transaction:
            </Text>{" "}
            <Text size={"1"}>
              <Link href={txUrl} target={"_blank"}>
                {shortenTxHash(state.context.txHash)}
              </Link>
            </Text>
          </Box>
        )}
      </Flex>
    </Flex>
  )
}

function renderStatusLabel(val: StateValueFrom<typeof intentStatusMachine>) {
  switch (val) {
    case "pending":
    case "checking":
      return "Pending"
    case "error":
      return "Can't get status"
    case "success":
      return "Completed"
    case "not_valid":
      return "Failed"
    default:
      val satisfies never
  }
}

function shortenTxHash(txHash: string) {
  return `${txHash.slice(0, 5)}...${txHash.slice(-5)}`
}
