import { Box, Button, Flex, Link, Spinner, Text } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import type { ActorRefFrom, StateValueFrom } from "xstate"
import type { intentStatusMachine } from "../../features/machines/intentStatusMachine"
import { assert } from "../../utils/assert"
import { formatTokenValue } from "../../utils/format"
import { AssetComboIcon } from "../Asset/AssetComboIcon"
import { CopyButton } from "./CopyButton"

type WithdrawIntentCardProps = {
  intentStatusActorRef: ActorRefFrom<typeof intentStatusMachine>
}

const NEAR_EXPLORER = "https://nearblocks.io"

export function WithdrawIntentCard({
  intentStatusActorRef,
}: WithdrawIntentCardProps) {
  const state = useSelector(intentStatusActorRef, (state) => state)
  const { tokenOut, intentDescription } = state.context

  assert(intentDescription.type === "withdraw", "Type must be withdraw")
  const amountWithdrawn = intentDescription.amountWithdrawn

  const txUrl =
    state.context.txHash != null
      ? `${NEAR_EXPLORER}/txns/${state.context.txHash}`
      : null

  return (
    <Flex p="2" gap="3">
      <Box pt="2">
        <AssetComboIcon {...tokenOut} />
      </Box>

      <Flex direction="column" gap="1" flexGrow="1">
        <Flex>
          <Box flexGrow="1">
            <Text size="2" weight="medium">
              Withdraw
            </Text>
          </Box>

          <Flex gap="1" align="center">
            {(state.matches("pending") || state.matches("checking")) && (
              <Spinner size="1" />
            )}

            <Text
              size="1"
              weight="medium"
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
                size="1"
                variant="outline"
                onClick={() => intentStatusActorRef.send({ type: "RETRY" })}
              >
                retry
              </Button>
            )}
          </Flex>
        </Flex>

        <Flex>
          <Flex direction="column" gap="1" flexGrow="1">
            {state.context.intentHash != null && (
              <Flex align="center" gap="1">
                <Text size="1" color="gray">
                  Intent: {truncateHash(state.context.intentHash)}
                </Text>

                <CopyButton
                  text={state.context.intentHash}
                  ariaLabel="Copy Intent hash"
                />
              </Flex>
            )}

            {state.context.txHash != null && txUrl != null && (
              <Flex align="center" gap="1">
                <Text size="1" color="gray">
                  {/* biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here */}
                  Transaction:{" "}
                  <Link href={txUrl} target="_blank" color="blue">
                    {truncateHash(state.context.txHash)}
                  </Link>
                </Text>

                <CopyButton
                  text={state.context.txHash}
                  ariaLabel="Copy Transaction hash"
                />
              </Flex>
            )}
          </Flex>

          <Text
            size="1"
            weight="medium"
            color={state.matches("not_valid") ? "gray" : "green"}
            style={{
              textDecoration: state.matches("not_valid")
                ? "line-through"
                : undefined,
            }}
          >
            +
            {formatTokenValue(
              amountWithdrawn.amount,
              amountWithdrawn.decimals,
              {
                min: 0.0001,
                fractionDigits: 4,
              }
              // biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here
            )}{" "}
            {tokenOut.symbol}
          </Text>
        </Flex>
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

function truncateHash(hash: string) {
  return `${hash.slice(0, 5)}...${hash.slice(-5)}`
}
