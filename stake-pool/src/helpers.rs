multiversx_sc::imports!();
multiversx_sc::derive_imports!();

pub const DIVISION_SAFETY_CONSTANT: u64 = 1_000_000_000;
pub const TIER1_DEPOSIT_DURATION: u64 = 60 * 86400;
pub const TIER2_DEPOSIT_DURATION: u64 = 90 * 86400;
pub const TIER3_DEPOSIT_DURATION: u64 = 180 * 86400;
pub const TIER1_DEPOSIT_FEES_PERCENTAGE: u64 = 190;
pub const TIER2_DEPOSIT_FEES_PERCENTAGE: u64 = 90;
pub const TIER3_DEPOSIT_FEES_PERCENTAGE: u64 = 0;
pub const TIER1_WITHDRAW_DURATION: u64 = 30 * 86400;
pub const TIER1_WITHDRAW_DURATION_INCREMENT: u64 = TIER1_WITHDRAW_DURATION + 1;
pub const TIER2_WITHDRAW_DURATION: u64 = 90 * 86400;
pub const TIER1_WITHDRAW_FEES_PERCENTAGE: u64 = 90;
pub const TIER2_WITHDRAW_FEES_PERCENTAGE: u64 = 190;
pub const TIER3_WITHDRAW_FEES_PERCENTAGE: u64 = 290;
pub const PERCENTAGE_DIVISOR: u64 = 10000;

#[multiversx_sc::module]
pub trait HelperModule: crate::storage::StorageModule {
    fn update_global_state_on_stake(&self, payment_amount: &BigUint) {
        self.update_global_state_general();
        self.total_amount_staked()
            .update(|old| *old += payment_amount);
    }

    fn update_global_state_on_unstake(&self, amount: &BigUint) {
        self.update_global_state_general();
        self.total_amount_staked().update(|old| *old -= amount);
    }

    fn update_user_state_on_stake(&self, payment_amount: &BigUint, tier: &u8) {
        let caller = self.blockchain().get_caller();
        self.update_user_state_general(&caller);
        self.wallet_amount_staked(&caller)
            .update(|old| *old += payment_amount);
        self.wallet_per_tier_amount_staked(&caller, &tier)
            .update(|old| *old += payment_amount);
        let current_block = self.blockchain().get_block_timestamp();
        self.wallet_per_tier_update_block(&caller, &tier)
            .set(current_block);
    }

    fn update_user_state_on_unstake(&self, amount: &BigUint, tier: &u8) {
        let caller = self.blockchain().get_caller();
        self.update_user_state_general(&caller);
        self.wallet_amount_staked(&caller)
            .update(|old| *old -= amount);
        self.wallet_per_tier_amount_staked(&caller, &tier)
            .update(|old| *old -= amount);
        let current_block = self.blockchain().get_block_timestamp();
        self.wallet_per_tier_update_block(&caller, &tier)
            .set(current_block);
    }

    fn update_user_state_on_claim_rewards(&self, caller: &ManagedAddress) -> BigUint {
        let rewards_per_share = self.rewards_per_share().get();
        let share_diff = &rewards_per_share - &self.wallet_rewards_per_share(&caller).get();
        let current_rewards = self.wallet_amount_staked(&caller).get() * share_diff
            / self.division_safety_constant().get();
        let total_pending_rewards = self.wallet_pending_rewards(&caller).get() + current_rewards;
        require!(total_pending_rewards > 0, "No rewards accumulated yet");
        self.wallet_pending_rewards(&caller).set(BigUint::zero());
        self.wallet_rewards_per_share(&caller)
            .set(rewards_per_share);
        total_pending_rewards
    }

    fn update_global_state_general(&self) {
        let current_block = self.blockchain().get_block_timestamp();
        let last_update_block = self.last_update_block().get();
        require!(
            current_block >= last_update_block,
            "Staking has not started yet or invalid block timestamp",
        );
        let block_diff: u64 = current_block - self.last_update_block().get();
        let total_amount_staked = self.total_amount_staked().get();
        let reward_per_block = self.rewards_per_block().get();
        if total_amount_staked != 0 as u64 {
            self.rewards_per_share().update(|old| {
                *old += BigUint::from(block_diff)
                    * reward_per_block
                    * self.division_safety_constant().get()
                    / total_amount_staked;
            });
        }
        self.last_update_block().set(current_block);
    }

