import {
  U32Value,
  U64Value,
  BigUIntValue,
  BooleanValue,
  AddressValue,
  Address,
  BytesValue,
  TokenIdentifierValue,
  VariadicValue,
  TokenIdentifierType,
  VariadicType,
  CompositeValue,
} from "@multiversx/sdk-core";

// WALLET_DATABASE_CONTRACT_ADDRESS obtained from previous call: 01.initWalletDatabaseCall
const WALLET_DATABASE_CONTRACT_ADDRESS =
  "erd1qqqqqqqqqqqqqpgqn04pywlasvqywexpxd8833hagtv35yu47wpqkc5fh4";

// DUMMY_RAISE_POOL_CONTRACT_ADDRESS obtained from previous call: 02.initDummyRaisePoolCall
const DUMMY_RAISE_POOL_CONTRACT_ADDRESS =
  "erd1qqqqqqqqqqqqqpgqratjhq7y0a6xt9nlj34tvdr9r9mggn927wpq0s79ys";

const SIGNER = "erd1knqwuf04wrqvdmagvag2wcps3h0fjjag6peqhdnz8qt6v0gvcm8qmy3x8m";

function getTransactionPayload() {
  const CURRENCY1 = "USDC-350c4e";
  const CURRENCY1_DECIMALS = 6;
  const CURRENCY2 = "USDT-58d5d0";
  const CURRENCY2_DECIMALS = 6;

  const transactionPayload = [
    new AddressValue(new Address(DUMMY_RAISE_POOL_CONTRACT_ADDRESS)),
    new AddressValue(new Address(WALLET_DATABASE_CONTRACT_ADDRESS)),
    new AddressValue(new Address(SIGNER)),
    VariadicValue.fromItems(
      CompositeValue.fromItems(
        new TokenIdentifierValue(CURRENCY1),
        new U32Value(CURRENCY1_DECIMALS),
      ),
      CompositeValue.fromItems(
        new TokenIdentifierValue(CURRENCY2),
        new U32Value(CURRENCY2_DECIMALS),
      ),
    ),
  ];

  return transactionPayload;
}

export { getTransactionPayload };
