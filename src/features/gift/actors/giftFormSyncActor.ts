import { fromCallback } from "xstate"
import type { createGiftFormParsedValuesStore } from "./giftFormParsedValues"
import type { createGiftFormValuesStore } from "./giftFormValuesStore"

export const giftFormSyncActor = fromCallback(
  ({
    input,
    sendBack,
  }: {
    input: {
      formValues: ReturnType<typeof createGiftFormValuesStore>
      parsedValues: ReturnType<typeof createGiftFormParsedValuesStore>
    }
    sendBack: (event: { type: "VALIDATE" }) => void
  }) => {
    const sub = input.formValues.on("changed", ({ context }) => {
      input.parsedValues.trigger.parseValues({ formValues: context })
    })

    const sub2 = input.parsedValues.on("valuesParsed", () => {
      sendBack({ type: "VALIDATE" })
    })

    return () => {
      sub.unsubscribe()
      sub2.unsubscribe()
    }
  }
)
