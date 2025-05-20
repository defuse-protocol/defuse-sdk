export type DeprecatedTokenToReplacedToken = Record<string, string>

export class DeprecatedTokensService {
  static #instance: DeprecatedTokensService

  deprecatedTokenToValidToken: DeprecatedTokenToReplacedToken | null = null

  private constructor(
    deprecatedTokenToValidToken: DeprecatedTokenToReplacedToken | null = null
  ) {
    this.deprecatedTokenToValidToken = deprecatedTokenToValidToken
  }

  public static makeInstance(
    deprecatedTokenToValidToken?: DeprecatedTokenToReplacedToken
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
