import { BridgeSDK } from "@defuse-protocol/bridge-sdk"

export const bridgeSDK = new BridgeSDK({
  evmRpc: {
    // hardcoded for now
    137: ["https://polygon-rpc.com"],
    56: ["https://bsc-dataseed.bnbchain.org"],
  },
})
