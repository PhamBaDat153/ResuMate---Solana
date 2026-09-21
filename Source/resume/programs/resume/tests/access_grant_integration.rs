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
const ACCESS_GRANT_SEED: &[u8] = b"access-grant";
const LINK_GRANT_SEED: &[u8] = b"link-grant";

const CREATE_PROFILE_DISCRIMINATOR: [u8; 8] = [225, 205, 234, 143, 17, 186, 50, 220];
const INITIALIZE_REGISTRY_DISCRIMINATOR: [u8; 8] = [157, 206, 75, 32, 236, 128, 138, 167];
const REGISTER_ISSUER_DISCRIMINATOR: [u8; 8] = [145, 117, 52, 59, 189, 27, 127, 18];
const ISSUE_CREDENTIAL_DISCRIMINATOR: [u8; 8] = [255, 193, 171, 224, 68, 171, 194, 87];
const REVOKE_CREDENTIAL_DISCRIMINATOR: [u8; 8] = [38, 123, 95, 95, 223, 158, 169, 87];
const CREATE_ACCESS_GRANT_DISCRIMINATOR: [u8; 8] = [72, 11, 152, 6, 199, 55, 89, 158];
const REVOKE_ACCESS_GRANT_DISCRIMINATOR: [u8; 8] = [172, 231, 25, 94, 128, 94, 232, 218];
const CREATE_LINK_GRANT_DISCRIMINATOR: [u8; 8] = [164, 180, 10, 203, 76, 35, 147, 72];
const REVOKE_LINK_GRANT_DISCRIMINATOR: [u8; 8] = [146, 93, 37, 141, 118, 5, 239, 178];
const ACCESS_GRANT_ACCOUNT_DISCRIMINATOR: [u8; 8] = [167, 55, 184, 237, 74, 242, 0, 109];
const LINK_GRANT_ACCOUNT_DISCRIMINATOR: [u8; 8] = [164, 180, 10, 203, 76, 35, 147, 72];

fn pda(seeds: &[&[u8]]) -> Address {
    Address::find_program_address(seeds, &PROGRAM_ID).0
}

fn profile_address(owner: &Address) -> Address {
    pda(&[PROFILE_SEED, owner.as_ref()])
}

fn registry_address() -> Address {
    pda(&[ISSUER_REGISTRY_SEED])
}

fn issuer_address(issuer: &Address) -> Address {
    pda(&[ISSUER_SEED, issuer.as_ref()])
}

fn credential_address(subject: &Address, id: u64) -> Address {
    pda(&[CREDENTIAL_SEED, subject.as_ref(), &id.to_le_bytes()])
}

fn access_grant_address(credential: &Address, recipient: &Address, grant_id: u64) -> Address {
    pda(&[ACCESS_GRANT_SEED, credential.as_ref(), recipient.as_ref(), &grant_id.to_le_bytes()])
}

