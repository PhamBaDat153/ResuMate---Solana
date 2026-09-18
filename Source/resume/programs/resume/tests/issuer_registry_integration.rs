use litesvm::LiteSVM;
use solana_address::{address, Address};
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_system_interface::program::ID as SYSTEM_PROGRAM_ID;
use solana_transaction::Transaction;
use std::path::PathBuf;

const PROGRAM_ID: Address = address!("8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63");
const ISSUER_REGISTRY_SEED: &[u8] = b"issuer-registry";
const ISSUER_SEED: &[u8] = b"issuer";
const INITIALIZE_REGISTRY_DISCRIMINATOR: [u8; 8] = [157, 206, 75, 32, 236, 128, 138, 167];
const REGISTER_ISSUER_DISCRIMINATOR: [u8; 8] = [145, 117, 52, 59, 189, 27, 127, 18];
const SET_ISSUER_ACTIVE_DISCRIMINATOR: [u8; 8] = [59, 193, 198, 208, 54, 149, 1, 64];
const REGISTRY_ACCOUNT_DISCRIMINATOR: [u8; 8] = [252, 217, 20, 87, 39, 96, 228, 46];
const ISSUER_ACCOUNT_DISCRIMINATOR: [u8; 8] = [216, 19, 83, 230, 108, 53, 80, 14];

fn registry_pda() -> (Address, u8) {
    Address::find_program_address(&[ISSUER_REGISTRY_SEED], &PROGRAM_ID)
}

fn issuer_pda(issuer: &Address) -> (Address, u8) {
    Address::find_program_address(&[ISSUER_SEED, issuer.as_ref()], &PROGRAM_ID)
}

fn initialize_registry_instruction(authority: &Address) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(registry_pda().0, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: INITIALIZE_REGISTRY_DISCRIMINATOR.to_vec(),
    }
}

fn register_issuer_instruction(
    authority: &Address,
    issuer_authority: &Address,
    issuer_type: u8,
) -> Instruction {
    let mut data = REGISTER_ISSUER_DISCRIMINATOR.to_vec();
    data.push(issuer_type);
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(registry_pda().0, false),
            AccountMeta::new_readonly(*issuer_authority, false),
            AccountMeta::new(issuer_pda(issuer_authority).0, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

fn set_issuer_active_instruction(
    authority: &Address,
    issuer_authority: &Address,
    is_active: bool,
) -> Instruction {
    let mut data = SET_ISSUER_ACTIVE_DISCRIMINATOR.to_vec();
    data.push(u8::from(is_active));
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new_readonly(registry_pda().0, false),
            AccountMeta::new(issuer_pda(issuer_authority).0, false),
        ],
        data,
    }
}

fn send_instruction(
    svm: &mut LiteSVM,
    payer: &Keypair,
    instruction: Instruction,
) -> Result<(), String> {
    let transaction = Transaction::new(
        &[payer],
        Message::new(&[instruction], Some(&payer.pubkey())),
        svm.latest_blockhash(),
    );
    svm.send_transaction(transaction)
        .map(|_| ())
        .map_err(|error| format!("transaction failed: {error:?}"))
}

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let program_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("target/deploy/resume.so");
    svm.add_program_from_file(PROGRAM_ID, program_path)
        .expect("compiled resume program is required");
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), 2_000_000_000)
        .expect("authority airdrop should succeed");
    (svm, authority)
}

fn assert_registry_state(svm: &LiteSVM, authority: &Address) {
    let (registry, bump) = registry_pda();
    let account = svm.get_account(&registry).expect("registry should exist");
    assert_eq!(account.owner, PROGRAM_ID);
    assert_eq!(account.data.len(), 105);
    assert_eq!(&account.data[..8], &REGISTRY_ACCOUNT_DISCRIMINATOR);
    assert_eq!(&account.data[8..40], authority.as_ref());
    assert_eq!(account.data[40], bump);
    assert_eq!(&account.data[41..105], &[0; 64]);
}

