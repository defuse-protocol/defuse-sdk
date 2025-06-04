import { type ILogger, setLogger } from "./logger"

export interface SDKConfig {
  logger?: ILogger
  env?: NearIntentsEnv | EnvConfig
}

export interface EnvConfig {
  contractID: string
  poaBridgeBaseURL: string
  solverRelayBaseURL: string
  managerConsoleBaseURL: string
  nearIntentsBaseURL: string
}

export type NearIntentsEnv = "production" | "stage"

const configsByEnvironment: Record<NearIntentsEnv, EnvConfig> = {
  production: {
    contractID: "intents.near",
    poaBridgeBaseURL: "https://bridge.chaindefuser.com",
    solverRelayBaseURL: "https://solver-relay-v2.chaindefuser.com",
    managerConsoleBaseURL: "https://api-mng-console.chaindefuser.com/api/",
    // nearIntentsBaseURL: "https://app.near-intents.org/api/",
    nearIntentsBaseURL: "http://localhost:3000/api/",
  },
  stage: {
    contractID: "staging-intents.near",
    // todo: update URLs when available
    poaBridgeBaseURL: "https://bridge.chaindefuser.com",
    solverRelayBaseURL: "https://solver-relay-v2.chaindefuser.com",
    managerConsoleBaseURL: "https://api-mng-console.chaindefuser.com/api/",
    nearIntentsBaseURL: "https://app.near-intents.org/api/",
  },
}

export let config = {
  env: configsByEnvironment.production,
}

export function configureSDK({ logger, env }: SDKConfig): void {
  if (logger) {
    setLogger(logger)
  }

  if (typeof env === "string") {
    config = { ...config, env: configsByEnvironment[env] }
  } else if (env) {
    config = { ...config, env }
  }
}
