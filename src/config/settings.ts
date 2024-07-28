import { SolverSettings } from "../types"

let settings: SolverSettings = {
  providerIds: [],
}

export const getSettings = (): SolverSettings => settings

export const setSettings = (newSettings: Partial<SolverSettings>) => {
  settings = { ...settings, ...newSettings }
}
