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
        tallyContractSigners,
        proposalContractSigners,
        IpfsProposalAddr
    } = body

    const proposalKeypair = Keypair.fromSecret(proposalSecret);
    const proposalAccountId = proposalKeypair.publicKey();

    const tallyKeypair = Keypair.fromSecret(tallySecret);
    const tallyAccountId = tallyKeypair.publicKey();
    const tallyTurretSigners = tallyContractSigners.split(',').map(function(item) {
        return item.trim();
    });;

    if (tallyTurretSigners.length < 3) {
        throw {
            message: 'Not enough tally turret contract signers.'
        }
    }

    const proposalTurretSigners = proposalContractSigners.split(',').map(function(item) {
        return item.trim();
    });;

    if (proposalTurretSigners.length < 3) {
        throw {
            message: 'Not enough proposal turret contract signers.'
        }
    }

    if (tallyTurretSigners.length != proposalTurretSigners.length) {
        throw {
            message: 'Number of proposal turret contract signers and tally turret contract signers must be the same.'
        }
    }

    // test data
    const nrOfOptions = 4;
    const daoPublicKey = "GACRU2RTTFSLDDFGLLDIBLQQG66W52QZPJ3SWVC45YTE5H6K2II4H4CD";
    const minimumTokensNeededToVote = 100000;
    const maximumVotingDuration = 300; // seconds
    const quorum = 40000;
    // end test data
    
    const nrOfSignersForProposalAccount = proposalTurretSigners.length + tallyTurretSigners.length + 1; // doa key
    const nrOfTrustlinesForProposalAccount = 0;
    const nrOfDataEntriesForProposalAccount = 6;
    const minBalanceProposalAccount = getMinBalance(nrOfSignersForProposalAccount, nrOfTrustlinesForProposalAccount, nrOfDataEntriesForProposalAccount);

    const nrOfSignersForTallyAccount = proposalTurretSigners.length + tallyTurretSigners.length + 2; // dao key + proposal account key
    const nrOfTrustlinesForTallyAccount = nrOfOptions;
    const nrOfDataEntriesForTallyAccount = 0;
    const minBalanceTallyAccount = getMinBalance(nrOfSignersForTallyAccount, nrOfTrustlinesForTallyAccount, nrOfDataEntriesForTallyAccount);
    
    const fee = await getFee();

    const sourceAccount = await server.loadAccount(source);
    
    const totalFeeCost = ((2 * proposalTurretSigners.length + 2 * tallyTurretSigners.length + 3 + nrOfOptions * 2) * fee) / 10000000;
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


    // add signers to proposal and tally account: 
    // signers are: proposal turret signers + tally turret signers + dao public key
    // for the tally account also the proposal account should be a signer
    const thresholdsValue = proposalTurretSigners.length * 2;

    for (const tallyTurretSigner of tallyTurretSigners) {

        transaction.addOperation(Operation.setOptions({
            source: proposalAccountId,
            signer: {
                ed25519PublicKey: tallyTurretSigner,
                weight: 2
            }
        }));

        transaction.addOperation(Operation.setOptions({
            source: tallyAccountId,
            signer: {
                ed25519PublicKey: tallyTurretSigner,
                weight: 2
            }
        }));
    }

    for (const proposalTurretSigner of proposalTurretSigners) {

        transaction.addOperation(Operation.setOptions({
            source: proposalAccountId,
            signer: {
                ed25519PublicKey: proposalTurretSigner,
                weight: 2
            }
        }));

        transaction.addOperation(Operation.setOptions({
            source: tallyAccountId,
            signer: {
                ed25519PublicKey: proposalTurretSigner,
                weight: 2
            }
        }));
    }

    // add proposal account as a "zero" signer to the tally account
    transaction.addOperation(Operation.setOptions({
        source: tallyAccountId,
        signer: {
            ed25519PublicKey: proposalAccountId,
            weight: 1
        }
    }));

    // add dao public key as a "zero" signer to the tally account
    // also remove the master key as a signer
    transaction.addOperation(Operation.setOptions({
        source: tallyAccountId,
        signer: {
            ed25519PublicKey: daoPublicKey,
            weight: 1
        },
        masterWeight: 0,
        lowThreshold: thresholdsValue,
        medThreshold: thresholdsValue,
        highThreshold: thresholdsValue
    }));

    // add dao public key as a "zero" signer to the proposal account
    // also remove the master key as a signer
    transaction.addOperation(Operation.setOptions({
        source: proposalAccountId,
        signer: {
            ed25519PublicKey: daoPublicKey,
            weight: 1
        },
        masterWeight: 0,
        lowThreshold: thresholdsValue,
        medThreshold: thresholdsValue,
        highThreshold: thresholdsValue,
        setFlags: 3 // Auth required, auth revocable
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