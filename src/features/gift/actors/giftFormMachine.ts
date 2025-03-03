import { type SnapshotFrom, assign, setup, spawnChild } from "xstate"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import {
  allSetSelector,
  createGiftFormParsedValuesStore,
} from "./giftFormParsedValues"
import { giftFormSyncActor } from "./giftFormSyncActor"
import { createGiftFormValuesStore } from "./giftFormValuesStore"

export const giftFormMachine = setup({
  types: {
    input: {} as {
      initialTokenIn: BaseTokenInfo | UnifiedTokenInfo
    },
    context: {} as {
      isValid: boolean
      formValues: ReturnType<typeof createGiftFormValuesStore>
      parsedValues: ReturnType<typeof createGiftFormParsedValuesStore>
    },
  },
  actors: {
    formSyncActor: giftFormSyncActor,
  },
  actions: {
    validate: assign({
      isValid: ({ context }) => {
        return allSetSelector(context.parsedValues.getSnapshot())
      },
    }),
  },
  guards: {
    isFormValid: ({ context }) => {
      return allSetSelector(context.parsedValues.getSnapshot())
    },
  },
}).createMachine({
  context: ({ input }) => ({
    isValid: false,
    formValues: createGiftFormValuesStore(input),
    parsedValues: createGiftFormParsedValuesStore(),
  }),
  entry: spawnChild("formSyncActor", {
    input: ({ context }) => ({
      formValues: context.formValues,
      parsedValues: context.parsedValues,
    }),
  }),
  on: {
    VALIDATE: {
      actions: "validate",
    },
  },
  initial: "idle",
  states: {
    idle: {},
  },
})

export function formValuesSelector(
  snapshot: SnapshotFrom<typeof giftFormMachine>
) {
  return snapshot.context.formValues
}
