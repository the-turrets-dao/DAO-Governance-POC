const {
    TransactionBuilder,
    Server,
    Networks,
    BASE_FEE,
    Keypair,
    Operation,
    Asset
} = require('stellar-sdk')

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'

const server = new Server(HORIZON_URL)


module.exports = async (body) => {
    const {
        action
    } = body;

    switch (action) {
        case 'create':
            return createProposal(body);

        case 'close':
            return closeProposal(body);

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
        sourceAccountId,
        nonceAccountId,
        proposalSecret,
        turretSigners,
        daoTomlHost,
        proposalLink
    } = body

    // load and parse dao.toml
    const daoTomlStr = await fetchDAOToml(daoTomlHost);
    var toml = require('toml');
    var daoTomlData = toml.parse(daoTomlStr);
    //console.dir(daoTomlData);

    // validate dao.toml data
    if (!daoTomlData.PROPOSAL_VOTING_TOKEN) {
        throw {
            message: 'Invalid dao toml, missing PROPOSAL_VOTING_TOKEN'
        }
    }

    let assetParts = daoTomlData.PROPOSAL_VOTING_TOKEN.split(':').map(function(item) {
        return item.trim();
    });

    if (assetParts.length != 2) {
        throw {
            message: 'Invalid dao toml, invalid voting token.'
        }
    }

    daoVotingToken = new Asset(assetParts[0], assetParts[1]);

    if (!daoTomlData.CREATE_PROPOSAL_BOND) {
        throw {
            message: 'Invalid dao toml, missing CREATE_PROPOSAL_BOND'
        }
    }

    const daoBondAmount = parseFloat(daoTomlData.CREATE_PROPOSAL_BOND) || 0.0;
    if (daoBondAmount <= 0.0) {
        throw {
            message: 'invalid doa toml. invalid CREATE_PROPOSAL_BOND'
        }
    }

    let daoQuorumStatic;
    if (daoTomlData.QUORUM_STATIC) {
        const daoQuorumStaticFloat = parseFloat(daoTomlData.QUORUM_STATIC) || 0.0;
        if (daoQuorumStaticFloat <= 0.0) {
            throw {
                message: 'invalid doa toml. invalid QUORUM_STATIC'
            }
        }
        daoQuorumStatic = daoQuorumStaticFloat;
    }

    if (daoTomlData.QUORUM_PERCENT_CIRCULATION) {
        throw {
            message: 'invalid doa toml. QUORUM_PERCENT_CIRCULATION is not supported yet. Use QUORUM_STATIC instead.'
        }
    }

    //let daoNonVotingAccounts = daoTomlData.NON_VOTING_ACCOUNTS;

    if (!daoTomlData.MIN_VOTING_DURATION_SECONDS) {
        throw {
            message: 'Invalid dao toml, missing MIN_VOTING_DURATION_SECONDS'
        }
    }

    const daoVotingDurationSeconds = parseInt(daoTomlData.MIN_VOTING_DURATION_SECONDS) || 0;
    if (daoVotingDurationSeconds <= 0) {
        throw {
            message: 'invalid doa toml. invalid MIN_VOTING_DURATION_SECONDS'
        }
    }

    let daoRescueSigners = daoTomlData.PROPOSAL_ACCOUNT_RESCUE_SIGNERS;
    if (!daoRescueSigners) {
        throw {
            message: 'Invalid dao toml, missing PROPOSAL_ACCOUNT_RESCUE_SIGNERS'
        }
    }

    if (daoRescueSigners.length != 3) {
        throw {
            message: 'Invalid number of rescue signers in dao.toml. DAO must provide 3 rescue signers.'
        }
    }

    let daoPublicKey = daoTomlData.DAO_PUBLIC_KEY;

    if (!daoPublicKey) {
        throw {
            message: 'Invalid dao toml, missing DAO_PUBLIC_KEY.'
        }
    }

    if (!daoPublicKey.startsWith("G")) {
        throw {
            message: 'Invalid dao toml, invalid DAO_PUBLIC_KEY. Must start with G'
        }
    }

    let daoSignature = daoTomlData.SIGNATURE;
    if (!daoSignature) {
        throw {
            message: 'Invalid dao toml, missing SIGNATURE.'
        }
    }
    // todo: validate signature

    // load and parse proposal data
    const proposalTomlStr = await fetchToml(proposalLink);
    var proposalTomlData = toml.parse(proposalTomlStr);
    //console.dir(proposalTomlData);

    if (!proposalTomlData.PROPOSAL_VOTING_TOKEN) {
        throw {
            message: 'Invalid proposal toml, missing PROPOSAL_VOTING_TOKEN'
        }
    }

    assetParts = proposalTomlData.PROPOSAL_VOTING_TOKEN.split(':').map(function(item) {
        return item.trim();
    });

    if (assetParts.length != 2) {
        throw {
            message: 'Invalid proposal toml, invalid voting token.'
        }
    }

    let proposalVotingToken = new Asset(assetParts[0], assetParts[1]);

    if (proposalVotingToken.code != daoVotingToken.code || proposalVotingToken.issuer != daoVotingToken.issuer) {
        throw {
            message: 'Invalid proposal toml, invalid voting token. Voting token must be the same as in dao.toml.'
        }
    }

    if (!proposalTomlData.PROPOSAL_DURATION_SECONDS) {
        throw {
            message: 'Invalid dao proposal, missing PROPOSAL_DURATION_SECONDS'
        }
    }

    const proposalVotingDurationSeconds = parseInt(proposalTomlData.PROPOSAL_DURATION_SECONDS) || 0;
    if (proposalVotingDurationSeconds <= 0) {
        throw {
            message: 'invalid proposal toml, invalid PROPOSAL_DURATION_SECONDS'
        }
    }

    if (proposalVotingDurationSeconds < daoVotingDurationSeconds) {
        throw {
            message: 'invalid proposal toml, PROPOSAL_DURATION_SECONDS < dao.toml:MIN_VOTING_DURATION_SECONDS'
        }
    }

    let proposalQuorumStatic;
    if (proposalTomlData.QUORUM_STATIC) {
        const proposalQuorumStaticFloat = parseFloat(daoTomlData.QUORUM_STATIC) || 0.0;
        if (proposalQuorumStaticFloat <= 0.0) {
            throw {
                message: 'invalid proposal toml. invalid QUORUM_STATIC'
            }
        }
        proposalQuorumStatic = proposalQuorumStaticFloat;
    }

    if (proposalQuorumStatic != daoQuorumStatic) {
        throw {
            message: 'invalid proposal toml. QUORUM_STATIC must equal to dao.toml:QUORUM_STATIC.'
        }
    }

    let proposalVotingOptions = proposalTomlData.PROPOSAL_VOTING_OPTIONS;
    if (!proposalVotingOptions) {
        throw {
            message: 'Invalid proposal toml, missing PROPOSAL_VOTING_OPTIONS'
        }
    }

    if (proposalVotingOptions.length < 2) {
        throw {
            message: 'Invalid number of options in proposal data (min 2).'
        }
    }
    const nrOfVotingOptions = proposalVotingOptions.length;

    const proposalKeypair = Keypair.fromSecret(proposalSecret);
    const proposalAccountId = proposalKeypair.publicKey();

    const turretContractSigners = turretSigners.split(',').map(function(item) {
        return item.trim();
    });

    if (turretContractSigners.length != 5) {
        throw {
            message: 'Invalid nr of turret signers. Please provide 5 turret signers.'
        }
    }

    const fee = await getFee();

    const sourceAccount = await server.loadAccount(sourceAccountId);

    // validate source account
    const sourceNativeBalance = parseFloat(sourceAccount.balances.find(b => b.asset_type == 'native').balance);

    const votingTokenBalanceLine = sourceAccount.balances.find(b => (b.asset_code == proposalVotingToken.code && b.asset_issuer == proposalVotingToken.issuer));
    if (!votingTokenBalanceLine) {
        throw {
            message: 'Invalid source account. Account has no voting tokens trustline.'
        }
    }
    const sourceVotingTokenBalance = parseFloat(votingTokenBalanceLine.balance);

    if (sourceVotingTokenBalance < daoBondAmount) {
        throw {
            message: 'Invalid source account. Insufficient voting tokens required for bond.'
        }
    }

    const nonceAccount = await server.loadAccount(nonceAccountId);

    // validate nonce account
    for (const turretSigner of turretContractSigners) {
        const signer = nonceAccount.signers.find(s => s.key == turretSigner);
        if (!signer) {
            throw {
                message: 'Invalid nonce account. Turret signer missing.'
            }
        }
        if (signer.weight != 1) {
            throw {
                message: 'Invalid nonce account. Turret signer weight must be 1.'
            }
        }
    }

    const nonceMasterSigner = nonceAccount.signers.find(s => s.key == nonceAccountId);

    if (nonceMasterSigner.weight != 0) {
        throw {
            message: 'Invalid nonce account. Master signer weight must be 0.'
        }
    }

    if (nonceAccount.thresholds.low_threshold != 3 ||
        nonceAccount.thresholds.med_threshold != 3 ||
        nonceAccount.thresholds.high_threshold != 3) {
        throw {
            message: 'Invalid nonce account. Invalid threshold value. Must be 3.'
        }
    }

    let transaction = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    // create proposal account
    transaction.addOperation(Operation.createAccount({
        destination: proposalAccountId,
        startingBalance: "" + 10
    }));

    // set status of the proposal account
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "status",
        value: "active"
    }));

    // add pointer to proposal data
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "proposalDataLink",
        value: proposalLink
    }));

    // add hash of proposal data
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "proposalDataHash",
        value: "todo"
    }));

    transaction.addOperation(Operation.payment({
        source: nonceAccountId,
        destination: proposalAccountId,
        asset: Asset.native(),
        amount: '0.01'
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

    // add rescue signers to proposal account
    for (const rescueSigner of daoRescueSigners) {
        transaction.addOperation(Operation.setOptions({
            source: proposalAccountId,
            signer: {
                ed25519PublicKey: rescueSigner,
                weight: 1
            }
        }));
    }

    // remove the master key as a signer
    // set thresholds
    transaction.addOperation(Operation.setOptions({
        source: proposalAccountId,
        masterWeight: 0,
        lowThreshold: 3,
        medThreshold: 3,
        highThreshold: 3
    }));

    // trust voting token.
    transaction.addOperation(Operation.changeTrust({
        source: proposalAccountId,
        asset: proposalVotingToken
    }));

    // offer tokens for voting
    for (let i = 0; i < nrOfVotingOptions; i++) {
        const assetCode = 'OPTION' + (i + 1);
        transaction.addOperation(Operation.manageSellOffer({
            source: proposalAccountId,
            selling: new Asset(assetCode, proposalAccountId),
            buying: proposalVotingToken,
            amount: "100000000000",
            price: 1
        }));
    }
    return transaction.setTimeout(0).build().toXDR('base64');
};

/* must be updated for current concept version
async function closeProposal(body) {
    const {
        source,
        proposalAccountId
    } = body

    const proposalAccount = await server.loadAccount(proposalAccountId);

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

    // read voting token
    let votingToken;
    if (typeof proposalAccount.data_attr.votingToken !== "undefined") {
        const votingTokenStr = Buffer.from(proposalAccount.data_attr.votingToken, 'base64').toString('utf-8');
        const assetParts = votingTokenStr.split(':').map(function(item) {
            return item.trim();
        });
        if (assetParts.length != 2) {
            throw {
                message: 'invalid proposal account, invalid voting token.'
            }
        }
        votingToken = new Asset(assetParts[0], assetParts[1]);
    } else {
        throw {
            message: 'invalid proposal account, missing voting token data entry.'
        }
    }
    // load all offers to be removed
    const offers = new Array();
    page = await server.offers().forAccount(proposalAccountId).call();
    while (true) {
        if (typeof page === "undefined" ||
            typeof page.records === "undefined" ||
            page.records.length == 0) {
            break;
        }
        for (let i = 0; i < page.records.length; i++) {
            offers.push(page.records[i]);
            if (page.records[i].buying.asset_code != votingToken.code &&
                page.records[i].buying.asset_issuer != votingToken.issuer) {
                throw {
                    message: 'invalid offer found for proposal account. offer must be buying voting token saved in data entry.'
                }
            }
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
        value: "closed"
    }));

    const closeTime = Math.floor(Date.now() / 1000);
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "closeTime",
        value: "" + closeTime
    }));

    transaction.addOperation(Operation.endSponsoringFutureReserves({
        source: proposalAccountId
    }));

    // remove existing offers
    for (let i = 0; i < offers.length; i++) {
        transaction.addOperation(Operation.manageSellOffer({
            source: proposalAccountId,
            selling: new Asset(offers[i].selling.asset_code, offers[i].selling.asset_issuer),
            buying: votingToken,
            amount: "0",
            price: 1,
            offerId: offers[i].id
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

    // check if proposal is active
    if (typeof proposalAccount.data_attr.status !== "undefined") {
        const status = Buffer.from(proposalAccount.data_attr.status, 'base64').toString('utf-8');
        if (status !== "closed") {
            throw {
                message: 'proposal status not closed'
            }
        }
    } else {
        throw {
            message: 'invalid proposal account, missing status data entry.'
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

    // read voting token
    let votingToken;
    if (typeof proposalAccount.data_attr.votingToken !== "undefined") {
        const votingTokenStr = Buffer.from(proposalAccount.data_attr.votingToken, 'base64').toString('utf-8');
        const assetParts = votingTokenStr.split(':').map(function(item) {
            return item.trim();
        });
        if (assetParts.length != 2) {
            throw {
                message: 'invalid proposal account, invalid voting token.'
            }
        }
        votingToken = new Asset(assetParts[0], assetParts[1]);
    } else {
        throw {
            message: 'invalid proposal account, missing voting token data entry.'
        }
    }

    // find voting options that reached the quorum
    const assets = new Array();
    const quorumReachedAssets = new Array();
    let page = await server.assets().forIssuer(proposalAccountId).call();
    while (true) {
        if (typeof page === "undefined" ||
            typeof page.records === "undefined" ||
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

    let winnerOption = -1;

    if (quorumReachedAssets.length != 0) {
        // find winner option
        quorumReachedAssets.sort((a, b) => (a.amount > b.amount) ? 1 : ((b.amount > a.amount) ? -1 : 0))

        const winner = quorumReachedAssets[quorumReachedAssets.length - 1];

        if (!winner.asset_code.startsWith("OPTION") || !winner.length > 6) {
            throw {
                message: 'invalid option token.'
            }
        }

        winnerOption = parseInt(winner.asset_code.substr(6) || -1);

        if (winnerOption < 0) {
            throw {
                message: 'invalid option token.'
            }
        }
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

    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "winnerOption",
        value: "" + winnerOption
    }));

    transaction.addOperation(Operation.endSponsoringFutureReserves({
        source: proposalAccountId
    }));

    // add sell offers for voting tokens collected.
    for (let i = 0; i < assets.length; i++) {
        transaction.addOperation(Operation.manageSellOffer({
            source: proposalAccountId,
            selling: votingToken,
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

*/

function getFee() {
    return server
        .feeStats()
        .then((feeStats) => feeStats?.fee_charged?.max || 100000)
        .catch(() => 100000)
};

/*function accountHasSigner(account, signer) {
    for (let i = 0; i < account.signers.length; i++) {
        if (account.signers[i].key == signer) {
            return true;
        }
    }
    return false;
};*/

async function fetchDAOToml(host) {
    const urlToml = host + '/.well-known/dao.toml';
    return fetchToml(urlToml)
};

async function fetchToml(url) {
    var fetch = require('node-fetch');

    const response = await fetch(url)
        .then(async (res) => {
            if (res.ok)
                return res.text()
            else
                throw await res.text()
        })

    return response
};