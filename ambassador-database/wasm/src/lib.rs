// Code generated by the multiversx-sc build system. DO NOT EDIT.

////////////////////////////////////////////////////
////////////////// AUTO-GENERATED //////////////////
////////////////////////////////////////////////////

// Init:                                 1
// Endpoints:                           21
// Async Callback (empty):               1
// Total number of exported functions:  23

#![no_std]
#![allow(internal_features)]
#![feature(lang_items)]

multiversx_sc_wasm_adapter::allocator!();
multiversx_sc_wasm_adapter::panic_handler!();

multiversx_sc_wasm_adapter::endpoints! {
    ambassador_database
    (
        init => init
        upgrade => upgrade
        registerReferralCode => register_referral_code
        removeReferralCode => remove_referral_code
        setReferralPercentage => set_referral_percentage
        applyReferralCode => apply_referral_code
        claimReferralEarning => claim_referral_earning
        getDefaultReferralPercentage => default_referral_percentage
        getUserReferralCode => user_referral_code
        getReferralCodeUser => referral_code_user
        getReferralCodes => referral_codes
        getReferralCodePercentage => referral_code_percentage
        getReferralEarnedTokens => referral_earned_tokens
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
