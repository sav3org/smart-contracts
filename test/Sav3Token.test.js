const { expectRevert, time } = require('@openzeppelin/test-helpers')
const Sav3Token = artifacts.require('Sav3Token')

const getLiquidityRewardsDivisor = async () => {
    return (await this.sav3Token.liquidityRewardsDivisor()).toString()
}

const getLiquidityLockDivisor = async () => {
    return (await this.sav3Token.liquidityLockDivisor()).toString()
}

const getBalance = async (address) => {
    return (await this.sav3Token.balanceOf(address)).toString()
}

const getTotalSupply = async () => {
    return (await this.sav3Token.totalSupply()).toString()
}

contract('Sav3Token', ([_, adminAddress, crowdsaleWalletAddress, crowdsaleContractAddress, user1Address, user2Address, user3Address, user4Address, user5Address]) => {
    beforeEach(async () => {
        this.sav3Token = await Sav3Token.new({from: adminAddress})
        await this.sav3Token.addMinter(crowdsaleContractAddress, {from: adminAddress})
        await this.sav3Token.renounceMinter({from: adminAddress})
    })

    it('should set divisors', async () => {
        // default liquidity lock divisor is 0
        assert.equal(0, await getLiquidityLockDivisor())

        // non admin cannot set
        await expectRevert(
            this.sav3Token.setLiquidityLockDivisor(40, {from: user1Address}),
            'WhitelistAdminRole: caller does not have the WhitelistAdmin role',
        )
        await expectRevert(
            this.sav3Token.setLiquidityRewardsDivisor(2, {from: user1Address}),
            'WhitelistAdminRole: caller does not have the WhitelistAdmin role',
        )

        // divisor smaller than minimum
        await expectRevert(
            this.sav3Token.setLiquidityLockDivisor(3, {from: adminAddress}),
            'Sav3Token::setLiquidityLockDivisor: too small',
        )
        await expectRevert(
            this.sav3Token.setLiquidityLockDivisor(9, {from: adminAddress}),
            'Sav3Token::setLiquidityLockDivisor: too small',
        )

        // set it properly
        await this.sav3Token.setLiquidityLockDivisor(40, {from: adminAddress})
        assert.equal(40, await getLiquidityLockDivisor())
        await this.sav3Token.setLiquidityLockDivisor(10, {from: adminAddress})
        assert.equal(10, await getLiquidityLockDivisor())
        await this.sav3Token.setLiquidityLockDivisor(0, {from: adminAddress})
        assert.equal(0, await getLiquidityLockDivisor())

        await this.sav3Token.setLiquidityRewardsDivisor(2, {from: adminAddress})
        assert.equal(2, await getLiquidityRewardsDivisor())
        await this.sav3Token.setLiquidityRewardsDivisor(10, {from: adminAddress})
        assert.equal(10, await getLiquidityRewardsDivisor())
        await this.sav3Token.setLiquidityRewardsDivisor(0, {from: adminAddress})
        assert.equal(0, await getLiquidityRewardsDivisor())
    })

    it('should set uniswap values once', async () => {
        // non admin cannot set
        await expectRevert(
            this.sav3Token.setUniswapV2Router(user1Address, {from: user1Address}),
            'WhitelistAdminRole: caller does not have the WhitelistAdmin role',
        )
        await expectRevert(
            this.sav3Token.setUniswapV2Pair(user1Address, {from: user1Address}),
            'WhitelistAdminRole: caller does not have the WhitelistAdmin role',
        )

        // set it properly
        await this.sav3Token.setUniswapV2Router(user1Address, {from: adminAddress})
        await this.sav3Token.setUniswapV2Pair(user1Address, {from: adminAddress})

        // cannot set twice
        await expectRevert(
            this.sav3Token.setUniswapV2Router(user2Address, {from: adminAddress}),
            'Sav3Token::setUniswapV2Router: already set',
        )
        await expectRevert(
            this.sav3Token.setUniswapV2Pair(user2Address, {from: adminAddress}),
            'Sav3Token::setUniswapV2Pair: already set',
        )
    })

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.sav3Token.name()
        const symbol = await this.sav3Token.symbol()
        const decimals = await this.sav3Token.decimals()
        assert.equal(name.toString(), 'Sav3Token')
        assert.equal(symbol.toString(), 'SAV3')
        assert.equal(decimals.toString(), '18')
    })

    it('should only allow crowdsale to mint token and users to burn', async () => {
        await this.sav3Token.mint(adminAddress, '100', { from: crowdsaleContractAddress })
        await this.sav3Token.mint(user1Address, '1000', { from: crowdsaleContractAddress })
        await expectRevert(
            this.sav3Token.mint(user2Address, '1000', { from: user1Address }),
            'MinterRole: caller does not have the Minter role',
        )
        await expectRevert(
            this.sav3Token.mint(user2Address, '1000', { from: adminAddress }),
            'MinterRole: caller does not have the Minter role',
        )
        assert.equal('1100', await getTotalSupply())
        assert.equal('100', await getBalance(adminAddress))
        assert.equal('1000', await getBalance(user1Address))
        assert.equal('0', await getBalance(user2Address))

        // delegates update
        await this.sav3Token.delegate(adminAddress, {from: adminAddress})
        await this.sav3Token.delegate(user1Address, {from: user1Address})
        await this.sav3Token.delegate(user2Address, {from: user2Address})
        assert.equal('100', (await this.sav3Token.getCurrentVotes(adminAddress)).toString())
        assert.equal('1000', (await this.sav3Token.getCurrentVotes(user1Address)).toString())
        assert.equal('0', (await this.sav3Token.getCurrentVotes(user2Address)).toString())

        // can burn and update delegates
        await this.sav3Token.burn('100', { from: adminAddress })
        await this.sav3Token.burn('100', { from: user1Address })
        await expectRevert(
            this.sav3Token.burn('100', { from: user2Address }),
            'SafeMath: subtraction overflow',
        )
        assert.equal('900', await getTotalSupply())
        assert.equal('0', await getBalance(adminAddress))
        assert.equal('900', await getBalance(user1Address))
        assert.equal('0', await getBalance(user2Address))

        // delegates update
        assert.equal('0', (await this.sav3Token.getCurrentVotes(adminAddress)).toString())
        assert.equal('900', (await this.sav3Token.getCurrentVotes(user1Address)).toString())
        assert.equal('0', (await this.sav3Token.getCurrentVotes(user2Address)).toString())
    })

    it('should supply token transfers properly with no liquidity lock', async () => {
        // default liquidity lock divisor is 0
        assert.equal(0, await getLiquidityLockDivisor())
        await this.sav3Token.mint(adminAddress, 10000, { from: crowdsaleContractAddress })
        await this.sav3Token.mint(user1Address, 10000, { from: crowdsaleContractAddress })
        await this.sav3Token.transfer(user2Address, 1000, { from: adminAddress })
        await this.sav3Token.transfer(user2Address, 10000, { from: user1Address })
        assert.equal(20000, await getTotalSupply())
        assert.equal(9000, await getBalance(adminAddress))
        assert.equal(0, await getBalance(user1Address))
        assert.equal(11000, await getBalance(user2Address))
    })

    it('should supply token transfers properly with liquidity lock', async () => {
        await this.sav3Token.setLiquidityLockDivisor(10, {from: adminAddress})
        assert.equal(10, await getLiquidityLockDivisor())
        await this.sav3Token.mint(adminAddress, 10000, { from: crowdsaleContractAddress })
        await this.sav3Token.mint(user1Address, 10000, { from: crowdsaleContractAddress })
 
        await this.sav3Token.transfer(user2Address, 1000, { from: adminAddress })
        assert.equal(900, await getBalance(user2Address))
        await this.sav3Token.transfer(user2Address, 10000, { from: user1Address })
        assert.equal(9900, await getBalance(user2Address))

        assert.equal(20000, await getTotalSupply())
        assert.equal(9000, await getBalance(adminAddress))
        assert.equal(0, await getBalance(user1Address))
    })

    it('should handle micro transfers locks and delegate', async () => {
        await this.sav3Token.setLiquidityLockDivisor(100, {from: adminAddress})
        assert.equal(100, await getLiquidityLockDivisor())

        // no lock, too small
        await this.sav3Token.mint(adminAddress, '1', { from: crowdsaleContractAddress })
        await this.sav3Token.transfer(user1Address, '1', { from: adminAddress })
        assert.equal((await this.sav3Token.balanceOf(user1Address)).toString(), '1')
        assert.equal((await this.sav3Token.balanceOf(adminAddress)).toString(), '0')
        assert.equal((await this.sav3Token.totalSupply()).toString(), '1')

        // try delegating
        await this.sav3Token.delegate(user2Address, {from: user1Address})
        assert.equal((await this.sav3Token.getCurrentVotes(user2Address)).toString(), '1')

        // no lock, too small
        await this.sav3Token.mint(adminAddress, '10', { from: crowdsaleContractAddress })
        await this.sav3Token.transfer(user1Address, '10', { from: adminAddress })
        assert.equal((await this.sav3Token.balanceOf(user1Address)).toString(), '11')
        assert.equal((await this.sav3Token.balanceOf(adminAddress)).toString(), '0')
        assert.equal((await this.sav3Token.totalSupply()).toString(), '11')

        // delegating had updated
        assert.equal((await this.sav3Token.getCurrentVotes(user2Address)).toString(), '11')

        await this.sav3Token.mint(adminAddress, '100', { from: crowdsaleContractAddress })
        await this.sav3Token.transfer(user1Address, '100', { from: adminAddress })
        assert.equal((await this.sav3Token.balanceOf(user1Address)).toString(), '110')
        assert.equal((await this.sav3Token.balanceOf(adminAddress)).toString(), '0')
        assert.equal((await this.sav3Token.totalSupply()).toString(), '111')

        // delegating had updated
        assert.equal((await this.sav3Token.getCurrentVotes(user2Address)).toString(), '110')

        await this.sav3Token.mint(adminAddress, '1000', { from: crowdsaleContractAddress })
        await this.sav3Token.transfer(user1Address, '1000', { from: adminAddress })
        assert.equal((await this.sav3Token.balanceOf(user1Address)).toString(), '1100')
        assert.equal((await this.sav3Token.balanceOf(adminAddress)).toString(), '0')
        assert.equal((await this.sav3Token.totalSupply()).toString(), '1111')

        // delegating had updated
        assert.equal((await this.sav3Token.getCurrentVotes(user2Address)).toString(), '1100')

        await this.sav3Token.mint(adminAddress, '10000', { from: crowdsaleContractAddress })
        await this.sav3Token.transfer(user1Address, '10000', { from: adminAddress })
        assert.equal((await this.sav3Token.balanceOf(user1Address)).toString(), '11000')
        assert.equal((await this.sav3Token.balanceOf(adminAddress)).toString(), '0')
        assert.equal((await this.sav3Token.totalSupply()).toString(), '11111')

        // delegating had updated
        assert.equal((await this.sav3Token.getCurrentVotes(user2Address)).toString(), '11000')
    })

    it('should fail if you try to do bad transfers', async () => {
        await this.sav3Token.setLiquidityLockDivisor(100, {from: adminAddress})
        assert.equal(100, await getLiquidityLockDivisor())

        await this.sav3Token.mint(adminAddress, '100', { from: crowdsaleContractAddress })
        await expectRevert(
            this.sav3Token.transfer(user2Address, '110', { from: adminAddress }),
            'ERC20: transfer amount exceeds balance',
        )
        await expectRevert(
            this.sav3Token.transfer(user2Address, '1', { from: user1Address }),
            'ERC20: transfer amount exceeds balance',
        )
    })

    // https://medium.com/bulldax-finance/sushiswap-delegation-double-spending-bug-5adcc7b3830f
    it('should fix delegate transfer bug', async () => {
        await this.sav3Token.setLiquidityLockDivisor(100, {from: adminAddress})
        assert.equal(100, await getLiquidityLockDivisor())

        await this.sav3Token.mint(adminAddress, '1000000', { from: crowdsaleContractAddress })
        await this.sav3Token.delegate(user3Address, {from: adminAddress})
        await this.sav3Token.transfer(user1Address, '1000000', {from: adminAddress} )
        await this.sav3Token.delegate(user3Address, {from: user1Address})
        await this.sav3Token.transfer(user2Address, '990000', {from: user1Address} )
        await this.sav3Token.delegate(user3Address, {from: user2Address})
        await this.sav3Token.transfer(adminAddress, '980100', {from: user2Address} )
        assert.equal((await this.sav3Token.totalSupply()).toString(), '1000000')
        assert.equal((await this.sav3Token.getCurrentVotes(user3Address)).toString(), '970299')
        assert.equal((await this.sav3Token.getCurrentVotes(adminAddress)).toString(), '0')
        assert.equal((await this.sav3Token.getCurrentVotes(user1Address)).toString(), '0')
        assert.equal((await this.sav3Token.getCurrentVotes(user2Address)).toString(), '0')
    })
})
