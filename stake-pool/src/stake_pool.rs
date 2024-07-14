#![no_std]

#[allow(unused_imports)]
use multiversx_sc::imports::*;
use permissions_module::Permissions;
mod events;
mod helpers;
mod storage;

const SECONDS_PER_BLOCK: u64 = 6;
const SECONDS_PER_DAY: u64 = 86400;

#[multiversx_sc::contract]
pub trait StakePool:
    crate::storage::StorageModule
    + permissions_module::PermissionsModule
    + pausable::PausableModule
    + helpers::HelperModule
    + events::EventsModule
{
    #[init]
    fn init(&self, token_id: TokenIdentifier) {
        let all_permissions = Permissions::OWNER | Permissions::ADMIN | Permissions::PAUSE;
        self.set_permissions(self.blockchain().get_caller(), all_permissions);
        self.token_id().set(token_id);
    }

    #[upgrade]
    fn upgrade(&self) {}

    #[endpoint(addRewards)]
    fn add_rewards(&self, amount: BigUint, start_timestamp: u64, days: u16) {
        self.require_caller_has_owner_permissions();
        let payment = self.call_value().single_esdt();
        require!(
            payment.token_identifier == self.token_id().get(),
            "Invalid payment currency"
        );
        require!(
            self.blockchain().get_block_timestamp() < start_timestamp,
            "Starting rewards timestamp must be in the future"
        );
        let time_diff = start_timestamp - self.blockchain().get_block_timestamp();
        let estimated_block_at_start_timestamp = time_diff / SECONDS_PER_BLOCK;
        self.last_update_block()
            .set(estimated_block_at_start_timestamp);
        let blocks_per_days = days as u64 * SECONDS_PER_DAY / SECONDS_PER_BLOCK;
        let days_in_seconds = days as u64 * SECONDS_PER_DAY;
        let rewards_per_block = amount / blocks_per_days;
        self.rewards_per_block().set(rewards_per_block);
        self.start_timestamp().set(start_timestamp);
        self.end_timestamp().set(start_timestamp + days_in_seconds);
    }

    #[payable("*")]
    #[endpoint(stake)]
    fn stake(&self) {
        self.require_state_active();
        let payment = self.call_value().single_esdt();
        require!(
            payment.token_identifier == self.token_id().get(),
            "Invalid payment currency"
        );

        let payment_amount = payment.amount;
        self.update_global_state_on_stake(&payment_amount);
        self.update_user_state_on_stake(&payment_amount);
    }

    #[endpoint(claimRewards)]
    fn claim_rewards(&self) {
        self.require_state_active();
        let caller = self.blockchain().get_caller();
        require!(
            self.wallet_amount_staked(&caller).get() >= BigUint::from(0 as u16),
            "No staked amount"
        );
        self.update_global_state_general();
        let total_pending_rewards = self.update_user_state_on_claim_rewards(&caller);
        self.send()
            .direct_esdt(&caller, &self.token_id().get(), 0, &total_pending_rewards);
    }
}
