import * as react_jsx_runtime from 'react/jsx-runtime';
import { Transaction as Transaction$1 } from '@solana/web3.js';
import { Hash, Address } from 'viem';

type SendNearTransaction = (tx: Transaction["NEAR"]) => Promise<{
    txHash: string;
} | null>;

declare enum BaseTokenConvertEnum {
    USD = "usd"
}
type BaseTokenBalance = {
    /** bigint in string */
    balance: string;
    balanceUsd?: string;
    convertedLast?: {
        [key in BaseTokenConvertEnum]: string;
    };
};
type SupportedChainName = "eth" | "near" | "base" | "arbitrum" | "bitcoin" | "solana" | "dogecoin" | "turbochain" | "aurora" | "xrpledger" | "zcash" | "gnosis" | "berachain";
interface FungibleTokenInfo extends Partial<BaseTokenBalance> {
    defuseAssetId: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    icon: string;
    /** @deprecated */
    chainId: string;
    chainIcon: string;
    chainName: SupportedChainName;
    /** @deprecated */
    routes: string[];
}
interface NativeTokenInfo extends Partial<BaseTokenBalance> {
    defuseAssetId: string;
    type: "native";
    symbol: string;
    name: string;
    decimals: number;
    icon: string;
    /** @deprecated */
    chainId: string;
    chainIcon: string;
    chainName: SupportedChainName;
    /** @deprecated */
    routes: string[];
}
type BaseTokenInfo = FungibleTokenInfo | NativeTokenInfo;
/**
 * A virtual aggregation of the same token across multiple blockchains.
 * This is not an on-chain token but a unified view of network-specific tokens
 * with shared properties.
 *
 * The name avoids "NativeMultichainAsset" to clarify that it doesn't represent
 * an actual multichain token, just a virtual abstraction.
 */
interface UnifiedTokenInfo {
    unifiedAssetId: string;
    symbol: string;
    name: string;
    icon: string;
    groupedTokens: BaseTokenInfo[];
}

type ERC191Message = {
    message: string;
};
type ERC191SignatureData = {
    type: "ERC191";
    signatureData: string;
    signedData: ERC191Message;
};
type NEP413Message = {
    message: string;
    recipient: string;
    nonce: Uint8Array;
    callbackUrl?: string;
};
type NEP413SignatureData = {
    type: "NEP413";
    signatureData: {
        accountId: string;
        /**
         * Base58-encoded signature with curve prefix. Example:
         * ed25519:Gxa24TGbJu4mqdhW3GbvLXmf4bSEyxVicrtpChDWbgga
         */
        publicKey: string;
        /** Base64-encoded signature */
        signature: string;
    };
    /**
     * The exact data that was signed. Wallet connectors may modify this during the signing process,
     * so this property contains the actual data that was signed by the wallet.
     */
    signedData: NEP413Message;
};
type SolanaMessage = {
    message: Uint8Array;
};
type SolanaSignatureData = {
    type: "SOLANA";
    signatureData: Uint8Array;
    signedData: SolanaMessage;
};
type WalletMessage = {
    ERC191: ERC191Message;
    NEP413: NEP413Message;
    SOLANA: SolanaMessage;
};
type WalletSignatureResult = ERC191SignatureData | NEP413SignatureData | SolanaSignatureData;
type SwapEvent = {
    type: string;
    data: unknown;
    error?: string;
};
type SwappableToken = BaseTokenInfo | UnifiedTokenInfo;
type SwapWidgetProps = {
    theme?: "dark" | "light";
    tokenList: SwappableToken[];
    onEmit?: (event: SwapEvent) => void;
    /**
     * The address (address for EVM, accountId for NEAR, etc) of the user performing the swap.
     * `null` if the user is not authenticated.
     */
    userAddress: string | null;
    userChainType: ChainType | null;
    sendNearTransaction: SendNearTransaction;
    signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>;
    onSuccessSwap: (params: {
        amountIn: bigint;
        amountOut: bigint;
        tokenIn: SwappableToken;
        tokenOut: SwappableToken;
        txHash: string;
        intentHash: string;
    }) => void;
    onNavigateDeposit?: () => void;
    initialTokenIn?: SwappableToken;
    initialTokenOut?: SwappableToken;
    /**
     * Optional referral code, used for tracking purposes.
     * Prop is not reactive, set it once when the component is created.
     */
    referral?: string;
};

type ChainType = "near" | "evm" | "solana";
declare const ChainType: {
    readonly Near: "near";
    readonly EVM: "evm";
    readonly Solana: "solana";
};
type UserInfo = {
    userAddress?: string;
    chainType?: ChainType;
};
type DepositWidgetProps = UserInfo & {
    tokenList: SwappableToken[];
    sendTransactionNear: (tx: Transaction["NEAR"][]) => Promise<string | null>;
    sendTransactionEVM: (tx: Transaction["EVM"]) => Promise<Hash | null>;
    sendTransactionSolana: (tx: Transaction["Solana"]) => Promise<string | null>;
    chainType?: ChainType;
};
type Transaction = {
    NEAR: SendTransactionNearParams;
    EVM: SendTransactionEVMParams;
    Solana: SendTransactionSolanaParams;
};
interface FunctionCallAction {
    type: "FunctionCall";
    params: {
        methodName: string;
        args: object;
        gas: string;
        deposit: string;
    };
}
type Action = FunctionCallAction;
interface SendTransactionNearParams {
    receiverId: string;
    actions: Array<Action>;
}
interface SendTransactionEVMParams {
    from: Address;
    to: Address;
    chainId: number;
    data: Hash;
    value?: bigint;
    gasPrice?: bigint;
    gas?: bigint;
}
interface SendTransactionSolanaParams extends Transaction$1 {
}

declare const DepositWidget: ({ tokenList, userAddress, chainType, sendTransactionNear, sendTransactionEVM, sendTransactionSolana, }: DepositWidgetProps) => react_jsx_runtime.JSX.Element;

declare const SwapWidget: ({ tokenList, userAddress, userChainType, sendNearTransaction, signMessage, onSuccessSwap, onNavigateDeposit, initialTokenIn, initialTokenOut, referral, }: SwapWidgetProps) => react_jsx_runtime.JSX.Element;

type WithdrawWidgetProps = UserInfo & {
    tokenList: (BaseTokenInfo | UnifiedTokenInfo)[];
    signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>;
    sendNearTransaction: SendNearTransaction;
    /**
     * Optional referral code, used for tracking purposes.
     * Prop is not reactive, set it once when the component is created.
     */
    referral?: string;
};

declare const WithdrawWidget: (props: WithdrawWidgetProps) => react_jsx_runtime.JSX.Element;

declare function isBaseToken(token: BaseTokenInfo | UnifiedTokenInfo): token is BaseTokenInfo;
declare function isUnifiedToken(token: BaseTokenInfo | UnifiedTokenInfo): token is UnifiedTokenInfo;

export { type BaseTokenInfo, ChainType, DepositWidget, SwapWidget, type UnifiedTokenInfo, WithdrawWidget, isBaseToken, isUnifiedToken };
