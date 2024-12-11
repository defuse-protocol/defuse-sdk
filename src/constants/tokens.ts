import type { BaseTokenInfo } from "../types/base"

export const NEAR_TOKEN_META = {
  defuseAssetId: "near:mainnet:native",
  blockchain: "near",
  chainName: "NEAR",
  chainId: "1313161554",
  address: "native",
  name: "NEAR",
  symbol: "NEAR",
  chainIcon: "/static/icons/network/near.svg",
  icon: "https://assets.coingecko.com/coins/images/10365/standard/near.jpg?1696510367",
  decimals: 24,
  routes: ["wrap.near", "near:mainnet:wrap.near"],
}

export const W_NEAR_TOKEN_META = {
  defuseAssetId: "near:mainnet:wrap.near",
  blockchain: "near",
  chainId: "mainnet",
  address: "wrap.near",
  chainName: "NEAR",
  name: "Wrapped NEAR fungible token",
  symbol: "wNEAR",
  chainIcon: "/static/icons/network/near.svg",
  icon: "https://assets.coingecko.com/coins/images/10365/standard/near.jpg",
  decimals: 24,
  routes: [],
}

export const NEAR_WHITELIST_TOKEN_ADDRESSES = [
  "wrap.near",
  "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near",
  "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near",
  "6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near",
  "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near",
  "111111111117dc0aa78b770fa6a738034120c302.factory.bridge.near",
  "c944e90c64b2c07662a292be6244bdf05cda44a7.factory.bridge.near",
  "usdt.tether-token.near",
  "berryclub.ek.near",
  "farm.berryclub.ek.near",
  "6f259637dcd74c767781e37bc6133cd6a68aa161.factory.bridge.near",
  "de30da39c46104798bb5aa3fe8b9e0e1f348163f.factory.bridge.near",
  "1f9840a85d5af5bf1d1762f925bdaddc4201f984.factory.bridge.near",
  "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near",
  "514910771af9ca656af840dff83e8264ecf986ca.factory.bridge.near",
  "f5cfbc74057c610c8ef151a439252680ac68c6dc.factory.bridge.near",
  "token.v2.ref-finance.near",
  "d9c2d319cd7e6177336b0a9c93c21cb48d84fb54.factory.bridge.near",
  "token.paras.near",
  "a4ef4b0b23c1fc81d3f9ecf93510e64f58a4a016.factory.bridge.near",
  "marmaj.tkn.near",
  "meta-pool.near",
  "token.cheddar.near",
  "52a047ee205701895ee06a375492490ec9c597ce.factory.bridge.near",
  "aurora",
  "pixeltoken.near",
  "dbio.near",
  "aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
  "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  "v1.dacha-finance.near",
  "3ea8ea4237344c9931214796d9417af1a1180770.factory.bridge.near",
  "e99de844ef3ef72806cf006224ef3b813e82662f.factory.bridge.near",
  "v3.oin_finance.near",
  "9aeb50f542050172359a0e1a25a9933bc8c01259.factory.bridge.near",
  "myriadcore.near",
  "xtoken.ref-finance.near",
  "sol.token.a11bd.near",
  "ust.token.a11bd.near",
  "luna.token.a11bd.near",
  "celo.token.a11bd.near",
  "cusd.token.a11bd.near",
  "abr.a11bd.near",
  "utopia.secretskelliessociety.near",
  "deip-token.near",
  "4691937a7508860f876c9c0a2a617e7d9e945d4b.factory.bridge.near",
  "linear-protocol.near",
  "usn",
  "mpdao-token.near",
  "neat.nrc-20.near",
  "atocha-token.near",
  "token.stlb.near",
  "far.tokens.fewandfar.near",
  "059a1f1dea1020297588c316ffc30a58a1a0d4a2.factory.bridge.near",
  "token.burrow.near",
  "fusotao-token.near",
  "v2-nearx.stader-labs.near",
  "discovol-token.near",
  "30d20208d987713f46dfd34ef128bb16c404d10f.factory.bridge.near",
  "token.sweat",
  "apys.token.a11bd.near",
  "ftv2.nekotoken.near",
  "phoenix-bonds.near",
  "token.bocachica_mars.near",
  "token.lonkingnearbackto2024.near",
  "blackdragon.tkn.near",
  "gear.enleap.near",
  "token.0xshitzu.near",
  "jumptoken.jumpfinance.near",
  "ft.zomland.near",
  "memelol.near",
  "ndc.tkn.near",
  "token.pumpopoly.near",
  "853d955acef822db058eb8505911ed77f175b99e.factory.bridge.near",
  "a663b02cf0a4b149d2ad41910cb81e23e1c41c32.factory.bridge.near",
  "bean.tkn.near",
  "802d89b6e511b335f05024a65161bce7efc3f311.factory.bridge.near",
  "438e48ed4ce6beecf503d43b9dbd3c30d516e7fd.factory.bridge.near",
  "benthedog.near",
  "3231cb76718cdef2155fc47b5286d82e6eda273f.factory.bridge.near",
  "44ee4ae1e0c2e6160715f24c02fd8df72afe31f2.factory.bridge.near",
  "cc6f64b74614f52e7fd808a48ad01a26ca778200.factory.bridge.near",
  "cf3c8be2e2c42331da80ef210e9b1b307c03d36a.factory.bridge.near",
  "2bb360ef17faaf3b33e6513bf6c5c382c6aa8c28.factory.bridge.near",
  "509a38b7a1cc0dcd83aa9d06214663d9ec7c7f4a.factory.bridge.near",
  "f56b164efd3cfc02ba739b719b6526a6fa1ca32a.factory.bridge.near",
  "9c2dc0c3cc2badde84b0025cf4df1c5af288d835.factory.bridge.near",
  "0000000de40dfa9b17854cbc7869d80f9f98d823.factory.bridge.near",
  "1494ca1f11d487c2bbe4543e90080aeba4ba3c2b.factory.bridge.near",
  "7f5c4aded107f66687e6e55dee36a3a8fa3de030.factory.bridge.near",
  "7e5981c2e072f53a0323d3d80baca3e31fb1550c.factory.bridge.near",
  "967da4048cd07ab37855c090aaf366e4ce1b9f48.factory.bridge.near",
  "4e807467ba9e3119d5356c5568ef63e9c321b471.factory.bridge.near",
  "6a8c1211d36be23d326a6b0bc4e29b482595d0a3.factory.bridge.near",
  "1ab43204a195a0fd37edec621482afd3792ef90b.factory.bridge.near",
  "a0dc23fa9f42146e62e027c50f866d8bdcc46a8a.factory.bridge.near",
  "8353b92201f19b4812eee32efd325f7ede123718.factory.bridge.near",
  "nearnvidia.near",
  "0aabcc65ef352ad84b1326df188c95b6ab856c1c.factory.bridge.near",
  "501ace9c35e60f03a2af4d484f49f9b1efde9f40.factory.bridge.near",
  "3540abe4f288b280a0740ad5121aec337c404d15.factory.bridge.near",
  "0000000000085d4780b73119b644ae5ecd22b376.factory.bridge.near",
  "0c10bf8fcb7bf5412187a595ab97a3609160b5c6.factory.bridge.near",
  "c6903b623f1548f533eb367f6f1b7d717b9351c2.factory.bridge.near",
  "39a15a0695c77cbe5fd4f06ab0ccb7bad62f696f.factory.bridge.near",
  "818f49467021bdaadae69e071e79ad2fd7226a1e.factory.bridge.near",
  "22.contract.portalbridge.near",
  "touched.tkn.near",
  "intel.tkn.near",
  "nkok.tkn.near",
  "usmeme.tg",
  "dragonsoultoken.near",
  "meta-token.near",
  "babyblackdragon.tkn.near",
  "edge-fast.near",
  "slush.tkn.near",
  "hat.tkn.near",
  "arepita.near",
  "16.contract.portalbridge.near",
  "dd.tg",
  "neiro.token0.near",
  "0316eb71485b0ab14103307bf65a021042c6d380.factory.bridge.near",
  "cz.token0.near",
  "corgi.token0.near",
  "kat.token0.near",
  "gp.token0.near",
  "v1.guild-covenant.near",
  "chill-129.meme-cooking.near",
]

export const NEP141_STORAGE_TOKEN: BaseTokenInfo = {
  defuseAssetId: "nep141:wrap.near",
  address: "wrap.near",
  decimals: 24,
  icon: "https://assets.coingecko.com/coins/images/10365/standard/near.jpg",
  chainId: "",
  chainIcon: "/static/icons/network/near.svg",
  chainName: "near",
  routes: [],
  symbol: "NEAR",
  name: "Near",
}
