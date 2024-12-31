import { settings } from "src/config/settings"
import {
  assetNetworkAdapter,
  reverseAssetNetworkAdapter,
} from "src/utils/adapters"
import { getDerivedToken } from "src/utils/tokenUtils"
import {
  type ActorRefFrom,
  and,
  assertEvent,
  assign,
  sendTo,
  setup,
} from "xstate"
import type { BaseTokenInfo, ChainType, SwappableToken } from "../../types"
import { BlockchainEnum } from "../../types"
import { parseUnits } from "../../utils/parse"
import { isBaseToken, isNativeToken, isUnifiedToken } from "../../utils/token"
import { backgroundBalanceActor } from "./backgroundBalanceActor"
import {
  type Output as DepositEVMMachineOutput,
  depositEVMMachine,
} from "./depositEVMMachine"
import { depositEstimateMaxValueActor } from "./depositEstimationActor"
import {
  type Output as DepositGenerateAddressMachineOutput,
  DepositGeneratedDescription,
  depositGenerateAddressMachine,
} from "./depositGenerateAddressMachine"
import {
  type Output as DepositNearMachineOutput,
  depositNearMachine,
} from "./depositNearMachine"
import {
  type Output as DepositSolanaMachineOutput,
  depositSolanaMachine,
} from "./depositSolanaMachine"
import {
  type Output as DepositTurboMachineOutput,
  depositTurboMachine,
} from "./depositTurboMachine"
import { poaBridgeInfoActor } from "./poaBridgeInfoActor"
import { storageDepositAmountActor } from "./storageDepositAmountActor"

export type Context = {
  error: null | {
    tag: "err"
    value: {
      reason: "ERR_GET_BALANCE" | "ERR_GET_STORAGE_DEPOSIT_AMOUNT"
      error: Error | null
    }
  }
  balance: bigint
  nativeBalance: bigint
  /**
   * The maximum amount that available on the user's balance minus the cost of the gas.
   * todo: either remove this, or make it work, now it is 0n for native tokens
   */
  maxDepositValue: bigint
  formValues: {
    token: SwappableToken | null
    network: BlockchainEnum | null
    amount: string
  }
  parsedFormValues: {
    amount: bigint
  }
  depositGenerateAddressRef: ActorRefFrom<
    typeof depositGenerateAddressMachine
  > | null
  poaBridgeInfoRef: ActorRefFrom<typeof poaBridgeInfoActor>
  tokenList: SwappableToken[]
  userAddress: string | null
  userChainType: ChainType | null
  defuseAssetId: string | null
  tokenAddress: string | null
  generatedAddressResult: DepositGenerateAddressMachineOutput | null
  depositNearResult: DepositNearMachineOutput | null
  depositEVMResult: DepositEVMMachineOutput | null
  depositSolanaResult: DepositSolanaMachineOutput | null
  depositTurboResult: DepositTurboMachineOutput | null
  derivedToken: BaseTokenInfo | null
  storageDepositRequired: bigint | null
}

