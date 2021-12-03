const {
    TransactionBuilder,
    Server,
    Networks,
    BASE_FEE,
    Keypair,
    Operation,
    Asset
} = require('stellar-sdk')

const server = new Server(HORIZON_URL)

module.exports = async (body) => {
    const {
        source,
        daoToml,
        proposalSecret,
        tallySecret,
        turretSigners,
        IpfsProposalAddr
    } = body

    const proposalKeypair = Keypair.fromSecret(proposalSecret);
    const proposalAccountId = proposalKeypair.publicKey();

    const tallyKeypair = Keypair.fromSecret(tallySecret);
    const tallyAccountId = tallyKeypair.publicKey();
    const turretContractSigners = turretSigners.split(',').map(function(item) {
        return item.trim();
    });;

    if (turretContractSigners.length < 3) {
        throw {
            message: 'Not enough turret contract signers.'
        }
    }

    // test data
    const nrOfOptions = 4;
    const daoPublicKey = "GACRU2RTTFSLDDFGLLDIBLQQG66W52QZPJ3SWVC45YTE5H6K2II4H4CD";
    const minimumTokensNeededToVote = 100000;
    const maximumVotingDuration = 300; // seconds
    const quorum = 40000;
    // end test data

    const nrOfSignersForProposalAccount = turretContractSigners.length + 1; // doa key
    const nrOfTrustlinesForProposalAccount = 0;
    const nrOfDataEntriesForProposalAccount = 7;
    const minBalanceProposalAccount = getMinBalance(nrOfSignersForProposalAccount, nrOfTrustlinesForProposalAccount, nrOfDataEntriesForProposalAccount);

    const nrOfSignersForTallyAccount = 2; // dao key + proposal account key
    const nrOfTrustlinesForTallyAccount = nrOfOptions;
    const nrOfDataEntriesForTallyAccount = 0;
    const minBalanceTallyAccount = getMinBalance(nrOfSignersForTallyAccount, nrOfTrustlinesForTallyAccount, nrOfDataEntriesForTallyAccount);

    const fee = await getFee();

    const sourceAccount = await server.loadAccount(source);

    const totalFeeCost = ((nrOfSignersForProposalAccount + nrOfSignersForTallyAccount + nrOfOptions * 2) * fee) / 10000000;
    const totalCost = totalFeeCost + minBalanceProposalAccount + minBalanceTallyAccount;
    console.log("total cost: ", totalCost);
    // todo: check if source has enough funds;

    let transaction = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });


    // create proposal account
    transaction.addOperation(Operation.createAccount({
        destination: proposalAccountId,
        startingBalance: "" + minBalanceProposalAccount
    }));

    // create tally account
    transaction.addOperation(Operation.createAccount({
        destination: tallyAccountId,
        startingBalance: "" + minBalanceTallyAccount
    }));

    // set status of the proposal account
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "status",
        value: "active"
    }));

    // set time of creation to proposal account 
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "createTime",
        value: "" + Math.floor(Date.now() / 1000)
    }));

    // add dao rules (Minimum token needed to vote)
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "minimumTokensNeededToVote",
        value: "" + minimumTokensNeededToVote
    }));

    // add dao rules (Maximum duration for the voting phase)
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "maximumVotingDuration",
        value: "" + maximumVotingDuration
    }));

    // add dao rules (Quorum: amount of votes needed for a proposal option to be accepted)
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "maximumVotingDuration",
        value: "" + maximumVotingDuration
    }));


    // add pointer to proposal data on IPFS
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "proposalData",
        value: IpfsProposalAddr
    }));

    // add tally account to data
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "tallyAccount",
        value: tallyAccountId
    }));


    // add signers to proposal account: 
    // turret signers + dao public key
    const proposalAccountThresholdsValue = turretContractSigners.length - 1;

    for (const turretSigner of turretContractSigners) {

        transaction.addOperation(Operation.setOptions({
            source: proposalAccountId,
            signer: {
                ed25519PublicKey: turretSigner,
                weight: 1
            }
        }));
    }

    // add dao public key as a signer to the proposal account
    // also remove the master key as a signer
    transaction.addOperation(Operation.setOptions({
        source: proposalAccountId,
        signer: {
            ed25519PublicKey: daoPublicKey,
            weight: 1
        },
        masterWeight: 0,
        lowThreshold: proposalAccountThresholdsValue,
        medThreshold: proposalAccountThresholdsValue,
        highThreshold: proposalAccountThresholdsValue,
        setFlags: 3 // Auth required, auth revocable (allow trust)
    }));


    // add proposal account signer to the tally account
    transaction.addOperation(Operation.setOptions({
        source: tallyAccountId,
        signer: {
            ed25519PublicKey: proposalAccountId,
            weight: 1
        }
    }));

    // add dao public key as a signer to the tally account
    // also remove the master key as a signer
    transaction.addOperation(Operation.setOptions({
        source: tallyAccountId,
        signer: {
            ed25519PublicKey: daoPublicKey,
            weight: 1
        },
        masterWeight: 0,
        lowThreshold: 5,
        medThreshold: 5,
        highThreshold: 5
    }));


    // let tally account trust vote assets issued by proposal account
    // allow trust only to tally account

    for (let i = 0; i < nrOfOptions; i++) {

        const assetCode = 'OPTION' + i;

        transaction.addOperation(Operation.changeTrust({
            source: tallyAccountId,
            asset: new Asset(assetCode, proposalAccountId)
        }));

        transaction.addOperation(Operation.allowTrust({
            source: proposalAccountId,
            trustor: tallyAccountId,
            assetCode: assetCode,
            authorize: 1
        }));
    }

    return transaction.setTimeout(0).build().toXDR('base64');

}

function getFee() {
    return server
        .feeStats()
        .then((feeStats) => feeStats?.fee_charged?.max || 100000)
        .catch(() => 100000)
};

function getMinBalance(nrOfSigners, nrOfTrustlines, nrOfDataEntries) {
    return (2 + nrOfSigners + nrOfTrustlines + nrOfDataEntries) * 0.5;
};