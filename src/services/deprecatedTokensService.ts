export type DeprecatedTokenToValidToken = Record<string, string>

export class DeprecatedTokensService {
  static #instance: DeprecatedTokensService

  deprecatedTokenToValidToken: DeprecatedTokenToValidToken | null = null

  private constructor(
    deprecatedTokenToValidToken: DeprecatedTokenToValidToken | null = null
  ) {
    this.deprecatedTokenToValidToken = deprecatedTokenToValidToken
  }

  public static makeInstance(
    deprecatedTokenToValidToken?: DeprecatedTokenToValidToken
  ): DeprecatedTokensService {
    if (!DeprecatedTokensService.#instance) {
      DeprecatedTokensService.#instance = new DeprecatedTokensService(
        deprecatedTokenToValidToken
      )
    }

    return DeprecatedTokensService.#instance
  }

  public getValidToken = (address: string): string => {
    return this.deprecatedTokenToValidToken?.[address] ?? address
  }
}
