#[allow(unused_imports)]
use multiversx_sc::imports::*;

#[multiversx_sc::module]
pub trait WalletDatabase {
    #[endpoint(registerWallet)]
    fn register_wallet(&self, user_signature: ManagedBuffer, signer_signature: ManagedBuffer) {
        let caller = self.blockchain().get_caller();
        require!(
            !self.whitelisted_wallets().contains(&caller),
            "Wallet is already registered"
        );

        let signer = self.signer().get();

        let mut buffer_user = ManagedBuffer::new();
        buffer_user.append(&caller.as_managed_buffer());
        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer_user, &user_signature);

        let mut buffer_signer = ManagedBuffer::new();
        buffer_signer.append(&signer.as_managed_buffer());
        self.crypto().verify_ed25519(
            signer.as_managed_buffer(),
            &buffer_signer,
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
        let signer = self.signer().get();

        let mut buffer_signer = ManagedBuffer::new();
        buffer_signer.append(&signer.as_managed_buffer());
        self.crypto().verify_ed25519(
            signer.as_managed_buffer(),
            &buffer_signer,
            &signer_signature,
        );

        self.whitelisted_wallets().remove(&caller);
        self.registered_wallets().swap_remove(&caller);
    }

    #[view(getSigner)]
    #[storage_mapper("signer")]
    fn signer(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getRegisteredWallets)]
    #[storage_mapper("registered_wallets")]
    fn registered_wallets(&self) -> UnorderedSetMapper<ManagedAddress>;

    #[storage_mapper("whitelisted_wallets")]
    fn whitelisted_wallets(&self) -> WhitelistMapper<ManagedAddress>;
}
