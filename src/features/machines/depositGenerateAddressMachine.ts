import { assign, fromPromise, setup } from "xstate"
import type { BlockchainEnum } from "../../types/deposit"

type Context = {
  blockchain: BlockchainEnum | null
  assetAddress: string | null
  depositAddress: string | null
}

type Events = {
  type: "INPUT"
  blockchain: BlockchainEnum
  assetAddress: string
}

type Input = {
  blockchain: BlockchainEnum | null
  assetAddress: string | null
}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
export type Output = {
  // todo: Output is expected to include intent status, intent entity and other relevant data
}

export const depositGenerateAddressMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
  actors: {
    generateDepositAddress: fromPromise(
      async ({ input }: { input: Input }): Promise<string> => {
        throw new Error("not implemented")
      }
    ),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0MAdmAE4CGOYeZEEJcsAdFhADZgDEAkgHIAKAVQAqAbQAMAXUSgM2HFnSFpIAB6IAjAGYALIzEA2ABz7NAdgBMO-WM3qANCACeiTWMb6tpgJznD500Y2vgC+wQ4osrgEYMTklNS09LBMRKQUWIRQHBCKYMyEAG7oANZ5EZhRqXFUNHQMjFXpmQgZRQDG6YriEt3KkfKKymoI+tqGjNpill76XgCstgb2Toj6jF5i6luGfl6GYvNjoeFoFfiN8bVJKTFp8pkcpCToJIyorBQAZi8AtozlcmisQoNUS9QuGSgLUK6A6A0I3V6SBA-QUSmRw1GXj0phshjGcyM+M0DmcCC8mkYhlM6jEc0sk3MXj2oTCIEI6BQ8GRAMqt2qCTqyT6ZzRQ0QeHMazEpjmhgphNM+3lAVJEvUzMYcz2xgpMwMpmOIF5535IMF12YbDAIrkYoxiHM6nW5m0tNGmidXlprrVCHUpnczOpPlcmk0s3DRpNQLuoKFN2B9ygttw9tAwyZunp0y82m9vh2pj96l0OiCcv8AVmsujp0BF3jloA4vywJQIKn4eLyTT1tpZh4A6M5V4-f5GOp-PoLGJtJo9upqXM6-1YwKrvUAGJkLDsTvI1GDB29uaMLPeb2ejUmP3eydOunTinacz+VnBIA */
  context: {
    blockchain: null,
    assetAddress: null,
    depositAddress: null,
  },
  id: "deposit-generate-address",
  initial: "idle",
  description:
    "Handle initializing a new deposit procedure.\n\nResult \\[Branching\\]:\n\n1. Network base direct deposit (Near, Ethereum, etc.);\n2. Indirect deposit via POA bridge;",
  states: {
    idle: {
      on: {
        INPUT: {
          target: "generating",
          actions: assign({
            blockchain: ({ event }) => event.blockchain,
            assetAddress: ({ event }) => event.assetAddress,
          }),
        },
      },
    },
    generating: {
      invoke: {
        input: ({ context }) => ({
          blockchain: context.blockchain,
          assetAddress: context.assetAddress,
        }),
        onDone: {
          target: "Genereted",
          actions: assign({
            depositAddress: ({ event }) => event.output,
          }),
        },
        onError: {
          target: "Failed",
        },
        src: "generateDepositAddress",
      },
      description: "Generate deposit address via POA bridge",
    },
    Genereted: {
      type: "final",
    },
    Failed: {
      type: "final",
    },
  },
})
