/**
 * SiloToSilo addresses on blockchains within Aurora Engine
 */
export const siloToSiloAddress = {
  aurora: "0x055707c67977e8217F98f19cFa8aca18B2282D0C",
  turbochain: "0x8a4Bf14C51e1092581F1392810eE38c5A20f83da",
} as const

/**
 * Account ids on Near of Aurora Engine powered blockchains
 * Mapping: ChainName -> AccountId
 */
export const auroraEngineContractId = {
  aurora: "aurora",
  turbochain: "0x4e45415f.c.aurora",
} as const
