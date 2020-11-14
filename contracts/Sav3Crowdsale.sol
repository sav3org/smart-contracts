pragma solidity ^0.5.17;

import "@openzeppelin/contracts/crowdsale/Crowdsale.sol";
import "@openzeppelin/contracts/crowdsale/distribution/PostDeliveryCrowdsale.sol";
import "@openzeppelin/contracts/crowdsale/emission/MintedCrowdsale.sol";
import "@openzeppelin/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "./crowdsale/WhitelistCrowdsale.sol";
import "./crowdsale/IndividuallyCappedCrowdsale.sol";
import "./crowdsale/IncreasingPriceCrowdsale.sol";
import "./crowdsale/TreasuryCrowdsale.sol";

contract Sav3Crowdsale is 
    Crowdsale, 
    MintedCrowdsale, 
    WhitelistCrowdsale, 
    TimedCrowdsale, 
    PostDeliveryCrowdsale, 
    IndividuallyCappedCrowdsale, 
    IncreasingPriceCrowdsale,
    TreasuryCrowdsale
{
    uint256 private _finalRate = 10000;
    uint256 private _individualCap = 3e18;
    constructor(
        address payable crowdsaleWallet, 
        IERC20 token,
        uint256 openingTime, 
        uint256 closingTime, 
        address whitelister,
        address referrers
    )
        TreasuryCrowdsale()
        WhitelistCrowdsale(whitelister)
        IncreasingPriceCrowdsale(_finalRate, referrers)
        PostDeliveryCrowdsale()
        TimedCrowdsale(openingTime, closingTime)
        IndividuallyCappedCrowdsale(_individualCap)
        MintedCrowdsale()
        Crowdsale(_finalRate, crowdsaleWallet, token)
        public
    {}
}
