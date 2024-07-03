// Code generated by the multiversx-sc build system. DO NOT EDIT.

////////////////////////////////////////////////////
////////////////// AUTO-GENERATED //////////////////
////////////////////////////////////////////////////

// Init:                                 1
// Upgrade:                              1
// Endpoints:                           14
// Async Callback (empty):               1
// Total number of exported functions:  17

#![no_std]

multiversx_sc_wasm_adapter::allocator!();
multiversx_sc_wasm_adapter::panic_handler!();

multiversx_sc_wasm_adapter::endpoints! {
    wallet_database
    (
        init => init
        upgrade => upgrade
        updateSigner => update_signer
        registerWallet => register_wallet
        removeWallet => remove_wallet
        getSignerAddress => signer_address
        getRegisteredWallets => registered_wallets
        addAdmin => add_admin_endpoint
        removeAdmin => remove_admin_endpoint
        updateOwnerOrAdmin => update_owner_or_admin_endpoint
        getPermissions => permissions
        addToPauseWhitelist => add_to_pause_whitelist
        removeFromPauseWhitelist => remove_from_pause_whitelist
        pause => pause
        resume => resume
        getState => state
    )
}

multiversx_sc_wasm_adapter::async_callback_empty! {}
