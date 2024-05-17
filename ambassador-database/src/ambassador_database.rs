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
        require!(
            self.referral_code_user(&referral_code).is_empty(),
            "Referral is already registered"
        );

        let caller = self.blockchain().get_caller();
        self.user_referral_code(&caller).set(referral_code.clone());
        self.referral_code_user(&referral_code).set(caller);
        let default_percentage = self.default_referral_percentage().get();
        self.referral_code_percentage(&referral_code)
            .set(default_percentage);
        self.referral_codes().insert(referral_code);
    }

    #[endpoint(removeReferralCode)]
    fn remove_referral_code(&self, referral_code: ManagedBuffer) {
        self.require_state_active();
        self.require_caller_has_admin_permissions();

        require!(
            !self.referral_code_user(&referral_code).is_empty(),
            "Referral is not registered"
        );

        let owner = self.referral_code_user(&referral_code).get();
        self.claim_referral_earning_by_address(&owner);
        self.user_referral_code(&owner).clear();
        self.referral_code_user(&referral_code).clear();
        self.referral_codes().swap_remove(&referral_code);
    }

    #[endpoint(setReferralPercentage)]
    fn set_referral_percentage(&self, referral_code: ManagedBuffer, new_percentage: u64) {
        self.require_state_active();
        self.require_caller_has_admin_permissions();
        require!(
            new_percentage < MAX_PERCENTAGE,
            "Invalid referral percentage"
        );
        require!(
            !self.referral_code_user(&referral_code).is_empty(),
            "Referral is not registered"
        );

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

        let mut payment = self.call_value().egld_or_single_esdt();
        let referral_percentage =
            BigUint::from(self.referral_code_percentage(&referral_code).get());
        let discount_amount = (&payment.amount * &referral_percentage) / MAX_PERCENTAGE;
        payment.amount -= &discount_amount;
        self.send().direct(
            &caller,
            &payment.token_identifier,
            payment.token_nonce,
            &payment.amount,
        );
        if payment.token_identifier.is_egld() {
            self.referral_earned_egld_amount(&referral_code)
                .update(|current| *current += discount_amount);
        } else {
            let esdt_token = payment.token_identifier.as_esdt_option().unwrap();
            self.referral_earned_esdt_amount(&referral_code, &esdt_token)
                .update(|current| *current += discount_amount);
            self.referral_earned_tokens(&referral_code)
                .insert(esdt_token.clone_value());
        }
    }

    #[endpoint(claimReferralEarning)]
    fn claim_referral_earning(&self) {
        self.require_state_active();
        let caller = self.blockchain().get_caller();
        self.claim_referral_earning_by_address(&caller);
    }

    fn claim_referral_earning_by_address(&self, address: &ManagedAddress) {
        let referral = self.user_referral_code(address).get();
        require!(
            !referral.is_empty(),
            "Address does not have a referral code associated"
        );

        let egld_gained = self.referral_earned_egld_amount(&referral).take();
        if egld_gained > 0 {
            self.send().direct_egld(address, &egld_gained);
        }

        let tokens_gained = self.referral_earned_tokens(&referral);
        let mut payments = ManagedVec::new();
        for token in tokens_gained.iter() {
            let amount = self.referral_earned_esdt_amount(&referral, &token).take();
            payments.push(EsdtTokenPayment::new(
                token,
                0,
                amount,
            ));

        }
        self.send().direct_multi(address, &payments);
        self.referral_earned_tokens(&referral).clear()
    }

    // STORAGE

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

    #[view(getReferralEarnedTokens)]
    #[storage_mapper("referral_earned_tokens")]
    fn referral_earned_tokens(
        &self,
        referral_code: &ManagedBuffer,
    ) -> UnorderedSetMapper<TokenIdentifier>;

    #[storage_mapper("referral_earned_esdt_amount")]
    fn referral_earned_esdt_amount(
        &self,
        referral_code: &ManagedBuffer,
        token: &TokenIdentifier,
    ) -> SingleValueMapper<BigUint>;

    #[storage_mapper("referral_earned_egld_amount")]
    fn referral_earned_egld_amount(
        &self,
        referral_code: &ManagedBuffer,
    ) -> SingleValueMapper<BigUint>;
}
