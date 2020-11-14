const { expectRevert, time } = require('@openzeppelin/test-helpers')
const Contract = require('@truffle/contract')
const Sav3Token = artifacts.require('Sav3Token')
const ERC20 = artifacts.require('ERC20')
const UniswapRouter = Contract({abi: require('@uniswap/v2-periphery/build/UniswapV2Router02').abi})
UniswapRouter.setProvider(web3.currentProvider)
const UniswapFactory = Contract({abi: require('@uniswap/v2-core/build/IUniswapV2Factory').abi})
UniswapFactory.setProvider(web3.currentProvider)

const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

const getBalance = async (address) => {
    return (await this.sav3Token.balanceOf(address)).toString()
}

const getWethBalance = async (address) => {
    return (await this.weth.balanceOf(address)).toString()
}

const getLockedBalances = async () => {
    const balances = {}
    balances.lockableSupply = (await this.sav3Token.lockableSupply()).toString()
    balances.lockableSupplyBalanceOf = await getBalance(this.sav3Token.address)
    balances.lockedSupply = (await this.sav3Token.lockedSupply()).toString()
    balances.burnedSupply = (await this.sav3Token.burnedSupply()).toString()
    balances.lockedLiquidity = (await this.sav3Token.lockedSupply()).toString()
    balances.uniswapPairBalance = await getBalance(this.uniswapPairAddress)
    balances.uniswapWethPairBalance = await getWethBalance(this.uniswapPairAddress)
    balances.burnableLiquidity = (await this.sav3Token.burnableLiquidity()).toString()
    balances.burnedLiquidity = (await this.sav3Token.burnedLiquidity()).toString()
    balances.lockedLiquidity = (await this.sav3Token.lockedLiquidity()).toString()
    return balances
}

