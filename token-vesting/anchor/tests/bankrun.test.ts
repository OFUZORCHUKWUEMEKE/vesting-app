import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import IDL from "../target/idl/tokenvesting.json";
import { startAnchor, ProgramTestContext, BanksClient, Clock } from "solana-bankrun"
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { Buffer } from "buffer";
import { BankrunProvider } from "anchor-bankrun";
import { Tokenvesting } from "../target/types/tokenvesting";
import { BN, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { mintTo } from "spl-token-bankrun";

describe("Vesting Smart Contract Tests", () => {
    const companyName = "Company";
    let beneficiary;
    let context: ProgramTestContext;
    let provider: BankrunProvider;
    let program: Program<Tokenvesting>
    let banksClient: BanksClient;
    let employer: Keypair;
    let mint: PublicKey;
    let beneficiaryProvider: BankrunProvider;
    let program2: Program<Tokenvesting>;
    let treasuryTokenAccount: PublicKey;
    let employeeAccount: PublicKey;
    let vestingAccountKey: PublicKey;
    beforeAll(async () => {
        beneficiary = new anchor.web3.Keypair();


        context = await startAnchor('', [
            { name: 'tokenvesting', programId: new PublicKey(IDL.address) }
        ],
            [{
                address: beneficiary.publicKey,
                info: {
                    lamports: 1_000_000_000,
                    data: Buffer.alloc(0),
                    owner: SYSTEM_PROGRAM_ID,
                    executable: false
                }
            }]

        );
        provider = new BankrunProvider(context);

        anchor.setProvider(provider);

        program = new Program<Tokenvesting>(IDL as Tokenvesting, provider);
        // Create a new mint
        // @ts-ignore
        mint = await createMint(banksClient, employer, employer.publicKey, null, 2);

        // Generate a new keypair for the beneficiary
        beneficiaryProvider = new BankrunProvider(context);
        beneficiaryProvider.wallet = new NodeWallet(beneficiary);

        // Generate a new keypair for the beneficiary
        beneficiaryProvider = new BankrunProvider(context);
        beneficiaryProvider.wallet = new NodeWallet(beneficiary);

        program2 = new Program<Tokenvesting>(IDL as Tokenvesting, beneficiaryProvider);

        // Derive PDAs
        [vestingAccountKey] = PublicKey.findProgramAddressSync(
            [Buffer.from(companyName)],
            program.programId
        );

        [treasuryTokenAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("vesting_treasury"), Buffer.from(companyName)],
            program.programId
        );

        [employeeAccount] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("employee_vesting"),
                beneficiary.publicKey.toBuffer(),
                vestingAccountKey.toBuffer(),
            ],
            program.programId
        );
    });

    it("should fund the treasury token account", async () => {
        const amount = 10_000 * 10 ** 9;
        const mintTx = await mintTo(
            // @ts-ignores
            banksClient,
            employer,
            mint,
            treasuryTokenAccount,
            employer,
            amount
        );

        console.log("Mint to Treasury Transaction Signature:", mintTx);
    });

    it("should create a vesting account", async () => {
        const tx = await program.methods
            .createVestingAccount(companyName)
            .accounts({
                signer: employer.publicKey,
                mint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc({ commitment: "confirmed" });

        const vestingAccountData = await program.account.vestingAccount.fetch(
            vestingAccountKey,
            "confirmed"
        );
        console.log(
            "Vesting Account Data:",
            JSON.stringify(vestingAccountData, null, 2)
        );

        console.log("Create Vesting Account Transaction Signature:", tx);
    });

    it("should create an employee vesting account", async () => {
        const tx2 = await program.methods
          .createEmployeeVesting(new BN(0), new BN(100), new BN(100), new BN(0))
          .accounts({
            beneficiary: beneficiary.publicKey,
            vestingAccount: vestingAccountKey,
          })
          .rpc({ commitment: "confirmed", skipPreflight: true });
    
        console.log("Create Employee Account Transaction Signature:", tx2);
        console.log("Employee account", employeeAccount.toBase58());
      });
    

    it("should claim tokens", async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const currentClock = await banksClient.getClock();
        context.setClock(
            new Clock(
                currentClock.slot,
                currentClock.epochStartTimestamp,
                currentClock.epoch,
                currentClock.leaderScheduleEpoch,
                1000n
            )
        );

        console.log("Employee account", employeeAccount.toBase58());

        const tx3 = await program2.methods
            .claimTokens(companyName)
            .accounts({
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc({ commitment: "confirmed" });

        console.log("Claim Tokens transaction signature", tx3);
    });
});