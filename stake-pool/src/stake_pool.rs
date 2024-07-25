#![no_std]

use helpers::DIVISION_SAFETY_CONSTANT;
#[allow(unused_imports)]
use multiversx_sc::imports::*;
use permissions_module::Permissions;
mod events;
mod helpers;
mod storage;

#[multiversx_sc::contract]
pub trait StakePool:
    crate::storage::StorageModule
    + permissions_module::PermissionsModule
    + pausable::PausableModule
    + helpers::HelperModule
    + events::EventsModule
{
    #[init]
    fn init(
        &self,
        token_id: TokenIdentifier,
        start_timestamp: u64,
        end_timestamp: u64,
        wallet_database_address: ManagedAddress,
    ) {
        require!(
            self.blockchain().get_block_timestamp() < start_timestamp,
            "Start timestamp must be set in the future"
        );
        require!(
            start_timestamp < end_timestamp,
            "End timestamp must be greater than start timestamp"
        );
        let all_permissions = Permissions::OWNER | Permissions::ADMIN | Permissions::PAUSE;
        self.set_permissions(self.blockchain().get_caller(), all_permissions);
        self.token_id().set(token_id);
        self.division_safety_constant()
            .set(BigUint::from(DIVISION_SAFETY_CONSTANT));
        self.start_timestamp().set(start_timestamp);
        self.end_timestamp().set(end_timestamp);
        self.wallet_database_address().set(wallet_database_address);
    }

    #[upgrade]
    fn upgrade(&self) {}

    #[payable("*")]
    #[endpoint(addRewards)]
    fn add_rewards(&self, rewards_per_block: Option<BigUint>) {
        self.require_caller_has_owner_permissions();
        let payment = self.call_value().single_esdt();
        require!(
            payment.token_identifier == self.token_id().get(),
            "Invalid payment currency"
        );
        self.total_rewards().update(|old| *old += payment.amount);
        match rewards_per_block {
            Some(rewards_per_block) => {
                self.rewards_per_block().set(rewards_per_block);
                let current_block = self.blockchain().get_block_timestamp();
                self.last_update_block().set(current_block);
                self.produce_rewards_enabled().set(true);
            }
            None => {}
        }
    }

    #[payable("*")]
    #[endpoint(stake)]
    fn stake(&self, tier: u8) {
        self.require_state_active();
        require!(self.produce_rewards_enabled().get(), "Rewards not enabled");
        let caller = self.blockchain().get_caller();
        require!(self.is_registered(&caller), "Wallet not registered");
        require!(tier <= 2, "Invalid tier");
        let payment = self.call_value().single_esdt();
        require!(
            payment.token_identifier == self.token_id().get(),
            "Invalid payment currency"
        );

        let payment_amount = payment.amount;
        self.update_global_state_on_stake(&payment_amount);
        self.update_user_state_on_stake(&payment_amount, &tier);
    }

    #[endpoint(unstake)]
    fn unstake(&self, amount: BigUint, tier: u8) {
        self.require_state_active();
        let caller = self.blockchain().get_caller();
        require!(tier <= 2, "Invalid tier");
        require!(
            self.wallet_per_tier_amount_staked(&caller, &tier).get() >= amount,
            "Not enough to unstake"
        );
        let remaining_amount = self.deduct_fee(&caller, &amount, &tier);
        self.update_global_state_on_unstake(&amount);
        self.update_user_state_on_unstake(&amount, &tier);
        self.send()
            .direct_esdt(&caller, &self.token_id().get(), 0, &remaining_amount);
    }

    #[endpoint(claimRewards)]
    fn claim_rewards(&self) {
        self.require_state_active();
        let caller = self.blockchain().get_caller();
        require!(
            self.wallet_amount_staked(&caller).get() >= BigUint::zero(),
            "No staked amount"
        );
        self.update_global_state_general();
        let total_pending_rewards = self.update_user_state_on_claim_rewards(&caller);
        if total_pending_rewards != BigUint::zero() {
            require!(
                self.total_rewards().get() >= total_pending_rewards,
                "Not enough token amount to pay rewards"
            );
            self.send()
                .direct_esdt(&caller, &self.token_id().get(), 0, &total_pending_rewards);
        }
    }
}
