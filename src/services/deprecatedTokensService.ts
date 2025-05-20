/**
 * A mapping between deprecated token addresses and their replacement (valid) token addresses.
 * The key is the deprecated token address, and the value is the corresponding valid token address.
 */
export type DeprecatedTokenToReplacedToken = Record<string, string>

/**
 * A singleton service that manages deprecated tokens and maps them to valid replacement tokens.
 */
export class DeprecatedTokensService {
  /** Singleton instance */
  static #instance: DeprecatedTokensService

  /**
   * Internal map of deprecated token addresses to their valid replacements.
   * If null, the mapping is not initialized and all tokens are assumed valid.
   */
  deprecatedTokenToValidToken: DeprecatedTokenToReplacedToken | null = null

  /**
   * Private constructor to enforce singleton pattern.
   *
   * @param deprecatedTokenToValidToken - An optional mapping of deprecated tokens to their valid replacements.
   */
  private constructor(
    deprecatedTokenToValidToken: DeprecatedTokenToReplacedToken | null = null
  ) {
    this.deprecatedTokenToValidToken = deprecatedTokenToValidToken
  }

  /**
   * Creates or returns the existing singleton instance of `DeprecatedTokensService`.
   *
   * @param deprecatedTokenToValidToken - Optional mapping used during first initialization.
   * @returns The singleton instance of `DeprecatedTokensService`.
   */
  public static makeInstance(
    deprecatedTokenToValidToken?: DeprecatedTokenToReplacedToken
  ): DeprecatedTokensService {
    if (!DeprecatedTokensService.#instance) {
      DeprecatedTokensService.#instance = new DeprecatedTokensService(
        deprecatedTokenToValidToken ?? null
      )
    }

    return DeprecatedTokensService.#instance
  }

  /**
   * Returns the existing singleton instance of `DeprecatedTokensService`.
   *
   * @returns The singleton instance of `DeprecatedTokensService`.
   */
  public static getInstance(): DeprecatedTokensService {
    return DeprecatedTokensService.#instance
  }

  /**
   * Given a token address, returns its valid replacement if it's deprecated,
   * or the original address if it's already valid.
   *
   * @param address - The token address to check.
   * @returns The valid token address if the input is deprecated; otherwise, the input itself.
   */
  public getValidToken = (address: string): string => {
    return this.deprecatedTokenToValidToken?.[address] ?? address
  }

  /**
   * Replaces the current deprecated-to-valid token mapping with a new one.
   *
   * @param newMapper - The updated mapping of deprecated token addresses to valid token addresses.
   * @returns DeprecatedTokenToReplacedToken
   * */
  public refreshMapper(
    newMapper: DeprecatedTokenToReplacedToken
  ): DeprecatedTokenToReplacedToken {
    this.deprecatedTokenToValidToken = newMapper

    return this.deprecatedTokenToValidToken
  }
}
