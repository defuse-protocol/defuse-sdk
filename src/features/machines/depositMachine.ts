import { assign, fromPromise, setup } from "xstate"
import { DepositProcessorService } from "../deposit"

export enum BlockchainEnum {
  NEAR = "near",
  ETHEREUM = "ethereum",
  BASE = "base",
  SOLANA = "solana",
  BITCOIN = "bitcoin",
  TON = "ton",
}

type Context = {
  blockchain: BlockchainEnum | null
  depositAddress: string | null
  depositAsset: string | null
  depositAmount: string | null
}

type Events =
  | { type: "GENERATE_DEPOSIT_ADDREES"; params: { blockchain: string } }
  | { type: "DIRECT_DEPOSIT_VIA_NEAR"; params: { blockchain: string } }
  | {
      type: "SET_DEPOSIT_PARAMS"
      params: {
        depositAddress: string
        depositAsset: string
        depositAmount: string
      }
    }

type Input = {
  blockchain: BlockchainEnum
  depositAsset: string
  depositAmount: string
}

const depositProcessorService = new DepositProcessorService()

export const depositMachine = setup({
  types: {
    context: {} as Context | undefined,
    events: {} as Events,
    input: {} as Input,
  },
  actions: {
    updateBlockchain: assign({
      blockchain: ({ event }) =>
        event.type === "GENERATE_DEPOSIT_ADDREES"
          ? (event.params.blockchain as BlockchainEnum)
          : null,
    }),
    updateDepositParams: assign({
      depositAddress: ({ event }) =>
        event.type === "SET_DEPOSIT_PARAMS"
          ? event.params.depositAddress
          : null,
      depositAsset: ({ event }) =>
        event.type === "SET_DEPOSIT_PARAMS" ? event.params.depositAsset : null,
      depositAmount: ({ event }) =>
        event.type === "SET_DEPOSIT_PARAMS" ? event.params.depositAmount : null,
    }),
    emitSuccessfulDeposit: (context, event) => {
      // Add your action code here
      // ...
    },
    emitFailedDeposit: (context, event) => {
      // Add your action code here
      // ...
    },
  },
  guards: {
    isValidNearNetwork: () => {
      throw new Error("not implemented")
    },
    isValidDepositParams: () => {
      throw new Error("not implemented")
    },
  },
  actors: {
    deposit: fromPromise(async ({ input }) => {
      throw new Error("deposit actor must be implemented externally")
    }),
    generateDepositAddress: fromPromise(
      async ({ input }: { input: Pick<Input, "blockchain"> }) => {
        return depositProcessorService
          .generateDepositAddress(input.blockchain)
          .then((data) => data)
      }
    ),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgKIAqAogDID6AkgHIDiAMgKIDCAIgNoAGALqJQAB1SwAlrFgBXWBgDaAXVkgAHogBMAVgAcANgCsAJgDMmgCwBOADQgAnq-uGAvk-OmIcBEgwAZQBRADEAWQAFAGUAVQAlAHEAeQARABkAJQBhAA0QZFQMHHwiUnIqWgZmNk4efiERcQQsXQJWXQUFXQVNXQUdXQVjXQVzXQVrXQVHXQVXXQV3XQUvXQVfXQV-XQVg3QVQ3QVw3QVI3QVI3QVY3QVE3QVU3QVMwUFCwUFKwUFGwUFOwUFBwUFJwUFVwUFdwUFTwUFbwUFXwUFfwUFQIUFYIUFUIUFcIUFSIUFaIUFWIUFBIUFJIUFVIUFdIUFTIUFbIUFXIUFfIUFQoUFYoUFUoUFcoUFSoUFaoUFWoUFBoUFJoUFVoUFdoUFToUFboUFXoUFfoUFQYUFYYUFUYUFcYUFSYUFaYUFWYUFBYUFJYUFVYUFdYUFTYUFbYUFXYUFfYUFQ4UFY4UFU4UFc4UFSEUFaEUFWEUFBEUFJEUFVEUFdEUFTEUFbEUFXEUFfEUFQkUFYkUFUkUFckUFSkUFakUFWkUFBkUFJkUFVkUFdkUFTkUFbkUFXkUFfkUFQUUFYUUFUUUFcUUFSUUFaUUFWUUFBUUFJUUFVUUFdUUFTUUFbUUFXUUFfUUFQ0UFY0UFU0UFc0UFSMUFaMUFWMUFBMUFJMUFVMUFdMUFTMUFbMUFXMUFfMUFQsUFYsUFUsUFcsUFSsUFasUFWsUFBsUFJsUFVsUFdsUFTsUFbsUFXsUFfsUFQcUFYcUFUcUFccUFScUFacUFWcUFBcUFJcUFVcUFdcUFTcUFbcUFXcUFfcUFQ8UFY8UFU8UFc8UFSiUFaiUFWiUFBiUFJiUFViUFdiUFTiUFbiUFXiUFfiUFQyUFYyUFUyUFcyUFSyUFayUFWyUFByUFJyUFVyUFdyUFTyUFbyUFXyUFfyUFQKUFYKUFUKUFcKUFSKUFaKUFWKUFBKUFJKUFVKUFdKUFTKUFbKUFXKUFfKUFQqUFYqUFUqUFcqUFSqUFaqUFWqUFBqUFJqUFVqUFdqUFTqUFbqUFXqUFfqUFQaUFYaUFUaUFcaUFSaUFaaUFWaUFBaUFJaUFVaUFdaUFTaUFbaUFXaUFfaUFQGUFYGUFUGUFcGUFSGUFaGUFWGUFBGUFJGUFVGUFdGUFTGUFbGUFXGUFfGUFQmUFYmUFUmUFcmUFSmUFamUFWmUFBmUFJmUFVmUFdmUFTmUFbmUFXmUFfmUFQWUFYWUFUWUFcWUFSWUFaWUFWWUFBWUFJWUFVWUFdWUFTWUFbWUFXWUFfWUFQOUFYOUFUOUFcOUFSOUFaOUFWOUFBOUFJOUFVOUFdOUFTOUFbOUFXOUFfOUFQeUFYeUFUeUFceUFSeUFaeUFWeUFBeUFJeUFVeUFdeUFTeUFbeUFXeUFfeUFQ+UFY+UFU+UFc+UFS+UFa+UFW+UFB+UFJ+UFV+UFd+UFT+UFb+UFX+UFf+UFQBUFYBUFUBUFcBUFSBUFaBUFWBUFBBUFJBUFVBUFdBUFTBUFbBUFXBUFfBUFQhUFYhUFUhUFchUFShUFahUFWhUFBhUFJhUFVhUFdhUFThUFbhUFXhUFfhUFQRUFYRUFURUFcRUFSRUFaRUFWRUFBRUFJRUFVRUFdRUFTRUFbRUFXRUFfRUFQJUFYJUFUJUFcJUFSJUFaJUFWJUFBJUFJJUFVJUFdJUFTJUFbJUFXJUFfJUFQFUFYFUFUFUFcFUFSFUFaFUFWFUFBFUFJFUFVFUFdFUFTFUFbFUFXFUFfFUFQlUFYlUFUlUFclUFSlUFalUFWlUFBlUFJlUFVlUFdlUFTlUFblUFXlUFflUFQVUFYVUFUVUFcVUFSVUFaVUFWVUFBVUFJVUFVVUFdVUFTVUFbVUFXVUFfVUFQNUFYNUFUNUFcNUFSNUFaNUFWNUFBNUFJNUFVNUFdNUFTNUFbNUFXNUFfNUFQDUFYDUFUDUFcDUFSDUFaDUFWDUFBDUFJDUFVDUFdDUFTDUFbDUFXDUFfDUFQzUFYzUFUzUFczUFSzUFazUFWzUFBzUFJzUFVzUFdzUFTzUFbzUFXzUFfzUFQHUFYHUFUHUFcHUFSHUFaHUFWHUFBHUFJHUFVHUFdHUFTHUFbHUFXHUFfHUFQXUFYXUFUXUFcXUFSXUFaXUFWXUFBXUFJXUFVXUFdXUFTXUFbXUFXXUFfXUFQPUFYPUFUPUFcPUFSPUFaPUFWPUFBPUFJPUFVPUFdPUFTPUFbPUFXPUFfPUFQfUFYfUFUfUFcfUFSfUFafUFWfUFBfUFJfUFVfUFdfUFTfUFbfUFXfUFffUFQ-UFYC */
  context: {
    blockchain: null,
    depositAddress: null,
    depositAsset: null,
    depositAmount: null,
  },
  id: "deposit_machine",
  initial: "Idle",
  states: {
    Idle: {
      on: {
        GENERATE_DEPOSIT_ADDREES: {
          actions: "updateBlockchain",
          target: "Generating",
        },
        DIRECT_DEPOSIT_VIA_NEAR: {
          actions: "updateBlockchain",
          target: "Configurating",
          guard: {
            type: "isValidNearNetwork",
          },
        },
      },
      description:
        "Handle initializing a new deposit procedure.\n\nResult \\[Branching\\]:\n\n1. Network base direct deposit (Near, Ethereum, etc.);\n2. Indirect deposit via POA bridge;",
    },
    Generating: {
      invoke: {
        input: ({ context }) => ({
          blockchain: context.blockchain as BlockchainEnum,
        }),
        src: "generateDepositAddress",
      },
      description: "Generate deposit address via POA bridge",
    },
    Configurating: {
      on: {
        SET_DEPOSIT_PARAMS: [
          {
            target: "Broadcasting",
            guard: {
              type: "isValidDepositParams",
            },
          },
          {
            target: "Configurating",
          },
        ],
      },
      description: "Configure all required data for direct deposit",
    },
    Broadcasting: {
      invoke: {
        input: {},
        onDone: {
          target: "Completed",
          actions: {
            type: "emitSuccessfulDeposit",
          },
        },
        onError: {
          target: "Failed",
          actions: {
            type: "emitFailedDeposit",
          },
        },
        src: "deposit",
      },
      description:
        "Configure the payload for ft_transfer_call, \n\nwhich triggers the NEAR wallet and \n\nbroadcasts the transaction",
    },
    Completed: {
      type: "final",
    },
    Failed: {
      type: "final",
    },
  },
})
