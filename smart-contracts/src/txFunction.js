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

// TEST DATA
const GOV = new Asset("GOV", "GBNOMH3B6BIQE65TZVVBNOCTMLN7MYORU5GX6YNBX5YBGCI45R2EMGOV"); // SBDT5Z3CPSHZ74224EP5DLGVO56J755FSTQZPDQ5WCCOOCAJMY4HL2M6
const daoPublicKey = "GACRU2RTTFSLDDFGLLDIBLQQG66W52QZPJ3SWVC45YTE5H6K2II4H4CD";
const nrOfOptions = 4;
const maximumVotingDuration = 300; // seconds
const testQuorum = 40000;
const offerAmountPerVotingOption = 100000000000;
// END test data


module.exports = async (body) => {
    const {
        stage
    } = body;

    switch (stage) {
        case 'create':
            return createProposal(body);

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

    // calculate reserve and costs.
    const nrOfSignersForProposalAccount = turretContractSigners.length + 1; // turret signers + doa key
    const nrOfTrustlinesForProposalAccount = 1; // GOV token
    const nrOfDataEntriesForProposalAccount = 5 + nrOfOptions; // status, createTime, endTime, quorum, proposalData + nr of options for later, when the result is stored.
    const minBalanceForProposalAccount = (2 + nrOfSignersForProposalAccount + nrOfTrustlinesForProposalAccount + nrOfDataEntriesForProposalAccount) * 0.5;

    const fee = await getFee();

    /*const nrOfOperations = nrOfSignersForProposalAccount + nrOfDataEntriesForProposalAccount + nrOfDataEntriesForProposalAccount + nrOfOptions + 1; // + create account
    const totalFeeCost = (nrOfOperations * fee) / 10000000;
    const totalCost = totalFeeCost + minBalanceForProposalAccount;
    console.log("total cost: ", totalCost);*/

    const sourceAccount = await server.loadAccount(source);

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
        value: "" + testQuorum
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
            amount: "" + offerAmountPerVotingOption,
            price: 1
        }));
    }
    return transaction.setTimeout(0).build().toXDR('base64');
};

async function tallyProposal(body) {
    const {
        source,
        proposalAccountId
    } = body

    const proposalAccount = await server.loadAccount(proposalAccountId);

    // check if proposal account has dao signer
    if (!accountHasSigner(proposalAccount, daoPublicKey)) {
        throw {
            message: 'invalid proposal account, missing dao signer.'
        }
    }

    // check if proposal is active
    if (typeof proposalAccount.data_attr.status !== "undefined") {
        const status = Buffer.from(proposalAccount.data_attr.status, 'base64').toString('utf-8');
        if (status !== "active") {
            throw {
                message: 'proposal status not active'
            }
        }
    } else {
        throw {
            message: 'invalid proposal account, missing status data entry.'
        }
    }

    // check if endTime is reached.
    if (typeof proposalAccount.data_attr.endTime !== "undefined") {
        const endTimeStr = Buffer.from(proposalAccount.data_attr.endTime, 'base64').toString('utf-8');
        const endTimeInt = parseInt(endTimeStr) || 0;
        if (endTimeInt == 0) {
            throw {
                message: 'invalid proposal account, invalid end time stored in account data.'
            }
        }
        const now = Math.floor(Date.now() / 1000);
        if (now < endTimeInt) {
            throw {
                message: 'voting time not finished.'
            }
        }
    } else {
        throw {
            message: 'invalid proposal account, missing end time data entry.'
        }
    }

    let quorum = 0;

    // read quorum
    if (typeof proposalAccount.data_attr.quorum !== "undefined") {
        const quporum = Buffer.from(proposalAccount.data_attr.quorum, 'base64').toString('utf-8');
        quorum = parseInt(quporum) || 0;
        if (quorum <= 0) {
            throw {
                message: 'invalid proposal account, invalid quorum stored in account data.'
            }
        }
    } else {
        throw {
            message: 'invalid proposal account, missing quorum data entry.'
        }
    }

    // find voting options that reached the quorum
    const assets = new Array();
    const quorumReachedAssets = new Array();
    let page = await server.assets().forIssuer(proposalAccountId).call();
    while (true) {
        if (typeof page == "undefined" ||
            typeof page.records == "undefined" ||
            page.records.length == 0) {
            break;
        }
        for (let i = 0; i < page.records.length; i++) {
            assets.push(page.records[i]);
            if (page.records[i].amount >= quorum) {
                quorumReachedAssets.push(page.records[i]);
            }
        }
        page = page.next();
    }

    if (quorumReachedAssets.length == 0) {
        throw {
            message: 'quorum not reached.'
        }
    }

    // find winner option
    quorumReachedAssets.sort((a,b) => (a.amount > b.amount) ? 1 : ((b.amount > a.amount) ? -1 : 0))
    
    const winner = quorumReachedAssets[0];

    if (!winner.asset_code.startsWith("OPTION") || !winner.length > 6) {
        throw {
            message: 'invalid option token.'
        }
    }
    
    const winnerOption = parseInt(winner.asset_code.substr(6) || -1);
    
    if (winnerOption < 0) {
        throw {
            message: 'invalid option token.'
        }
    }

    // load all offers to be removed
    const offers = new Array();
    page = await server.offers().forAccount(proposalAccountId).call();
    while (true) {
        if (typeof page == "undefined" ||
            typeof page.records == "undefined" ||
            page.records.length == 0) {
            break;
        }
        for (let i = 0; i < page.records.length; i++) {
            offers.push(page.records[i]);
        }
        page = page.next();
    }

    // create transaction
    const sourceAccount = await server.loadAccount(source);
    const fee = await getFee();

    let transaction = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    transaction.addOperation(Operation.beginSponsoringFutureReserves({
        source: source,
        sponsoredId: proposalAccountId
    }))

    // set status of the proposal account
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "status",
        value: "finished"
    }));

    const finishTime = Math.floor(Date.now() / 1000);
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "finishTime",
        value: "" + finishTime
    }));

    transaction.addOperation(Operation.endSponsoringFutureReserves({
        source: proposalAccountId
    }));

    // remove existing offers
    for (let i = 0; i < offers.length; i++) {
        transaction.addOperation(Operation.manageSellOffer({
            source: proposalAccountId,
            selling: new Asset(offers[i].selling.asset_code, offers[i].selling.asset_issuer),
            buying: GOV,
            amount: "" + 0,
            price: 1,
            offerId: offers[i].id
        }));

    }

    // add sell offers for GOV tokens collected.
    for (let i = 0; i < assets.length; i++) {
        transaction.addOperation(Operation.manageSellOffer({
            source: proposalAccountId,
            selling: GOV,
            buying: new Asset(assets[i].asset_code, assets[i].asset_issuer),
            amount: "" + assets[i].amount,
            price: 1
        }));
    }
    return transaction.setTimeout(0).build().toXDR('base64');
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

function accountHasSigner(account, signer) {
    for (let i = 0; i < account.signers.length; i++) {
        if (account.signers[i].key == signer) {
            return true;
        }
    }
    return false;
};