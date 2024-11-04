// Copied from https://github.com/mynearwallet/my-near-wallet/blob/3b1a6c6e5c62a0235f5e32d370f803fa2180c6f8/packages/frontend/src/utils/wallet.ts#L75
const ACCOUNT_ID_REGEX = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/

const IMPLICIT_ACCOUNT_MAX_LENGTH = 64

export function isLegitAccountId(accountId: string): boolean {
  return ACCOUNT_ID_REGEX.test(accountId)
}

export function isImplicitAccount(accountId: string): boolean {
  return (
    accountId.length === IMPLICIT_ACCOUNT_MAX_LENGTH && !accountId.includes(".")
  )
}
