pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "./TokenTimelock.sol";

contract TreasuryCrowdsale is FinalizableCrowdsale {
    using SafeMath for uint256;

    TokenTimelock public treasuryTimelock;

    // mint treasury supply a single time after finalization (~3% unlocked, ~20% locked for 5 years)
    function _finalization() internal {
        uint256 treasuryAmountUnlocked = token().totalSupply().mul(4).div(100);
        uint256 treasuryAmountLocked = token().totalSupply().mul(25).div(100);
        treasuryTimelock = new TokenTimelock(
            token(),
            wallet(),
            block.timestamp.add(60 * 60 * 24 * 365 * 5), // 5 years
            treasuryAmountLocked
        );
        ERC20Mintable(address(token())).mint(wallet(), treasuryAmountUnlocked);
        ERC20Mintable(address(token())).mint(address(treasuryTimelock), treasuryAmountLocked);
        super._finalization();
    }
}
