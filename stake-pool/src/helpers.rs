multiversx_sc::imports!();
multiversx_sc::derive_imports!();

pub const DIVISION_SAFETY_CONSTANT: u64 = 1_000_000_000_000_000_000;

#[multiversx_sc::module]
pub trait HelperModule: crate::storage::StorageModule {
    fn update_global_state_on_stake(&self, payment_amount: &BigUint) {
        self.update_global_state_general();
        self.total_amount_staked()
            .update(|old| *old += payment_amount);
    }

    fn update_user_state_on_stake(&self, payment_amount: &BigUint) {
        let caller = self.blockchain().get_caller();
        self.update_user_state_general(&caller);
        self.wallet_amount_staked(&caller)
            .update(|old| *old += payment_amount);
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
        if block_diff != 0 as u64 {
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
}
