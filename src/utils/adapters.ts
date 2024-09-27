/**
 * See intent contract here - https://nearblocks.io/address/esufed.near.
 */
export enum AdapterIntent0Statuses {
  AVAILABLE = "Available",
  COMPLETED = "Completed",
  ROLLED_BACK = "RolledBack",
  EXPIRED = "Expired",
}
interface AdapterIntent0Result {
  completedStatuses: AdapterIntent0Statuses[]
}
export const adapterIntent0: AdapterIntent0Result = {
  completedStatuses: [
    AdapterIntent0Statuses.COMPLETED,
    AdapterIntent0Statuses.EXPIRED,
    AdapterIntent0Statuses.ROLLED_BACK,
  ],
}

/**
 * See intent contract here - https://nearblocks.io/address/swap-defuse.near.
 */
export enum AdapterIntent1Statuses {
  AVAILABLE = "available",
  EXECUTED = "executed",
  ROLLED_BACK = "rolled_back",
}
interface AdapterIntent1Result {
  completedStatuses: AdapterIntent1Statuses[]
}
export const adapterIntent1: AdapterIntent1Result = {
  completedStatuses: [
    AdapterIntent1Statuses.EXECUTED,
    AdapterIntent1Statuses.ROLLED_BACK,
  ],
}

export type IntentsStatuses = AdapterIntent0Result | AdapterIntent1Result
