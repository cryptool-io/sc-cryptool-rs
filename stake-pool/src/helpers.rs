multiversx_sc::imports!();
multiversx_sc::derive_imports!();

const DIVISION_SAFETY_CONSTANT: u64 = 1000000000;

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
        let current_rewards =
            self.wallet_amount_staked(&caller).get() * share_diff / DIVISION_SAFETY_CONSTANT;
        let total_pending_rewards = self.wallet_pending_rewards(&caller).get() + current_rewards;
        require!(total_pending_rewards > 0, "No rewards accumulated yet");
        self.wallet_pending_rewards(&caller)
            .set(BigUint::from(0 as u16));
        self.wallet_rewards_per_share(&caller)
            .set(rewards_per_share);
        total_pending_rewards
    }

    fn update_global_state_general(&self) {
        let current_block = self.blockchain().get_block_timestamp();
        let block_diff = current_block - self.last_update_block().get();
        let total_amount_staked = self.total_amount_staked().get();
        let reward_per_block = self.rewards_per_block().get();
        self.rewards_per_share().update(|old| {
            *old += BigUint::from(block_diff) * reward_per_block * DIVISION_SAFETY_CONSTANT
                / total_amount_staked;
        });
        self.last_update_block().set(current_block);
    }

    fn update_user_state_general(&self, caller: &ManagedAddress) {
        let rewards_per_share = self.rewards_per_share().get();
        let wallet_rewards_per_share = self.wallet_rewards_per_share(&caller).get();
        let rewards_share_diff = &rewards_per_share - &wallet_rewards_per_share;
        self.wallet_pending_rewards(&caller).update(|old| {
            *old += &rewards_share_diff * &self.wallet_amount_staked(&caller).get()
                / DIVISION_SAFETY_CONSTANT;
        });
        self.wallet_rewards_per_share(&caller)
            .set(&rewards_per_share);
    }
}
