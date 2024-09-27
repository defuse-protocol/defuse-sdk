const ReferralEnum = {
  enum: [
    {
      struct: {
        Null: "string",
      },
    },
    {
      struct: {
        Some: "string",
      },
    },
  ],
}

const ExpirationEnum = {
  enum: [
    {
      struct: {
        Null: "u64",
      },
    },
    {
      struct: {
        Time: "u64",
      },
    },
    {
      struct: {
        Block: "u64",
      },
    },
  ],
}

const TransferTokenStruct = {
  struct: {
    token_id: "string",
    amount: "u128",
  },
}

const IntentStruct = {
  struct: {
    initiator: "string",
    send: TransferTokenStruct,
    receive: TransferTokenStruct,
    expiration: ExpirationEnum,
    referral: ReferralEnum,
  },
}

const CreateIntentStruct = {
  struct: {
    id: "string",
    IntentStruct,
  },
}

export const swapSchema = {
  enum: [
    {
      struct: {
        CreateIntent: CreateIntentStruct,
      },
    },
    {
      struct: {
        ExecuteIntent: "string",
      },
    },
  ],
}
