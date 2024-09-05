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

import { TIMESTAMP, SIGNATURE_REGISTER_BOB_WALLET } from "./signedData";

function getTransactionPayload() {
  const transactionPayload = [
    new U64Value(TIMESTAMP),
    BytesValue.fromHex(SIGNATURE_REGISTER_BOB_WALLET),
  ];
  return transactionPayload;
}

export { getTransactionPayload };
