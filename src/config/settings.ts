import { Settings } from "../types"

let settings: Settings = {
  providerIds: [],
}

export const getSettings = (): Settings => settings

export const setSettings = (newSettings: Partial<Settings>) => {
  settings = { ...settings, ...newSettings }
}
