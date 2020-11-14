const { expectRevert, time } = require('@openzeppelin/test-helpers')
const Sav3Crowdsale = artifacts.require('Sav3Crowdsale')
const Sav3Token = artifacts.require('Sav3Token')
const Whitelister = artifacts.require('Whitelister')
const TokenTimelock = artifacts.require('TokenTimelock')
const Referrers = artifacts.require('Referrers')

const DAY = 60 * 60 * 24

const getBalance = async (address) => {
    return (await this.sav3Token.balanceOf(address)).toString()
}

const getTotalSupply = async () => {
    return (await this.sav3Token.totalSupply()).toString()
}

const getContribution = async (address) => {
    return (await this.sav3Crowdsale.getContribution(address)).toString()
}

const getCrowdsaleBalance = async (address) => {
    return (await this.sav3Crowdsale.balanceOf(address)).toString()
}

const buyToRandomAddresses = async (addressCount = 0) => {
    while (addressCount--) {
        const address = getRandomAddress()
        await this.whitelister.whitelist([address], {from: this.deployerAddress})
        await this.sav3Crowdsale.buyTokens(address, {value: 3e18})
    }
}

const getRandomAddress = () => {
    const chars = [1,2,3,4,5,6,7,8,9,0,'a','b','c','d','e','f']
    let address = '0x'
    while (address.length < 42) {
        address += chars[Math.floor(chars.length * Math.random())]
    }
    return address
}

