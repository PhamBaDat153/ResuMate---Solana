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
const PROFILE_SEED: &[u8] = b"profile";
const ISSUER_REGISTRY_SEED: &[u8] = b"issuer-registry";
const ISSUER_SEED: &[u8] = b"issuer";
const CREDENTIAL_SEED: &[u8] = b"credential";

const CREATE_PROFILE_DISCRIMINATOR: [u8; 8] = [225, 205, 234, 143, 17, 186, 50, 220];
const INITIALIZE_REGISTRY_DISCRIMINATOR: [u8; 8] = [157, 206, 75, 32, 236, 128, 138, 167];
const REGISTER_ISSUER_DISCRIMINATOR: [u8; 8] = [145, 117, 52, 59, 189, 27, 127, 18];
const SET_ISSUER_ACTIVE_DISCRIMINATOR: [u8; 8] = [59, 193, 198, 208, 54, 149, 1, 64];
const ISSUE_CREDENTIAL_DISCRIMINATOR: [u8; 8] = [255, 193, 171, 224, 68, 171, 194, 87];
const REVOKE_CREDENTIAL_DISCRIMINATOR: [u8; 8] = [38, 123, 95, 95, 223, 158, 169, 87];
const CREDENTIAL_ACCOUNT_DISCRIMINATOR: [u8; 8] = [145, 44, 68, 220, 67, 46, 100, 135];

const STATUS_ACTIVE: u8 = 0;
const STATUS_REVOKED: u8 = 1;

fn profile_address(owner: &Address) -> Address {
    Address::find_program_address(&[PROFILE_SEED, owner.as_ref()], &PROGRAM_ID).0
}

fn registry_address() -> Address {
    Address::find_program_address(&[ISSUER_REGISTRY_SEED], &PROGRAM_ID).0
}

fn issuer_address(issuer: &Address) -> Address {
    Address::find_program_address(&[ISSUER_SEED, issuer.as_ref()], &PROGRAM_ID).0
}

fn credential_address(subject: &Address, credential_id: u64) -> Address {
    Address::find_program_address(
        &[
            CREDENTIAL_SEED,
            subject.as_ref(),
            &credential_id.to_le_bytes(),
        ],
        &PROGRAM_ID,
    )
    .0
}

fn create_profile_instruction(owner: &Address) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*owner, true),
            AccountMeta::new(profile_address(owner), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: CREATE_PROFILE_DISCRIMINATOR.to_vec(),
    }
}

fn initialize_registry_instruction(authority: &Address) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(registry_address(), false),
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
            AccountMeta::new_readonly(registry_address(), false),
            AccountMeta::new_readonly(*issuer_authority, false),
            AccountMeta::new(issuer_address(issuer_authority), false),
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
            AccountMeta::new_readonly(registry_address(), false),
            AccountMeta::new(issuer_address(issuer_authority), false),
        ],
        data,
    }
}

