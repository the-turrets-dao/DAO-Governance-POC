const {
    default: BigNumber
} = require('bignumber.js')
const {
    TransactionBuilder,
    Server,
    Networks,
    BASE_FEE,
    Keypair,
    Operation,
    Asset,
    hash
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
                message: 'Invalid action. Options are: create, close, tally and execute.'
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
    const toml = require('toml');
    const daoTomlData = toml.parse(daoTomlStr);
    //console.dir(daoTomlData);

    // verify signature
    const daoSignature = daoTomlData.SIGNATURE;
    if (!daoSignature) {
        throw {
            message: 'Invalid dao toml, missing SIGNATURE.'
        }
    }

    const daoPublicKey = daoTomlData.DAO_PUBLIC_KEY;

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

    const allDaoTomlLines = daoTomlStr.split('\n');
    let linesWithoutSignature = new Array();
    for (const line of allDaoTomlLines) {
        if (!line.startsWith("SIGNATURE")) {
            linesWithoutSignature.push(line);
        }
    }

    const daoTomlDataWithoutSignature = linesWithoutSignature.join('\n');
    const daoDataBuffer = Buffer.from(daoTomlDataWithoutSignature, 'utf8');
    const daoKeyPair = Keypair.fromPublicKey(daoPublicKey);
    const daoSignatureBuffer = Buffer.from(daoSignature, 'base64')
    let signatureValid = false;
    try {
        signatureValid = daoKeyPair.verify(daoDataBuffer, daoSignatureBuffer)
    } catch (error) {
        signatureValid = false;
    }
    if (!signatureValid) {
        throw {
            message: 'Invalid dao toml, invalid SIGNATURE'
        }
    }

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

    const daoRescueSigners = daoTomlData.PROPOSAL_ACCOUNT_RESCUE_SIGNERS;
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

    // load and parse proposal data
    const proposalTomlStr = await fetchToml(proposalLink);
    //const shajs = require('sha.js')
    //const proposalHash =  shajs('sha256').update(proposalTomlStr).digest('hex');
    const proposalHash = hash(Buffer.from(proposalTomlStr, 'utf8')).toString('hex');
    const proposalTomlData = toml.parse(proposalTomlStr);

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

    const proposalVotingToken = new Asset(assetParts[0], assetParts[1]);

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

    const proposalVotingOptions = proposalTomlData.PROPOSAL_VOTING_OPTIONS;
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

    const sourceAccount = await server.loadAccount(sourceAccountId);

    // validate source account
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

    let fee = parseInt(BASE_FEE);
    let transaction = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    const minBalanceOfProposalAccount = ((2 + nrOfVotingOptions + 12) * 0.5);
    // create proposal account
    transaction.addOperation(Operation.createAccount({
        destination: proposalAccountId,
        startingBalance: "" + minBalanceOfProposalAccount
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
        value: proposalHash
    }));

    transaction.addOperation(Operation.payment({
        source: nonceAccountId,
        destination: proposalAccountId,
        asset: Asset.native(),
        amount: '0.01'
    }));

    // let proposal account trust voting token.
    transaction.addOperation(Operation.changeTrust({
        source: proposalAccountId,
        asset: proposalVotingToken
    }));

    //pay bond
    transaction.addOperation(Operation.payment({
        source: sourceAccountId,
        destination: proposalAccountId,
        asset: proposalVotingToken,
        amount: "" + daoBondAmount
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

    const maxBigNumber = new BigNumber(922337203685);
    const offerAmount = maxBigNumber.minus(daoBondAmount).dividedBy(nrOfVotingOptions);

    // offer tokens for voting
    for (let i = 0; i < nrOfVotingOptions; i++) {
        const assetCode = 'OPTION' + (i + 1);
        transaction.addOperation(Operation.manageSellOffer({
            source: proposalAccountId,
            selling: new Asset(assetCode, proposalAccountId),
            buying: proposalVotingToken,
            amount: offerAmount.toString(),
            price: 1
        }));
    }

    return transaction.setTimeout(0).build().toXDR('base64');
};

async function closeProposal(body) {
    const {
        source,
        proposalAccountId,
        proposalLink
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

    // load, parse and verify proposal data
    const proposalTomlStr = await fetchToml(proposalLink);
    const calculatedProposalHash = hash(Buffer.from(proposalTomlStr, 'utf8')).toString('hex');
    if (typeof proposalAccount.data_attr.proposalDataHash !== "undefined") {
        const proposalHashFromAccount = Buffer.from(proposalAccount.data_attr.proposalDataHash, 'base64').toString('utf-8');
        if (calculatedProposalHash != proposalHashFromAccount) {
            throw {
                message: 'invalid proposal data. hash does not match to proposal account entry.'
            }
        }
    } else {
        throw {
            message: 'invalid proposal account, missing proposalDataHash data entry.'
        }
    }

    const toml = require('toml');
    const proposalTomlData = toml.parse(proposalTomlStr);
    const duration = proposalTomlData.PROPOSAL_DURATION_SECONDS;
    if (!duration) {
        throw {
            message: 'Invalid dao proposal, missing PROPOSAL_DURATION_SECONDS'
        }
    }
    const durationSeconds = parseInt(duration) || 0;
    if (durationSeconds <= 0) {
        throw {
            message: 'Invalid dao proposal data PROPOSAL_DURATION_SECONDS <= 0 or invalid.'
        }
    }

    // load current time from last closed ledger to see if the proposal can be closed.
    let page = await server.ledgers().order("desc").limit(1).call();
    if (typeof page === "undefined" ||
        typeof page.records === "undefined" ||
        page.records.length == 0) {
        throw {
            message: 'Error loading last ledger'
        }
    }
    const lastLedger = page.records[0];
    const currentTime = lastLedger.closed_at;
    const currentTimeSeconds = Math.floor(Date.parse(currentTime) / 1000);

    page = await server.payments().forAccount(proposalAccountId).order("asc").call();
    if (typeof page === "undefined" ||
        typeof page.records === "undefined" ||
        page.records.length < 3) { // create_account, payment native from nonce account, payment of bond from creator with voting token.
        throw {
            message: 'Error loading payments for proposal account.'
        }
    }

    const createdAtTimeSeconds = Math.floor(Date.parse(page.records[0].created_at) / 1000);

    // check if endTime is reached.
    if (currentTimeSeconds < createdAtTimeSeconds + durationSeconds) {
        throw {
            message: 'voting time not finished. ' + (createdAtTimeSeconds + durationSeconds - currentTimeSeconds) + ' seconds left.'
        }
    }

    // parse nonce account id to be merged back into the initial source account
    let nonceAccountId = page.records[1].source_account;

    // parse creator account to merge nonce account back into it.
    let creatorAccountId = page.records[2].source_account;

    let bondAmount = page.records[2].amount;

    // read voting token
    if (!proposalTomlData.PROPOSAL_VOTING_TOKEN) {
        throw {
            message: 'Invalid proposal toml, missing PROPOSAL_VOTING_TOKEN'
        }
    }

    const assetParts = proposalTomlData.PROPOSAL_VOTING_TOKEN.split(':').map(function(item) {
        return item.trim();
    });

    if (assetParts.length != 2) {
        throw {
            message: 'Invalid proposal toml, invalid voting token.'
        }
    }

    const votingToken = new Asset(assetParts[0], assetParts[1]);

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

    let fee = parseInt(BASE_FEE);
    let transaction = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    // set status of the proposal account
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "status",
        value: "closed"
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

    // merge nonce account into creator account if creator account and nonce account still exists
    let creatorAccount;
    try {
        creatorAccount = await server.loadAccount(creatorAccountId);
        await server.loadAccount(nonceAccountId);
        transaction.addOperation(Operation.accountMerge({
            source: nonceAccountId,
            destination: creatorAccountId
        }));
    } catch (error) {}

    // send back the bond to the creator account if it exists
    if (creatorAccount) {
        transaction.addOperation(Operation.payment({
            source: proposalAccountId,
            destination: creatorAccountId,
            asset: votingToken,
            amount: bondAmount
        }));
    }
    return transaction.setTimeout(0).build().toXDR('base64');
};

async function tallyProposal(body) {
    const {
        source,
        proposalAccountId,
        proposalLink
    } = body

    const proposalAccount = await server.loadAccount(proposalAccountId);

    // check if proposal is closed
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

    // load, parse and verify proposal data
    const proposalTomlStr = await fetchToml(proposalLink);
    const calculatedProposalHash = hash(Buffer.from(proposalTomlStr, 'utf8')).toString('hex')
    if (typeof proposalAccount.data_attr.proposalDataHash !== "undefined") {
        const proposalHashFromAccount = Buffer.from(proposalAccount.data_attr.proposalDataHash, 'base64').toString('utf-8');
        if (calculatedProposalHash != proposalHashFromAccount) {
            throw {
                message: 'invalid proposal data: hash does not match to proposal account entry.'
            }
        }
    } else {
        throw {
            message: 'invalid proposal account, missing proposalDataHash data entry.'
        }
    }

    const toml = require('toml');
    const proposalTomlData = toml.parse(proposalTomlStr);

    let quorum = 0.0;

    // read quorum static
    const quorumStatic = proposalTomlData.QUORUM_STATIC;
    if (quorumStatic) {
        const quorumStaticFloat = parseFloat(quorumStatic) || 0.0;
        if (quorumStaticFloat <= 0.0) {
            throw {
                message: 'Invalid dao proposal data QUORUM_STATIC <= 0.0 or invalid.'
            }
        }
        quorum = quorumStaticFloat;
    }

    // read voting token
    if (!proposalTomlData.PROPOSAL_VOTING_TOKEN) {
        throw {
            message: 'Invalid proposal toml, missing PROPOSAL_VOTING_TOKEN'
        }
    }

    const assetParts = proposalTomlData.PROPOSAL_VOTING_TOKEN.split(':').map(function(item) {
        return item.trim();
    });

    if (assetParts.length != 2) {
        throw {
            message: 'Invalid proposal toml, invalid voting token.'
        }
    }

    const votingToken = new Asset(assetParts[0], assetParts[1]);

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

    let fee = parseInt(BASE_FEE);
    let transaction = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    let status = winnerOption == -1 ? "failed" : "finished";

    // set status of the proposal account
    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "status",
        value: status
    }));

    if (status === "finished") {

        transaction.addOperation(Operation.beginSponsoringFutureReserves({
            source: source,
            sponsoredId: proposalAccountId
        }));

        transaction.addOperation(Operation.manageData({
            source: proposalAccountId,
            name: "winnerOption",
            value: "" + winnerOption
        }));

        transaction.addOperation(Operation.endSponsoringFutureReserves({
            source: proposalAccountId
        }));
    }

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
        proposalAccountId,
        proposalLink
    } = body

    const proposalAccount = await server.loadAccount(proposalAccountId);

    // check if proposal is finished
    if (typeof proposalAccount.data_attr.status !== "undefined") {
        const status = Buffer.from(proposalAccount.data_attr.status, 'base64').toString('utf-8');
        if (status !== "finished") {
            throw {
                message: 'proposal status not finished'
            }
        }
    } else {
        throw {
            message: 'invalid proposal account, missing status data entry.'
        }
    }

    // load winner option
    let winnerOption = -1;
    if (typeof proposalAccount.data_attr.winnerOption !== "undefined") {
        const winnerOptionStr = Buffer.from(proposalAccount.data_attr.winnerOption, 'base64').toString('utf-8');
        const winnerOptionInt = parseInt(winnerOptionStr) || 0;
        if (winnerOptionInt <= 0) {
            throw {
                message: 'invalid winnerOption in proposal account data entry.'
            }
        }
        winnerOption = winnerOptionInt;
    } else {
        throw {
            message: 'invalid proposal account, missing winnerOption data entry.'
        }
    }

    // load, parse and verify proposal data
    const proposalTomlStr = await fetchToml(proposalLink);
    const calculatedProposalHash = hash(Buffer.from(proposalTomlStr, 'utf8')).toString('hex');
    if (typeof proposalAccount.data_attr.proposalDataHash !== "undefined") {
        const proposalHashFromAccount = Buffer.from(proposalAccount.data_attr.proposalDataHash, 'base64').toString('utf-8');
        if (calculatedProposalHash != proposalHashFromAccount) {
            throw {
                message: 'invalid proposal data. hash does not match to proposal account entry.'
            }
        }
    } else {
        throw {
            message: 'invalid proposal account, missing proposalDataHash data entry.'
        }
    }

    const toml = require('toml');
    const proposalTomlData = toml.parse(proposalTomlStr);
    if (!proposalTomlData.PROPOSAL_VOTING_OPTIONS) {
        throw {
            message: 'Invalid proposal toml, missing PROPOSAL_VOTING_OPTIONS'
        }
    }
    const votingOptions = proposalTomlData.PROPOSAL_VOTING_OPTIONS;

    if (winnerOption - 1 < votingOptions.length) {
        return votingOptions[winnerOption - 1].xdr;
    }
    throw {
        message: 'Invalid winner option ' + winnerOption
    }
};

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