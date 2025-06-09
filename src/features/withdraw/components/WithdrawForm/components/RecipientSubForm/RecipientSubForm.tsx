import { MagicWandIcon, PersonIcon } from "@radix-ui/react-icons"
import { Box, Flex, IconButton, Text, TextField } from "@radix-ui/themes"
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form"
import { Controller, useFormContext } from "react-hook-form"
import { EmptyIcon } from "src/components/EmptyIcon"
import { ModalSelectNetwork } from "src/components/Network/ModalSelectNetwork"
import { Select } from "src/components/Select/Select"
import { SelectTriggerLike } from "src/components/Select/SelectTriggerLike"
import type { BalanceMapping } from "src/features/machines/depositedBalanceMachine"
import { parseDestinationMemo } from "src/features/machines/withdrawFormReducer"
import type { BlockchainEnum } from "src/sdk/poaBridge/constants/blockchains"
import type {
  BaseTokenInfo,
  SupportedChainName,
  TokenValue,
  UnifiedTokenInfo,
} from "src/types/base"
import { reverseAssetNetworkAdapter } from "src/utils/adapters"
import { validateAddress } from "src/utils/validateAddress"
import type { WithdrawFormNearValues } from "../../index"
import { truncateUserAddress } from "../../utils"
import { HotBalance } from "../HotBalance/HotBalance"
import { LongWithdrawWarning } from "../LongWithdrawWarning"

type RecipientSubFormProps = {
  control: Control<WithdrawFormNearValues>
  token: BaseTokenInfo | UnifiedTokenInfo
  balancesData: BalanceMapping
  poaBridgeBalances: Record<string, TokenValue>
  liquidityData: Record<string, bigint> | undefined
  blockchainSelectItems: Record<
    string,
    {
      label: string
      icon: React.ReactNode
      value: string
      hotBalance: TokenValue | null
    }
  >
  showHotBalances: boolean
  isNetworkModalOpen: boolean
  setIsNetworkModalOpen: (isOpen: boolean) => void
  onChangeNetwork: (network: SupportedChainName) => void
  tokenOut: BaseTokenInfo
  parsedAmountIn: { amount: bigint; decimals: number } | null
  isChainTypeSatisfiesChainName: boolean
  userAddress: string | undefined
  errors: FieldErrors<WithdrawFormNearValues>
  register: UseFormRegister<WithdrawFormNearValues>
  setValue: UseFormSetValue<WithdrawFormNearValues>
}

export const RecipientSubForm = ({
  control,
  token,
  blockchainSelectItems,
  showHotBalances,
  isNetworkModalOpen,
  setIsNetworkModalOpen,
  onChangeNetwork,
  tokenOut,
  parsedAmountIn,
  isChainTypeSatisfiesChainName,
  userAddress,
  errors,
  register,
  setValue,
}: RecipientSubFormProps) => {
  const { watch } = useFormContext<WithdrawFormNearValues>()
  const recipient = watch("recipient")

  return (
    <Flex direction="column" gap="2">
      <Box px="2" asChild>
        <Text size="1" weight="bold">
          Recipient
        </Text>
      </Box>
      <Controller
        name="blockchain"
        control={control}
        rules={{
          required: "This field is required",
          deps: "recipient",
        }}
        render={({ field }) => (
          <>
            <SelectTriggerLike
              label={
                blockchainSelectItems[field.value]?.label ?? "Select network"
              }
              icon={blockchainSelectItems[field.value]?.icon ?? <EmptyIcon />}
              onClick={() => setIsNetworkModalOpen(true)}
              hint={
                <Select.Hint>
                  {Object.keys(blockchainSelectItems).length === 1
                    ? "This network only"
                    : "Network"}
                </Select.Hint>
              }
              disabled={
                Object.keys(blockchainSelectItems).length === 1 &&
                field.value === Object.values(blockchainSelectItems)[0]?.value
              }
            />

            <ModalSelectNetwork
              token={token}
              selectNetwork={onChangeNetwork}
              selectedNetwork={field.value}
              isOpen={isNetworkModalOpen}
              onClose={() => setIsNetworkModalOpen(false)}
              renderValueDetails={
                showHotBalances
                  ? (address: string) => (
                      <HotBalance
                        symbol={tokenOut.symbol}
                        hotBalance={
                          blockchainSelectItems[
                            reverseAssetNetworkAdapter[
                              address as BlockchainEnum
                            ]
                          ]?.hotBalance
                        }
                      />
                    )
                  : undefined
              }
            />
          </>
        )}
      />

      {tokenOut.bridge === "poa" && showHotBalances && (
        <LongWithdrawWarning
          amountIn={parsedAmountIn}
          symbol={tokenOut.symbol}
          hotBalance={blockchainSelectItems[tokenOut.chainName]?.hotBalance}
        />
      )}

      <Flex direction="column" gap="1">
        <Flex gap="2" align="center">
          <Box asChild flexGrow="1">
            <TextField.Root
              size="3"
              {...register("recipient", {
                validate: {
                  pattern: (value, formValues) => {
                    if (!validateAddress(value, formValues.blockchain)) {
                      return "Invalid address for the selected blockchain"
                    }
                  },
                },
              })}
              placeholder="Enter wallet address"
            >
              <TextField.Slot>
                <PersonIcon height="16" width="16" />
              </TextField.Slot>
            </TextField.Root>
          </Box>

          {isChainTypeSatisfiesChainName &&
            userAddress != null &&
            recipient !== userAddress && (
              <IconButton
                type="button"
                onClick={() => {
                  setValue("recipient", userAddress, {
                    shouldValidate: true,
                  })
                }}
                variant="outline"
                size="3"
                title={`Autofill with your address ${truncateUserAddress(
                  userAddress
                )}`}
                aria-label={`Autofill with your address ${truncateUserAddress(
                  userAddress
                )}`}
              >
                <MagicWandIcon />
              </IconButton>
            )}
        </Flex>

        {errors.recipient && (
          <Box px="2" asChild>
            <Text size="1" color="red" weight="medium">
              {errors.recipient.message}
            </Text>
          </Box>
        )}
      </Flex>

      <Controller
        name="blockchain"
        control={control}
        render={({ field }) =>
          field.value === "xrpledger" ? (
            <Flex direction="column" gap="1">
              <Box px="2" asChild>
                <Text size="1" weight="bold">
                  Destination Tag (optional)
                </Text>
              </Box>
              <TextField.Root
                size="3"
                {...register("destinationMemo", {
                  validate: {
                    uint32: (value) => {
                      if (value == null || value === "") return

                      if (
                        parseDestinationMemo(value, tokenOut.chainName) == null
                      ) {
                        return "Should be a number"
                      }
                    },
                  },
                })}
                placeholder="Enter destination tag"
              />
              {errors.destinationMemo && (
                <Box px="2" asChild>
                  <Text size="1" color="red" weight="medium">
                    {errors.destinationMemo.message}
                  </Text>
                </Box>
              )}
            </Flex>
          ) : (
            <></>
          )
        }
      />
    </Flex>
  )
}