fn assert_issuer_state(
    svm: &LiteSVM,
    issuer_authority: &Address,
    issuer_type: u8,
    is_active: bool,
) {
    let (issuer, bump) = issuer_pda(issuer_authority);
    let (registry, _) = registry_pda();
    let account = svm.get_account(&issuer).expect("issuer should exist");
    assert_eq!(account.owner, PROGRAM_ID);
    assert_eq!(account.data.len(), 107);
    assert_eq!(&account.data[..8], &ISSUER_ACCOUNT_DISCRIMINATOR);
    assert_eq!(&account.data[8..40], registry.as_ref());
    assert_eq!(&account.data[40..72], issuer_authority.as_ref());
    assert_eq!(account.data[72], issuer_type);
    assert_eq!(account.data[73], u8::from(is_active));
    assert_eq!(account.data[74], bump);
    assert_eq!(&account.data[75..107], &[0; 32]);
}

#[test]
fn initializes_registry_with_authority_bump_and_reserved_bytes() {
    let (mut svm, authority) = setup();
    send_instruction(
        &mut svm,
        &authority,
        initialize_registry_instruction(&authority.pubkey()),
    )
    .expect("registry initialization should succeed");

    assert_registry_state(&svm, &authority.pubkey());
}

#[test]
fn rejects_duplicate_registry_initialization_without_changing_state() {
    let (mut svm, authority) = setup();
    send_instruction(
        &mut svm,
        &authority,
        initialize_registry_instruction(&authority.pubkey()),
    )
    .expect("first registry initialization should succeed");
    let original = svm.get_account(&registry_pda().0).unwrap().data;

    let other = Keypair::new();
    svm.airdrop(&other.pubkey(), 2_000_000_000)
        .expect("other authority airdrop should succeed");
    assert!(send_instruction(
        &mut svm,
        &other,
        initialize_registry_instruction(&other.pubkey()),
    )
    .is_err());

    assert_eq!(svm.get_account(&registry_pda().0).unwrap().data, original);
}

#[test]
fn authority_registers_active_issuer_and_can_toggle_status() {
    let (mut svm, authority) = setup();
    send_instruction(
        &mut svm,
        &authority,
        initialize_registry_instruction(&authority.pubkey()),
    )
    .expect("registry initialization should succeed");
    let issuer = Keypair::new();
    let issuer_type = 2;

    send_instruction(
        &mut svm,
        &authority,
        register_issuer_instruction(&authority.pubkey(), &issuer.pubkey(), issuer_type),
    )
    .expect("issuer registration should succeed");
    assert_issuer_state(&svm, &issuer.pubkey(), issuer_type, true);

    send_instruction(
        &mut svm,
        &authority,
        set_issuer_active_instruction(&authority.pubkey(), &issuer.pubkey(), false),
    )
    .expect("issuer deactivation should succeed");
    assert_issuer_state(&svm, &issuer.pubkey(), issuer_type, false);

    send_instruction(
        &mut svm,
        &authority,
        set_issuer_active_instruction(&authority.pubkey(), &issuer.pubkey(), true),
    )
    .expect("issuer reactivation should succeed");
    assert_issuer_state(&svm, &issuer.pubkey(), issuer_type, true);
}

#[test]
fn rejects_non_authority_registry_administration() {
    let (mut svm, authority) = setup();
    send_instruction(
        &mut svm,
        &authority,
        initialize_registry_instruction(&authority.pubkey()),
    )
    .expect("registry initialization should succeed");
    let issuer = Keypair::new();
    let other = Keypair::new();
    svm.airdrop(&other.pubkey(), 2_000_000_000)
        .expect("other authority airdrop should succeed");

    assert!(send_instruction(
        &mut svm,
        &other,
        register_issuer_instruction(&other.pubkey(), &issuer.pubkey(), 1),
    )
    .is_err());
    assert!(svm.get_account(&issuer_pda(&issuer.pubkey()).0).is_none());

    send_instruction(
        &mut svm,
        &authority,
        register_issuer_instruction(&authority.pubkey(), &issuer.pubkey(), 1),
    )
    .expect("issuer registration should succeed");
    assert_issuer_state(&svm, &issuer.pubkey(), 1, true);

    assert!(send_instruction(
        &mut svm,
        &other,
        set_issuer_active_instruction(&other.pubkey(), &issuer.pubkey(), false),
    )
    .is_err());
    assert_issuer_state(&svm, &issuer.pubkey(), 1, true);
}
