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
        stage
    } = body;

    switch (stage) {
        case 'create':
            return createProposal(body);

        case 'vote':
            return vote(body);

        case 'tally':
            return tallyProposal(body);

        case 'execute':
            return executeProposal(body);

        default:
            throw {
                message: 'Invalid stage.'
            }
    }
}

async function createProposal(body) {
    const {
        source,
        daoToml,
        proposalSecret,
        turretSigners,
        IpfsProposalAddr
    } = body

    const proposalKeypair = Keypair.fromSecret(proposalSecret);
    const proposalAccountId = proposalKeypair.publicKey();

    const turretContractSigners = turretSigners.split(',').map(function(item) {
        return item.trim();
    });;

    if (turretContractSigners.length < 5 || turretContractSigners.length > 19) {
        throw {
            message: 'Invalid nr of turret signers (min: 5, max: 19)'
        }
    }

    // test data
    const nrOfOptions = 4;
    const daoPublicKey = "GACRU2RTTFSLDDFGLLDIBLQQG66W52QZPJ3SWVC45YTE5H6K2II4H4CD";
    const GOV = new Asset("GOV", "GBNOMH3B6BIQE65TZVVBNOCTMLN7MYORU5GX6YNBX5YBGCI45R2EMGOV");
    const maximumVotingDuration = 300; // seconds
    const quorum = 40000;
    // end test data

    // calculate reserve and costs.
    const nrOfSignersForProposalAccount = turretContractSigners.length + 1; // turret signers + doa key
    const nrOfTrustlinesForProposalAccount = 1; // GOV token
    const nrOfDataEntriesForProposalAccount = 5 + nrOfOptions; // status, createTime, endTime, quorum, proposalData + nr of options for later, when the result is stored.
    const minBalanceForProposalAccount = (2 + nrOfSignersForProposalAccount + nrOfTrustlinesForProposalAccount + nrOfDataEntriesForProposalAccount) * 0.5;

    const fee = await getFee();

    const nrOfOperations = nrOfSignersForProposalAccount + nrOfDataEntriesForProposalAccount + nrOfDataEntriesForProposalAccount + nrOfOptions + 1; // + create account
    const totalFeeCost = (nrOfOperations * fee) / 10000000;
    const totalCost = totalFeeCost + minBalanceForProposalAccount;
    console.log("total cost: ", totalCost);

    const sourceAccount = await server.loadAccount(source);
    // todo: check if source has enough funds;

    let transaction = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    // create proposal account
    transaction.addOperation(Operation.createAccount({
        destination: proposalAccountId,
        startingBalance: "" + minBalanceForProposalAccount
    }));

    // set status of the proposal account
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "status",
        value: "active"
    }));

    const createTime = Math.floor(Date.now() / 1000);

    // set time of creation to proposal account 
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "createTime",
        value: "" + createTime
    }));

    // add dao rules (Maximum duration for the voting phase)
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "endTime",
        value: "" + (createTime + maximumVotingDuration)
    }));

    // add dao rules (Quorum: amount of votes needed for a proposal option to be accepted)
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "quorum",
        value: "" + quorum
    }));

    // add pointer to proposal data on IPFS
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "proposalData",
        value: IpfsProposalAddr
    }));

    // add turret signers to proposal account
    for (const turretSigner of turretContractSigners) {
        transaction.addOperation(Operation.setOptions({
            source: proposalAccountId,
            signer: {
                ed25519PublicKey: turretSigner,
                weight: 1
            }
        }));
    }

    // if 2 turrets are not available any more, than it still works.
    const proposalAccountThresholdsValue = turretContractSigners.length - 2;

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
        highThreshold: proposalAccountThresholdsValue
    }));

    // trust GOV token.
    transaction.addOperation(Operation.changeTrust({
        source: proposalAccountId,
        asset: GOV
    }));

    // offer tokens for voting
    for (let i = 0; i < nrOfOptions; i++) {

        const assetCode = 'OPTION' + i;

        transaction.addOperation(Operation.manageSellOffer({
            source: proposalAccountId,
            selling: new Asset(assetCode, proposalAccountId),
            buying: GOV,
            amount: '100000000000',
            price: 1
        }));
    }

    return transaction.setTimeout(0).build().toXDR('base64');

};

async function vote(body) {
    const {
        source,
        proposalAccountId,
        optionIndex
    } = body

    return 'todo'
};


async function tallyProposal(body) {
    const {
        source,
        proposalAccountId
    } = body

    return 'todo'
};

async function executeProposal(body) {
    const {
        source,
        proposalAccountId
    } = body

    return 'todo'
};


function getFee() {
    return server
        .feeStats()
        .then((feeStats) => feeStats?.fee_charged?.max || 100000)
        .catch(() => 100000)
};