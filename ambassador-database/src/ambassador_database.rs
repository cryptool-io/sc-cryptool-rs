#![no_std]

pub const MAX_PERCENTAGE: u64 = 10_000;

#[allow(unused_imports)]
use multiversx_sc::imports::*;
use permissions_module::Permissions;

#[multiversx_sc::contract]
pub trait AmbassadorDatabase:
    permissions_module::PermissionsModule + pausable::PausableModule
{
    #[init]
    fn init(&self, default_referral_percentage: u64) {
        let all_permissions = Permissions::OWNER | Permissions::ADMIN | Permissions::PAUSE;
        self.set_permissions(self.blockchain().get_caller(), all_permissions);
        require!(
            default_referral_percentage < MAX_PERCENTAGE,
            "Invalid default referral percentage"
        );
        self.default_referral_percentage()
            .set(default_referral_percentage);
    }

    #[upgrade]
    fn upgrade(&self) {}

    #[endpoint(registerReferralCode)]
    fn register_referral_code(&self, referral_code: ManagedBuffer) {
        self.require_state_active();
        let caller = self.blockchain().get_caller();

        self.user_referral_code(&caller).set(referral_code.clone());
        self.referral_code_user(&referral_code).set(caller);
        let default_percentage = self.default_referral_percentage().get();
        self.referral_code_percentage(&referral_code)
            .set(default_percentage);
        self.referral_codes().insert(referral_code);
    }

    #[endpoint(setReferralPercentage)]
    fn set_referral_percentage(&self, referral_code: ManagedBuffer, new_percentage: u64) {
        self.require_state_active();
        self.require_caller_has_admin_permissions();
        require!(
            new_percentage < MAX_PERCENTAGE,
            "Invalid referral percentage"
        );

        let referral_percentage = self.referral_code_percentage(&referral_code).get();
        require!(referral_percentage > 0, "Referral not registered");

        self.referral_code_percentage(&referral_code)
            .set(new_percentage);
    }

    #[payable("*")]
    #[endpoint(applyReferralCode)]
    fn apply_referral_code(&self, referral_code: ManagedBuffer) {
        self.require_state_active();
        let caller = self.blockchain().get_caller();
        require!(
            self.blockchain().is_smart_contract(&caller),
            "Only smart contracts can apply referral codes"
        );

        let payments = self.call_value().all_esdt_transfers();
        require!(payments.len() == 1, "Incorrect payment");

        let mut payment = payments.get(0);
        let referral_percentage =
            BigUint::from(self.referral_code_percentage(&referral_code).get());
        let discount_amount = (&payment.amount * &referral_percentage) / MAX_PERCENTAGE;
        payment.amount -= &discount_amount;
        self.send().direct_esdt(
            &caller,
            &payment.token_identifier,
            payment.token_nonce,
            &payment.amount,
        );
        self.referral_earning(&referral_code)
            .update(|current| *current += discount_amount);
    }

    #[view(getDefaultReferralPercentage)]
    #[storage_mapper("default_referral_percentage")]
    fn default_referral_percentage(&self) -> SingleValueMapper<u64>;

    #[view(getUserReferralCode)]
    #[storage_mapper("user_referral_code")]
    fn user_referral_code(&self, address: &ManagedAddress) -> SingleValueMapper<ManagedBuffer>;

    #[view(getReferralCodeUser)]
    #[storage_mapper("referral_code_user")]
    fn referral_code_user(
        &self,
        referral_code: &ManagedBuffer,
    ) -> SingleValueMapper<ManagedAddress>;

    #[view(getReferralCodes)]
    #[storage_mapper("referral_codes")]
    fn referral_codes(&self) -> UnorderedSetMapper<ManagedBuffer>;

    #[view(getReferralCodePercentage)]
    #[storage_mapper("referral_code_percentage")]
    fn referral_code_percentage(&self, referral_code: &ManagedBuffer) -> SingleValueMapper<u64>;

    #[view(getReferralEarning)]
    #[storage_mapper("referral_earning")]
    fn referral_earning(&self, referral_code: &ManagedBuffer) -> SingleValueMapper<BigUint>;
}
