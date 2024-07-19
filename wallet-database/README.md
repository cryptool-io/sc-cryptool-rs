## User Callable Endpoints on Wallet Database SC:

- **registerWallet** (_timestamp: u64, user_signature: ManagedBuffer_)

  - The user needs to register his wallet before being able to deposit.
  - The signature data format is:
    - user_signature: signed(timestamp + user_address)

- **removeWallet** (_timestamp: u64, user_signature: ManagedBuffer_)

  - The user also has the possibility to remove their signature from the whitelisted addresses.
  - The signature data format is:
    - user_signature: signed(timestamp + user_address)

## General Callable Endpoints on Wallet Database SC:

- **isRegistered** (_address: ManagedAddress_) -> bool

  - Calling this endpoint checks whether or not a wallet is registered