fn link_grant_address(credential: &Address, id: u64) -> Address {
    pda(&[LINK_GRANT_SEED, credential.as_ref(), &id.to_le_bytes()])
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> Result<(), String> {
    let tx = Transaction::new(
        &[payer],
        Message::new(&[ix], Some(&payer.pubkey())),
        svm.latest_blockhash(),
    );
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{e:?}"))
}

fn setup_svm() -> LiteSVM {
    let mut svm = LiteSVM::new();
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("target/deploy/resume.so");
    svm.add_program_from_file(PROGRAM_ID, path)
        .expect("compiled resume.so required");
    svm
}

fn airdrop(svm: &mut LiteSVM, kp: &Keypair) {
    svm.airdrop(&kp.pubkey(), 2_000_000_000).unwrap();
}

struct GrantWorld {
    svm: LiteSVM,
    authority: Keypair,
    issuer: Keypair,
    subject: Keypair,
    recipient: Keypair,
    attacker: Keypair,
    credential: Address,
}

fn setup_grant_world() -> GrantWorld {
    let mut svm = setup_svm();
    let authority = Keypair::new();
    let issuer = Keypair::new();
    let subject = Keypair::new();
    let recipient = Keypair::new();
    let attacker = Keypair::new();
    airdrop(&mut svm, &authority);
    airdrop(&mut svm, &issuer);
    airdrop(&mut svm, &subject);
    airdrop(&mut svm, &recipient);
    airdrop(&mut svm, &attacker);

    send(
        &mut svm,
        &authority,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(authority.pubkey(), true),
                AccountMeta::new(registry_address(), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data: INITIALIZE_REGISTRY_DISCRIMINATOR.to_vec(),
        },
    )
    .unwrap();

    let mut reg = REGISTER_ISSUER_DISCRIMINATOR.to_vec();
    reg.push(1);
    send(
        &mut svm,
        &authority,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(authority.pubkey(), true),
                AccountMeta::new_readonly(registry_address(), false),
                AccountMeta::new_readonly(issuer.pubkey(), false),
                AccountMeta::new(issuer_address(&issuer.pubkey()), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data: reg,
        },
    )
    .unwrap();

    send(
        &mut svm,
        &subject,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(subject.pubkey(), true),
                AccountMeta::new(profile_address(&subject.pubkey()), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data: CREATE_PROFILE_DISCRIMINATOR.to_vec(),
        },
    )
    .unwrap();

    let mut issue = ISSUE_CREDENTIAL_DISCRIMINATOR.to_vec();
    issue.extend_from_slice(&0u64.to_le_bytes());
    issue.extend_from_slice(&[1; 32]);
    issue.extend_from_slice(&[2; 32]);
    let uri = b"https://example.com/c.json";
    issue.extend_from_slice(&(uri.len() as u32).to_le_bytes());
    issue.extend_from_slice(uri);
    issue.push(0);
    send(
        &mut svm,
        &issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(issuer.pubkey(), true),
                AccountMeta::new_readonly(issuer_address(&issuer.pubkey()), false),
                AccountMeta::new_readonly(subject.pubkey(), false),
                AccountMeta::new(profile_address(&subject.pubkey()), false),
                AccountMeta::new(credential_address(&subject.pubkey(), 0), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data: issue,
        },
    )
    .unwrap();

    let credential = credential_address(&subject.pubkey(), 0);
    GrantWorld {
        svm,
        authority,
        issuer,
        subject,
        recipient,
        attacker,
        credential,
    }
}

fn create_access_grant_ix(
    grantor: &Address,
    credential: &Address,
    recipient: &Address,
    grant_id: u64,
    key_version: u32,
    wrapped_key: &[u8],
    expires_at: Option<i64>,
) -> Instruction {
    let mut data = CREATE_ACCESS_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&grant_id.to_le_bytes());
    data.extend_from_slice(&key_version.to_le_bytes());
    data.extend_from_slice(&(wrapped_key.len() as u32).to_le_bytes());
    data.extend_from_slice(wrapped_key);
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
            AccountMeta::new(*grantor, true),
            AccountMeta::new_readonly(*credential, false),
            AccountMeta::new_readonly(*recipient, false),
            AccountMeta::new(access_grant_address(credential, recipient, grant_id), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

fn revoke_access_grant_ix(
    grantor: &Address,
    credential: &Address,
    recipient: &Address,
    grant_id: u64,
) -> Instruction {
    let mut data = REVOKE_ACCESS_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&grant_id.to_le_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*grantor, true),
            AccountMeta::new_readonly(*credential, false),
            AccountMeta::new_readonly(*recipient, false),
            AccountMeta::new(access_grant_address(credential, recipient, grant_id), false),
        ],
        data,
    }
}

fn revoke_credential_ix(issuer: &Address, credential: &Address) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(*issuer, true),
            AccountMeta::new_readonly(issuer_address(issuer), false),
            AccountMeta::new(*credential, false),
        ],
        data: REVOKE_CREDENTIAL_DISCRIMINATOR.to_vec(),
    }
}

struct AccessGrantView {
    credential: Address,
    grantor: Address,
    recipient: Address,
    recipient_key_version: u32,
    wrapped_document_key: Vec<u8>,
    created_at: i64,
    expires_at: Option<i64>,
    status: u8,
    bump: u8,
}

fn read_access_grant(svm: &LiteSVM, addr: &Address) -> AccessGrantView {
    let account = svm.get_account(addr).expect("access grant should exist");
    assert_eq!(account.owner, PROGRAM_ID);
    assert_eq!(&account.data[..8], &ACCESS_GRANT_ACCOUNT_DISCRIMINATOR);

    let credential = Address::new_from_array(account.data[8..40].try_into().unwrap());
    let grantor = Address::new_from_array(account.data[40..72].try_into().unwrap());
    let recipient = Address::new_from_array(account.data[72..104].try_into().unwrap());
    let recipient_key_version = u32::from_le_bytes(account.data[104..108].try_into().unwrap());
    let key_len = u32::from_le_bytes(account.data[108..112].try_into().unwrap()) as usize;
    let wrapped_document_key = account.data[112..112 + key_len].to_vec();
    let mut offset = 112 + key_len;
    let created_at = i64::from_le_bytes(account.data[offset..offset + 8].try_into().unwrap());
    offset += 8;
    let expires_at = match account.data[offset] {
        0 => {
            offset += 1;
            None
        }
        1 => {
            offset += 1;
            let val = i64::from_le_bytes(account.data[offset..offset + 8].try_into().unwrap());
            offset += 8;
            Some(val)
        }
        other => panic!("invalid expiry option {other}"),
    };
    let status = account.data[offset];
    let bump = account.data[offset + 1];

    AccessGrantView {
        credential,
        grantor,
        recipient,
        recipient_key_version,
        wrapped_document_key,
        created_at,
        expires_at,
        status,
        bump,
    }
}