    fn update_user_state_general(&self, caller: &ManagedAddress) {
        let rewards_per_share = self.rewards_per_share().get();
        let wallet_rewards_per_share = self.wallet_rewards_per_share(&caller).get();
        let rewards_share_diff = &rewards_per_share - &wallet_rewards_per_share;
        self.wallet_pending_rewards(&caller).update(|old| {
            *old += &rewards_share_diff * &self.wallet_amount_staked(&caller).get()
                / self.division_safety_constant().get();
        });
        self.wallet_rewards_per_share(&caller)
            .set(&rewards_per_share);
    }

    fn is_registered(&self, address: &ManagedAddress) -> bool {
        self.wallet_database_proxy(self.wallet_database_address().get())
            .is_registered(address)
            .execute_on_dest_context::<bool>()
    }

    fn deduct_fee(&self, caller: &ManagedAddress, base_amount: &BigUint, tier: &u8) -> BigUint {
        let current_block = self.blockchain().get_block_timestamp();
        let wallet_stake_timestamp = self.wallet_per_tier_update_block(caller, tier).get();
        let fees_percentage = match tier {
            0 => {
                let target_timestamp = wallet_stake_timestamp + TIER1_DEPOSIT_DURATION;
                if current_block > target_timestamp {
                    TIER1_DEPOSIT_FEES_PERCENTAGE
                } else {
                    let block_diff = target_timestamp - current_block;
                    match block_diff {
                        0..=TIER1_WITHDRAW_DURATION => {
                            TIER1_DEPOSIT_FEES_PERCENTAGE + TIER1_WITHDRAW_FEES_PERCENTAGE
                        }
                        _ => TIER1_DEPOSIT_FEES_PERCENTAGE + TIER2_WITHDRAW_FEES_PERCENTAGE,
                    }
                }
            }
            1 => {
                let target_timestamp = wallet_stake_timestamp + TIER2_DEPOSIT_DURATION;
                if current_block > target_timestamp {
                    TIER2_DEPOSIT_FEES_PERCENTAGE
                } else {
                    let block_diff = target_timestamp - current_block;
                    match block_diff {
                        0..=TIER1_WITHDRAW_DURATION => {
                            TIER2_DEPOSIT_FEES_PERCENTAGE + TIER1_WITHDRAW_FEES_PERCENTAGE
                        }
                        _ => TIER2_DEPOSIT_FEES_PERCENTAGE + TIER2_WITHDRAW_FEES_PERCENTAGE,
                    }
                }
            }
            2 => {
                let target_timestamp = wallet_stake_timestamp + TIER3_DEPOSIT_DURATION;
                if current_block > target_timestamp {
                    TIER3_DEPOSIT_FEES_PERCENTAGE
                } else {
                    let block_diff = target_timestamp - current_block;
                    match block_diff {
                        0..=TIER1_WITHDRAW_DURATION => {
                            TIER3_DEPOSIT_FEES_PERCENTAGE + TIER1_WITHDRAW_FEES_PERCENTAGE
                        }
                        TIER1_WITHDRAW_DURATION_INCREMENT..=TIER2_WITHDRAW_DURATION => {
                            TIER3_DEPOSIT_FEES_PERCENTAGE + TIER2_WITHDRAW_FEES_PERCENTAGE
                        }
                        _ => TIER3_DEPOSIT_FEES_PERCENTAGE + TIER3_WITHDRAW_FEES_PERCENTAGE,
                    }
                }
            }
            _ => unreachable!(),
        };
        let fees = base_amount * fees_percentage / PERCENTAGE_DIVISOR;
        self.total_fees().update(|old| *old += &fees);
        base_amount - &fees
    }

    #[proxy]
    fn wallet_database_proxy(
        &self,
        callee_sc_address: ManagedAddress,
    ) -> wallet_database::Proxy<Self::Api>;
}
