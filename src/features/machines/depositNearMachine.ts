import { assign, fromPromise, setup } from "xstate"
import type { BlockchainEnum } from "../../types/deposit"

type Context = {
  blockchain: BlockchainEnum | null
  amount: string | null
  address: string | null
  error: Error | null
  outcome: unknown | null
}

type Events = {
  type: "INPUT"
  asset: string
  amount: string
}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
type Input = {}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
export type Output = {
  // todo: Output is expected to include intent status, intent entity and other relevant data
}

export const depositNearMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
    input: {} as Input,
    output: {} as Output,
  },
  actors: {
    signAndSendTransactions: fromPromise(async (): Promise<string> => {
      throw new Error("not implemented")
    }),
    broadcastMessage: fromPromise(async (): Promise<string> => {
      throw new Error("not implemented")
    }),
  },
  actions: {
    emitSuccessfulDeposit: () => {
      throw new Error("not implemented")
    },
  },
  guards: {
    isDepositValid: () => {
      throw new Error("not implemented")
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0AdmAIYBOAxAJIByACgKoAqA2gAwC6ioG2OW6BLiAAeiAKwAWAOwA6AJwSxrVgA4VANnWsAjAGYATABoQAT0R59emawmt9m7et06pK3QF93xlD1yESpDLYUARYBFDkEAJgMmEAbugA1jE+mH5EZEFYIWFQCPHoAMbEfAJs7OVCvqWCSCKI9mIyunoqtq66Es66xmYIjk0q+vYK+qpyClKe3mhp+BmBwaHh5GCkpOiBqAA2JQBmmwC2Mqm8-plLufkECcU15ZV11fy1oKIIeNpDMkrqUrq6IYTBRyKS9RADGRDfRSGysMQKLSdaYgU7pAIyOJrLB7Ey5ciPbhzF5Cd4tCQyCSaXRSOQqRzjCQScEIXQImTqMRSbT-bR01h-TkotHzDFY0g4vErZjaThPYkCUkQiQqDkSfQSL6qdRU9UstlyDlcr7OFViAHIryo2ZnBYyABGG2IEGKsD4KyiRFiNySKRt6MyjvQztd7ryBTuLweHCqCte9VZdnkTiUdOkgPUKhZsO08n0nWhDikYk8VoI6BQ8DqIvOpFjvBJdXeFmcPwF-0B+mBElBLLwmsNkjsOppcmGKmF-tFF2yyyg9dwjbeEKk6hkGqk+f0CPNXf+fb0uc3XOLKb0cm0Ekn1VrmOxuNyC5qStZVOa5tYcgFfzEPLk6hZexWGaNlWCkRRPypFQpCmK0aztABBe1NhwSAnyXBNPm3DkhjNHUNBpYsWTUfR1y-fRoK-MC+Tka85lvIMQ2IN1H3lBtFSbBoxDXMYVDEMQ1DHaD6QA0xECpYDtz4-8DHUewrzgqdb2odAcAAAgAMXQABXAgIDUzY1MoG5iG2LAIHQjjlwQLkZD5Vc2WGfMd05Yjvi7OxKOUbkJjo20MQAYXQQ4djAVCLLYxcrITAxDW0AS2iGbQ7G0S8ejEhASLIzzaW8-RS3cIA */
  context: {
    blockchain: null,
    amount: null,
    address: null,
    error: null,
    outcome: null,
  },
  id: "deposit-near",
  initial: "signing",
  on: {
    INPUT: {
      target: "#deposit-near.signing",
      output: ({ event }: { event: Events }) => ({
        ...event,
      }),
    },
  },
  description:
    "Generating sign message, wait for the proof of sign (tx).\n\nResult:\n\n- Update \\[context\\] with payload for ft_transfer_call;\n- Callback event to user for signing the solver message by wallet;",
  states: {
    signing: {
      invoke: {
        id: "deposit-near.signing:invocation[0]",
        input: ({ context }) => ({
          amount: context.amount,
          address: context.address,
        }),
        onDone: {
          target: "verifying",
          actions: assign((context, event) => ({
            ...context,
            outcome: null,
          })),
        },
        onError: {
          target: "Aborted",
          actions: assign((context, event) => ({
            ...context,
            error: null,
          })),
        },
        src: "signAndSendTransactions",
      },
    },
    verifying: {
      always: [
        {
          target: "broadcasting",
          guard: {
            type: "isDepositValid",
          },
        },
        {
          target: "Not Found or Invalid",
        },
      ],
    },
    Aborted: {
      type: "final",
    },
    broadcasting: {
      invoke: {
        id: "deposit-near.broadcasting:invocation[0]",
        input: {},
        onDone: {
          target: "Completed",
          actions: {
            type: "emitSuccessfulDeposit",
          },
        },
        src: "broadcastMessage",
      },
      description:
        "Configure the payload for ft_transfer_call,\n\nwhich triggers the NEAR wallet and\n\nbroadcasts the transaction",
    },
    "Not Found or Invalid": {
      type: "final",
    },
    Completed: {
      type: "final",
    },
  },
})
