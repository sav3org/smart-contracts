pragma solidity ^0.5.0;

import "@openzeppelin/contracts/crowdsale/Crowdsale.sol";

// custom validation using the whitelister contract

contract WhitelistCrowdsale is Crowdsale {
    address public whitelister;

    constructor(address _whitelister) public {
        whitelister = _whitelister;
    }

    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal view {
        require(IWhitelister(whitelister).whitelisted(_beneficiary) == true, "WhitelistCrowdsale: beneficiary not whitelisted");
        super._preValidatePurchase(_beneficiary, _weiAmount);
    }

    function isWhitelisted(address _address) external view returns (bool) {
    	return IWhitelister(whitelister).whitelisted(_address);
    }
}

interface IWhitelister {
    function whitelisted(address _address) external view returns (bool);
}
