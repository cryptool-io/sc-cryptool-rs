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
} from "@multiversx/sdk-core";

import {
  POOL_ID,
  TIMESTAMP,
  DATA_DEPLOYER_SIGNED,
  deployerAddressBech32,
} from "./signedData";

function getTransactionPayload() {
  const SOFT_CAP = 10000;
  const HARD_CAP = 50000;
  const CURRENCY1 = "USDC-350c4e";
  const CURRENCY2 = "USDT-58d5d0";
  const MIN_DEPOSIT = 100;
  const MAX_DEPOSIT = 5000;
  const DEPOSIT_INCREMENTS = 50;
  const START_DATE = 1725534643;
  const END_DATE = 1818110409;

  const transactionPayload = [
    StringValue.fromUTF8(POOL_ID),
    new U64Value(SOFT_CAP),
    new U64Value(HARD_CAP),
    new U64Value(MIN_DEPOSIT),
    new U64Value(MAX_DEPOSIT),
    new U64Value(DEPOSIT_INCREMENTS),
    new U64Value(START_DATE),
    new U64Value(END_DATE),
    new BooleanValue(true),
    new AddressValue(new Address(deployerAddressBech32)),
    new AddressValue(new Address(deployerAddressBech32)),
    BytesValue.fromHex(DATA_DEPLOYER_SIGNED),
    new U64Value(TIMESTAMP),
    VariadicValue.fromItems(
      new TokenIdentifierValue(CURRENCY1),
      new TokenIdentifierValue(CURRENCY2),
    ),
  ];
  return transactionPayload;
}

export { getTransactionPayload };
