#![no_std]

#[allow(unused_imports)]
use multiversx_sc::imports::*;

#[multiversx_sc::contract]
pub trait WalletDatabase: permissions_module::PermissionsModule + pausable::PausableModule {
    #[init]
    fn init(&self, signer: ManagedAddress) {
        self.signer_address().set(signer);
    }

    #[upgrade]
    fn upgrade(&self) {}

    #[endpoint(updateSigner)]
    fn update_signer(&self, new_signer: ManagedAddress) {
        self.require_caller_has_owner_or_admin_permissions();
        self.signer_address().set(new_signer);
    }

    #[endpoint(registerWallet)]
    fn register_wallet(&self, user_signature: ManagedBuffer, signer_signature: ManagedBuffer) {
        let caller = self.blockchain().get_caller();
        require!(
            !self.whitelisted_wallets().contains(&caller),
            "Wallet is already registered"
        );

        let signer = self.signer_address().get();

        self.crypto().verify_ed25519(
            &caller.as_managed_buffer(),
            &caller.as_managed_buffer(),
            &user_signature,
        );

        self.crypto().verify_ed25519(
            signer.as_managed_buffer(),
            &signer.as_managed_buffer(),
            &signer_signature,
        );

        self.whitelisted_wallets().add(&caller);
        self.registered_wallets().insert(caller);
    }

    #[endpoint(removeWallet)]
    fn remove_wallet(&self, signer_signature: ManagedBuffer) {
        let caller = self.blockchain().get_caller();
        require!(
            self.whitelisted_wallets().contains(&caller),
            "Wallet is not registered"
        );
        let signer = self.signer_address().get();

        self.crypto().verify_ed25519(
            signer.as_managed_buffer(),
            &caller.as_managed_buffer(),
            &signer_signature,
        );

        self.whitelisted_wallets().remove(&caller);
        self.registered_wallets().swap_remove(&caller);
    }

    #[view(getSignerAddress)]
    #[storage_mapper("signer_address")]
    fn signer_address(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getRegisteredWallets)]
    #[storage_mapper("registered_wallets")]
    fn registered_wallets(&self) -> UnorderedSetMapper<ManagedAddress>;

    #[storage_mapper("whitelisted_wallets")]
    fn whitelisted_wallets(&self) -> WhitelistMapper<ManagedAddress>;
}