#[test]
fn issuer_creates_access_grant_successfully() {
    let mut world = setup_grant_world();
    let wrapped_key = vec![10u8; 32];
    let grant_id = 0u64;

    send(
        &mut world.svm,
        &world.issuer,
        create_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
            1,
            &wrapped_key,
            Some(4_000_000_000i64),
        ),
    )
    .expect("issuer should create access grant");

    let grant_addr = access_grant_address(&world.credential, &world.recipient.pubkey(), grant_id);
    let view = read_access_grant(&world.svm, &grant_addr);
    assert_eq!(view.credential, world.credential);
    assert_eq!(view.grantor, world.issuer.pubkey());
    assert_eq!(view.recipient, world.recipient.pubkey());
    assert_eq!(view.recipient_key_version, 1);
    assert_eq!(view.wrapped_document_key, wrapped_key);
    assert_eq!(view.expires_at, Some(4_000_000_000));
    assert_eq!(view.status, 0);
}

#[test]
fn subject_creates_access_grant_successfully() {
    let mut world = setup_grant_world();
    let wrapped_key = vec![11u8; 16];
    let grant_id = 0u64;

    send(
        &mut world.svm,
        &world.subject,
        create_access_grant_ix(
            &world.subject.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
            2,
            &wrapped_key,
            None,
        ),
    )
    .expect("subject should create access grant");

    let grant_addr = access_grant_address(&world.credential, &world.recipient.pubkey(), grant_id);
    let view = read_access_grant(&world.svm, &grant_addr);
    assert_eq!(view.grantor, world.subject.pubkey());
    assert_eq!(view.recipient_key_version, 2);
    assert_eq!(view.wrapped_document_key, wrapped_key);
    assert_eq!(view.expires_at, None);
    assert_eq!(view.status, 0);
}

#[test]
fn rejects_unauthorized_grantor() {
    let mut world = setup_grant_world();
    let result = send(
        &mut world.svm,
        &world.attacker,
        create_access_grant_ix(
            &world.attacker.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            0,
            1,
            &[1; 32],
            None,
        ),
    );
    assert!(result.is_err());

    let grant_addr = access_grant_address(&world.credential, &world.recipient.pubkey(), 0);
    assert!(world.svm.get_account(&grant_addr).is_none());
}

#[test]
fn rejects_access_grant_for_revoked_credential() {
    let mut world = setup_grant_world();
    send(
        &mut world.svm,
        &world.issuer,
        revoke_credential_ix(&world.issuer.pubkey(), &world.credential),
    )
    .unwrap();

    let result = send(
        &mut world.svm,
        &world.issuer,
        create_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            0,
            1,
            &[1; 32],
            None,
        ),
    );
    assert!(result.is_err());
}

#[test]
fn rejects_non_future_expiry() {
    let mut world = setup_grant_world();
    let result = send(
        &mut world.svm,
        &world.issuer,
        create_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            0,
            1,
            &[1; 32],
            Some(0i64),
        ),
    );
    assert!(result.is_err());
}

#[test]
fn rejects_oversized_wrapped_key() {
    let mut world = setup_grant_world();
    let big_key = vec![0u8; 513];
    let result = send(
        &mut world.svm,
        &world.issuer,
        create_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            0,
            1,
            &big_key,
            None,
        ),
    );
    assert!(result.is_err());
}

#[test]
fn original_grantor_revokes_access_grant() {
    let mut world = setup_grant_world();
    let grant_id = 0u64;
    send(
        &mut world.svm,
        &world.issuer,
        create_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
            1,
            &[1; 32],
            None,
        ),
    )
    .unwrap();

    send(
        &mut world.svm,
        &world.issuer,
        revoke_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
        ),
    )
    .expect("original grantor should revoke");

    let grant_addr = access_grant_address(&world.credential, &world.recipient.pubkey(), grant_id);
    let view = read_access_grant(&world.svm, &grant_addr);
    assert_eq!(view.status, 1);
}