// only run this test on forked network
contract.skip('Sav3Token', ([_, adminAddress, crowdsaleWalletAddress, crowdsaleContractAddress, user1Address, user2Address, user3Address, user4Address, user5Address]) => {
    this.userAddresses = [user1Address, user2Address, user3Address, user4Address, user5Address]
    beforeEach(async () => {
        // create token
        this.sav3Token = await Sav3Token.new({from: adminAddress})
        await this.sav3Token.addMinter(crowdsaleContractAddress, {from: adminAddress})
        await this.sav3Token.renounceMinter({from: adminAddress})
        this.sav3Token.setUniswapV2Router(uniswapRouterAddress, {from: adminAddress})
        const mintedTokens = '1000000000000000000000'
        this.sav3Token.mint(user1Address, mintedTokens, {from: crowdsaleContractAddress})
        this.sav3Token.mint(user2Address, mintedTokens, {from: crowdsaleContractAddress})
        this.sav3Token.mint(user3Address, mintedTokens, {from: crowdsaleContractAddress})
        this.sav3Token.mint(user4Address, mintedTokens, {from: crowdsaleContractAddress})
        await this.sav3Token.mint(user5Address, mintedTokens, {from: crowdsaleContractAddress})
        await this.sav3Token.setLiquidityLockDivisor(10, {from: adminAddress})

        // create uniswap
        this.uniswapRouter = await UniswapRouter.at(uniswapRouterAddress)
        const uniswapFactoryAddress = await this.uniswapRouter.factory()
        this.uniswapFactory = await UniswapFactory.at(uniswapFactoryAddress)
        this.sav3Token.approve(this.uniswapRouter.address, mintedTokens, {from: user1Address})
        this.sav3Token.approve(this.uniswapRouter.address, mintedTokens, {from: user2Address})
        this.sav3Token.approve(this.uniswapRouter.address, mintedTokens, {from: user3Address})
        this.sav3Token.approve(this.uniswapRouter.address, mintedTokens, {from: user4Address})
        await this.sav3Token.approve(this.uniswapRouter.address, mintedTokens, {from: user5Address})

        // add initial liq and create pair
        const amountTokenDesired = '100000000000000000000'
        const minAmountForSlippage = 0
        const deadline = Number((await time.latest()).toString()) + (60 * 60)
        await this.uniswapRouter.addLiquidityETH(
            this.sav3Token.address,
            amountTokenDesired,
            minAmountForSlippage,
            minAmountForSlippage,
            user1Address,
            deadline,
            {value: '1000000000000000000', from: user1Address}
        )

        // pair created
        const wethAddress = await this.uniswapRouter.WETH()
        this.weth = await ERC20.at(wethAddress)
        this.uniswapPairAddress = await this.uniswapFactory.getPair(wethAddress, this.sav3Token.address)
        await this.sav3Token.setUniswapV2Pair(this.uniswapPairAddress, {from: adminAddress})
    })

    it('lock liquidity', async () => {
        const amount = '10000000000000000000'
        let balancesBeforeLock, balancesAfterLock, balancesAfterBurn

        // some liquidity rewards
        await this.sav3Token.setLiquidityRewardsDivisor(2, {from: adminAddress})

        // do transfers
        await this.sav3Token.transfer(user2Address, amount, {from: user3Address})
        await this.sav3Token.transfer(user5Address, amount, {from: user1Address})
        await this.sav3Token.transfer(user4Address, amount, {from: user2Address})
        await this.sav3Token.transfer(user4Address, amount, {from: user5Address})
        await this.sav3Token.transfer(user3Address, amount, {from: user2Address})

        // test reverts
        await expectRevert(
            this.sav3Token.lockLiquidity(0, {from: user1Address}), 
            'ERC20TransferLiquidityLock::lockLiquidity: lock amount cannot be 0'
        )
        const lockableSupplyPlus1 = (await this.sav3Token.lockableSupply()).add(web3.utils.toBN(1))
        await expectRevert(
            this.sav3Token.lockLiquidity(lockableSupplyPlus1.toString(), {from: user1Address}), 
            'ERC20TransferLiquidityLock::lockLiquidity: lock amount higher than lockable balance'
        )

        // lock liquidity
        balancesBeforeLock = await getLockedBalances()
        await this.sav3Token.lockLiquidity(balancesBeforeLock.lockableSupply, {from: user1Address})
        balancesAfterLock = await getLockedBalances()

        // burn liquidity
        await this.sav3Token.burnLiquidity({from: user1Address})
        balancesAfterBurn = await getLockedBalances()

        // assert
        assert.deepEqual(balancesBeforeLock, {
            lockableSupply: '15000000000000000000',
            lockableSupplyBalanceOf: '15000000000000000000',
            lockedSupply: '0',
            burnedSupply: '0',
            lockedLiquidity: '1000',
            uniswapPairBalance: '90000000000000000000',
            uniswapWethPairBalance: '1000000000000000000',
            burnableLiquidity: '0',
            burnedLiquidity: '1000'
        })
        assert.deepEqual(balancesAfterLock, {
            lockableSupply: '0',
            lockableSupplyBalanceOf: '0',
            lockedSupply: '3749999999970000000',
            burnedSupply: '0',
            lockedLiquidity: '351364184463154253',
            uniswapPairBalance: '105000000000000000000',
            uniswapWethPairBalance: '998739228912951919',
            burnableLiquidity: '351364184463153253',
            burnedLiquidity: '1000'
        })
        assert.deepEqual(balancesAfterBurn, { 
            lockableSupply: '0',
            lockableSupplyBalanceOf: '0',
            lockedSupply: '3749999999970000000',
            burnedSupply: '3749999999970000000',
            lockedLiquidity: '351364184463154253',
            uniswapPairBalance: '105000000000000000000',
            uniswapWethPairBalance: '998739228912951919',
            burnableLiquidity: '0',
            burnedLiquidity: '351364184463154253'
        })

        // no liquidity rewards
        await this.sav3Token.setLiquidityRewardsDivisor(0, {from: adminAddress})

        // do transfers
        await this.sav3Token.transfer(user2Address, amount, {from: user3Address})
        await this.sav3Token.transfer(user5Address, amount, {from: user1Address})
        await this.sav3Token.transfer(user4Address, amount, {from: user2Address})
        await this.sav3Token.transfer(user4Address, amount, {from: user5Address})
        await this.sav3Token.transfer(user3Address, amount, {from: user2Address})

        // lock liquidity
        balancesBeforeLock = await getLockedBalances()
        await this.sav3Token.lockLiquidity(balancesBeforeLock.lockableSupply, {from: user1Address})
        balancesAfterLock = await getLockedBalances()

        // burn liquidity
        await this.sav3Token.burnLiquidity({from: user1Address})
        balancesAfterBurn = await getLockedBalances()

        // assert
        assert.deepEqual(balancesBeforeLock, {
            lockableSupply: '5000000000000000000',
            lockableSupplyBalanceOf: '5000000000000000000',
            lockedSupply: '3749999999970000000',
            burnedSupply: '3749999999970000000',
            lockedLiquidity: '351364184463154253',
            uniswapPairBalance: '105000000000000000000',
            uniswapWethPairBalance: '998739228912951919',
            burnableLiquidity: '0',
            burnedLiquidity: '351364184463154253'
        })
        assert.deepEqual(balancesAfterLock, {
            lockableSupply: '0',
            lockableSupplyBalanceOf: '0',
            lockedSupply: '6339285714190000000',
            burnedSupply: '3839285714220000000',
            lockedLiquidity: '580159467369393575',
            uniswapPairBalance: '110000000000000000000',
            uniswapWethPairBalance: '998268724551975311',
            burnableLiquidity: '228795282906239322',
            burnedLiquidity: '351364184463154253'
        })
        assert.deepEqual(balancesAfterBurn, { 
            lockableSupply: '0',
            lockableSupplyBalanceOf: '0',
            lockedSupply: '6339285714190000000',
            burnedSupply: '6339285714190000000',
            lockedLiquidity: '580159467369393575',
            uniswapPairBalance: '110000000000000000000',
            uniswapWethPairBalance: '998268724551975311',
            burnableLiquidity: '0',
            burnedLiquidity: '580159467369393575'
        })

        // only liquidity rewards
        await this.sav3Token.setLiquidityRewardsDivisor(1, {from: adminAddress})

        // do transfers
        await this.sav3Token.transfer(user2Address, amount, {from: user3Address})
        await this.sav3Token.transfer(user5Address, amount, {from: user1Address})
        await this.sav3Token.transfer(user4Address, amount, {from: user2Address})
        await this.sav3Token.transfer(user4Address, amount, {from: user5Address})
        await this.sav3Token.transfer(user3Address, amount, {from: user2Address})

        // lock liquidity
        balancesBeforeLock = await getLockedBalances()
        // await this.sav3Token.lockLiquidity(balancesBeforeLock.lockableSupply, {from: user1Address})
        // use rewardLiquidityProviders which does the same thing to test it
        await this.sav3Token.rewardLiquidityProviders();
        balancesAfterLock = await getLockedBalances()

        // burn liquidity
        await expectRevert(
            this.sav3Token.burnLiquidity({from: user1Address}), 
            'ERC20TransferLiquidityLock::burnLiquidity: burn amount cannot be 0'
        )

        assert.deepEqual(balancesBeforeLock, {
            lockableSupply: '5000000000000000000',
            lockableSupplyBalanceOf: '5000000000000000000',
            lockedSupply: '6339285714190000000',
            burnedSupply: '6339285714190000000',
            lockedLiquidity: '580159467369393575',
            uniswapPairBalance: '110000000000000000000',
            uniswapWethPairBalance: '998268724551975311',
            burnableLiquidity: '0',
            burnedLiquidity: '580159467369393575'
        })
        assert.deepEqual(balancesAfterLock, {
            lockableSupply: '0',
            lockableSupplyBalanceOf: '0',
            lockedSupply: '6627435064835000000',
            burnedSupply: '6627435064835000000',
            lockedLiquidity: '580159467369393575',
            uniswapPairBalance: '115000000000000000000',
            uniswapWethPairBalance: '998268724551975311',
            burnableLiquidity: '0',
            burnedLiquidity: '580159467369393575'
        })
    })
})
