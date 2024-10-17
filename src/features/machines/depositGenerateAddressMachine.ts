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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0MAdmAE4CGOYeZEEJcsAdFhADZgDEAkgHIAKAVQAqAbQAMAXUSgM2HFnSFpIAB6IAjGICsjdVrEBOdQCYAHMYAsAdi1arAGhABPRMfVXGY4wGYL6gGxa-qYG3qbWAL4RjiiyuARgxOSU1LT0sExEpBRYhFAcEIpgzIQAbugA1sWxmPFZyVQ0dAyM9Tl5CLnlAMY5iuISA8px8orKaghaoYzGBlb+BmLuWt52-o4uCOqmHlbq3vPegd5i3sb+3lExaLX4bSlN6ZmJ2fJ5HKQk6CSMqKwUADNvgBbRg1OQJJIURppFr3XJQTpldC9UaEAZDJAgEYKJRYiZTbyMAyBfzWUz+bbqdQWDauKweUx2CynMQU7zqIxaKLRECEdAoeBY8F1F4NVLNDLDW648aIPAWUx0hB4baMKwU4xacIcxbBAJXEAiu5i6ESp7MNhgaVyWX4xBiZWWMSG42Q14wyXPKFvKA23B20ATHymdVuQz6bWs0JOsRidX6JYhUwpiwWOyum4Q+6ei0AcTFYEoEH9aLlCAMFiJCxOWnOplWNIczlcYg8ldOJlOPgsWtMmZG7vFjxaADEyFh2CWsTixvaK-547MmZYGRTNN4nTZdG3eycLGSDEEeREgA */
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