export const depositUIMachine = setup({
  types: {
    input: {} as {
      tokenList: SwappableToken[]
    },
    context: {} as Context,
    events: {} as
      | {
          type: "INPUT"
          params: Partial<{
            token: SwappableToken
            network: BlockchainEnum | null
            amount: string
          }>
        }
      | {
          type: "SUBMIT"
        }
      | {
          type: "AUTO_SUBMIT"
        }
      | {
          type: "LOGIN"
          params: {
            userAddress: string
            userChainType: ChainType
          }
        }
      | {
          type: "LOGOUT"
        },
    children: {} as {
      depositNearRef: "depositNearActor"
      depositEVMRef: "depositEVMActor"
      depositSolanaRef: "depositSolanaActor"
      depositTurboRef: "depositTurboActor"
    },
  },
  actors: {
    fetchWalletAddressBalanceActor: backgroundBalanceActor,
    depositNearActor: depositNearMachine,
    depositGenerateAddressActor: depositGenerateAddressMachine,
    poaBridgeInfoActor: poaBridgeInfoActor,
    depositEVMActor: depositEVMMachine,
    depositSolanaActor: depositSolanaMachine,
    depositEstimateMaxValueActor: depositEstimateMaxValueActor,
    depositTurboActor: depositTurboMachine,
    fetchStorageDepositAmountActor: storageDepositAmountActor,
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      console.error(event.error)
    },
    setError: assign({
      error: (_, error: NonNullable<Context["error"]>["value"]) => ({
        tag: "err" as const,
        value: error,
      }),
    }),
    setFormValues: assign({
      formValues: (
        { context },
        {
          data,
        }: {
          data: Partial<{
            token: SwappableToken
            network: BlockchainEnum | null
            amount: string
          }>
        }
      ) => ({
        ...context.formValues,
        ...data,
      }),
    }),
    setDerivedToken: assign({
      derivedToken: ({ context }) => {
        if (
          context.formValues.token == null ||
          context.formValues.network == null
        ) {
          return null
        }

        const derivedToken = getDerivedToken(
          context.formValues.token,
          reverseAssetNetworkAdapter[context.formValues.network]
        )

        // This isn't possible condition, if this happens, we need to fix the token list
        if (derivedToken == null) {
          throw new Error("ERR_TOKEN_NOT_FOUND")
        }
        return derivedToken
      },
    }),
    parseFormValues: assign({
      parsedFormValues: ({ context }) => {
        try {
          return {
            amount: parseUnits(
              context.formValues.amount,
              context.formValues.token?.decimals ?? 0
            ),
            network: context.formValues.network,
            token: context.formValues.token,
          }
        } catch {
          return {
            amount: 0n,
            network: null,
            token: null,
          }
        }
      },
    }),
    clearError: assign({ error: null }),
    setDepositNearResult: assign({
      depositNearResult: (_, value: DepositNearMachineOutput) => value,
    }),
    setDepositEVMResult: assign({
      depositEVMResult: (_, value: DepositEVMMachineOutput) => value,
    }),
    setDepositSolanaResult: assign({
      depositSolanaResult: (_, value: DepositSolanaMachineOutput) => value,
    }),
    setDepositTurboResult: assign({
      depositTurboResult: (_, value: DepositTurboMachineOutput) => value,
    }),
    setDepositGenerateAddressResult: assign({
      generatedAddressResult: (_, value: DepositGenerateAddressMachineOutput) =>
        value,
    }),
    clearDepositResult: assign({ depositNearResult: null }),
    clearDepositEVMResult: assign({ depositEVMResult: null }),
    clearGeneratedAddressResult: assign({ generatedAddressResult: null }),
    clearDepositSolanaResult: assign({ depositSolanaResult: null }),
    clearDepositTurboResult: assign({ depositTurboResult: null }),
    clearResults: assign({
      depositNearResult: null,
      depositEVMResult: null,
      depositSolanaResult: null,
      depositTurboResult: null,
      generatedAddressResult: null,
    }),

    extractAssetIds: assign({
      defuseAssetId: ({ context }) => {
        if (context.formValues.token == null) {
          return null
        }
        if (isBaseToken(context.formValues.token)) {
          return context.formValues.token.defuseAssetId
        }
        return (
          context.formValues.token.groupedTokens.find(
            (token) =>
              assetNetworkAdapter[token.chainName] ===
              context.formValues.network
          )?.defuseAssetId ?? null
        )
      },
      tokenAddress: ({ context }) => {
        if (context.formValues.token == null) {
          return null
        }
        if (isBaseToken(context.formValues.token)) {
          return context.formValues.token.address
        }
        return (
          context.formValues.token.groupedTokens.find(
            (token) =>
              assetNetworkAdapter[token.chainName] ===
              context.formValues.network
          )?.address ?? null
        )
      },
    }),

    clearUIDepositAmount: () => {
      throw new Error("not implemented")
    },
    clearBalances: assign({
      balance: 0n,
      nativeBalance: 0n,
    }),

    fetchPOABridgeInfo: sendTo("poaBridgeInfoRef", { type: "FETCH" }),
  },
  guards: {
    isTokenValid: ({ context }) => {
      return !!context.formValues.token
    },
    isNetworkValid: ({ context }) => {
      return !!context.formValues.network
    },
    isLoggedIn: ({ context }) => {
      return !!context.userAddress
    },
    isChainNearSelected: ({ context }) => {
      return context.formValues.network === BlockchainEnum.NEAR
    },
    isChainEVMSelected: ({ context }) => {
      return (
        context.formValues.network === BlockchainEnum.ETHEREUM ||
        context.formValues.network === BlockchainEnum.BASE ||
        context.formValues.network === BlockchainEnum.ARBITRUM
      )
    },
    isChainSolanaSelected: ({ context }) => {
      return context.formValues.network === BlockchainEnum.SOLANA
    },
    isChainAuroraEngineSelected: ({ context }) => {
      return (
        context.formValues.network === BlockchainEnum.TURBOCHAIN ||
        context.formValues.network === BlockchainEnum.AURORA
      )
    },
    isBalanceSufficientForEstimate: ({ context }) => {
      if (context.formValues.token == null) {
        return false
      }
      const token = context.formValues.token
      // For all Native tokens, we should validate wallet native balance
      if (
        (isUnifiedToken(token) && token.groupedTokens.some(isNativeToken)) ||
        (isBaseToken(token) && isNativeToken(token))
      ) {
        return context.nativeBalance > 0n
      }
      return context.balance > 0n
    },
    isPassiveDepositEnabledForSelectedChain: ({ context }) => {
      return (
        context.formValues.network != null &&
        context.formValues.network !== BlockchainEnum.NEAR &&
        context.formValues.network !== BlockchainEnum.TURBOCHAIN &&
        context.formValues.network !== BlockchainEnum.AURORA &&
        !!context.userAddress &&
        !!context.defuseAssetId
      )
    },
    isOk: (_, a: { tag: "err" | "ok" }) => a.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRHgAcIgEwA6AGziALHMbiAjI0UjZAGhABPYcuUB2ZZIDMy6dMbLx0uaYCcD8QF8X2lB1yESFSuQBVABUmViQQLy5efiEEPFlGSQk5AFZxRhFDcWcHaW09OIMRUxkHFMyVOWdxERS3DzRMbyJJSFwsHihiAGUAgCEAWWoQln5I7j5w2LwHROkUxkZTRkMHR1VlfOFxBclGSxTDO2U5ZVN503qQTyb8FrauTp7+oZDlMPZbiZjhZ0kalKmDQ7aQOI6bXTCDRJOSGRhghwKawiOTSK43Tg+VoQdpPXqDYb0cQfCJfaJTX4iSQKRF2cSmUxZZQpBxbBAlQwSdKAlmGTmpBzoxqY+44x5dfGveimEnjcmgaYGEyMmwODRyTIWLSQhC5SSGOT0kQnI6KWZyIWRLEPDpdOgABWCoTGZMmCuEjJS-zVVSU0hOp1ZOrwfLkMlBoJSJxUBtc7muwuaWGxuKgklQACcwHhM2gAIYZvNRHjEZ3hOVuwQew2lbJrdKGcynFJsvCojnM7LnexgoGW27WsW29NZ1AFosTYgQXhgSSwHBF2cYpMp8Uj-OF4tlz6cb4UwqzaSSAxHY01ZmnVvSOHHjJWVZR5QI-si5M2zrrsebiatARgADGBDFgA+lmACORBZgAtmAPA4LAU4znOC44EuiZ3G+Q4frmX4Trwv4AUBEygWAEFYNBsHwdupK7vKVaFCoR4GikCyrIaDKHGyVhhhqjI1I2jJgha8bLhhq7Djh47FgRgEgeBkFgDBcGwJIABGeYADZ5jw-6zlgEAaWAiE8HpPAAG7oAA1rOABmYA4P+AAWADqmmGTgACCEAQFmsCwH0mnabpABKYA2dRFY-IUWr6nCazSJkDIOBCBRtrIexKFGpyWMaYIviu75ppJ374WAf6ycR8nkYplEqepWk6XpBlGWAGYZugGbplpOA2R1UGSHZDkuW59leT5cD+YFjWheFozlq6UV4AYli3tkVT2BYpgpHkwZAlSGrZDYKSotIDKWPlYmFZ+Uk-mVhFyaRClKfBkgwCZ34fvphmlnNO7tHRippFI4gg4eYgqCiIhskCexZEJzjbeIcUXYOqbXSVPAyURvAkWRFHKa9sGtROn3NaW7wurRlaKvIiTFAGRyMiIawtjqMMrNkBoI7IyMiehqNrsVeGY3dFU41V+MvW9xNrqL2M8MB0sfV004mZIHQWdZkiiZQRObmAY2+bAM0RQt+5LRski5PCINHIwUZlK2qhzBkzMrMUqKPijopo0L0lyw9eM1QT84dXmMB4KJ6tk6rpma7Z9lOd0OBhzAAAi6EeVB6AEHBJu-TR-3U-oFhessmrWE4iirGy9JzE+W2zPI16MoY3uYb7o43fhOJZv+ODAaJuNPbV0ffabVOLZtDj-AlaqdkUaRsizZjzGolhgk+Tjt+J2Fdxj2vVf3g-ocP1XPSpX1GfQFPzZP5tnGox42AYGpGPMJzL1tq8LCdm9OIKPmVofaC33sLQ+fcB5DwlsHF6eZs65xwMZOOVk0KRAAKLziwFBRcAw8wCAAGqaQIGAfOsozbujiFXfU5Q7BrDUCaOQbJQzhn2OcDIBpYTKB3rAAgqkoK4HFLQMABYggCGQercyqDtboWEQWMhlMi5RVNFbOk1hrBKiRq2WwUg1DmCRqiMECw8pAIHC0Xh-DBG2nQQQgYYiJEa2kaJGxAwFF3yUfuFRuRDQGn5JGKGwYziGCtslRY5QVCzHOJcUxr45x8IETgcU3R0ANTzPY2Okj44yMiMk1Jbi-rFmUf6MwcJUQoiqBYcQTsjy5FyFtU61hTRtxiSuCxCTxRBAIBmVS6B0lIUcVrUSnTunoHyYXQpnjimMgYUjf08xshslfuGOZJxrDyBUDvK6ftbrlXlmfSWKlQ6FgjlHK+xBWrtU6qgbqvUMz9UGknFOxywAZ0iFnHOecwoTw8ZQi2dgZDV3ONedIhpoY2BhOcZK6RHD22EvGHg6AUDwHCKJHwiiJm-PSEoZ+p4bDGmOilfQYS9g7DWKcY0GprybKwlAdFe5flPmOjihKeKLyEriJkRIaRyi5DOJqf01K0ZXzpQDfQzMShLG2rIZQIglDGCYcGTkiRVihMsFUJGW1BWgOzNsuikVzZ8TMICIJ5wdhKE-sGY6XoWKNlWclREjgtUSTARi8Z9L6JLUbDPZs5gWQZFNaYVsnIJU7GZozEFYgnV7w3OAgOlVHrn1qiK4uhRQQmB9cyWYxRZCBuDHYKk3L6zLWMYAhowCO7atwv7XZgcR4E3qkFMAyap50mpA+GVYhFg2AValbaJhMprHYT6WwUaioup2fdeNQcL5qSmrpMeTb3GusBoiNtZQO2yrWT24QsISiFq2qocwhhASjvRrGmtU660vQbY1bWM5m3mwkF6O2VRTrHqWDsVsCgTB8hZKYZuoI1mnt1SLC94sE0HMJu9EmtKl3usVK23xx7jq2DSBoJ2TgZD-qRslDQhwuTAfHaVMDCsYEzqVjBhdD6GUsjDEhlihp5nocCeCs49JAQNmjAKlpl0aVnurZO8D07R4UdliRxWesYPUY9ScNU1JHASHmPYeYlgnasf-f+mk+x0g7EIzGgTYtSMQdgSpUTw5Y7SemE+6kzgZVAhUPILatcwymC4YcRY9JAwWD01Widhn9kmeQqnbMolLP6DsCUDNfrs30kWYoGznYgQsls2qHz3dQOCaM8JkOTzw4hfQlRuDorCgsi9FFrNAba5IxCZ2ekBxxVpYPnGoTV7Dm5ZOQVizRWU2iB2PqbidT32adrrsFEPKxtJaWMJMtZiK3Ov0z+XuAEoGnzI0m7rLbMiz2ZvilQMql46gSpF5YdgMi21WNwnjAt5u+Z7kfFbkQAszuFRth+20Z4sTVCyOwihtoBIKHyRI9DjD7csJyRr4ClvH2gcZmd8CPk4DC4UBQJRnDktw65s4rMAfJT2MdVE8J4SnCRhD6SUOHu3Ce6PLrBT4O-AsHsYFEh-VGOXrYY8pxzD2yxfFHh8SrGdDkRmMRSP-3WuZixa8ztFhBlSmayQfrkT2AyAsXTV3zH88SdY2xIvXuUP-UxVzGRFiyrEI7QJ-79TrL5KdMoThLszdiW0gXUBcnaTSbEWnxX-1UjhJC8JlhW6tmtaXDIJpMhODUHzyxWvOjDJ6brr3KaOLHgSijqwFxc0FBsEeAwzhkhglBMzOMbggA */
  id: "deposit-ui",

  context: ({ input, spawn }) => ({
    error: null,
    balance: 0n,
    nativeBalance: 0n,
    maxDepositValue: 0n,
    formValues: {
      token: null,
      network: null,
      amount: "",
    },
    parsedFormValues: {
      amount: 0n,
    },
    depositNearResult: null,
    depositEVMResult: null,
    depositSolanaResult: null,
    depositTurboResult: null,
    depositGenerateAddressRef: null,
    tokenList: input.tokenList,
    userAddress: null,
    userChainType: null,
    defuseAssetId: null,
    tokenAddress: null,
    generatedAddressResult: null,
    poaBridgeInfoRef: spawn("poaBridgeInfoActor", {
      id: "poaBridgeInfoRef",
    }),
    storageDepositRequired: null,
    derivedToken: null,
  }),

  entry: ["fetchPOABridgeInfo"],

  on: {
    LOGIN: {
      actions: [
        assign({
          userAddress: ({ event }) => event.params.userAddress,
          userChainType: ({ event }) => event.params.userChainType,
        }),
      ],
    },

    LOGOUT: {
      actions: [
        "clearResults",
        "clearBalances",
        assign({
          userAddress: () => "",
          formValues: {
            token: null,
            network: null,
            amount: "",
          },
        }),
      ],
    },
  },

  states: {
    editing: {
      initial: "idle",

      on: {
        SUBMIT: [
          {
            target: "submittingNearTx",
            guard: "isChainNearSelected",
            actions: "clearDepositResult",
          },
          {
            target: "submittingEVMTx",
            reenter: true,
            guard: "isChainEVMSelected",
          },
          {
            target: "submittingSolanaTx",
            reenter: true,
            guard: "isChainSolanaSelected",
          },
          {
            target: "submittingTurboTx",
            reenter: true,
            guard: "isChainAuroraEngineSelected",
          },
        ],

        INPUT: {
          target: ".pre-preparation",
          actions: [
            "clearError",
            "clearResults",
            {
              type: "setFormValues",
              params: ({ event }) => ({ data: event.params }),
            },
            "setDerivedToken",
            "parseFormValues",
          ],
        },
      },

      states: {
        idle: {},

        "pre-preparation": {
          always: {
            target: "preparation",
            guard: and(["isTokenValid", "isNetworkValid", "isLoggedIn"]),
          },
        },

        preparation: {
          entry: "extractAssetIds",
          initial: "execution_requirements",

          states: {
            execution_requirements: {
              type: "parallel",

              states: {
                balance: {
                  initial: "idle",
                  states: {
                    idle: {
                      invoke: {
                        id: "fetchWalletAddressBalanceRef",
                        src: "fetchWalletAddressBalanceActor",

                        input: ({ context }: { context: Context }) => {
                          assert(context.formValues.network, "network is null")
                          assert(context.defuseAssetId, "defuseAssetId is null")
                          assert(context.tokenAddress, "tokenAddress is null")
                          assert(context.userAddress, "userAddress is null")

                          return {
                            defuseAssetId: context.defuseAssetId,
                            tokenAddress: context.tokenAddress,
                            userAddress: context.userAddress,
                            network: context.formValues.network,
                            token: context.formValues.token,
                          }
                        },

                        onDone: {
                          target: "done",
                          actions: assign({
                            balance: ({ event }) => event.output?.balance ?? 0n,
                            nativeBalance: ({ event }) =>
                              event.output?.nativeBalance ?? 0n,
                          }),
                        },

                        onError: {
                          target: "done",
                          actions: [
                            {
                              type: "logError",
                              params: ({ event }) => event,
                            },
                            {
                              type: "setError",
                              params: ({ event }) => {
                                console.log("onError type: setError", event)
                                return {
                                  reason: "ERR_GET_BALANCE",
                                  error: null,
                                }
                              },
                            },
                          ],
                        },
                      },
                    },

                    done: {
                      type: "final",
                    },
                  },
                },

                generating: {
                  initial: "idle",

                  states: {
                    idle: {
                      always: [
                        {
                          target: "execution_generating",
                          guard: "isPassiveDepositEnabledForSelectedChain",
                        },
                        {
                          target: "done",
                        },
                      ],
                    },
                    execution_generating: {
                      invoke: {
                        id: "depositGenerateAddressRef",
                        src: "depositGenerateAddressActor",

                        input: ({ context }) => {
                          assert(
                            context.userAddress != null,
                            "userAddress is null"
                          )
                          assert(
                            context.userChainType != null,
                            "userChainType is null"
                          )
                          assert(context.formValues.network, "network is null")

                          return {
                            userAddress: context.userAddress,
                            userChainType: context.userChainType,
                            chain: context.formValues.network,
                          }
                        },

                        onDone: {
                          target: "done",

                          actions: [
                            {
                              type: "setDepositGenerateAddressResult",
                              params: ({ event }) => {
                                return event.output
                              },
                            },
                          ],
                        },
                      },
                    },

                    done: {
                      type: "final",
                    },
                  },
                },

                "storage-deposit": {
                  initial: "idle",
                  states: {
                    idle: {
                      invoke: {
                        id: "fetchStorageDepositAmountRef",
                        src: "fetchStorageDepositAmountActor",

                        input: ({ context }: { context: Context }) => {
                          assert(context.userAddress, "userAddress is null")
                          assert(context.derivedToken, "derivedToken is null")

                          return {
                            token: context.derivedToken,
                            userAccountId: context.userAddress,
                          }
                        },

                        onDone: {
                          target: "done",
                          actions: assign({
                            storageDepositRequired: ({ event }) => event.output,
                          }),
                          reenter: true,
                        },

                        onError: {
                          target: "done",
                          actions: [
                            {
                              type: "logError",
                              params: ({ event }) => event,
                            },
                            {
                              type: "setError",
                              params: () => {
                                return {
                                  reason: "ERR_GET_STORAGE_DEPOSIT_AMOUNT",
                                  error: null,
                                }
                              },
                            },
                          ],
                          reenter: true,
                        },
                      },
                    },

                    done: {
                      type: "final",
                    },
                  },
                },
              },

              onDone: "direct_deposit_requirements",
            },

            direct_deposit_requirements: {
              initial: "idle",

              states: {
                idle: {
                  always: [
                    {
                      target: "amount",
                      guard: "isBalanceSufficientForEstimate",
                    },
                    {
                      target: "done",
                    },
                  ],
                },
                amount: {
                  invoke: {
                    id: "depositEstimateMaxValueRef",
                    src: "depositEstimateMaxValueActor",

                    input: ({ context }: { context: Context }) => {
                      assert(context.formValues.token, "token is null")
                      assert(context.formValues.network, "network is null")
                      assert(context.tokenAddress, "tokenAddress is null")
                      assert(context.userAddress, "userAddress is null")

                      return {
                        token: context.formValues.token,
                        network: context.formValues.network,
                        balance: context.balance,
                        nativeBalance: context.nativeBalance,
                        tokenAddress: context.tokenAddress as string,
                        userAddress: context.userAddress,
                        // It is optional cause for NEAR estimation we don't need to generate an address
                        generateAddress:
                          context.generatedAddressResult?.tag === "ok"
                            ? context.generatedAddressResult.value
                                .depositAddress
                            : null,
                      }
                    },

                    onDone: {
                      target: "done",
                      actions: assign({
                        maxDepositValue: ({ event }) => event.output,
                      }),
                    },
                  },
                },
                done: {
                  type: "final",
                },
              },
            },
          },

          onDone: "idle",
        },
      },
    },

    submittingNearTx: {
      invoke: {
        id: "depositNearRef",
        src: "depositNearActor",

        input: ({ context }) => {
          assert(context.formValues.token, "token is null")
          assert(context.userAddress, "userAddress is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: context.formValues.token,
            accountId: context.userAddress,
          }
        },

        onDone: {
          target: "editing.preparation",

          actions: [
            {
              type: "setDepositNearResult",
              params: ({ event }) => event.output,
            },
            { type: "clearUIDepositAmount" },
          ],

          reenter: true,
        },
      },
    },

    submittingEVMTx: {
      invoke: {
        id: "depositEVMRef",
        src: "depositEVMActor",

        input: ({ context, event }) => {
          assertEvent(event, "SUBMIT")
          const depositAddress =
            context.generatedAddressResult?.tag === "ok"
              ? context.generatedAddressResult.value.depositAddress
              : null

          assert(context.formValues.network, "network is null")
          assert(context.userAddress, "userAddress is null")
          assert(context.tokenAddress, "tokenAddress is null")
          assert(depositAddress, "depositAddress is null")
          assert(context.formValues.token, "token is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: context.formValues.token,
            accountId: context.userAddress,
            tokenAddress: context.tokenAddress,
            depositAddress,
            chainName: reverseAssetNetworkAdapter[context.formValues.network],
          }
        },

        onDone: {
          target: "editing.preparation",

          actions: [
            {
              type: "setDepositEVMResult",
              params: ({ event }) => event.output,
            },
            { type: "clearUIDepositAmount" },
          ],

          reenter: true,
        },
      },
    },

    submittingSolanaTx: {
      invoke: {
        id: "depositSolanaRef",
        src: "depositSolanaActor",

        input: ({ context, event }) => {
          assertEvent(event, "SUBMIT")
          const depositAddress =
            context.generatedAddressResult?.tag === "ok"
              ? context.generatedAddressResult.value.depositAddress
              : null

          assert(context.formValues.network, "network is null")
          assert(context.userAddress, "userAddress is null")
          assert(context.tokenAddress, "tokenAddress is null")
          assert(depositAddress, "depositAddress is null")
          assert(context.formValues.token, "token is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: context.formValues.token,
            accountId: context.userAddress,
            tokenAddress: context.tokenAddress,
            depositAddress,
          }
        },

        onDone: {
          target: "editing.preparation",

          actions: [
            {
              type: "setDepositSolanaResult",
              params: ({ event }) => event.output,
            },
            { type: "clearUIDepositAmount" },
          ],

          reenter: true,
        },
      },
    },

    submittingTurboTx: {
      invoke: {
        id: "depositTurboRef",
        src: "depositTurboActor",

        input: ({ context, event }) => {
          assertEvent(event, "SUBMIT")

          assert(context.formValues.network, "network is null")
          assert(context.userAddress, "userAddress is null")
          assert(context.tokenAddress, "tokenAddress is null")
          assert(context.formValues.token, "token is null")

          return {
            balance: context.balance,
            amount: context.parsedFormValues.amount,
            asset: context.formValues.token,
            accountId: context.userAddress,
            tokenAddress: context.tokenAddress,
            depositAddress: settings.defuseContractId,
            chainName: reverseAssetNetworkAdapter[context.formValues.network],
          }
        },

        onDone: {
          target: "editing.preparation",

          actions: [
            {
              type: "setDepositTurboResult",
              params: ({ event }) => event.output,
            },
            { type: "clearUIDepositAmount" },
          ],

          reenter: true,
        },
      },
    },
  },

  initial: "editing",
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
