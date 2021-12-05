# POC for DAO governance based on stellar smart contracts

This repository will hold a Proof of Concept for DAO governance based on Stellar. It is created in collaboration of Instant DAO and The Turrets DAO.

Currently it contains one smart contract that will be upladed on 5 different turret servers. The smart contract is work in progress.

Following chapters describe the process we have come up with for this prototype. Depending on progress, we will adjust it accordingly.

The process is made up of four actions : 
 
- ***create*** *proposal*

- ***close*** *proposal*

- ***tally*** *proposal*

- ***execute*** *proposal*

The smart contract implements these four actions. When executed, the desired action is specified via the parameter ```action```.

## Create proposal

To create a new proposal the user has to execute the smart contract with the action parameter set to ```action='create'```. 

Other **parameters** are:

- account id of the source account that will fund the create proposal process - see [source accout](#source-account-to-create-a-proposal)
- a secret seed for a proposal account that does not yet exist and should be created - see [proposal account](#seed-for-the-proposal-account)
- a link to the general dao specifications for proposals - see [dao data specification](#dao-specifications-for-proposals)
- a link to the specific configuration of the proposal - see [proposal data specification](#specification-of-the-proposal)
- a list of 5 turret signers on which this contract is run and which are responsible for signing further steps (close, tally, execute) - see [turret signers](#turret-signers).

The **XDR** resulting from the execution of the contract is signed by the turret servers and has to be also signed by the user with the seed of the proposal account before submitted to the stellar network.  


### Source account to create a proposal

The source account must be controlled by the 5 turret signers provided as a prameter to the create proposal action of the smart contract.

- *master key weight*: 0
- *all thresholds*: 3
- *signers*: the 5 turret signers, each having a weight of 1
- *balance*: tbd - approx 5-10 XLM to be able to finance the creation of the proposal

### Seed for the proposal account

It should be a random secret seed of an account that does not yet exist and is yet to be created. It is used for creating a proposal account. The smart contract cannot create its own, because it runs on 5 different turret servers and each server would generate a different secret seed. But don't worry, the master key of this account will be set to a weight of 0. So the seed is only needed for the creation of the account, but has no further signing possibilities.

### DAO specifications for proposals

The specifications are stored in a separate file. It must be located under <doa-domain>/.well-known/dao.toml with CORS enabled. 

It is a toml file and must contain the following data fields:

| Field name | Mandatory | Description |
| :--- | :--- | :--- |
| VERSION| required |Version number of this data format. Currently 0.0.1|
| DAO_NAME| required |The name of the DAO (e.g "The Turrets DAO").|
| DAO_DESCRIPTION| required |Description of the DAO. (e.g. its mission)|
| DAO_OFFICIAL_EMAIL| required |Contact email address.|
| DAO_URL| required |Link to the official home page of the DAO.|
| PROPOSAL_VOTING_TOKEN| required |Canonical form of the token to be used for votion on proposals. (e.g. "GOV:GBNOMH3B6BIQE65TZVVBNOCTMLN7MYORU5GX6YNBX5YBGCI45R2EMGOV")|
| MIN_VOTING_POWER_CREATE_PROPOSAL| required |The minimum amount of voting tokens the creator of the proposal must have to be allowed to create the proposal.|
| MIN_VOTING_POWER_CREATE_QUORUM| required |The minimum amount of voting tokens one option of the proposal must have to win the proposal.|
| MIN_VOTING_POWER_CREATE_QUORUM| required |The minimum amount of tokens an option must receive to win the proposal.|
| MIN_VOTING_DURATION_SECONDS| required |The minimum number of seconds that a proposal must be active.|
| PROPOSAL_ACCOUNT_RESCUE_SIGNERS| required |A list of 3 signers that can be used by the DAO to control a proposal account in case of emergency.|
| DAO_PUBLIC_KEY| required |The DAO public key used to sign the fields of this file (shown above)|
| SIGNATURE| required |The signature resulting from signing the data with the DAO public key.|

Example:

```
VERSION="0.0.1"
DAO_NAME="Test DAO"
DAO_DESCRIPTION="A DAO for testing stuff"
DAO_OFFICIAL_EMAIL="hi@testdao.org"
DAO_URL="https://testdao.org"
DAO_VOTING_TOKEN="GOV:GBNOMH3B6BIQE65TZVVBNOCTMLN7MYORU5GX6YNBX5YBGCI45R2EMGOV"
MIN_VOTING_POWER_CREATE_PROPOSAL="100"
MIN_VOTING_POWER_CREATE_QUORUM="40000"
MIN_VOTING_DURATION_SECONDS="300"
PROPOSAL_ACCOUNT_RESCUE_SIGNERS=[
"GCBY2B7KKVE4T66B4ZECNLOYT3Y772GHJTATP33IDUSYXTZSJNNYRWX5",
"GAA72JLMNMAIZ44XYYNKACANN6THCU7MLKB4M3YDFOHI4IEU4PLTDLLY",
"GDUGCQEZ5XOCZ6MDXI44ZALD4GDJBHE6XZAXPRB7DTGJ6O2S76VG7FML"
]
DAO_PUBLIC_KEY="GAZZWLZCTLL2GMEICJWMGF4T3BDE6QTQEQDCBKJGXKUUD3D66THAGDAO"
SIGNATURE="..."
```

### Specification of the proposal

The specifications are stored in a separate file.  The file must be stored and made available for access by the smart contract via a link (e.g. IPFS). The content of the file must not be changed after the creation of the proposal. This is ensured by a hash that is stored in the proposal account data. A link to the proposal specifications is passed as a parameter for each action of the contract (create, close, tally, execute). The integrity of the content is then checked in the smart contract based on the hash stored in the proposal account.

It is a toml file and must contain the following data fields:

| Field name | Mandatory | Description |
| :--- | :--- | :--- |
| VERSION| required |Version number of this data format. Currently 0.0.1|
| PROPOSAL_NAME| required |Name of the proposal to be displayed to the voter.|
| PROPOSAL_DESCRIPTION| required |Description of the proposal to be displayed to the voter. markdown|
| PROPOSAL_CONTACT_EMAIL| required |Contact email address of the creator of this proposal.|
| PROPOSAL_DISCUSSION_LINK| required |Link to the official discussion forum for this proposal (e.g. link to discord server)|
| PROPOSAL_QUORUM_CRITERIA| optional |fixed or dynamic (tbd)|
| PROPOSAL_VOTING_OPTIONS| required |The voting options|

Each votin option must contain following data fields

| Field name | Mandatory | Description |
| :--- | :--- | :--- |
| TITLE| required |Title of the voting option.|
| DESCRIPTION| required |Description of the voting option to be displayed to the voter.|
| XDR| required |The xdr to be signed by the turret signers in case the option has won the election. It will be signed in the ```execute``` action step.|

Example:

```
VERSION="0.0.1"
PROPOSAL_NAME="Test Proposal"
PROPOSAL_DESCRIPTION="The description of this proposal"
PROPOSAL_CONTACT_EMAIL="hi@testdao.org"
PROPOSAL_DISCUSSION_LINK="https://testdao.org"
PROPOSAL_VOTING_TOKEN="GOV:GBNOMH3B6BIQE65TZVVBNOCTMLN7MYORU5GX6YNBX5YBGCI45R2EMGOV"
PROPOSAL_QUORUM_CRITERIA="fixed"
[[PROPOSAL_VOTING_OPTIONS]]
label="one"
value="vote for one"
xdr="AAAAAgAAAAAzmy8imtejMIgSbMMXk9hGT0JwJAYgqSa6qUHsfvTOAwAAAGQAFDXMAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAABjI7vSXjmgz0+a3XZS/qPXSjVpkiTnnDovaOi12CdJ2AAAAAAAAAAABfXhAAAAAAAAAAAA"
[[PROPOSAL_VOTING_OPTIONS]]
label="one"
value="vote for one"
xdr="AAAAAgAAAAAzmy8imtejMIgSbMMXk9hGT0JwJAYgqSa6qUHsfvTOAwAAAGQAFDXMAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAABjI7vSXjmgz0+a3XZS/qPXSjVpkiTnnDovaOi12CdJ2AAAAAAAAAAAC+vCAAAAAAAAAAAA"
```

### Turret signers

The smart contract must be uploaded to 5 turret servers. When uploading, a specific sigener for the contract is returned from each turret server. With this signer the turret server signs the resulting xdr as soon as the smart contract is executed. The 5 signers must be passed as parameters to the smart contract when creating the proposal, so that they can be set as signers of the proposal account.

### Contract logic of the create proposal action

#### 1. validate parameters and data
#### 2. create xdr based on data provided by the parameters
#### 2.a. create the proposal account having
- *signers*: 5 turret signers provided by parameter and 3 DAO rescue signers from dao.toml:PROPOSAL_ACCOUNT_RESCUE_SIGNERS, each having a weight of 1
- *master key weight*: 0
- *thresholds*: all set to 3
- *data entries*: ```staus="active"```, ```proposal_data_hash="..."```
#### 2.b. create an selling offer for each proposal option
- *selling*: "OPTION[x]:proposal_account_id" tokens 
- *buying*: voting tokens asspecifield in dao.toml (PROPOSAL_VOTING_TOKEN)
- *amount*: max
- *price:* 1.0


## Close proposal

To close a proposal the user has to execute the smart contract with the action parameter set to ```action='close'```. 

Other **parameters** are:
- account id of the source account used to finance this operation (executors account)
- proposal account id - see [create proposal](#-create-proposal)
- a link to the specific configuration of the proposal - see [proposal data specification](#specification-of-the-proposal)

The **XDR** resulting from the execution of the contract is signed by the turret servers and has to be also signed by the user with the signer(s) of the source account before submitted to the stellar network.  

### Contract logic of the close proposal action

#### 1. validate parameters and data
#### 2. delete offers if the proposal can be closed (check duration)
#### 3. set status to closed in data entry of proposal account

## Test curretnt version
You can find a description here on how to [test the smart contract locally](smart-contracts/).
