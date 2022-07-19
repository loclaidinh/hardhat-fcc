const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts } = require("hardhat")

describe("FundMe", async function () {
    let fundMe
    let deployer
    let mockV3Aggregator
    const sendValue = ethers.utils.parseEther("1") // 1ETH
    beforeEach(async () => {
        // const accounts = await ethers.getSigners()
        // deployer = accounts[0]
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        fundMe = await ethers.getContract("FundMe", deployer)
        mockV3Aggregator = await ethers.getContract(
            "MockV3Aggregator",
            deployer
        )
    })

    describe("constructor", async function () {
        it("Set the aggregator address correctly", async function () {
            const respond = await fundMe.priceFeed()
            assert.equal(respond, mockV3Aggregator.address)
        })
    })

    describe("fund", async function () {
        it("Fails if you dont send enough ETH", async function () {
            await expect(fundMe.fund()).to.be.revertedWith(
                "You need to spend more ETH!"
            )
        })

        it("updated the amount funded data structure", async function () {
            await fundMe.fund({ value: sendValue })
            const respond = await fundMe.addressToAmountFunded(deployer)
            // console.log(`address to amount respond ${respond}`)
            assert.equal(respond.toString(), sendValue.toString())
        })

        it("Add funder to fund of array", async function () {
            await fundMe.fund({ value: sendValue })
            const funder = await fundMe.funders(0)
            assert.equal(funder, deployer)
        })
    })

    describe("withdraw", async function () {
        beforeEach(async function () {
            await fundMe.fund({ value: sendValue })
        })

        it("withdraw ETH from single funder", async function () {
            // Arrange
            const startingFundMeBalance = await ethers.provider.getBalance(
                fundMe.address
            )
            const startingFounderBalance = await ethers.provider.getBalance(
                deployer
            )

            //Actions
            const respondtransaction = await fundMe.withdraw()
            const transactionReceipt = await respondtransaction.wait(1)
            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const endingFundMeBalance = await ethers.provider.getBalance(
                fundMe.address
            )
            const endingFounderBalance = await ethers.provider.getBalance(
                deployer
            )

            // Assert
            assert.equal(endingFundMeBalance, 0)
            assert.equal(
                startingFounderBalance.add(startingFundMeBalance).toString(),
                endingFounderBalance.add(gasCost).toString()
            )
            // console.log(ethers.utils.formatEther(endingFounderBalance))
        })

        it("allow us can withdraw from multiple funders", async function () {
            //arrange
            const accounts = await ethers.getSigners()
            for (let i = 1; i < 6; i++) {
                const fundMeConnectedContract = await fundMe.connect(
                    accounts[i]
                )
                await fundMeConnectedContract.fund({ value: sendValue })
            }

            const startingFundMeBalance = await ethers.provider.getBalance(
                fundMe.address
            )
            const startingFounderBalance = await ethers.provider.getBalance(
                deployer
            )
            //act
            const respondtransaction = await fundMe.withdraw()
            const transactionReceipt = await respondtransaction.wait(1)
            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const endingFundMeBalance = await ethers.provider.getBalance(
                fundMe.address
            )
            const endingFounderBalance = await ethers.provider.getBalance(
                deployer
            )

            //assert
            assert.equal(endingFundMeBalance, 0)
            assert.equal(
                startingFounderBalance.add(startingFundMeBalance).toString(),
                endingFounderBalance.add(gasCost).toString()
            )

            // make sure that funders array reset properly
            await expect(fundMe.funders(0)).to.be.reverted
            for (let i = 1; i < 6; i++) {
                assert.equal(
                    await fundMe.addressToAmountFunded(accounts[i].address),
                    0
                )
            }
        })

        it("only allow owner to withdraw", async function () {
            const accounts = await ethers.getSigners()
            const attacker = accounts[1]
            const attackerConnectedContract = await fundMe.connect(attacker)

            expect(attackerConnectedContract.withdraw()).to.be.revertedWith(
                "FundMe__NotOwner"
            )
        })
    })
})
