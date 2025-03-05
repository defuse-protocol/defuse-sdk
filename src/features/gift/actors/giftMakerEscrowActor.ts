import { base58, hex } from "@scure/base"
import { sign } from "tweetnacl"
import { setup } from "xstate"

export type EscrowKeyPair = {
  publicKey: string
  secretKey: string
  walletId: string
}

export const giftMakerEscrowActor = setup({
  types: {
    input: {} as {
      type: "ed25519"
    },
    context: {} as {
      keyPair: EscrowKeyPair
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAcQFEA5egJQEEAVegfQGl6AmgAU2ASRYBtAAwBdRKAAOAe1i4ALriX55IAB6IAjACYArCRNTLUgJzWA7KYDMJowBoQAT0QAOAyQAstrb+AGxGjt5SEQC+se74ShBwOmhYeIREOsqqGlo6+ggAtCHuXkUhcSCpOATEZJRgWSrqmtpIeoj+bp6GUv4k9iEmdnZD3o4GIyaV1el1mEqoClRqkE05rfmIjo525uH+Ftb+Eb4GjqW9jiQOQyEGJv6WdtYhdrGxQA */
  context: ({ input }) => {
    {
      const type = input.type
      switch (type) {
        case "ed25519": {
          const keyPair = sign.keyPair()
          return {
            keyPair: {
              publicKey: `ed25519:${base58.encode(keyPair.publicKey)}`,
              secretKey: base58.encode(keyPair.secretKey),
              walletId: hex.encode(keyPair.publicKey),
            },
          }
        }
        default: {
          throw new Error("Invalid key type")
        }
      }
    }
  },
  initial: "idle",
  states: {
    idle: {},
  },
})
