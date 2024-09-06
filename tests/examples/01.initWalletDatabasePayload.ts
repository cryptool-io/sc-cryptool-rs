import { AddressValue, Address } from "@multiversx/sdk-core";

import { signerAddressBech32 } from "./signedData";

function getTransactionPayload() {
  const transactionPayload = [
    new AddressValue(new Address(signerAddressBech32)),
  ];
  return transactionPayload;
}

export { getTransactionPayload };