fn issue_credential_instruction(
    issuer_authority: &Address,
    subject: &Address,
    credential_id: u64,
    credential_type_hash: [u8; 32],
    claims_hash: [u8; 32],
    uri: &str,
    expires_at: Option<i64>,
) -> Instruction {
    let mut data = ISSUE_CREDENTIAL_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&credential_id.to_le_bytes());
    data.extend_from_slice(&credential_type_hash);
    data.extend_from_slice(&claims_hash);
    data.extend_from_slice(&(uri.len() as u32).to_le_bytes());
    data.extend_from_slice(uri.as_bytes());
    match expires_at {
        None => data.push(0),
        Some(ts) => {
            data.push(1);
            data.extend_from_slice(&ts.to_le_bytes());
        }
    }
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*issuer_authority, true),
            AccountMeta::new_readonly(issuer_address(issuer_authority), false),
            AccountMeta::new_readonly(*subject, false),
            AccountMeta::new(profile_address(subject), false),
            AccountMeta::new(credential_address(subject, credential_id), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

fn revoke_credential_instruction(
    issuer_authority: &Address,
    credential: &Address,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(*issuer_authority, true),
            AccountMeta::new_readonly(issuer_address(issuer_authority), false),
            AccountMeta::new(*credential, false),
        ],
        data: REVOKE_CREDENTIAL_DISCRIMINATOR.to_vec(),
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

fn setup_svm() -> LiteSVM {
    let mut svm = LiteSVM::new();
    let program_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("target/deploy/resume.so");
    svm.add_program_from_file(PROGRAM_ID, program_path)
        .expect("compiled resume program is required");
    svm
}

fn airdrop(svm: &mut LiteSVM, keypair: &Keypair) {
    svm.airdrop(&keypair.pubkey(), 2_000_000_000)
        .expect("airdrop should succeed");
}

struct IssuerWorld {
    svm: LiteSVM,
    authority: Keypair,
    issuer: Keypair,
    subject: Keypair,
}

fn setup_issuer_world() -> IssuerWorld {
    let mut svm = setup_svm();
    let authority = Keypair::new();
    let issuer = Keypair::new();
    let subject = Keypair::new();
    airdrop(&mut svm, &authority);
    airdrop(&mut svm, &issuer);
    airdrop(&mut svm, &subject);

    send_instruction(
        &mut svm,
        &authority,
        initialize_registry_instruction(&authority.pubkey()),
    )
    .expect("registry init");
    send_instruction(
        &mut svm,
        &authority,
        register_issuer_instruction(&authority.pubkey(), &issuer.pubkey(), 1),
    )
    .expect("register issuer");
    send_instruction(
        &mut svm,
        &subject,
        create_profile_instruction(&subject.pubkey()),
    )
    .expect("subject profile");

    IssuerWorld {
        svm,
        authority,
        issuer,
        subject,
    }
}

fn issue(
    world: &mut IssuerWorld,
    credential_id: u64,
    type_hash: [u8; 32],
    claims_hash: [u8; 32],
    uri: &str,
    expires_at: Option<i64>,
) -> Result<(), String> {
    send_instruction(
        &mut world.svm,
        &world.issuer,
        issue_credential_instruction(
            &world.issuer.pubkey(),
            &world.subject.pubkey(),
            credential_id,
            type_hash,
            claims_hash,
            uri,
            expires_at,
        ),
    )
}

fn revoke(world: &mut IssuerWorld, credential: &Address) -> Result<(), String> {
    send_instruction(
        &mut world.svm,
        &world.issuer,
        revoke_credential_instruction(&world.issuer.pubkey(), credential),
    )
}

fn profile_credential_count(svm: &LiteSVM, subject: &Address) -> u64 {
    let account = svm
        .get_account(&profile_address(subject))
        .expect("profile should exist");
    u64::from_le_bytes(account.data[48..56].try_into().unwrap())
}

struct CredentialView {
    subject: Address,
    issuer: Address,
    credential_id: u64,
    type_hash: [u8; 32],
    claims_hash: [u8; 32],
    uri: String,
    issued_at: i64,
    expires_at: Option<i64>,
    status: u8,
    subject_accepted: bool,
    bump: u8,
}

fn read_credential(svm: &LiteSVM, address: &Address) -> CredentialView {
    let account = svm.get_account(address).expect("credential should exist");
    assert_eq!(account.owner, PROGRAM_ID);
    assert_eq!(account.data.len(), 368);
    assert_eq!(&account.data[..8], &CREDENTIAL_ACCOUNT_DISCRIMINATOR);

    let subject = Address::new_from_array(account.data[8..40].try_into().unwrap());
    let issuer = Address::new_from_array(account.data[40..72].try_into().unwrap());
    let credential_id = u64::from_le_bytes(account.data[72..80].try_into().unwrap());
    let type_hash: [u8; 32] = account.data[80..112].try_into().unwrap();
    let claims_hash: [u8; 32] = account.data[112..144].try_into().unwrap();
    let uri_len = u32::from_le_bytes(account.data[144..148].try_into().unwrap()) as usize;
    let uri = String::from_utf8(account.data[148..148 + uri_len].to_vec()).unwrap();
    let mut offset = 148 + uri_len;
    let issued_at = i64::from_le_bytes(account.data[offset..offset + 8].try_into().unwrap());
    offset += 8;
    let expires_at = match account.data[offset] {
        0 => {
            offset += 1;
            None
        }
        1 => {
            let value = i64::from_le_bytes(account.data[offset + 1..offset + 9].try_into().unwrap());
            offset += 9;
            Some(value)
        }
        other => panic!("invalid expiry option {other}"),
    };
    let status = account.data[offset];
    let subject_accepted = account.data[offset + 1] == 1;
    let bump = account.data[offset + 2];

    CredentialView {
        subject,
        issuer,
        credential_id,
        type_hash,
        claims_hash,
        uri,
        issued_at,
        expires_at,
        status,
        subject_accepted,
        bump,
    }
}

/// Snapshot of every credential field except `status`.
fn credential_immutable_snapshot(svm: &LiteSVM, address: &Address) -> Vec<u8> {
    let mut data = svm.get_account(address).unwrap().data.clone();
    let view = read_credential(svm, address);
    // Recompute status offset from the live layout.
    let uri_len = view.uri.len();
    let mut offset = 148 + uri_len + 8;
    offset += match view.expires_at {
        None => 1,
        Some(_) => 9,
    };
    data[offset] = STATUS_ACTIVE;
    data
}

#[test]
fn issuer_can_issue_active_credential_and_increments_subject_counter() {
    let mut world = setup_issuer_world();
    let uri = "https://example.com/degree.pdf";
    let expiry = Some(4_000_000_000i64);

    issue(&mut world, 0, [1; 32], [2; 32], uri, expiry).expect("issue should succeed");

    let credential = credential_address(&world.subject.pubkey(), 0);
    let view = read_credential(&world.svm, &credential);
    assert_eq!(view.subject, world.subject.pubkey());
    assert_eq!(view.issuer, world.issuer.pubkey());
    assert_eq!(view.credential_id, 0);
    assert_eq!(view.type_hash, [1; 32]);
    assert_eq!(view.claims_hash, [2; 32]);
    assert_eq!(view.uri, uri);
    assert!(view.issued_at >= 0);
    assert_eq!(view.expires_at, expiry);
    assert_eq!(view.status, STATUS_ACTIVE);
    assert!(!view.subject_accepted);
    assert_eq!(
        view.bump,
        Address::find_program_address(
            &[
                CREDENTIAL_SEED,
                world.subject.pubkey().as_ref(),
                &0u64.to_le_bytes()
            ],
            &PROGRAM_ID
        )
        .1
    );
    assert_eq!(profile_credential_count(&world.svm, &world.subject.pubkey()), 1);
}

#[test]
fn issuer_can_issue_sequential_credentials() {
    let mut world = setup_issuer_world();
    issue(
        &mut world,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/a.pdf",
        None,
    )
    .unwrap();
    issue(
        &mut world,
        1,
        [3; 32],
        [4; 32],
        "https://example.com/b.pdf",
        None,
    )
    .unwrap();

    assert_eq!(profile_credential_count(&world.svm, &world.subject.pubkey()), 2);
    assert_eq!(
        read_credential(&world.svm, &credential_address(&world.subject.pubkey(), 0)).credential_id,
        0
    );
    assert_eq!(
        read_credential(&world.svm, &credential_address(&world.subject.pubkey(), 1)).credential_id,
        1
    );
}

#[test]
fn original_issuer_can_revoke_active_credential() {
    let mut world = setup_issuer_world();
    issue(
        &mut world,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/a.pdf",
        None,
    )
    .unwrap();
    let credential = credential_address(&world.subject.pubkey(), 0);

    revoke(&mut world, &credential).expect("revoke should succeed");
    assert_eq!(read_credential(&world.svm, &credential).status, STATUS_REVOKED);
    assert!(world.svm.get_account(&credential).is_some());
}

#[test]
fn revoke_only_mutates_status_field() {
    let mut world = setup_issuer_world();
    issue(
        &mut world,
        0,
        [9; 32],
        [8; 32],
        "https://example.com/immutable.pdf",
        Some(5_000_000_000),
    )
    .unwrap();
    let credential = credential_address(&world.subject.pubkey(), 0);
    let before = credential_immutable_snapshot(&world.svm, &credential);
    let before_count = profile_credential_count(&world.svm, &world.subject.pubkey());

    revoke(&mut world, &credential).unwrap();

    assert_eq!(read_credential(&world.svm, &credential).status, STATUS_REVOKED);
    assert_eq!(credential_immutable_snapshot(&world.svm, &credential), before);
    assert_eq!(
        profile_credential_count(&world.svm, &world.subject.pubkey()),
        before_count
    );
}

#[test]
fn inactive_issuer_can_still_revoke_but_cannot_issue() {
    let mut world = setup_issuer_world();
    issue(
        &mut world,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/a.pdf",
        None,
    )
    .unwrap();
    let credential = credential_address(&world.subject.pubkey(), 0);

    send_instruction(
        &mut world.svm,
        &world.authority,
        set_issuer_active_instruction(&world.authority.pubkey(), &world.issuer.pubkey(), false),
    )
    .expect("deactivate issuer");

    assert!(issue(
        &mut world,
        1,
        [3; 32],
        [4; 32],
        "https://example.com/blocked.pdf",
        None,
    )
    .is_err());
    assert_eq!(profile_credential_count(&world.svm, &world.subject.pubkey()), 1);
    assert!(world
        .svm
        .get_account(&credential_address(&world.subject.pubkey(), 1))
        .is_none());

    revoke(&mut world, &credential).expect("inactive issuer may still revoke");
    assert_eq!(read_credential(&world.svm, &credential).status, STATUS_REVOKED);
}

#[test]
fn rejects_non_sequential_and_duplicate_credential_ids() {
    let mut world = setup_issuer_world();
    assert!(issue(
        &mut world,
        1,
        [1; 32],
        [2; 32],
        "https://example.com/a.pdf",
        None,
    )
    .is_err());
    assert_eq!(profile_credential_count(&world.svm, &world.subject.pubkey()), 0);

    issue(
        &mut world,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/a.pdf",
        None,
    )
    .unwrap();
    assert!(issue(
        &mut world,
        0,
        [3; 32],
        [4; 32],
        "https://example.com/dup.pdf",
        None,
    )
    .is_err());
    assert_eq!(profile_credential_count(&world.svm, &world.subject.pubkey()), 1);
}

#[test]
fn rejects_empty_hashes_long_uri_and_invalid_expiry() {
    let mut world = setup_issuer_world();

    assert!(issue(
        &mut world,
        0,
        [0; 32],
        [2; 32],
        "https://example.com/a.pdf",
        None,
    )
    .is_err());
    assert!(issue(
        &mut world,
        0,
        [1; 32],
        [0; 32],
        "https://example.com/a.pdf",
        None,
    )
    .is_err());
    assert!(issue(
        &mut world,
        0,
        [1; 32],
        [2; 32],
        &"x".repeat(201),
        None,
    )
    .is_err());
    assert!(issue(
        &mut world,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/a.pdf",
        Some(0),
    )
    .is_err());
    assert_eq!(profile_credential_count(&world.svm, &world.subject.pubkey()), 0);
    assert!(world
        .svm
        .get_account(&credential_address(&world.subject.pubkey(), 0))
        .is_none());
}

#[test]
fn rejects_issue_without_subject_profile_or_with_foreign_profile() {
    let mut world = setup_issuer_world();
    let stranger = Keypair::new();
    airdrop(&mut world.svm, &stranger);

    // Subject has no profile.
    let no_profile = Keypair::new();
    airdrop(&mut world.svm, &no_profile);
    assert!(send_instruction(
        &mut world.svm,
        &world.issuer,
        issue_credential_instruction(
            &world.issuer.pubkey(),
            &no_profile.pubkey(),
            0,
            [1; 32],
            [2; 32],
            "https://example.com/a.pdf",
            None,
        ),
    )
    .is_err());

    // Attacker tries to use another subject's profile while naming a different subject.
    assert!(send_instruction(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(issuer_address(&world.issuer.pubkey()), false),
                AccountMeta::new_readonly(stranger.pubkey(), false),
                AccountMeta::new(profile_address(&world.subject.pubkey()), false),
                AccountMeta::new(credential_address(&stranger.pubkey(), 0), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data: {
                let mut data = ISSUE_CREDENTIAL_DISCRIMINATOR.to_vec();
                data.extend_from_slice(&0u64.to_le_bytes());
                data.extend_from_slice(&[1; 32]);
                data.extend_from_slice(&[2; 32]);
                let uri = b"https://example.com/a.pdf";
                data.extend_from_slice(&(uri.len() as u32).to_le_bytes());
                data.extend_from_slice(uri);
                data.push(0);
                data
            },
        },
    )
    .is_err());
    assert_eq!(profile_credential_count(&world.svm, &world.subject.pubkey()), 0);
}

#[test]
fn rejects_issue_by_unregistered_or_wrong_issuer_account() {
    let mut world = setup_issuer_world();
    let fake_issuer = Keypair::new();
    airdrop(&mut world.svm, &fake_issuer);

    assert!(send_instruction(
        &mut world.svm,
        &fake_issuer,
        issue_credential_instruction(
            &fake_issuer.pubkey(),
            &world.subject.pubkey(),
            0,
            [1; 32],
            [2; 32],
            "https://example.com/a.pdf",
            None,
        ),
    )
    .is_err());
    assert_eq!(profile_credential_count(&world.svm, &world.subject.pubkey()), 0);
}

#[test]
fn rejects_revoke_by_non_issuer_and_other_registered_issuer() {
    let mut world = setup_issuer_world();
    issue(
        &mut world,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/a.pdf",
        None,
    )
    .unwrap();
    let credential = credential_address(&world.subject.pubkey(), 0);

    let attacker = Keypair::new();
    airdrop(&mut world.svm, &attacker);
    assert!(send_instruction(
        &mut world.svm,
        &attacker,
        revoke_credential_instruction(&attacker.pubkey(), &credential),
    )
    .is_err());

    let other_issuer = Keypair::new();
    airdrop(&mut world.svm, &other_issuer);
    send_instruction(
        &mut world.svm,
        &world.authority,
        register_issuer_instruction(&world.authority.pubkey(), &other_issuer.pubkey(), 2),
    )
    .unwrap();
    assert!(send_instruction(
        &mut world.svm,
        &other_issuer,
        revoke_credential_instruction(&other_issuer.pubkey(), &credential),
    )
    .is_err());

    assert_eq!(read_credential(&world.svm, &credential).status, STATUS_ACTIVE);
}

#[test]
fn rejects_double_revoke_and_nonexistent_credential() {
    let mut world = setup_issuer_world();
    issue(
        &mut world,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/a.pdf",
        None,
    )
    .unwrap();
    let credential = credential_address(&world.subject.pubkey(), 0);
    revoke(&mut world, &credential).unwrap();
    world.svm.expire_blockhash();
    assert!(revoke(&mut world, &credential).is_err());

    let missing = credential_address(&world.subject.pubkey(), 1);
    assert!(revoke(&mut world, &missing).is_err());
}

#[test]
fn rejects_fake_pda_and_account_substitution_on_revoke() {
    let mut world = setup_issuer_world();
    issue(
        &mut world,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/a.pdf",
        None,
    )
    .unwrap();
    let credential = credential_address(&world.subject.pubkey(), 0);
    let decoy = Keypair::new();
    let profile = profile_address(&world.subject.pubkey());

    assert!(revoke(&mut world, &decoy.pubkey()).is_err());
    assert!(revoke(&mut world, &profile).is_err());
    assert_eq!(read_credential(&world.svm, &credential).status, STATUS_ACTIVE);
}

#[test]
fn rejects_transaction_that_omits_required_issuer_signature_on_revoke() {
    let mut world = setup_issuer_world();
    issue(
        &mut world,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/a.pdf",
        None,
    )
    .unwrap();
    let credential = credential_address(&world.subject.pubkey(), 0);
    let attacker = Keypair::new();
    airdrop(&mut world.svm, &attacker);

    let instruction = revoke_credential_instruction(&world.issuer.pubkey(), &credential);
    let mut transaction =
        Transaction::new_unsigned(Message::new(&[instruction], Some(&attacker.pubkey())));
    assert!(transaction
        .try_sign(&[&attacker], world.svm.latest_blockhash())
        .is_err());
    assert_eq!(read_credential(&world.svm, &credential).status, STATUS_ACTIVE);
}
