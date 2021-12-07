# Totem Token

Truffle version: 5.4.2

## Install packages

```
npm i
```

## Run tests

```
truffle test
```
Remove migrations files if issues arise (specifically 2_crowdsale.js).

## Gas consumption report

Uncomment the reporter line in the truffle-config.js file to get report on gas consumption after tests

## Get test coverage

```
truffle run coverage
```

## Verify contracts

```
truffle run verify <CONTRACT NAME> --network <NETWORK NAME>
```

```
./scripts/verify.sh
```

## Static security check

```
slither --truffle-version truffle@5.2.4 .
```
