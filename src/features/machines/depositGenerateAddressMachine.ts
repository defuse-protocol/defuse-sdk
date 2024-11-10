import type { BlockchainEnum } from "src/types"
import { assign, fromPromise, setup } from "xstate"

export type DepositGeneratedDescription = {
  type: "depositAddressGenerated"
  depositAddress: string
}

type Context = {
  accountId: string | null
  chain: BlockchainEnum | null
  depositAddress: string | null
  error: null | {
    tag: "err"
    value: {
      reason: "ERR_GENERATING_ADDRESS"
      error: Error | null
    }
  }
}

type Events = {
  type: "INPUT"
  accountId: string
  defuseAssetId: string
}

type Input = {
  accountId: string
  chain: BlockchainEnum
}

export type Output =
  | NonNullable<Context["error"]>
  | {
      tag: "ok"
      value: {
        depositAddress: string
        depositDescription: DepositGeneratedDescription
      }
    }

export const depositGenerateAddressMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
    input: {} as Input,
    output: {} as Output,
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
  context: ({ input }) => {
    return {
      accountId: input.accountId,
      chain: input.chain,
      depositAddress: null,
      error: null,
    }
  },

  id: "deposit-generate-address",

  initial: "generating",

  output: ({ context }): Output => {
    if (context.depositAddress != null) {
      return {
        tag: "ok",
        value: {
          depositAddress: context.depositAddress,
          depositDescription: {
            type: "depositAddressGenerated",
            depositAddress: context.depositAddress,
          },
        },
      }
    }

    throw new Error("Unexpected output")
  },

  description:
    "Handle initializing a new deposit procedure.\n\nResult \\[Branching\\]:\n\n1. Network base direct deposit (Near, Ethereum, etc.);\n2. Indirect deposit via POA bridge;",

  states: {
    generating: {
      invoke: {
        input: ({ context }) => {
          if (!context.chain || !context.accountId) {
            throw new Error("Asset address or account ID is missing")
          }
          return {
            accountId: context.accountId as string,
            chain: context.chain,
          }
        },
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