#[test]
fn rejects_non_grantor_revoke() {
    let mut world = setup_grant_world();
    let grant_id = 0u64;
    send(
        &mut world.svm,
        &world.issuer,
        create_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
            1,
            &[1; 32],
            None,
        ),
    )
    .unwrap();

    let result = send(
        &mut world.svm,
        &world.attacker,
        revoke_access_grant_ix(
            &world.attacker.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
        ),
    );
    assert!(result.is_err());

    let grant_addr = access_grant_address(&world.credential, &world.recipient.pubkey(), grant_id);
    let view = read_access_grant(&world.svm, &grant_addr);
    assert_eq!(view.status, 0);
}

#[test]
fn rejects_repeated_revoke() {
    let mut world = setup_grant_world();
    let grant_id = 0u64;
    send(
        &mut world.svm,
        &world.issuer,
        create_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
            1,
            &[1; 32],
            None,
        ),
    )
    .unwrap();

    send(
        &mut world.svm,
        &world.issuer,
        revoke_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
        ),
    )
    .unwrap();

    let result = send(
        &mut world.svm,
        &world.issuer,
        revoke_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
        ),
    );
    assert!(result.is_err());
}

#[test]
fn revoke_does_not_mutate_credential() {
    let mut world = setup_grant_world();
    let grant_id = 0u64;
    send(
        &mut world.svm,
        &world.issuer,
        create_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
            1,
            &[1; 32],
            None,
        ),
    )
    .unwrap();

    let cred_before = world.svm.get_account(&world.credential).unwrap().data.clone();

    send(
        &mut world.svm,
        &world.issuer,
        revoke_access_grant_ix(
            &world.issuer.pubkey(),
            &world.credential,
            &world.recipient.pubkey(),
            grant_id,
        ),
    )
    .unwrap();

    let cred_after = world.svm.get_account(&world.credential).unwrap().data.clone();
    assert_eq!(cred_before, cred_after);
}

#[test]
fn issuer_creates_link_grant_successfully() {
    let mut world = setup_grant_world();
    let secret_hash = [7u8; 32];
    let wrapped_key = vec![9u8; 32];
    let link_id = 0u64;

    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&link_id.to_le_bytes());
    data.extend_from_slice(&secret_hash);
    data.extend_from_slice(&(wrapped_key.len() as u32).to_le_bytes());
    data.extend_from_slice(&wrapped_key);
    data.extend_from_slice(&4_000_000_000i64.to_le_bytes());
    data.extend_from_slice(&5u32.to_le_bytes());

    send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, link_id), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    )
    .expect("issuer should create link grant");

    let lg_addr = link_grant_address(&world.credential, link_id);
    let account = world.svm.get_account(&lg_addr).unwrap();
    assert_eq!(&account.data[..8], &LINK_GRANT_ACCOUNT_DISCRIMINATOR);
}

#[test]
fn subject_creates_link_grant_successfully() {
    let mut world = setup_grant_world();
    let secret_hash = [8u8; 32];
    let wrapped_key = vec![9u8; 16];
    let link_id = 0u64;

    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&link_id.to_le_bytes());
    data.extend_from_slice(&secret_hash);
    data.extend_from_slice(&(wrapped_key.len() as u32).to_le_bytes());
    data.extend_from_slice(&wrapped_key);
    data.extend_from_slice(&4_000_000_000i64.to_le_bytes());
    data.extend_from_slice(&0u32.to_le_bytes());

    send(
        &mut world.svm,
        &world.subject,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.subject.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, link_id), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    )
    .expect("subject should create link grant");
}

#[test]
fn rejects_link_grant_unauthorized_grantor() {
    let mut world = setup_grant_world();
    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&0u64.to_le_bytes());
    data.extend_from_slice(&[7u8; 32]);
    data.extend_from_slice(&32u32.to_le_bytes());
    data.extend_from_slice(&[9u8; 32]);
    data.extend_from_slice(&4_000_000_000i64.to_le_bytes());
    data.extend_from_slice(&5u32.to_le_bytes());

    let result = send(
        &mut world.svm,
        &world.attacker,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.attacker.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, 0), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    );
    assert!(result.is_err());
}

#[test]
fn rejects_link_grant_for_revoked_credential() {
    let mut world = setup_grant_world();
    send(
        &mut world.svm,
        &world.issuer,
        revoke_credential_ix(&world.issuer.pubkey(), &world.credential),
    )
    .unwrap();

    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&0u64.to_le_bytes());
    data.extend_from_slice(&[7u8; 32]);
    data.extend_from_slice(&32u32.to_le_bytes());
    data.extend_from_slice(&[9u8; 32]);
    data.extend_from_slice(&4_000_000_000i64.to_le_bytes());
    data.extend_from_slice(&5u32.to_le_bytes());

    let result = send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, 0), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    );
    assert!(result.is_err());
}