contract('Sav3Crowdsale', ([_, deployerAddress, crowdsaleWallet, user1Address, user2Address, user3Address, user4Address, user5Address, user6Address]) => {
    beforeEach(async () => {
        this.deployerAddress = deployerAddress

        this.sav3Token = await Sav3Token.new({from: deployerAddress})
        await this.sav3Token.addWhitelistAdmin(crowdsaleWallet, {from: deployerAddress})

        this.whitelister = await Whitelister.new({from: deployerAddress})
        this.referrers = await Referrers.new({from: deployerAddress})

        this.startTime = Number((await time.latest()).toString()) + 60
        this.endTime = this.startTime + (60 * 60 * 24 * 5)
        this.sav3Crowdsale = await Sav3Crowdsale.new(
            crowdsaleWallet,
            this.sav3Token.address,
            this.startTime,
            this.endTime,
            this.whitelister.address,
            this.referrers.address,
            {from: deployerAddress}
        )
        await this.sav3Token.addMinter(this.sav3Crowdsale.address, {from: deployerAddress})
        await this.sav3Token.renounceMinter({from: deployerAddress})
    })

    it('whitelister', async () => {
        assert.equal(false, await this.whitelister.whitelisted(user1Address))
        assert.equal(false, await this.whitelister.whitelisted(user2Address))
        assert.equal(false, await this.whitelister.whitelisted(user3Address))
        await expectRevert(
            this.whitelister.whitelist([user1Address, user2Address, user3Address], {from: user1Address}), 
            'WhitelistAdminRole: caller does not have the WhitelistAdmin role'
        )
        await this.whitelister.whitelist([user1Address, user2Address, user3Address], {from: deployerAddress})
        assert.equal(true, await this.whitelister.whitelisted(user1Address))
        assert.equal(true, await this.whitelister.whitelisted(user2Address))
        assert.equal(true, await this.whitelister.whitelisted(user3Address))

        await expectRevert(
            this.whitelister.unwhitelist([user2Address, user3Address], {from: user1Address}), 
            'WhitelistAdminRole: caller does not have the WhitelistAdmin role'
        )
        await this.whitelister.unwhitelist([user2Address, user3Address], {from: deployerAddress})
        assert.equal(true, await this.whitelister.whitelisted(user1Address))
        assert.equal(false, await this.whitelister.whitelisted(user2Address))
        assert.equal(false, await this.whitelister.whitelisted(user3Address))

        // test helper method
        assert.equal(true, await this.sav3Crowdsale.isWhitelisted(user1Address))
        assert.equal(false, await this.sav3Crowdsale.isWhitelisted(user2Address))
    })

    it('referrers', async () => {
        assert.equal(false, await this.referrers.isReferrer(user1Address))
        assert.equal(false, await this.referrers.isReferrer(user2Address))
        assert.equal(false, await this.referrers.isReferrer(user3Address))
        await expectRevert(
            this.referrers.addReferrers([user1Address, user2Address, user3Address], {from: user1Address}), 
            'WhitelistAdminRole: caller does not have the WhitelistAdmin role'
        )
        await this.referrers.addReferrers([user1Address, user2Address, user3Address], {from: deployerAddress})
        assert.equal(true, await this.referrers.isReferrer(user1Address))
        assert.equal(true, await this.referrers.isReferrer(user2Address))
        assert.equal(true, await this.referrers.isReferrer(user3Address))

        await expectRevert(
            this.referrers.removeReferrers([user2Address, user3Address], {from: user1Address}), 
            'WhitelistAdminRole: caller does not have the WhitelistAdmin role'
        )
        await this.referrers.removeReferrers([user2Address, user3Address], {from: deployerAddress})
        assert.equal(true, await this.referrers.isReferrer(user1Address))
        assert.equal(false, await this.referrers.isReferrer(user2Address))
        assert.equal(false, await this.referrers.isReferrer(user3Address))

        // test helper method
        assert.equal(true, await this.sav3Crowdsale.isReferrer(user1Address))
        assert.equal(false, await this.sav3Crowdsale.isReferrer(user2Address))
    })

    it('send', async () => {
        // not started yet
        await expectRevert(
            this.sav3Crowdsale.send(1e18, { from: user1Address }), 
            'TimedCrowdsale: not open'
        )
        await time.increaseTo(this.startTime)

        // not whitelisted
        await expectRevert(
            this.sav3Crowdsale.send(1e18, { from: user1Address }), 
            'WhitelistCrowdsale: beneficiary not whitelisted'
        )
        await this.whitelister.whitelist([user1Address, user2Address, user3Address], {from: deployerAddress})

        // exceeds cap
        await expectRevert(
            this.sav3Crowdsale.send(4e18, { from: user1Address }), 
            `IndividuallyCappedCrowdsale: beneficiary's cap exceeded`
        )
        await this.sav3Crowdsale.send(1e18, {from: user1Address})
        await this.sav3Crowdsale.send(1e18, {from: user1Address})
        await this.sav3Crowdsale.send(1e18, {from: user1Address})
        assert.equal(await getBalance(user1Address), 0)
        await expectRevert(
            this.sav3Crowdsale.send(1e18, { from: user1Address }), 
            `IndividuallyCappedCrowdsale: beneficiary's cap exceeded`
        )
        await this.sav3Crowdsale.send(3e18, {from: user2Address})
        assert.equal(await getBalance(user2Address), 0)

        // cannot withdraw before sale is over
        await expectRevert(
            this.sav3Crowdsale.withdrawTokens(user1Address), 
            `PostDeliveryCrowdsale: not closed`
        )

        // sale ended
        await time.increaseTo(this.endTime + 60)
        await expectRevert(
            this.sav3Crowdsale.send(3e18, {from: user3Address}), 
            `TimedCrowdsale: not open`
        )

        // can withdraw after sale has ended
        await this.sav3Crowdsale.withdrawTokens(user1Address)
        assert.notEqual(await getBalance(user1Address), 0)
        await this.sav3Crowdsale.withdrawTokens(user2Address)
        assert.notEqual(await getBalance(user2Address), 0)
    })

    it('buyTokens', async () =>  {
        // not started yet
        await expectRevert(
            this.sav3Crowdsale.buyTokens(user1Address, { value: 1e18, from: user1Address }), 
            'TimedCrowdsale: not open'
        )
        await time.increaseTo(this.startTime)

        // not whitelisted
        await expectRevert(
            this.sav3Crowdsale.buyTokens(user1Address, { value: 1e18, from: user1Address }), 
            'WhitelistCrowdsale: beneficiary not whitelisted'
        )
        await this.whitelister.whitelist([user1Address, user2Address, user3Address], {from: deployerAddress})

        // exceeds cap
        await expectRevert(
            this.sav3Crowdsale.buyTokens(user1Address, { value: 4e18, from: user1Address }), 
            `IndividuallyCappedCrowdsale: beneficiary's cap exceeded`
        )
        await this.sav3Crowdsale.buyTokens(user1Address, { value: 1e18, from: user1Address })
        await this.sav3Crowdsale.buyTokens(user1Address, { value: 1e18, from: user1Address })
        await this.sav3Crowdsale.buyTokens(user1Address, { value: 1e18, from: user1Address })
        assert.equal(await getBalance(user1Address), 0)
        await expectRevert(
            this.sav3Crowdsale.buyTokens(user1Address, { value: 1e18, from: user1Address }), 
            `IndividuallyCappedCrowdsale: beneficiary's cap exceeded`
        )
        await this.sav3Crowdsale.buyTokens(user2Address, { value: 3e18, from: user2Address })
        assert.equal(await getBalance(user2Address), 0)

        // cannot withdraw before sale is over
        await expectRevert(
            this.sav3Crowdsale.withdrawTokens(user1Address), 
            `PostDeliveryCrowdsale: not closed`
        )

        // sale ended
        await time.increaseTo(this.endTime + 60)
        await expectRevert(
            this.sav3Crowdsale.buyTokens(user1Address, { value: 3e18, from: user3Address }), 
            `TimedCrowdsale: not open`
        )

        // can withdraw after sale has ended
        await this.sav3Crowdsale.withdrawTokens(user1Address)
        assert.notEqual(await getBalance(user1Address), 0)
        await this.sav3Crowdsale.withdrawTokens(user2Address)
        assert.notEqual(await getBalance(user2Address), 0)
    })

    it('bonding curve and referrers', async () => {
        await time.increaseTo(this.startTime)
        await this.whitelister.whitelist([user1Address, user2Address, user3Address, user4Address, user5Address, user6Address], {from: deployerAddress})
        await this.referrers.addReferrers([user1Address], {from: deployerAddress})
        await this.sav3Crowdsale.buyTokens(user1Address, { value: 3e18, from: user1Address })
        await this.sav3Crowdsale.buyTokens(user2Address, { value: 3e18, from: user2Address })
        await buyToRandomAddresses(4)
        await this.sav3Crowdsale.buyTokens(user3Address, { value: 3e18, from: user2Address })
        await buyToRandomAddresses(5)
        await this.sav3Crowdsale.buyTokens(user4Address, { value: 3e18, from: user3Address })
        await buyToRandomAddresses(5)
        await this.sav3Crowdsale.buyTokens(user5Address, { value: 3e18, from: user4Address })
        await buyToRandomAddresses(10)
        await this.sav3Crowdsale.buyTokens(user6Address, { value: 3e18, from: user5Address })

        // referrer
        assert.equal('93750000000000000000000', await getCrowdsaleBalance(user1Address))
        // non referrers
        assert.equal('75000000000000000000000', await getCrowdsaleBalance(user2Address))
        assert.equal('60000000000000000000000', await getCrowdsaleBalance(user3Address))
        assert.equal('52500000000000000000000', await getCrowdsaleBalance(user4Address))
        assert.equal('45000000000000000000000', await getCrowdsaleBalance(user5Address))
        assert.equal('36000000000000000000000', await getCrowdsaleBalance(user6Address))
    
        await time.increaseTo(this.endTime + 60)
        await this.sav3Crowdsale.withdrawTokens(user1Address)
        await this.sav3Crowdsale.withdrawTokens(user2Address)
        await this.sav3Crowdsale.withdrawTokens(user3Address)
        await this.sav3Crowdsale.withdrawTokens(user4Address)
        await this.sav3Crowdsale.withdrawTokens(user5Address)
        await this.sav3Crowdsale.withdrawTokens(user6Address)

        // referrer
        assert.equal('93750000000000000000000', await getBalance(user1Address))
        // non referrers
        assert.equal('75000000000000000000000', await getBalance(user2Address))
        assert.equal('60000000000000000000000', await getBalance(user3Address))
        assert.equal('52500000000000000000000', await getBalance(user4Address))
        assert.equal('45000000000000000000000', await getBalance(user5Address))
        assert.equal('36000000000000000000000', await getBalance(user6Address))

        // treasury has correct amount
        assert.equal(0, await getBalance(crowdsaleWallet))
        await this.sav3Crowdsale.finalize()
        const treasuryTimelock = await TokenTimelock.at(await this.sav3Crowdsale.treasuryTimelock())
        assert.equal('63450000000000000000000', await getBalance(crowdsaleWallet))
        assert.equal('396562500000000000000000', await getBalance(treasuryTimelock.address))
        assert.equal('2046262500000000000000000', await getTotalSupply())

        // treasury funds are timelocked
        await time.increase(60 * 5)
        assert.equal(0, (await treasuryTimelock.releasable()).toString())

        await time.increase(DAY)
        assert.equal(0, (await treasuryTimelock.releasable()).toString())

        await time.increase(14 * DAY)
        assert.equal(0, (await treasuryTimelock.releasable()).toString())

        await expectRevert(
            treasuryTimelock.release(), 
            'TokenTimelock: no tokens to release'
        )

        await time.increase(15 * DAY)
        assert.equal('3965625000000000000000', (await treasuryTimelock.releasable()).toString())

        // try release
        assert.equal('63450000000000000000000', await getBalance(crowdsaleWallet))
        await treasuryTimelock.release()
        assert.equal('67415625000000000000000', await getBalance(crowdsaleWallet))
        assert.equal('0', (await treasuryTimelock.releasable()).toString())
        await expectRevert(
            treasuryTimelock.release(), 
            'TokenTimelock: no tokens to release'
        )

        await time.increase(70 * DAY)
        assert.equal('15862500000000000000000', (await treasuryTimelock.releasable()).toString())

        await time.increase(100 * DAY)
        assert.equal('35690625000000000000000', (await treasuryTimelock.releasable()).toString())

        await time.increase(165 * DAY)
        assert.equal('75346875000000000000000', (await treasuryTimelock.releasable()).toString())

        // try release
        assert.equal('67415625000000000000000', await getBalance(crowdsaleWallet))
        await treasuryTimelock.release()
        assert.equal('142762500000000000000000', await getBalance(crowdsaleWallet))
        assert.equal('0', (await treasuryTimelock.releasable()).toString())
        await expectRevert(
            treasuryTimelock.release(), 
            'TokenTimelock: no tokens to release'
        )

        await time.increase(4 * 365 * DAY)
        assert.equal('317250000000000000000000', (await treasuryTimelock.releasable()).toString())

        await time.increase(5 * 365 * DAY)
        assert.equal('317250000000000000000000', (await treasuryTimelock.releasable()).toString())
   })
})
