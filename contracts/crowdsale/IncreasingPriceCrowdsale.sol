pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/crowdsale/validation/TimedCrowdsale.sol";

/**
 * @title IncreasingPriceCrowdsale
 * @dev Extension of Crowdsale contract that increases the price of tokens linearly in time.
 * Note that what should be provided to the constructor is the initial and final _rates_, that is,
 * the amount of tokens per wei contributed. Thus, the initial rate must be greater than the final rate.
 */
contract IncreasingPriceCrowdsale is TimedCrowdsale {
    using SafeMath for uint256;

    // uint256 private _initialRate;
    uint256 private _finalRate;

    address public referrers;

    /**
     * @dev Constructor, takes initial and final rates of tokens received per wei contributed.
     * @param finalRate Number of tokens a buyer gets per wei at the end of the crowdsale
     */
    constructor (uint256 finalRate, address _referrers) public {
        require(finalRate > 0, "IncreasingPriceCrowdsale: final rate is 0");
        // solhint-disable-next-line max-line-length
        _finalRate = finalRate;
        referrers = _referrers;
    }

    function isReferrer(address _address) public view returns (bool) {
        if (referrers == address(0)) {
            return false;
        }
        return IReferrers(referrers).isReferrer(_address);
    }

    /**
     * The base rate function is overridden to revert, since this crowdsale doesn't use it, and
     * all calls to it are a mistake.
     */
    function rate() public view returns (uint256) {
        revert("IncreasingPriceCrowdsale: rate() called");
    }


    // function initialRate() public view returns (uint256) {
    //     return _initialRate;
    // }

    /**
     * @return the final rate of the crowdsale.
     */
    function finalRate() public view returns (uint256) {
        return _finalRate;
    }

    /**
     * @dev Returns the rate of tokens per wei at the present time.
     * Note that, as price _increases_ with time, the rate _decreases_.
     * @return The number of tokens a buyer gets per wei at a given time
     */
    function getCurrentRate() public view returns (uint256) {
        if (!isOpen()) {
            return 0;
        }

        uint256 _weiRaised = weiRaised();
        uint256 _rate = _finalRate;

        if (isReferrer(msg.sender)) {
            _rate = _rate.mul(125).div(100);
        }

        if (_weiRaised < 15e18) {
            return _rate.mul(250).div(100);
        }
        if (_weiRaised < 30e18) {
            return _rate.mul(200).div(100);
        }
        if (_weiRaised < 45e18) {
            return _rate.mul(175).div(100);
        }
        if (_weiRaised < 75e18) {
            return _rate.mul(150).div(100);
        }
        if (_weiRaised < 105e18) {
            return _rate.mul(120).div(100);
        }
        if (_weiRaised < 135e18) {
            return _rate.mul(110).div(100);
        }
        if (_weiRaised < 165e18) {
            return _rate.mul(105).div(100);
        }
        return _rate;
    }

    /**
     * @dev Overrides parent method taking into account variable rate.
     * @param weiAmount The value in wei to be converted into tokens
     * @return The number of tokens _weiAmount wei will buy at present time
     */
    function _getTokenAmount(uint256 weiAmount) internal view returns (uint256) {
        uint256 currentRate = getCurrentRate();
        return currentRate.mul(weiAmount);
    }
}

interface IReferrers {
    function isReferrer(address _address) external view returns (bool);
}