#[test]
fn rejects_link_grant_empty_secret_hash() {
    let mut world = setup_grant_world();
    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&0u64.to_le_bytes());
    data.extend_from_slice(&[0u8; 32]);
    data.extend_from_slice(&32u32.to_le_bytes());
    data.extend_from_slice(&[9u8; 32]);
    data.extend_from_slice(&4_000_000_000i64.to_le_bytes());
    data.extend_from_slice(&5u32.to_le_bytes());

    let result = send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, 0), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    );
    assert!(result.is_err());
}

#[test]
fn rejects_link_grant_non_future_expiry() {
    let mut world = setup_grant_world();
    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&0u64.to_le_bytes());
    data.extend_from_slice(&[7u8; 32]);
    data.extend_from_slice(&32u32.to_le_bytes());
    data.extend_from_slice(&[9u8; 32]);
    data.extend_from_slice(&0i64.to_le_bytes());
    data.extend_from_slice(&5u32.to_le_bytes());

    let result = send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, 0), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    );
    assert!(result.is_err());
}

#[test]
fn rejects_link_grant_oversized_wrapped_key() {
    let mut world = setup_grant_world();
    let big_key = vec![0u8; 513];
    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&0u64.to_le_bytes());
    data.extend_from_slice(&[7u8; 32]);
    data.extend_from_slice(&(big_key.len() as u32).to_le_bytes());
    data.extend_from_slice(&big_key);
    data.extend_from_slice(&4_000_000_000i64.to_le_bytes());
    data.extend_from_slice(&5u32.to_le_bytes());

    let result = send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, 0), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    );
    assert!(result.is_err());
}

#[test]
fn original_grantor_revokes_link_grant() {
    let mut world = setup_grant_world();
    let link_id = 0u64;
    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&link_id.to_le_bytes());
    data.extend_from_slice(&[7u8; 32]);
    data.extend_from_slice(&32u32.to_le_bytes());
    data.extend_from_slice(&[9u8; 32]);
    data.extend_from_slice(&4_000_000_000i64.to_le_bytes());
    data.extend_from_slice(&5u32.to_le_bytes());

    send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, link_id), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    )
    .unwrap();

    let mut rev = REVOKE_LINK_GRANT_DISCRIMINATOR.to_vec();
    rev.extend_from_slice(&link_id.to_le_bytes());
    send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, link_id), false),
            ],
            data: rev,
        },
    )
    .expect("original grantor should revoke link grant");
}

#[test]
fn rejects_link_grant_revoke_by_non_grantor() {
    let mut world = setup_grant_world();
    let link_id = 0u64;
    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&link_id.to_le_bytes());
    data.extend_from_slice(&[7u8; 32]);
    data.extend_from_slice(&32u32.to_le_bytes());
    data.extend_from_slice(&[9u8; 32]);
    data.extend_from_slice(&4_000_000_000i64.to_le_bytes());
    data.extend_from_slice(&5u32.to_le_bytes());

    send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, link_id), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    )
    .unwrap();

    let mut rev = REVOKE_LINK_GRANT_DISCRIMINATOR.to_vec();
    rev.extend_from_slice(&link_id.to_le_bytes());
    let result = send(
        &mut world.svm,
        &world.attacker,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.attacker.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, link_id), false),
            ],
            data: rev,
        },
    );
    assert!(result.is_err());
}

#[test]
fn rejects_repeated_link_grant_revoke() {
    let mut world = setup_grant_world();
    let link_id = 0u64;
    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&link_id.to_le_bytes());
    data.extend_from_slice(&[7u8; 32]);
    data.extend_from_slice(&32u32.to_le_bytes());
    data.extend_from_slice(&[9u8; 32]);
    data.extend_from_slice(&4_000_000_000i64.to_le_bytes());
    data.extend_from_slice(&5u32.to_le_bytes());

    send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, link_id), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    )
    .unwrap();

    let mut rev = REVOKE_LINK_GRANT_DISCRIMINATOR.to_vec();
    rev.extend_from_slice(&link_id.to_le_bytes());
    send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, link_id), false),
            ],
            data: rev.clone(),
        },
    )
    .unwrap();

    let result = send(
        &mut world.svm,
        &world.issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.issuer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, link_id), false),
            ],
            data: rev,
        },
    );
    assert!(result.is_err());
}
