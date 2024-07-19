#![no_std]

#[allow(unused_imports)]
use multiversx_sc::imports::*;
use permissions_module::Permissions;

#[multiversx_sc::contract]
pub trait WalletDatabase: permissions_module::PermissionsModule + pausable::PausableModule {
    #[init]
    fn init(&self, signer: ManagedAddress) {
        let all_permissions = Permissions::OWNER | Permissions::ADMIN | Permissions::PAUSE;
        self.set_permissions(self.blockchain().get_caller(), all_permissions);
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
    fn register_wallet(&self, timestamp: u64, user_signature: ManagedBuffer) {
        let caller = self.blockchain().get_caller();
        require!(
            !self.whitelisted_wallets().contains(&caller),
            "Wallet is already registered"
        );

        let signer = self.signer_address().get();

        let mut buffer_user = ManagedBuffer::new();
        let result = timestamp.dep_encode(&mut buffer_user);
        require!(result.is_ok(), "Could not encode");
        buffer_user.append(&caller.as_managed_buffer());
        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer_user, &user_signature);

        self.whitelisted_wallets().add(&caller);
        self.registered_wallets().insert(caller);
    }

    #[endpoint(removeWallet)]
    fn remove_wallet(&self, timestamp: u64, user_signature: ManagedBuffer) {
        let caller = self.blockchain().get_caller();
        require!(
            self.whitelisted_wallets().contains(&caller),
            "Wallet is not registered"
        );
        let signer = self.signer_address().get();

        let mut buffer_user = ManagedBuffer::new();
        let result = timestamp.dep_encode(&mut buffer_user);
        require!(result.is_ok(), "Could not encode");
        buffer_user.append(&caller.as_managed_buffer());
        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer_user, &user_signature);

        self.whitelisted_wallets().remove(&caller);
        self.registered_wallets().swap_remove(&caller);
    }

    #[endpoint(isRegistered)]
    fn is_registered(&self, address: &ManagedAddress) -> bool {
        self.whitelisted_wallets().contains(address)
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
