## Owner Callable Endpoints on Factory SC:

- **init** (_source_raise_contract: ManagedAddress, wallet_database_address: ManagedAddress, signer: ManagedAddress, payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>_)

  - Deploy a Factory smart contract with the dummy raise pool as a source contract, the wallet database address, the backend wallet that will be used to validate database data as signer and the accepted currencies for creating the raise pools and their respective decimals.

- **deployRaisePool** (_pool_id: u32, soft_cap: BigUint, hard_cap: BigUint, min_deposit: BigUint, max_deposit: BigUint, deposit_increments: BigUint, start_date: u64, end_date: u64, refund_enabled: bool, platform_fee_wallet: ManagedAddress, group_fee_wallet: ManagedAddress, signature: ManagedBuffer, timestamp: u64, currencies: MultiValueEncoded<TokenIdentifier>_)

  - This endpoint, called on the factory, deploys a new raise pool. Notice the parameters are virtually identical to the dummy deploy except for the owner, which the Factory sets as the caller and the currencies which don't need to have their decimals specified as this was done in the Factory deploy step.