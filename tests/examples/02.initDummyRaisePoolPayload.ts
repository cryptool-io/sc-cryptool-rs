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
  StringValue,
  CompositeValue,
} from "@multiversx/sdk-core";

import {
  POOL_ID,
  deployerAddressBech32,
  signerAddressBech32,
} from "./signedData";

// WALLET_DATABASE_CONTRACT_ADDRESS obtained from previous call: 01.initWalletDatabaseCall
const WALLET_DATABASE_CONTRACT_ADDRESS =
  "erd1qqqqqqqqqqqqqpgq7faj4p0ncezeetavmd2hd3ey3v4dunan7wpq67y99x";

function getTransactionPayload() {
  const SOFT_CAP = 10000;
  const HARD_CAP = 50000;
  const CURRENCY1 = "USDC-350c4e";
  const CURRENCY1_DECIMALS = 6;
  const CURRENCY2 = "USDT-58d5d0";
  const CURRENCY2_DECIMALS = 6;
  const MIN_DEPOSIT = 100;
  const MAX_DEPOSIT = 5000;
  const DEPOSIT_INCREMENTS = 50;
  const START_DATE = 1725607602;
  const END_DATE = 1818110409;

  const transactionPayload = [
    new AddressValue(new Address(deployerAddressBech32)),
    StringValue.fromUTF8(POOL_ID),
    new U64Value(SOFT_CAP),
    new U64Value(HARD_CAP),
    new BigUIntValue(MIN_DEPOSIT),
    new BigUIntValue(MAX_DEPOSIT),
    new BigUIntValue(DEPOSIT_INCREMENTS),
    new U64Value(START_DATE),
    new U64Value(END_DATE),
    new BooleanValue(true),
    new AddressValue(new Address(deployerAddressBech32)),
    new AddressValue(new Address(deployerAddressBech32)),
    new AddressValue(new Address(signerAddressBech32)),
    new AddressValue(new Address(WALLET_DATABASE_CONTRACT_ADDRESS)),
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
