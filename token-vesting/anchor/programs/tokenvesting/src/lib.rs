#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount,Mint};

declare_id!("AsjZ3kWAUSQRNt2pZVeJkywhZ6gpLpHZmJjduPmKZDZZ");

#[program]
pub mod tokenvesting {
    use super::*;

    pub fn create_vesting_account(ctx: Context<CreateVestingAccount>,company_name:String) -> Result<()> {
      *ctx.accounts.vesting_account = VestingAccount{
        owner:ctx.account.signer.key(),
        mint:ctx.account.mint.key(),
        treasury_token_account:ctx.account.treasury_token_account.key(),
        company_name,
        treasury_bump:ctx.bumps.treasury_token_account,
        vesting_account:ctx.bumps.vesting_account
      }
        Ok(())
    }

    pub fn create_employee_account(ctx:Context<CreateEmployeeAccount>,start_time:i64,end_time:i64,total_amount:u64,cliff_time:i64)->Result<()>{
      *ctx.accounts.employee_account = EmployeeAccount{
        beneficiary:ctx.accounts.beneficiary.key(),
        start_time,
        end_time,
        total_amount,
        total_withdrawn=0,
        cliff_time,
        vesting_account:ctx.accounts.vesting_account.key(),
        bump:ctx.bumps.employee_account
      }
    }

    pub fn claim_tokens(ctx:Context<ClaimTokens>,company_name:String)->Result<()>{
      let employee_account = &mut ctx.accounts.employee_account
      Ok(())
    }

}

#[derive(Accounts)]
#[instruction(company_name:String)]
pub struct CreateVestingAccount<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
      init,
      space = 8 + VestingAccount::INIT_SPACE,
      payer = signer,
      seeds=[company_name.as_ref()]
    )]
    pub vesting_account:Accounts<'info,VestingAccount>,
    pub mint:Interface<'info,Mint>,
    #[account(
      init,
      payer=signer,
      token::mint=mint,
      token::authority=treasury_token_account,
      seeds=[b"vesting_treasury",company_name.as_bytes()],
      bump
    )]
    pub treasury_token_account:InterfaceAccount<'info,TokenAccount>,
    pub system_program:Program<'info,System>,
    pub token_program:Interface<'info,TokenInterface>
}

#[derive(Accounts)]
pub struct CreateEmployeeAccount<'info>{
  #[account(mut)]
  pub owner:Signer<'info>,
  pub beneficiary:SystemAccount<'info>,
  #[account(
    has_one = owner
  )]
  pub vesting_account:Account<'info,VestingAccount>,
  #[account(
    init,
    space=8 + EmployeeAccount::INIT_SPACE,
    payer=owner,
    seeds=[b"employee_vesting",beneficiary.key().as_ref(),vesting_account.key().as_ref()],
    bump
  )]
  pub employee_account:Account<'info,EmployeeAccount>,
  pub system_program:Program<'info,System>
}

#[derive(Accounts)]
#[instruction(company_name:String)]
pub struct ClaimTokens<'info>{
  #[account(mut)]
  pub beneficiary:Signer<'info>
  #[account(
    mut,
    seeds=[b"employee_vesting",beneficiary.key().as_ref(),vesting_account.key().as_ref()],
    bump= employee_account.bump,
    has_one= beneficiary,
    has_one=vesting_account
  )]
  pub employee_account:Account<'info,EmployeeAccount>,
  #[account(
    mut,
    seeds=[company_name.as_ref()],
    bump=vesting_account.bump,
    has_one = treasury_token_account,
    has_one=mint
  )]
  pub vesting_account:Account<'info,VestingAccount>,
  pub mint:InterfaceAccount<'info,Mint>,
  #[account(mut)]
  pub treasury_token_account:InterfaceAccount<'info,TokenAccount>,
  #[account(
    init_if_needed,
    payer= beneficiary,
    associated_token::mint = mint,
    associated_token::authority=beneficiary,
    associated_token::program=token_program
  )]
  pub employee_token_account:InterfaceAccount<'info,TokenAccount>,
  pub token_program:Interface<'info,TokenInterface>,
  pub associated_token_program:Program<'info,AssociatedToken>,
  pub system_program:Program<'info,System>
}

#[account]
#[derive(InitSpace)]
pub struct VestingAccount{
  pub owner:Pubkey,
  pub mint:Pubkey,
  pub treasury_token_account:Pubkey,
  #[max_len(50)]
  pub company_name:String,
  pub treasury_bump:u8,
  pub bump:u8
}

#[account]
#[derive(InitSpace)]
pub struct EmployeeAccount{
  pub beneficiary:Pubkey,
  pub start_time:i64,
  pub end_time:i64,
  pub cliff:i64,
  pub vesting_account:Pubkey,
  pub total_amount:u64,
  pub total_withdrawn:u64,
  pub bump:u8
}
